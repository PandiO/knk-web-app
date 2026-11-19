/*
 * Knights and Kings overview map: the BlueMap bridge (PandiO/knk-workspace#737; OVERVIEW_MAP_DESIGN § 5 rule 14,
 * O14, O26).
 *
 * Loaded by BlueMap's own web app through `webapp.conf` `scripts: ["/bluemap-bridge/bridge.js"]` (deploy notes in
 * knk-workspace). Written against BlueMap v5.29's web app API: `window.bluemap` (BlueMapApp), `window.BlueMap` (the
 * module with MarkerSet), `bluemap.mapViewer.markers` (the root marker set), `bluemap.mapViewer.controlsManager`,
 * `map.terrainHeightAt(x, z)` and the `bluemapCameraMoved` / `bluemapMapChanged` events. Recheck this file on every
 * BlueMap upgrade.
 *
 * The bridge only draws and reports: pins with labels, region outlines (flash, show, hide), players, camera moves,
 * clicks. It knows nothing of panels or actions; those live in the page's mapActionRegistry. Messages are versioned
 * envelopes `{ v: 1, type, payload }`, accepted only from the parent page on this page's own origin. Keep the
 * constants below in step with knk-web-app `src/components/map/bridgeProtocol.ts`. Version 1 is frozen: new features
 * (the siege tactical map, #613) add new message types or a new version, never change a v1 message.
 *
 * Plain ES2017, no build step, no dependencies.
 */
