import { MarkerStore } from './marker-store.js';

const SYMBOLS = {
  pin: '<circle cx="16" cy="14" r="4" fill="#172119"/>',
  star: '<path d="m16 7 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7Z" fill="#172119"/>',
  flag: '<path d="M12 23V7m0 1h10l-2 4 2 4H12" fill="none" stroke="#172119" stroke-width="2" stroke-linejoin="round"/>',
  landmark: '<path d="m8 13 8-6 8 6M10 14v8m6-8v8m6-8v8M8 23h16" fill="none" stroke="#172119" stroke-width="2"/>',
  transport: '<path d="m7 16 7-2 1-7h2l1 7 7 2v2l-7-1-1 6h-2l-1-6-7 1Z" fill="#172119"/>',
  service: '<path d="M13 7h6v5h5v6h-5v5h-6v-5H8v-6h5Z" fill="#172119"/>',
  nature: '<path d="m16 6 8 12h-5l4 6H9l4-6H8Z" fill="#172119"/>',
};
const COLORS = { pin: '#c4f578', star: '#ffcf70', flag: '#d5b7ff', landmark: '#d2dca0', transport: '#88d5f5', service: '#ffb5a6', nature: '#95d6ad' };

function markerIcon(L, icon, isUser = false) {
  const kind = SYMBOLS[icon] ? icon : 'pin';
  return L.divIcon({
    className: `map-marker map-marker--${isUser ? 'user' : 'place'} map-marker--${kind}`,
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40" aria-hidden="true" style="display:block;filter:drop-shadow(0 2px 3px #0006)"><path d="M16 39C13 34 2 26 2 16a14 14 0 1 1 28 0c0 10-11 18-14 23Z" fill="${COLORS[kind]}" stroke="#172119" stroke-width="1.5"/>${SYMBOLS[kind]}</svg>`,
    iconSize: [32, 40], iconAnchor: [16, 39], popupAnchor: [0, -35],
  });
}

function safeSourceURL(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function popupContent(point, buttons = []) {
  const root = document.createElement('div');
  root.className = 'map-popup';
  const title = document.createElement('strong');
  title.textContent = point.name;
  const coordinate = document.createElement('p');
  coordinate.textContent = `X ${point.x.toFixed(2)} · Y ${point.y.toFixed(2)}`;
  root.append(title, coordinate);
  const source = safeSourceURL(point.source);
  if (source) {
    const link = document.createElement('a');
    link.href = source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Источник координат';
    root.append(link);
  }
  if (buttons.length) {
    const actions = document.createElement('div');
    actions.className = 'map-popup__actions';
    for (const { label, handler, danger = false } of buttons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.className = danger ? 'map-popup__delete' : 'map-popup__button';
      button.addEventListener('click', (event) => { event.stopPropagation(); handler(); });
      actions.append(button);
    }
    root.append(actions);
  }
  return root;
}

/** User coordinates stay in game units and remain unchanged when the basemap changes. */
export function createMarkerManager({
  L, map, bounds, places = [], storage, onChange = () => {}, onEdit = () => {}, onStorageError = () => {},
}) {
  if (!L?.marker || !L?.layerGroup || !L?.divIcon || !map) throw new TypeError('Leaflet map is required');
  let selectedStorage = storage;
  if (storage === undefined) {
    try { selectedStorage = window.localStorage; }
    catch { selectedStorage = null; }
  }
  const store = new MarkerStore({ bounds, storage: selectedStorage, onStorageError });
  const userLayer = L.layerGroup().addTo(map);
  const placeLayer = L.layerGroup().addTo(map);
  const userMarkers = new Map();
  const placeMarkers = new Map();
  let searchMarker;

  function emit() { onChange(store.getMarkers()); }
  function clearSearch() {
    if (searchMarker) map.removeLayer(searchMarker);
    searchMarker = undefined;
  }
  function focusView(point) {
    const zoom = Math.min(map.getMaxZoom(), Math.max(map.getZoom(), 4));
    map.setView([point.y, point.x], zoom, { animate: false });
  }
  function renderUsers() {
    const values = store.getMarkers();
    const ids = new Set(values.map((value) => value.id));
    for (const [id, marker] of userMarkers) {
      if (!ids.has(id)) { userLayer.removeLayer(marker); userMarkers.delete(id); }
    }
    for (const point of values) {
      let marker = userMarkers.get(point.id);
      if (!marker) {
        marker = L.marker([point.y, point.x], {
          icon: markerIcon(L, point.icon, true), draggable: true,
          title: point.name, alt: point.name, autoPan: true,
        });
        marker.on('dragend', () => {
          const coordinate = marker.getLatLng();
          update(point.id, {
            x: Math.min(bounds.maxX, Math.max(bounds.minX, coordinate.lng)),
            y: Math.min(bounds.maxY, Math.max(bounds.minY, coordinate.lat)),
          });
        });
        userMarkers.set(point.id, marker);
        marker.addTo(userLayer);
      }
      marker.setLatLng([point.y, point.x]);
      marker.setIcon(markerIcon(L, point.icon, true));
      marker.options.title = point.name;
      marker.options.alt = point.name;
      const element = marker.getElement?.();
      if (element) { element.title = point.name; element.setAttribute('aria-label', point.name); }
      marker.bindPopup(popupContent(point, [
        { label: 'Изменить', handler: () => { const current = store.get(point.id); if (current) onEdit(current); } },
        { label: 'Удалить', danger: true, handler: () => remove(point.id) },
      ]));
    }
  }
  function add(input) {
    const point = store.add(input);
    renderUsers(); emit();
    return point;
  }
  function update(id, patch) {
    const point = store.update(id, patch);
    renderUsers(); emit();
    return point;
  }
  function remove(id) {
    const removed = store.remove(id);
    if (removed) { renderUsers(); emit(); }
    return removed;
  }

  for (const point of places) {
    if (!point || typeof point.id !== 'string' || typeof point.name !== 'string'
        || !Number.isFinite(point.x) || !Number.isFinite(point.y)
        || point.x < bounds.minX || point.x > bounds.maxX || point.y < bounds.minY || point.y > bounds.maxY
        || placeMarkers.has(point.id)) continue;
    const marker = L.marker([point.y, point.x], {
      icon: markerIcon(L, point.category), title: point.name, alt: point.name,
    }).bindPopup(popupContent(point, [
      { label: 'Сохранить как метку', handler: () => onEdit({ name: point.name, x: point.x, y: point.y, icon: 'pin' }) },
    ])).addTo(placeLayer);
    placeMarkers.set(point.id, marker);
  }
  renderUsers();
  emit();

  function showSearchResult(result) {
    if (!result || !Number.isFinite(result.x) || !Number.isFinite(result.y)
        || result.x < bounds.minX || result.x > bounds.maxX || result.y < bounds.minY || result.y > bounds.maxY) {
      throw new RangeError('Координаты находятся за границами карты.');
    }
    clearSearch();
    const point = { ...result, name: result.name || 'Координаты' };
    focusView(point);
    searchMarker = L.marker([point.y, point.x], {
      icon: markerIcon(L, 'flag', true), title: point.name, alt: point.name,
    }).bindPopup(popupContent(point, [
      { label: 'Сохранить как метку', handler: () => onEdit({ name: point.name, x: point.x, y: point.y, icon: 'pin' }) },
    ])).addTo(map);
    searchMarker.openPopup();
  }

  function focus(result) {
    const own = store.get(result?.id);
    const place = placeMarkers.get(result?.id);
    if (own) {
      clearSearch();
      if (!map.hasLayer(userLayer)) userLayer.addTo(map);
      focusView(own);
      userMarkers.get(own.id)?.openPopup();
    } else if (place) {
      clearSearch();
      if (!map.hasLayer(placeLayer)) placeLayer.addTo(map);
      focusView(result);
      place.openPopup();
    } else showSearchResult(result);
  }

  return {
    getMarkers: () => store.getMarkers(), add, update, remove, focus, showSearchResult,
    setPlacesVisible(visible) { if (visible) placeLayer.addTo(map); else map.removeLayer(placeLayer); },
    setUsersVisible(visible) { if (visible) userLayer.addTo(map); else map.removeLayer(userLayer); },
    destroy() {
      clearSearch(); map.removeLayer(userLayer); map.removeLayer(placeLayer);
      userMarkers.clear(); placeMarkers.clear();
    },
  };
}
