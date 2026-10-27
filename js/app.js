const ids = [
  'map', 'map-message', 'zoom-in', 'zoom-out', 'fit-world', 'grid-toggle',
  'coordinate-x', 'coordinate-y', 'zoom-value', 'scale-value', 'bounds-x', 'bounds-y',
  'bounds-status', 'source-status', 'source-note', 'map-mode', 'connection-status',
  'layer-switcher', 'places-toggle', 'users-toggle', 'places-count', 'markers-count',
  'search-form', 'place-search', 'search-results', 'search-feedback', 'marker-list',
  'empty-markers', 'add-marker', 'marker-dialog', 'marker-form', 'marker-name',
  'marker-x', 'marker-y', 'marker-dialog-title', 'marker-form-error', 'close-dialog',
  'cancel-dialog', 'pick-on-map', 'placement-banner', 'cancel-placement',
  'session-notice', 'session-message', 'dismiss-notice',
];
const ui = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const scaleFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });
const ICONS = { pin: '●', star: '★', flag: '⚑' };
const RESULT_KINDS = { place: 'Известное место', user: 'Моя метка', coordinate: 'Игровые координаты' };
let core;
let manager;
let config;
let catalogue = [];
let searchPlaces;
let results = [];
let activeResult = -1;
let editingId;
let placementDraft;
let placing = false;
let noticeTimer;
let storageWarning = '';
let layerState;

function messageOf(error, fallback = 'Не удалось выполнить действие.') {
  return error instanceof Error ? error.message : fallback;
}

function notify(message, isError = false) {
  clearTimeout(noticeTimer);
  ui['session-message'].textContent = message;
  ui['session-notice'].hidden = false;
  ui['session-notice'].toggleAttribute('data-error', isError);
  if (!isError) noticeTimer = setTimeout(() => { ui['session-notice'].hidden = true; }, 5000);
}

function reportStorageError(message) {
  storageWarning = message;
  notify(message, true);
}

function updateButtons() {
  if (!core) return;
  ui['zoom-in'].disabled = core.map.getZoom() >= core.map.getMaxZoom();
  ui['zoom-out'].disabled = core.map.getZoom() <= core.map.getMinZoom();
}

function updateCoordinate(point) {
  ui['coordinate-x'].value = point ? numberFormat.format(point.x) : '—';
  ui['coordinate-y'].value = point ? numberFormat.format(point.y) : '—';
}

function updateView({ zoom, unitsPerPixel }) {
  ui['zoom-value'].value = numberFormat.format(zoom);
  ui['scale-value'].value = scaleFormat.format(unitsPerPixel);
  updateButtons();
}

function updateLayer({ id, label, status }) {
  layerState = { id, label, status };
  ui['map-mode'].textContent = `${label.toLocaleUpperCase('ru-RU')}${status === 'loading' ? ' · ЗАГРУЗКА' : ''}`;
  ui['map-mode'].closest('.map-badge').toggleAttribute('data-loading', status === 'loading');
  for (const button of ui['layer-switcher'].querySelectorAll('[data-layer]')) {
    button.setAttribute('aria-pressed', String(button.dataset.layer === id));
  }
  ui['connection-status'].textContent = status === 'loading' ? 'ЗАГРУЗКА' : status === 'error' ? 'ОШИБКА ТАЙЛОВ' : 'ГОТОВО';
  ui['connection-status'].toggleAttribute('data-error', status === 'error');
  ui['source-status'].textContent = status === 'error' ? `Не удалось загрузить ${label}` : `Слой ${label}`;
  ui['source-note'].textContent = status === 'error'
    ? 'Часть тайлов недоступна. Попробуйте другой стиль карты; метки и координаты сохраняют своё положение.'
    : config?.calibration === 'community'
      ? 'Привязка из открытого проекта. Точность по игровым точкам ещё не проверена.'
      : config?.calibration === 'unverified'
        ? 'Геопривязка требует проверки по игровым координатам.'
        : 'Карта отображается в игровой системе координат.';
}

function handleTileError() {
  if (layerState && layerState.status !== 'error') updateLayer({ ...layerState, status: 'error' });
}

function closeSuggestions() {
  ui['search-results'].hidden = true;
  ui['place-search'].setAttribute('aria-expanded', 'false');
  ui['place-search'].removeAttribute('aria-activedescendant');
  activeResult = -1;
}

function setSearchFeedback(message, isError = false) {
  ui['search-feedback'].textContent = message;
  ui['search-feedback'].hidden = !message;
  ui['search-feedback'].toggleAttribute('data-error', isError);
}

