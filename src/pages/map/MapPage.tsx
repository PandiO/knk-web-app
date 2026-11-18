import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { mapClient } from '../../apiClients/mapClient';
import { useAuth } from '../../contexts/AuthContext';
import type { MapArenaDto, MapConfigDto, MapMarkersDto } from '../../types/dtos/map/MapDtos';
import { BlueMapFrame, BlueMapFrameHandle } from '../../components/map/BlueMapFrame';
import { MapToPageMessage, pageMessage, regionKey } from '../../components/map/bridgeProtocol';
import { MapActionRegistry, mapActionRegistry } from '../../components/map/mapActionRegistry';
import { toBridgeMarkers, townRegionKeys } from '../../components/map/mapMarkers';
import { MapPanel, MapSelection } from '../../components/map/MapPanel';
import { toBridgePlayers } from '../../components/map/mapPlayers';
import { MapPlayerPanel } from '../../components/map/PlayerCard';
import { PlayerModerationPanel } from '../../components/map/PlayerModerationPanel';
import { useLivePlayers } from '../../components/map/useLivePlayers';
import { useMapAvailability } from '../../components/map/useMapAvailability';

/** How often the page asks for the marker version (§ 5 rule 2: reload the markers when it changes). */
export const MARKER_VERSION_POLL_MS = 60_000;
/** The bridge's region group of the town toggle: one town (with its districts) at a time (O05). */
const TOWN_TOGGLE_GROUP = 'town-toggle';
const NO_ARENAS: MapArenaDto[] = [];

/**
 * The public overview map, `/map` (PandiO/knk-workspace#737; OVERVIEW_MAP_DESIGN § 4, § 5 rules 2–5, 13–15).
 * Without the API's `Map:Enabled` it only says the map is not available (O27).
 */
export const MapPage: React.FC<{ registry?: MapActionRegistry }> = ({ registry = mapActionRegistry }) => {
  const availability = useMapAvailability();
  if (availability.status === 'checking') {
    return <p className="text-sm text-muted" role="status">Loading the map…</p>;
  }
  if (availability.status === 'off') {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Map</h1>
        <p className="text-muted">The map is not available.</p>
        <Link to="/" className="text-sm text-primary underline">Back to the start page</Link>
      </div>
    );
  }
  return <MapView initialConfig={availability.config} registry={registry} />;
};