(function () {
  'use strict';

  var PROTOCOL_VERSION = 1;
  var ORIGIN = window.location.origin;
  var SET_PINS = 'knk-pins';
  var SET_REGIONS = 'knk-regions';
  var SET_PLAYERS = 'knk-players';
  var OUR_SETS = [SET_PINS, SET_REGIONS, SET_PLAYERS];
  var FLASH_GROUP = '__flash__';
  var DEFAULT_Y = 64;
  var HEIGHT_RETRIES = 15;
  var HEIGHT_RETRY_MS = 2000;
  var CAMERA_THROTTLE_MS = 250;

  // The bridge's own query parameters in webapp.conf `scripts` (deploy notes).
  var PARAMS = (function () {
    try {
      var src = document.currentScript && document.currentScript.src;
      return src ? new URL(src, window.location.href).searchParams : null;
    } catch (e) {
      return null;
    }
  })();

  // Which game world each BlueMap map shows: `bridge.js?worlds=<mapId>:<world>,<mapId>:<world>` in webapp.conf
  // (deploy notes). A map id without an entry shows the world of the same name (case-insensitive).
  var MAP_WORLDS = (function () {
    var result = {};
    try {
      var param = PARAMS ? PARAMS.get('worlds') : null;
      (param || '').split(',').forEach(function (pair) {
        var index = pair.indexOf(':');
        if (index > 0) result[pair.slice(0, index).trim().toLowerCase()] = pair.slice(index + 1).trim().toLowerCase();
      });
    } catch (e) {
      // no mapping: map id = world name
    }
    return result;
  })();

  // Where a player's head image comes from (#739): `bridge.js?heads=<url with {uuid}>`, for example a skin service
  // (deploy notes: a third-party service sees the viewers' IP addresses). Without it, BlueMap's own default head
  // (`assets/steve.png`) for everyone. Characters that could leave the CSS url() are refused.
  var HEAD_TEMPLATE = (function () {
    var value = PARAMS ? PARAMS.get('heads') : null;
    if (!value || /['"()\\<>\s]/.test(value) || value.indexOf('{uuid}') < 0) return null;
    var scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(value);
    return scheme && !/^https?$/i.test(scheme[1]) ? null : value;
  })();
  var DEFAULT_HEAD = 'assets/steve.png';
  var UUID_PATTERN = /^[0-9a-fA-F-]{32,36}$/;
  var CSS_COLOR = /^#[0-9a-fA-F]{6}$/;
  var TAG_KINDS = ['afk', 'staff', 'owner', 'hidden', 'minigame'];
  var PLAYER_HEAD_HEIGHT = 1.8;

  var COLORS = {
    town: { line: { r: 250, g: 204, b: 21, a: 1 }, fill: { r: 250, g: 204, b: 21, a: 0.18 } },
    district: { line: { r: 56, g: 189, b: 248, a: 1 }, fill: { r: 56, g: 189, b: 248, a: 0.12 } },
    structure: { line: { r: 248, g: 113, b: 113, a: 1 }, fill: { r: 248, g: 113, b: 113, a: 0.15 } },
    arena: { line: { r: 192, g: 132, b: 252, a: 1 }, fill: { r: 192, g: 132, b: 252, a: 0.15 } }
  };

  var state = {
    markers: { version: '', pins: [], regions: [] },
    regionsByKey: {},
    groups: {},
    flash: null,
    players: [],
    heightTries: 0,
    heightTimer: null,
    lastCameraPost: 0,
    cameraTimer: null,
    sets: {}
  };

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function post(type, payload) {
    if (window.parent === window) return;
    window.parent.postMessage({ v: PROTOCOL_VERSION, type: type, payload: payload }, ORIGIN);
  }

  function currentMap() {
    return window.bluemap && window.bluemap.mapViewer ? window.bluemap.mapViewer.map : null;
  }

  function currentMapId() {
    var map = currentMap();
    return map && map.data ? map.data.id : null;
  }

  function worldOfMap(mapId) {
    var id = String(mapId).toLowerCase();
    return Object.prototype.hasOwnProperty.call(MAP_WORLDS, id) ? MAP_WORLDS[id] : id;
  }

  function mapOfWorld(world) {
    var target = String(world).toLowerCase();
    var maps = window.bluemap && window.bluemap.mapsMap;
    if (!maps) return null;
    var found = null;
    maps.forEach(function (_map, id) {
      if (!found && worldOfMap(id) === target) found = id;
    });
    return found;
  }

  // The marker world is the game world's name (Domain.WorldName); see MAP_WORLDS for BlueMap map ids.
  function onCurrentMap(world) {
    var id = currentMapId();
    return !!id && typeof world === 'string' && world.toLowerCase() === worldOfMap(id);
  }

  function terrainY(x, z) {
    var map = currentMap();
    if (!map || typeof map.terrainHeightAt !== 'function') return null;
    try {
      var y = map.terrainHeightAt(x, z);
      return typeof y === 'number' && isFinite(y) ? y : null;
    } catch (e) {
      return null;
    }
  }

  function pinY(pin) {
    if (typeof pin.y === 'number') return pin.y;
    var y = terrainY(pin.x, pin.z);
    return y === null ? null : y;
  }

  function injectStyle() {
    if (document.getElementById('knk-bridge-style')) return;
    var style = document.createElement('style');
    style.id = 'knk-bridge-style';
    style.textContent = [
      '.knk-pin,.knk-label,.knk-region-label{pointer-events:auto;cursor:pointer;transform:translate(-50%,-50%);}',
      '.knk-pin{width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.7);}',
      '.knk-pin-town{background:#facc15;width:18px;height:18px;}',
      '.knk-pin-district{background:#38bdf8;}',
      '.knk-pin-structure{background:#f87171;}',
      '.knk-pin-arena{background:#c084fc;}',
      '.knk-label,.knk-region-label{margin-top:-22px;white-space:nowrap;font:600 13px/1.2 system-ui,sans-serif;',
      'color:#fff;text-shadow:0 1px 2px #000,0 0 4px #000;text-align:center;}',
      // A player: name label and tags above the head; the head's bottom sits on the player's head height.
      '.knk-player{pointer-events:auto;cursor:pointer;transform:translate(-50%,-100%);display:flex;flex-direction:column;',
      'align-items:center;gap:2px;white-space:nowrap;font:600 12px/1.2 system-ui,sans-serif;color:#fff;text-align:center;}',
      '.knk-player-label{font-weight:400;background:rgba(0,0,0,.6);border-radius:3px;padding:1px 4px;text-shadow:1px 1px 0 #3f3f3f;}',
      '.knk-player-tags{display:flex;gap:2px;}',
      '.knk-tag{font-size:10px;font-weight:600;border-radius:3px;padding:0 3px;background:rgba(0,0,0,.6);color:#e5e7eb;}',
      '.knk-tag-staff{background:#0e7490;color:#fff;}',
      '.knk-tag-owner{background:#b45309;color:#fff;}',
      '.knk-tag-hidden{background:#374151;color:#fff;}',
      '.knk-tag-minigame{background:#7e22ce;color:#fff;}',
      '.knk-player-head{width:16px;height:16px;border:1px solid rgba(0,0,0,.7);background:#6b7280 center/cover no-repeat;',
      'image-rendering:pixelated;box-shadow:0 0 2px rgba(0,0,0,.6);}',
      '.knk-player-afk .knk-player-head,.knk-player-afk .knk-player-label{opacity:.6;}',
      '.knk-label-sub{font-weight:400;font-size:11px;opacity:.9;}',
      '.knk-region-label{color:#bae6fd;}'
    ].join('');
    document.head.appendChild(style);
  }

  function getSet(id, label) {
    if (state.sets[id]) return state.sets[id];
    var set = new window.BlueMap.MarkerSet(id);
    set.data.label = label;
    set.data.toggleable = false;
    set.data.defaultHide = false;
    window.bluemap.mapViewer.markers.add(set);
    state.sets[id] = set;
    return set;
  }

  // BlueMap's own marker manager reloads live/markers.json every 10 s and removes every root marker set that file
  // doesn't list (v5.29 NormalMarkerManager.updateFromData). Keep ours by adding them to its ignore list.
  function protectOurSets() {
    var root = window.bluemap.mapViewer.markers;
    if (root.__knkProtected) return;
    var original = root.updateMarkerSetsFromData;
    root.updateMarkerSetsFromData = function (data, ignore) {
      return original.call(this, data, (ignore || []).concat(OUR_SETS));
    };
    root.__knkProtected = true;
  }

  function withClick(set, handlers) {
    set.markers.forEach(function (marker, id) {
      var handler = handlers[id];
      if (!handler) return;
      if (marker.elementObject) {
        marker.elementObject.onClick = function (event) {
          if (event && event.data && event.data.doubleTap) return false;
          handler();
          return true;
        };
      } else if (!marker.__knkClick) {
        var original = marker.onClick;
        marker.onClick = function (event) {
          if (event && event.data && event.data.doubleTap) return false;
          if (original && original.call(marker, event) === false) return false;
          handler();
          return true;
        };
        marker.__knkClick = true;
      }
    });
  }

  function clickHandler(kind, id) {
    return function () { post('markerClicked', { kind: kind, id: id }); };
  }

  function htmlMarker(x, y, z, html, maxDistance) {
    var data = {
      type: 'html',
      position: { x: x, y: y, z: z },
      html: html,
      classes: [],
      listed: false
    };
    if (typeof maxDistance === 'number') data.maxDistance = maxDistance;
    return data;
  }

  function renderPins() {
    var set = getSet(SET_PINS, 'Knights and Kings');
    var data = {};
    var handlers = {};
    var missingHeight = false;
    state.markers.pins.forEach(function (pin) {
      if (!onCurrentMap(pin.world)) return;
      var y = pinY(pin);
      if (y === null) {
        missingHeight = true;
        y = DEFAULT_Y;
      }
      var base = pin.kind + ':' + pin.id;
      var attrs = ' data-knk-kind="' + escapeHtml(pin.kind) + '" data-knk-id="' + escapeHtml(pin.id) + '"';
      data[base + '|pin'] = htmlMarker(pin.x, y, pin.z,
        '<div class="knk-pin knk-pin-' + escapeHtml(pin.kind) + '"' + attrs + ' title="' + escapeHtml(pin.label) + '"></div>');
      var label = '<div class="knk-label knk-label-' + escapeHtml(pin.kind) + '"' + attrs + '>' + escapeHtml(pin.label)
        + (pin.sublabel ? '<div class="knk-label-sub">' + escapeHtml(pin.sublabel) + '</div>' : '') + '</div>';
      data[base + '|label'] = htmlMarker(pin.x, y, pin.z, label, pin.maxDistance);
      handlers[base + '|pin'] = clickHandler(pin.kind, pin.id);
      handlers[base + '|label'] = clickHandler(pin.kind, pin.id);
    });
    set.updateMarkersFromData(data);
    withClick(set, handlers);
    scheduleHeightRetry(missingHeight);
  }

  // A centroid pin has no height (y null); the terrain height is known once the tile under it has loaded.
  function scheduleHeightRetry(missingHeight) {
    if (state.heightTimer) {
      clearTimeout(state.heightTimer);
      state.heightTimer = null;
    }
    if (!missingHeight || state.heightTries >= HEIGHT_RETRIES) return;
    state.heightTries += 1;
    state.heightTimer = setTimeout(function () {
      state.heightTimer = null;
      renderPins();
      renderRegions();
    }, HEIGHT_RETRY_MS);
  }

  function regionCentre(region) {
    var first = region.outlines[0];
    if (!first || !first.points.length) return null;
    var sx = 0, sz = 0;
    first.points.forEach(function (p) { sx += p[0]; sz += p[1]; });
    return { x: sx / first.points.length, z: sz / first.points.length };
  }

  function regionMarkers(prefix, region, data, handlers, withLabel) {
    var colors = COLORS[region.kind] || COLORS.town;
    region.outlines.forEach(function (outline, index) {
      if (!outline.points || outline.points.length < 3) return;
      var id = prefix + '|' + region.key + '|' + index;
      var first = outline.points[0];
      data[id] = {
        type: 'extrude',
        position: { x: first[0], y: outline.minY, z: first[1] },
        shape: outline.points.map(function (p) { return { x: p[0], z: p[1] }; }),
        shapeMinY: outline.minY,
        shapeMaxY: outline.maxY,
        label: escapeHtml(region.label),
        depthTest: false,
        lineWidth: 3,
        lineColor: colors.line,
        fillColor: colors.fill,
        listed: false
      };
      handlers[id] = clickHandler(region.kind, region.id);
    });
    if (withLabel) {
      var centre = regionCentre(region);
      if (centre) {
        var y = terrainY(centre.x, centre.z);
        var labelId = prefix + '|' + region.key + '|label';
        data[labelId] = htmlMarker(centre.x, y === null ? DEFAULT_Y : y, centre.z,
          '<div class="knk-region-label" data-knk-kind="' + escapeHtml(region.kind) + '" data-knk-id="'
          + escapeHtml(region.id) + '">' + escapeHtml(region.label) + '</div>');
        handlers[labelId] = clickHandler(region.kind, region.id);
      }
    }
  }

  function renderRegions() {
    var set = getSet(SET_REGIONS, 'Knights and Kings regions');
    var data = {};
    var handlers = {};
    Object.keys(state.groups).forEach(function (group) {
      state.groups[group].forEach(function (key) {
        var region = state.regionsByKey[key];
        if (region && onCurrentMap(region.world)) regionMarkers(group, region, data, handlers, true);
      });
    });
    if (state.flash && state.flash.visible) {
      var flashed = state.regionsByKey[state.flash.key];
      if (flashed && onCurrentMap(flashed.world)) regionMarkers(FLASH_GROUP, flashed, data, handlers, false);
    }
    set.updateMarkersFromData(data);
    withClick(set, handlers);
  }

  // One styled run of the name label (#739): the page turned the `&` codes into `#RRGGBB`; anything else is dropped.
  function partHtml(part) {
    if (!part || typeof part !== 'object') return '';
    var css = [];
    if (typeof part.color === 'string' && CSS_COLOR.test(part.color)) css.push('color:' + part.color);
    if (part.bold === true) css.push('font-weight:700');
    if (part.italic === true) css.push('font-style:italic');
    var decoration = (part.underline === true ? 'underline ' : '') + (part.strikethrough === true ? 'line-through' : '');
    if (decoration) css.push('text-decoration:' + decoration.trim());
    return '<span' + (css.length ? ' style="' + css.join(';') + '"' : '') + '>' + escapeHtml(part.text) + '</span>';
  }

  function labelHtml(player) {
    if (Array.isArray(player.parts) && player.parts.length > 0) return player.parts.map(partHtml).join('');
    return escapeHtml(player.label);
  }

  function tagsHtml(player) {
    if (!Array.isArray(player.tags) || player.tags.length === 0) return '';
    var tags = player.tags.filter(function (tag) {
      return tag && TAG_KINDS.indexOf(tag.kind) >= 0 && typeof tag.text === 'string';
    });
    if (tags.length === 0) return '';
    return '<div class="knk-player-tags">' + tags.map(function (tag) {
      return '<span class="knk-tag knk-tag-' + tag.kind + '" data-knk-tag="' + tag.kind + '">' + escapeHtml(tag.text) + '</span>';
    }).join('') + '</div>';
  }

  function headUrl(uuid) {
    if (!HEAD_TEMPLATE || !UUID_PATTERN.test(uuid)) return DEFAULT_HEAD;
    return HEAD_TEMPLATE.split('{uuid}').join(uuid);
  }

  function isAfk(player) {
    return Array.isArray(player.tags) && player.tags.some(function (tag) { return tag && tag.kind === 'afk'; });
  }

  function playerHtml(player) {
    var uuid = String(player.uuid);
    return '<div class="knk-player' + (isAfk(player) ? ' knk-player-afk' : '') + '" data-knk-player="' + escapeHtml(uuid) + '">'
      + '<div class="knk-player-label">' + labelHtml(player) + '</div>'
      + tagsHtml(player)
      + '<div class="knk-player-head" style="background-image:url(\'' + escapeHtml(headUrl(uuid)) + '\')"></div>'
      + '</div>';
  }

  function renderPlayers() {
    var set = getSet(SET_PLAYERS, 'Knights and Kings players');
    var data = {};
    var handlers = {};
    state.players.forEach(function (player) {
      if (!player || typeof player.uuid !== 'string' || !onCurrentMap(player.world)) return;
      if (typeof player.x !== 'number' || typeof player.y !== 'number' || typeof player.z !== 'number') return;
      var id = 'player|' + player.uuid;
      data[id] = htmlMarker(player.x, player.y + PLAYER_HEAD_HEIGHT, player.z, playerHtml(player));
      handlers[id] = (function (uuid) {
        return function () { post('playerClicked', { uuid: uuid }); };
      })(player.uuid);
    });
    set.updateMarkersFromData(data);
    withClick(set, handlers);
  }

  function renderAll() {
    renderPins();
    renderRegions();
    renderPlayers();
  }

  function stopFlash() {
    if (state.flash && state.flash.timer) clearTimeout(state.flash.timer);
    state.flash = null;
  }

  function startFlash(payload) {
    stopFlash();
    var count = Math.max(1, Math.min(10, Number(payload.count) || 3));
    var duration = Math.max(50, Math.min(5000, Number(payload.durationMs) || 400));
    var flash = { key: String(payload.key), visible: false, steps: count * 2, timer: null };
    state.flash = flash;
    var step = function () {
      if (state.flash !== flash) return;
      if (flash.steps <= 0) {
        state.flash = null;
        renderRegions();
        return;
      }
      flash.visible = !flash.visible;
      flash.steps -= 1;
      renderRegions();
      flash.timer = setTimeout(step, duration);
    };
    step();
  }

  function focus(payload) {
    var app = window.bluemap;
    var go = function () {
      var controls = app.mapViewer.controlsManager;
      var y = typeof payload.y === 'number' ? payload.y : terrainY(payload.x, payload.z);
      controls.position.set(payload.x, y === null ? controls.position.y : y, payload.z);
      if (typeof payload.distance === 'number') controls.distance = payload.distance;
    };
    var target = onCurrentMap(payload.world) ? null : mapOfWorld(payload.world);
    if (target) {
      Promise.resolve(app.switchMap(target)).then(go, function () { /* stay on the current map */ });
    } else {
      go();
    }
  }

  function isValidMessage(event) {
    if (event.origin !== ORIGIN) return false;
    if (event.source !== window.parent || window.parent === window) return false;
    var data = event.data;
    return !!data && typeof data === 'object' && data.v === PROTOCOL_VERSION && typeof data.type === 'string'
      && !!data.payload && typeof data.payload === 'object';
  }

  function onMessage(event) {
    if (!isValidMessage(event)) return;
    var payload = event.data.payload;
    switch (event.data.type) {
      case 'setMarkers':
        state.markers = {
          version: String(payload.version || ''),
          pins: Array.isArray(payload.pins) ? payload.pins : [],
          regions: Array.isArray(payload.regions) ? payload.regions : []
        };
        state.regionsByKey = {};
        state.markers.regions.forEach(function (region) { state.regionsByKey[region.key] = region; });
        state.heightTries = 0;
        renderPins();
        renderRegions();
        break;
      case 'flashRegion':
        startFlash(payload);
        break;
      case 'showRegions':
        state.groups[String(payload.group)] = Array.isArray(payload.keys) ? payload.keys.map(String) : [];
        renderRegions();
        break;
      case 'hideRegions':
        delete state.groups[String(payload.group)];
        renderRegions();
        break;
      case 'setPlayers':
        state.players = Array.isArray(payload.players) ? payload.players : [];
        renderPlayers();
        break;
      case 'focus':
        focus(payload);
        break;
      default:
        break; // unknown types are ignored, so a newer page can talk to an older bridge
    }
  }

  function onCameraMoved() {
    var now = Date.now();
    var send = function () {
      state.lastCameraPost = Date.now();
      state.cameraTimer = null;
      var controls = window.bluemap.mapViewer.controlsManager;
      post('cameraChanged', {
        mapId: currentMapId(),
        x: controls.position.x,
        y: controls.position.y,
        z: controls.position.z,
        distance: controls.distance
      });
    };
    if (now - state.lastCameraPost >= CAMERA_THROTTLE_MS) {
      send();
    } else if (!state.cameraTimer) {
      state.cameraTimer = setTimeout(send, CAMERA_THROTTLE_MS);
    }
  }

  // Escape while the focus is inside this iframe (#757): the page's own keydown listener cannot hear it, so report it
  // as the v1 type `escapePressed` (added under O14: new type, no v1 meaning changed). The page decides what it closes;
  // the key still reaches BlueMap.
  function onKeyDown(event) {
    if (event.key === 'Escape' && !event.repeat) post('escapePressed', {});
  }

  function onMapChanged() {
    state.heightTries = 0;
    renderAll();
    post('ready', { protocol: PROTOCOL_VERSION, mapId: currentMapId() });
  }

  function start() {
    var app = window.bluemap;
    injectStyle();
    protectOurSets();
    getSet(SET_PINS, 'Knights and Kings');
    getSet(SET_REGIONS, 'Knights and Kings regions');
    getSet(SET_PLAYERS, 'Knights and Kings players');
    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', onKeyDown, true);
    if (app.events && app.events.addEventListener) {
      app.events.addEventListener('bluemapCameraMoved', onCameraMoved);
      app.events.addEventListener('bluemapMapChanged', onMapChanged);
    }
    window.__knkBridge = { protocol: PROTOCOL_VERSION, state: state, mapWorlds: MAP_WORLDS };
    post('ready', { protocol: PROTOCOL_VERSION, mapId: currentMapId() });
  }

  // BlueMap loads `scripts` after its maps; wait a little in case the app object is not there yet.
  var attempts = 0;
  (function waitForBlueMap() {
    if (window.bluemap && window.bluemap.mapViewer && window.BlueMap && window.BlueMap.MarkerSet) {
      start();
    } else if (attempts++ < 100) {
      setTimeout(waitForBlueMap, 100);
    } else if (window.console) {
      window.console.warn('[knk bridge] BlueMap web app not found; the bridge is idle.');
    }
  })();
})();