function highlightResult(index) {
  activeResult = index;
  const options = ui['search-results'].querySelectorAll('[role=option]');
  options.forEach((option, position) => option.setAttribute('aria-selected', String(position === index)));
  const option = options[index];
  if (option) {
    ui['place-search'].setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  } else ui['place-search'].removeAttribute('aria-activedescendant');
}

function runSearch() {
  const query = ui['place-search'].value.trim().replace(/−/g, '-');
  closeSuggestions();
  if (!query || !manager || !searchPlaces) {
    results = [];
    setSearchFeedback(query ? 'Поиск подготавливается…' : '');
    return;
  }
  try {
    results = searchPlaces(query, catalogue, manager.getMarkers(), config.worldBounds);
    ui['search-results'].replaceChildren();
    for (const [index, result] of results.entries()) {
      const option = document.createElement('li');
      option.id = `search-option-${index}`;
      option.dataset.index = String(index);
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      const name = document.createElement('strong');
      name.textContent = result.name;
      const details = document.createElement('small');
      details.textContent = `${RESULT_KINDS[result.kind] || 'Точка'} · X ${numberFormat.format(result.x)} · Y ${numberFormat.format(result.y)}`;
      option.append(name, details);
      ui['search-results'].append(option);
    }
    ui['search-results'].hidden = !results.length;
    ui['place-search'].setAttribute('aria-expanded', String(Boolean(results.length)));
    setSearchFeedback(results.length ? `Найдено: ${results.length}. ↑ ↓ — выбор, Enter — показать.` : 'Ничего не найдено. Попробуйте другое название или координаты.');
  } catch (error) {
    results = [];
    setSearchFeedback(messageOf(error), true);
  }
}

function focusResult(result) {
  if (result.kind === 'user') ui['users-toggle'].checked = true;
  if (result.kind === 'place') ui['places-toggle'].checked = true;
  if (result.kind === 'coordinate') manager.showSearchResult(result);
  else manager.focus(result);
}

function selectResult(index) {
  const result = results[index];
  if (!result || !manager) return;
  try {
    focusResult(result);
    closeSuggestions();
    ui['place-search'].value = result.name;
    setSearchFeedback(`На карте: ${result.name}`);
  } catch (error) { notify(messageOf(error), true); }
}

function renderMarkers(markers) {
  ui['markers-count'].textContent = String(markers.length);
  ui['empty-markers'].hidden = markers.length > 0;
  ui['marker-list'].replaceChildren();
  for (const marker of markers) {
    const item = document.createElement('li');
    item.dataset.id = marker.id;
    const focus = document.createElement('button');
    focus.type = 'button';
    focus.className = 'marker-focus';
    focus.dataset.action = 'focus';
    focus.title = `Показать «${marker.name}» на карте`;
    const symbol = document.createElement('span');
    symbol.className = 'marker-list-symbol';
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = ICONS[marker.icon] || ICONS.pin;
    const text = document.createElement('span');
    text.className = 'marker-text';
    const name = document.createElement('strong');
    name.textContent = marker.name;
    const coordinate = document.createElement('small');
    coordinate.textContent = `X ${numberFormat.format(marker.x)} · Y ${numberFormat.format(marker.y)}`;
    text.append(name, coordinate);
    focus.append(symbol, text);
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'marker-action';
    edit.dataset.action = 'edit';
    edit.setAttribute('aria-label', `Изменить метку «${marker.name}»`);
    edit.title = 'Изменить';
    edit.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m13 3 4 4M3 17l1-5L13 3a2.8 2.8 0 0 1 4 4l-9 9Z"/></svg>';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'marker-action';
    remove.dataset.action = 'delete';
    remove.setAttribute('aria-label', `Удалить метку «${marker.name}»`);
    remove.title = 'Удалить';
    remove.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M7 5V3h6v2M5 5l1 12h8l1-12M8 8v6m4-6v6"/></svg>';
    item.append(focus, edit, remove);
    ui['marker-list'].append(item);
  }
}

function formDraft() {
  return {
    ...(editingId ? { id: editingId } : {}),
    name: ui['marker-name'].value,
    x: ui['marker-x'].value,
    y: ui['marker-y'].value,
    icon: ui['marker-form'].elements.icon.value,
  };
}

function setPlacement(active) {
  placing = active;
  ui['placement-banner'].hidden = !active;
  ui.map.closest('.map-area').classList.toggle('is-placing', active);
}

