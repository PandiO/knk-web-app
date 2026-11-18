import type { Page } from '@playwright/test';
import type { MockApi } from '../support/mockApi';
import type {
  MapConfigDto,
  MapDistrictPanelDto,
  MapMarkersDto,
  MapStructurePanelDto,
  MapTownPanelDto,
} from '../../src/types/dtos/map/MapDtos';

/**
 * The public overview map (PandiO/knk-workspace#737): api/Map mocks and a fake BlueMap web app.
 *
 * The fake answers `/bluemap/` inside the iframe. It offers the slice of BlueMap v5.29's web app API the bridge uses
 * (`window.bluemap`, `window.BlueMap.MarkerSet`, the root marker set, `terrainHeightAt`, the controls manager) and then
 * loads the **real** `public/bluemap-bridge/bridge.js` from the build, so the specs run the actual bridge script. It
 * draws html markers as DOM elements (a click calls `elementObject.onClick`, as BlueMap's CSS2DObject does) and
 * extrude markers as `.fake-extrude` elements with their label, and records how often the flash group appeared.
 */

export const mapConfig: MapConfigDto = {
  enabled: true,
  markerVersion: 'v-one',
  labels: { town: null, district: 1500, structure: 600, arena: 1500 },
  flash: { count: 3, durationMs: 60 },
  livePlayers: { enabled: false, pollIntervalMs: 2000 },
  gateCommands: { enabled: false },
};

const square = (x: number, z: number, size: number): [number, number][] =>
  [[x, z], [x + size, z], [x + size, z + size], [x, z + size]];

export const mapMarkers: MapMarkersDto = {
  version: 'v-one',
  towns: [
    {
      id: 1, name: 'Aldmoor', pin: { world: 'world', x: 50.5, y: 70, z: 50.5, source: 'location' },
      outlines: [{ world: 'world', points: square(0, 0, 100), minY: 60, maxY: 120 }],
    },
    {
      id: 2, name: 'Brightwater', pin: { world: 'world', x: 1000.5, y: 64, z: 1000.5, source: 'location' },
      outlines: [{ world: 'world', points: square(950, 950, 100), minY: 60, maxY: 120 }],
    },
  ],
  districts: [
    {
      id: 4, townId: 1, name: 'Harbour', pin: { world: 'world', x: 25.5, y: null, z: 25.5, source: 'centroid' },
      outlines: [{ world: 'world', points: square(0, 0, 50), minY: 60, maxY: 100 }],
    },
    {
      id: 5, townId: 1, name: 'Old Market', pin: { world: 'world', x: 75.5, y: null, z: 75.5, source: 'centroid' },
      outlines: [{ world: 'world', points: square(50, 50, 50), minY: 60, maxY: 100 }],
    },
    {
      id: 6, townId: 2, name: 'Riverside', pin: { world: 'world', x: 975.5, y: null, z: 975.5, source: 'centroid' },
      outlines: [{ world: 'world', points: square(950, 950, 50), minY: 60, maxY: 100 }],
    },
  ],
  structures: [
    {
      id: 9, districtId: 4, townId: 1, name: 'North Gate', type: 'Structure', subtype: 'Gate', typeLabel: 'Structure, Gate',
      pin: { world: 'world', x: 10, y: 66, z: 10, source: 'location' }, outlines: [],
    },
    {
      id: 10, districtId: 5, townId: 1, name: 'Bakery', type: 'Structure', subtype: null, typeLabel: 'Structure',
      pin: { world: 'world', x: 80, y: 65, z: 80, source: 'location' }, outlines: [],
    },
    {
      id: 11, districtId: 6, townId: 2, name: 'Nether Hut', type: 'Structure', subtype: null, typeLabel: 'Structure',
      pin: { world: 'world_nether', x: 5, y: 40, z: 5, source: 'location' }, outlines: [],
    },
  ],
};

export const aldmoor: MapTownPanelDto = { id: 1, name: 'Aldmoor', description: 'A harbour town on the west coast.', districtCount: 2 };
export const harbour: MapDistrictPanelDto = { id: 4, name: 'Harbour', description: 'Ships and fish.', townName: 'Aldmoor' };
export const northGate: MapStructurePanelDto = {
  id: 9, name: 'North Gate', description: 'The main gate.', type: 'Structure', subtype: 'Gate',
  districtName: 'Harbour', townName: 'Aldmoor', streetName: 'Gate Road', houseNumber: 1,
  gate: {
    underSiege: false,
    doors: [
      { name: 'Left door', openState: 'open', isDestroyed: false, healthCurrent: 750, healthMax: 1000 },
      { name: 'Right door', openState: 'closed', isDestroyed: true, healthCurrent: 0, healthMax: 1000 },
    ],
  },
};

/** The map on: config, markers and the panels above. */
export function mockMapOn(api: MockApi, config: MapConfigDto = mapConfig, markers: MapMarkersDto = mapMarkers): void {
  api.json<MapConfigDto>('GET', 'Map/config', config);
  api.json<MapMarkersDto>('GET', 'Map/markers', markers);
  api.json<MapTownPanelDto>('GET', 'Map/towns/1', aldmoor);
  api.json<MapDistrictPanelDto>('GET', 'Map/districts/4', harbour);
  api.json<MapStructurePanelDto>('GET', 'Map/structures/9', northGate);
}