const MapView: React.FC<{ initialConfig: MapConfigDto; registry: MapActionRegistry }> = ({ initialConfig, registry }) => {
  const { isLoggedIn } = useAuth();
  const frameRef = useRef<BlueMapFrameHandle>(null);
  const [config, setConfig] = useState(initialConfig);
  const [markers, setMarkers] = useState<MapMarkersDto | null>(null);
  const [markersFailed, setMarkersFailed] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(0);
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [toggledTownId, setToggledTownId] = useState<number | null>(null);
  /** A clicked live player (#739): the name card; one panel at a time, so it replaces a place's panel. */
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  // Live players (#739, O21): polled only while the API's Map:LivePlayers:Enabled is on (O27).
  const livePlayers = useLivePlayers(config.livePlayers);

  // Markers: once per page view and whenever the marker version changes.
  useEffect(() => {
    let cancelled = false;
    mapClient.getMarkers().then(
      result => { if (!cancelled) { setMarkers(result); setMarkersFailed(false); } },
      () => { if (!cancelled) setMarkersFailed(true); },
    );
    return () => { cancelled = true; };
  }, [config.markerVersion]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      mapClient.getConfig().then(
        next => setConfig(previous => (next && next.markerVersion !== previous.markerVersion ? next : previous)),
        () => { /* keep the markers we have */ },
      );
    }, MARKER_VERSION_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Arena pins come with every players poll; the pins are only sent again when the arenas actually change.
  const arenasKey = JSON.stringify(livePlayers?.arenas ?? NO_ARENAS);
  const arenas = useMemo<MapArenaDto[]>(() => JSON.parse(arenasKey), [arenasKey]);
  const bridgeMarkers = useMemo(
    () => (markers ? toBridgeMarkers(markers, config.labels, arenas) : null),
    [markers, config.labels, arenas],
  );
  const regionKeys = useMemo(() => new Set(bridgeMarkers?.regions.map(region => region.key) ?? []), [bridgeMarkers]);

  useEffect(() => {
    if (bridgeReady > 0 && bridgeMarkers) frameRef.current?.send(pageMessage('setMarkers', bridgeMarkers));
  }, [bridgeReady, bridgeMarkers]);

  // Players: every poll, and again whenever the bridge (re)starts. Nothing is sent while the flag is off.
  const bridgePlayers = useMemo(() => (livePlayers ? toBridgePlayers(livePlayers.players) : null), [livePlayers]);
  const playersSent = useRef(false);
  useEffect(() => {
    if (bridgeReady === 0) return;
    if (bridgePlayers) {
      frameRef.current?.send(pageMessage('setPlayers', { players: bridgePlayers }));
      playersSent.current = true;
    } else if (playersSent.current) {
      frameRef.current?.send(pageMessage('setPlayers', { players: [] }));
      playersSent.current = false;
    }
  }, [bridgeReady, bridgePlayers]);

  useEffect(() => {
    if (bridgeReady === 0) return;
    if (toggledTownId !== null && markers) {
      const keys = townRegionKeys(markers, toggledTownId).filter(key => regionKeys.has(key));
      frameRef.current?.send(pageMessage('showRegions', { group: TOWN_TOGGLE_GROUP, keys }));
    } else {
      frameRef.current?.send(pageMessage('hideRegions', { group: TOWN_TOGGLE_GROUP }));
    }
  }, [bridgeReady, toggledTownId, markers, regionKeys]);

  const onBridgeMessage = useCallback((message: MapToPageMessage) => {
    switch (message.type) {
      case 'ready':
        setBridgeReady(count => count + 1);
        break;
      case 'markerClicked': {
        const { kind, id } = message.payload;
        if (!registry.get(kind)) return;
        setSelectedPlayer(null);
        setSelection({ kind, id });
        if (kind === 'town' && regionKeys.has(regionKey('town', id))) {
          frameRef.current?.send(pageMessage('flashRegion', {
            key: regionKey('town', id),
            count: config.flash.count,
            durationMs: config.flash.durationMs,
          }));
        }
        break;
      }
      case 'playerClicked':
        // The name card (§ 4.4), with the player context panel (#743) below it for moderators.
        setSelection(null);
        setSelectedPlayer(message.payload.uuid);
        break;
      default:
        break; // cameraChanged: not used yet
    }
  }, [registry, regionKeys, config.flash.count, config.flash.durationMs]);

  const panelOpen = selection !== null || selectedPlayer !== null;
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSelection(null);
      setSelectedPlayer(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen]);

  const clickedPlayer = selectedPlayer
    ? livePlayers?.players.find(player => player.uuid === selectedPlayer) ?? null
    : null;

  const isTown = selection?.kind === 'town';
  const canShowRegion = !!selection && isTown && regionKeys.has(regionKey('town', selection.id));

  return (
    <div className={`fixed inset-x-0 bottom-0 ${isLoggedIn ? 'top-16' : 'top-0'} z-0 bg-canvas`}>
      <h1 className="sr-only">Map</h1>
      <BlueMapFrame ref={frameRef} onMessage={onBridgeMessage} className="h-full w-full border-0" />
      {markersFailed && (
        <div role="alert" className="absolute left-4 top-4 rounded-md bg-surface px-3 py-2 text-sm text-fg shadow">
          The map's places could not be loaded. Reload the page to try again.
        </div>
      )}
      {selection && (
        <MapPanel
          key={`${selection.kind}:${selection.id}`}
          registry={registry}
          selection={selection}
          regionShown={isTown && toggledTownId === selection.id}
          canShowRegion={canShowRegion}
          onRegionShownChange={shown => setToggledTownId(shown ? selection.id : null)}
          onClose={() => setSelection(null)}
        />
      )}
      {selectedPlayer && (
        <MapPlayerPanel key={selectedPlayer} player={clickedPlayer} onClose={() => setSelectedPlayer(null)}>
          {clickedPlayer && <PlayerModerationPanel player={clickedPlayer} />}
        </MapPlayerPanel>
      )}
    </div>
  );
};