function openMarkerDialog(marker = {}) {
  setPlacement(false);
  closeSuggestions();
  editingId = marker.id;
  ui['marker-dialog-title'].textContent = marker.id ? 'Изменить метку' : 'Новая метка';
  ui['marker-name'].value = marker.name ?? '';
  ui['marker-x'].value = marker.x ?? '';
  ui['marker-y'].value = marker.y ?? '';
  ui['marker-form'].elements.icon.value = ICONS[marker.icon] ? marker.icon : 'pin';
  ui['marker-form-error'].hidden = true;
  ui['marker-form-error'].textContent = '';
  if (!ui['marker-dialog'].open) ui['marker-dialog'].showModal();
  ui['marker-name'].focus();
}

function closeMarkerDialog() {
  ui['marker-dialog'].close();
  setPlacement(false);
  placementDraft = undefined;
}

function configureInteractions() {
  ui['zoom-in'].addEventListener('click', () => core.map.zoomIn());
  ui['zoom-out'].addEventListener('click', () => core.map.zoomOut());
  ui['fit-world'].addEventListener('click', () => core.fitWorld());
  ui['grid-toggle'].addEventListener('change', (event) => core.setGridVisible(event.target.checked));
  ui['layer-switcher'].addEventListener('click', (event) => {
    const button = event.target.closest('button[data-layer]');
    if (!button) return;
    try { core.setBaseLayer(button.dataset.layer); }
    catch (error) { notify(messageOf(error), true); }
  });
  ui['dismiss-notice'].addEventListener('click', () => { ui['session-notice'].hidden = true; });
  ui['places-toggle'].addEventListener('change', (event) => manager?.setPlacesVisible(event.target.checked));
  ui['users-toggle'].addEventListener('change', (event) => manager?.setUsersVisible(event.target.checked));
  ui['add-marker'].addEventListener('click', () => {
    if (manager) openMarkerDialog();
    else notify('Метки ещё подготавливаются. Попробуйте через несколько секунд.');
  });
  ui['marker-list'].addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    const id = button?.closest('li')?.dataset.id;
    if (!id || !manager) return;
    const marker = manager.getMarkers().find((entry) => entry.id === id);
    if (!marker) return;
    try {
      if (button.dataset.action === 'focus') focusResult({ ...marker, kind: 'user' });
      if (button.dataset.action === 'edit') openMarkerDialog(marker);
      if (button.dataset.action === 'delete') {
        manager.remove(id);
        notify(storageWarning ? `Метка удалена из сеанса. ${storageWarning}` : 'Метка удалена.', Boolean(storageWarning));
      }
    } catch (error) { notify(messageOf(error), true); }
  });
  ui['search-form'].addEventListener('submit', (event) => {
    event.preventDefault();
    if (ui['search-results'].hidden) runSearch();
    if (results.length) selectResult(activeResult >= 0 ? activeResult : 0);
  });
  ui['place-search'].addEventListener('input', runSearch);
  ui['place-search'].addEventListener('focus', () => { if (ui['place-search'].value.trim()) runSearch(); });
  ui['place-search'].addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closeSuggestions(); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (ui['search-results'].hidden) runSearch();
    if (!results.length) return;
    const next = event.key === 'ArrowDown'
      ? (activeResult + 1) % results.length
      : (activeResult <= 0 ? results.length - 1 : activeResult - 1);
    highlightResult(next);
  });
  ui['search-results'].addEventListener('mousedown', (event) => event.preventDefault());
  ui['search-results'].addEventListener('click', (event) => {
    const option = event.target.closest('[data-index]');
    if (option) selectResult(Number(option.dataset.index));
  });
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.search-box')) closeSuggestions();
  });
  for (const id of ['close-dialog', 'cancel-dialog']) ui[id].addEventListener('click', closeMarkerDialog);
  ui['marker-dialog'].addEventListener('cancel', () => { setPlacement(false); placementDraft = undefined; });
  ui['pick-on-map'].addEventListener('click', () => {
    placementDraft = formDraft();
    ui['marker-dialog'].close();
    setPlacement(true);
    ui.map.focus();
  });
  ui['cancel-placement'].addEventListener('click', () => openMarkerDialog(placementDraft || {}));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && placing) openMarkerDialog(placementDraft || {});
  });
  core.map.on('click', (event) => {
    if (!placing) return;
    const { lng: x, lat: y } = event.latlng;
    const bounds = config.worldBounds;
    if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) {
      notify('Выберите точку внутри границ карты.', true);
      return;
    }
    openMarkerDialog({ ...placementDraft, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
    ui['marker-name'].value ? ui['marker-form'].querySelector('[type=submit]').focus() : ui['marker-name'].focus();
  });
  ui['marker-form'].addEventListener('submit', (event) => {
    event.preventDefault();
    if (!manager) return;
    const draft = formDraft();
    const marker = { name: draft.name.trim(), x: Number(draft.x), y: Number(draft.y), icon: draft.icon };
    try {
      if (!marker.name) throw new TypeError('Укажите название метки.');
      if (!draft.x.trim() || !draft.y.trim() || !Number.isFinite(marker.x) || !Number.isFinite(marker.y)) {
        throw new TypeError('Укажите обе координаты X и Y числами.');
      }
      const saved = editingId ? manager.update(editingId, marker) : manager.add(marker);
      closeMarkerDialog();
      focusResult({ ...saved, kind: 'user' });
      notify(storageWarning ? `Метка доступна в этом сеансе. ${storageWarning}` : 'Метка сохранена в этом браузере.', Boolean(storageWarning));
    } catch (error) {
      ui['marker-form-error'].textContent = messageOf(error);
      ui['marker-form-error'].hidden = false;
    }
  });
}