/** The API's Map:Enabled off: every api/Map route answers 404. */
export function mockMapOff(api: MockApi): void {
  api.on('GET', /^Map\//, { status: 404, body: { error: 'MapOff' } });
}

const FAKE_BLUEMAP = `<!doctype html>
<html><head><meta charset="utf-8"><title>Fake BlueMap</title>
<style>body{margin:0;font:12px sans-serif} .fake-html,.fake-extrude{display:inline-block;margin:4px;padding:4px;border:1px solid #999;vertical-align:top} .fake-html *{transform:none!important;margin:0!important;position:static!important}</style>
</head><body>
<div id="markers"></div>
<script>
(function () {
  var fake = { flashOn: 0, flashVisible: false, renders: 0, received: [] };
  window.__fake = fake;
  window.addEventListener('message', function (e) { fake.received.push(e.data && e.data.type); });

  function Marker(id, type) {
    this.isMarker = true;
    this.data = { id: id, type: type };
    this.markerData = null;
    if (type === 'html') this.elementObject = { onClick: function () { return false; } };
    else this.onClick = function () { return true; };
  }

  function MarkerSet(id) {
    this.isMarkerSet = true;
    this.data = { id: id, label: id, toggleable: true, defaultHide: false };
    this.markerSets = new Map();
    this.markers = new Map();
  }
  MarkerSet.prototype.add = function (o) { if (o.isMarkerSet) this.markerSets.set(o.data.id, o); render(); return this; };
  MarkerSet.prototype.remove = function (o) { if (o.isMarkerSet) this.markerSets.delete(o.data.id); render(); return this; };
  // As BlueMap's: keeps the sets in data or ignore, removes every other set.
  MarkerSet.prototype.updateMarkerSetsFromData = function (data, ignore) {
    var keep = new Set(Object.keys(data || {}).concat(ignore || []));
    var self = this;
    Array.from(this.markerSets.keys()).forEach(function (id) { if (!keep.has(id)) self.markerSets.delete(id); });
    render();
  };
  MarkerSet.prototype.updateMarkersFromData = function (data) {
    var self = this;
    var ids = Object.keys(data || {});
    ids.forEach(function (id) {
      var m = self.markers.get(id);
      if (!m || m.data.type !== data[id].type) { m = new Marker(id, data[id].type); self.markers.set(id, m); }
      m.markerData = data[id];
    });
    Array.from(this.markers.keys()).forEach(function (id) { if (ids.indexOf(id) < 0) self.markers.delete(id); });
    render();
  };

  var root = new MarkerSet('bm-root');
  var events = document.createElement('div');
  window.BlueMap = { MarkerSet: MarkerSet };
  window.bluemap = {
    events: events,
    mapsMap: new Map([['world', {}], ['world_nether', {}]]),
    switchMap: function (id) { window.bluemap.mapViewer.map.data.id = id; render(); return Promise.resolve(); },
    mapViewer: {
      markers: root,
      map: { data: { id: 'world' }, terrainHeightAt: function () { return 70; } },
      controlsManager: { position: { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } }, distance: 1000 }
    }
  };
  // BlueMap's NormalMarkerManager reloading live/markers.json (it keeps only the player and popup sets).
  fake.reloadMarkerFile = function () { root.updateMarkerSetsFromData({}, ['bm-players', 'bm-popup-set']); };

  function render() {
    fake.renders++;
    var box = document.getElementById('markers');
    if (!box) return;
    box.innerHTML = '';
    var flashNow = false;
    root.markerSets.forEach(function (set, setId) {
      set.markers.forEach(function (m, id) {
        var d = m.markerData || {};
        var el = document.createElement('div');
        el.setAttribute('data-set', setId);
        el.setAttribute('data-marker', id);
        if (m.data.type === 'html') {
          el.className = 'fake-html';
          el.innerHTML = d.html;
          el.setAttribute('data-max-distance', d.maxDistance === undefined ? 'none' : String(d.maxDistance));
          el.addEventListener('click', function (e) { m.elementObject.onClick({ event: e, data: { doubleTap: false } }); });
        } else {
          el.className = 'fake-extrude';
          el.textContent = d.label;
          if (id.indexOf('__flash__|') === 0) flashNow = true;
          el.addEventListener('click', function () { m.onClick({ data: { doubleTap: false } }); });
        }
        box.appendChild(el);
      });
    });
    if (flashNow && !fake.flashVisible) fake.flashOn++;
    fake.flashVisible = flashNow;
  }
})();
</script>
<script src="/bluemap-bridge/bridge.js"></script>
</body></html>`;

/** Serves the fake BlueMap web app under /bluemap/ (the real bridge script comes from the build). */
export async function serveFakeBlueMap(page: Page): Promise<void> {
  await page.route(url => url.pathname.startsWith('/bluemap/'), route =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FAKE_BLUEMAP }));
}
