import { MAP_CONFIG } from './config.js';
import { createGameCRS, pixelToWorld, worldToPixel, validateConfig } from './projection.js';
import { createBaseLayerManager } from './layers.js';

function gridStep(unitsPerPixel) {
  const target = unitsPerPixel * 130;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 5, 10].map((value) => value * magnitude)
    .find((value) => value >= target);
}

/** Canvas tiles share the basemap CRS, so the grid stays aligned at every zoom. */
function createCoordinateGrid(L, config, bounds, isDiagnostic) {
  const Grid = L.GridLayer.extend({
    createTile(coords) {
      const tile = document.createElement('canvas');
      const size = config.tileSize;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      tile.width = size * ratio;
      tile.height = size * ratio;
      const context = tile.getContext('2d');
      context.scale(ratio, ratio);
      if (isDiagnostic) {
        context.fillStyle = '#16241e';
        context.fillRect(0, 0, size, size);
      }

      const left = coords.x * size;
      const top = coords.y * size;
      const nw = pixelToWorld(left, top, coords.z, config);
      const se = pixelToWorld(left + size, top + size, coords.z, config);
      const unitsPerPixel = (se.x - nw.x) / size;
      const step = gridStep(unitsPerPixel);
      const format = (value) => Math.abs(value) < 1e-8 ? '0' : String(Math.round(value));
      context.font = '10px ui-monospace, SFMono-Regular, monospace';
      context.lineWidth = 1;

      for (let x = Math.ceil(nw.x / step) * step; x < se.x; x += step) {
        const px = Math.round(worldToPixel(x, nw.y, coords.z, config).x - left) + 0.5;
        context.strokeStyle = x === 0 ? 'rgba(188,218,148,.70)' : 'rgba(170,198,173,.20)';
        context.beginPath();
        context.moveTo(px, 0);
        context.lineTo(px, size);
        context.stroke();
        context.fillStyle = 'rgba(196,217,193,.74)';
        context.fillText(`X ${format(x)}`, px + 5, 15);
      }
      for (let y = Math.floor(nw.y / step) * step; y > se.y; y -= step) {
        const py = Math.round(worldToPixel(nw.x, y, coords.z, config).y - top) + 0.5;
        context.strokeStyle = y === 0 ? 'rgba(188,218,148,.70)' : 'rgba(170,198,173,.20)';
        context.beginPath();
        context.moveTo(0, py);
        context.lineTo(size, py);
        context.stroke();
        context.fillStyle = 'rgba(196,217,193,.74)';
        context.fillText(`Y ${format(y)}`, 5, py - 5);
      }
      return tile;
    },
  });
  return new Grid({
    tileSize: config.tileSize,
    noWrap: true,
    pane: 'coordinate-grid',
    bounds,
    minZoom: config.minZoom,
    maxZoom: config.maxZoom,
    attribution: isDiagnostic ? 'Проверочная координатная сетка' : '',
    updateWhenIdle: true,
    keepBuffer: 2,
  });
}

/** Shared projection, bounded navigation and switchable XYZ base styles. */
export function createMap(container, {
  onCoordinate = () => {},
  onViewChange = () => {},
  onTileError = () => {},
  onLayerChange = () => {},
  config = MAP_CONFIG,
} = {}) {
  validateConfig(config);
  const L = window.L;
  if (!L) throw new Error('Leaflet must be loaded before createMap');
  if (!['diagnostic', 'xyz'].includes(config.tileMode)) {
    throw new RangeError('tileMode must be diagnostic or xyz');
  }
  const { minX, minY, maxX, maxY } = config.worldBounds;
  const bounds = L.latLngBounds([[minY, minX], [maxY, maxX]]);
  let viewBounds = bounds;
  if (config.viewPixelBounds) {
    const view = config.viewPixelBounds;
    const nw = pixelToWorld(view.minX, view.minY, config.nativeZoom, config);
    const se = pixelToWorld(view.maxX, view.maxY, config.nativeZoom, config);
    viewBounds = L.latLngBounds([[se.y, nw.x], [nw.y, se.x]]);
    if (!bounds.contains(viewBounds)) throw new RangeError('Initial view must be inside worldBounds');
  }
  const isDiagnostic = config.tileMode === 'diagnostic';
  const map = L.map(container, {
    crs: createGameCRS(L, config),
    minZoom: config.minZoom,
    maxZoom: config.maxZoom,
    maxBounds: bounds,
    maxBoundsViscosity: 1,
    zoomControl: false,
    attributionControl: true,
    zoomSnap: 0.25,
    zoomDelta: 1,
    wheelPxPerZoomLevel: 90,
    worldCopyJump: false,
  });

  const layers = isDiagnostic ? null : createBaseLayerManager(L, map, config, {
    onChange: onLayerChange, onTileError,
  });
  const gridPane = map.createPane('coordinate-grid');
  gridPane.style.zIndex = '350';
  gridPane.style.pointerEvents = 'none';

  const grid = createCoordinateGrid(L, config, bounds, isDiagnostic).addTo(map);
  const border = L.rectangle(bounds, {
    color: '#c6d7a0', weight: 1, opacity: 0.65, fill: false,
    interactive: false, dashArray: '5 6',
  }).addTo(map);

  function reportView() {
    const p0 = worldToPixel(minX, minY, map.getZoom(), config);
    const p1 = worldToPixel(minX + 1, minY, map.getZoom(), config);
    onViewChange({ zoom: map.getZoom(), unitsPerPixel: 1 / (p1.x - p0.x) });
  }

  function fitWorld() {
    map.fitBounds(viewBounds, { padding: [28, 28], animate: false });
    map.panInsideBounds(bounds, { animate: false });
    reportView();
  }

  map.on('zoomend moveend', reportView);
  map.on('mousemove', ({ latlng }) => {
    onCoordinate(bounds.contains(latlng) ? { x: latlng.lng, y: latlng.lat } : null);
  });
  map.on('mouseout', () => onCoordinate(null));
  map.on('click', ({ latlng }) => {
    onCoordinate(bounds.contains(latlng) ? { x: latlng.lng, y: latlng.lat } : null);
  });
  fitWorld();

  const observer = new ResizeObserver(() => {
    map.invalidateSize({ pan: false });
    map.panInsideBounds(bounds, { animate: false });
  });
  observer.observe(map.getContainer());
  map.on('unload', () => { observer.disconnect(); layers?.destroy(); });

  return {
    map,
    get baseLayer() { return layers?.layer; },
    isDiagnostic,
    fitWorld,
    setBaseLayer(id) { return layers ? layers.select(id) : false; },
    getBaseLayerId() { return layers?.id || null; },
    setGridVisible(visible) {
      if (visible) {
        if (!map.hasLayer(grid)) grid.addTo(map);
        if (!map.hasLayer(border)) border.addTo(map);
      } else {
        map.removeLayer(grid);
        map.removeLayer(border);
      }
    },
  };
}
