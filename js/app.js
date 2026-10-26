const elements = Object.fromEntries([
  'map', 'map-message', 'zoom-in', 'zoom-out', 'fit-world', 'grid-toggle',
  'coordinate-x', 'coordinate-y', 'zoom-value', 'scale-value', 'bounds-x',
  'bounds-y', 'bounds-status', 'source-status', 'source-note', 'map-mode', 'connection-status',
].map((id) => [id, document.getElementById(id)]));

const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const scaleFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });
let core;
let tileError = false;

function updateButtons() {
  if (!core) return;
  const { map } = core;
  elements['zoom-in'].disabled = map.getZoom() >= map.getMaxZoom();
  elements['zoom-out'].disabled = map.getZoom() <= map.getMinZoom();
}

function updateCoordinate(coordinate) {
  elements['coordinate-x'].value = coordinate ? numberFormat.format(coordinate.x) : '—';
  elements['coordinate-y'].value = coordinate ? numberFormat.format(coordinate.y) : '—';
}

function updateView({ zoom, unitsPerPixel }) {
  elements['zoom-value'].value = numberFormat.format(zoom);
  elements['scale-value'].value = scaleFormat.format(unitsPerPixel);
  updateButtons();
}

function showTileError() {
  tileError = true;
  elements['connection-status'].textContent = 'ОШИБКА ТАЙЛОВ';
  elements['connection-status'].dataset.error = '';
  elements['source-status'].textContent = 'Не удалось загрузить тайлы';
  elements['source-note'].textContent = 'Проверьте наличие файлов карты и путь к тайлам. Координатная сетка и управление доступны.';
}

async function start() {
  try {
    const [{ createMap }, { MAP_CONFIG }] = await Promise.all([
      import('./map.js'),
      import('./config.js'),
    ]);
    if (!window.L) throw new Error('Leaflet is unavailable. Check assets/vendor/leaflet/.');

    const { worldBounds } = MAP_CONFIG;
    elements['bounds-x'].textContent = `${numberFormat.format(worldBounds.minX)} … ${numberFormat.format(worldBounds.maxX)}`;
    elements['bounds-y'].textContent = `${numberFormat.format(worldBounds.minY)} … ${numberFormat.format(worldBounds.maxY)}`;
    elements['bounds-status'].textContent = MAP_CONFIG.calibration === 'community'
      ? 'ПО ИСТОЧНИКУ' : MAP_CONFIG.calibration === 'unverified' ? 'УСЛОВНАЯ' : 'ПАРАМЕТРЫ';

    core = createMap(elements.map, {
      onCoordinate: updateCoordinate,
      onViewChange: updateView,
      onTileError: showTileError,
    });

    elements['zoom-in'].addEventListener('click', () => core.map.zoomIn());
    elements['zoom-out'].addEventListener('click', () => core.map.zoomOut());
    elements['fit-world'].addEventListener('click', () => core.fitWorld());
    elements['grid-toggle'].addEventListener('change', (event) => {
      core.setGridVisible(event.target.checked);
    });
    elements['grid-toggle'].disabled = false;
    elements['fit-world'].disabled = false;
    core.setGridVisible(elements['grid-toggle'].checked);
    updateButtons();

    if (!core.isDiagnostic) {
      const layerId = MAP_CONFIG.layer.id || 'Карта';
      const layerLabel = MAP_CONFIG.layer.label || `${layerId.charAt(0).toLocaleUpperCase('ru-RU')}${layerId.slice(1)}`;
      elements['map-mode'].textContent = layerLabel.toLocaleUpperCase('ru-RU');
      if (!tileError) {
        elements['source-status'].textContent = `Слой ${layerLabel}`;
        elements['source-note'].textContent = MAP_CONFIG.calibration === 'community'
          ? `${layerLabel} подключён. Привязка из открытого проекта; точность по игровым точкам ещё не проверена.`
          : MAP_CONFIG.calibration === 'unverified'
            ? 'Тайлы подключены. Геопривязка и границы требуют проверки по игровым координатам.'
            : 'Карта отображается в игровой системе координат.';
      }
    } else {
      elements['map-mode'].textContent = 'ПРОВЕРОЧНАЯ СЕТКА';
      elements['source-status'].textContent = 'Проверочная сетка';
      elements['source-note'].textContent = 'Исходные тайлы не подключены. Границы будут уточнены при калибровке карты.';
    }
    if (!tileError) elements['connection-status'].textContent = 'ГОТОВО';
    elements['map-message'].hidden = true;
    document.body.removeAttribute('data-loading');
  } catch (error) {
    console.error('Map initialization failed:', error);
    elements['map-message'].textContent = 'Не удалось открыть карту. Запустите проект через локальный HTTP-сервер и проверьте файлы Leaflet.';
    elements['map-message'].hidden = false;
    elements['connection-status'].textContent = 'ОШИБКА';
    elements['connection-status'].dataset.error = '';
    elements['grid-toggle'].disabled = true;
    document.body.removeAttribute('data-loading');
  }
}

start();