async function loadPlaces() {
  try {
    const response = await fetch('./data/places.json', { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new TypeError('Expected a place catalogue array');
    return data.filter((place) => place && typeof place.id === 'string' && typeof place.name === 'string'
      && Number.isFinite(place.x) && Number.isFinite(place.y)
      && place.x >= config.worldBounds.minX && place.x <= config.worldBounds.maxX
      && place.y >= config.worldBounds.minY && place.y <= config.worldBounds.maxY);
  } catch (error) {
    console.warn('Place catalogue unavailable:', error);
    notify('Каталог известных мест недоступен. Поиск координат и личные метки продолжают работать.', true);
    return [];
  }
}

async function start() {
  try {
    const [{ createMap }, { MAP_CONFIG }] = await Promise.all([import('./map.js'), import('./config.js')]);
    if (!window.L) throw new Error('Leaflet is unavailable. Check assets/vendor/leaflet/.');
    config = MAP_CONFIG;
    const bounds = config.worldBounds;
    ui['bounds-x'].textContent = `${numberFormat.format(bounds.minX)} … ${numberFormat.format(bounds.maxX)}`;
    ui['bounds-y'].textContent = `${numberFormat.format(bounds.minY)} … ${numberFormat.format(bounds.maxY)}`;
    ui['bounds-status'].textContent = config.calibration === 'community' ? 'ПО ИСТОЧНИКУ' : config.calibration === 'unverified' ? 'УСЛОВНАЯ' : 'ПАРАМЕТРЫ';
    ui['marker-x'].min = bounds.minX; ui['marker-x'].max = bounds.maxX;
    ui['marker-y'].min = bounds.minY; ui['marker-y'].max = bounds.maxY;
    core = createMap(ui.map, { onCoordinate: updateCoordinate, onViewChange: updateView, onTileError: handleTileError, onLayerChange: updateLayer });
    configureInteractions();
    core.setGridVisible(ui['grid-toggle'].checked);
    ui['fit-world'].disabled = false;
    updateButtons();
    ui['map-message'].hidden = true;
    document.body.removeAttribute('data-loading');

    try {
      const [{ createMarkerManager }, searchModule, places] = await Promise.all([
        import('./markers.js'), import('./search.js'), loadPlaces(),
      ]);
      searchPlaces = searchModule.searchPlaces;
      catalogue = places;
      ui['places-count'].textContent = String(places.length);
      manager = createMarkerManager({ L: window.L, map: core.map, bounds, places, onChange: renderMarkers, onEdit: openMarkerDialog, onStorageError: reportStorageError });
      manager.setPlacesVisible(ui['places-toggle'].checked);
      manager.setUsersVisible(ui['users-toggle'].checked);
      if (ui['place-search'].value.trim()) runSearch();
    } catch (error) {
      console.error('Interactive features initialization failed:', error);
      notify('Не удалось загрузить поиск и метки. Карта и переключение стилей доступны; обновите страницу, чтобы повторить.', true);
    }
  } catch (error) {
    console.error('Map initialization failed:', error);
    ui['map-message'].textContent = 'Не удалось открыть карту. Запустите проект через локальный HTTP-сервер и проверьте файлы Leaflet.';
    ui['map-message'].hidden = false;
    ui['connection-status'].textContent = 'ОШИБКА';
    ui['connection-status'].setAttribute('data-error', '');
    document.body.removeAttribute('data-loading');
  }
}

start();
