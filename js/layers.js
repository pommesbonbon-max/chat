/** Base styles share one CRS and never change the current view or overlays. */
export function createBaseLayerManager(L, map, config, {
  onChange = () => {}, onTileError = () => {},
} = {}) {
  const definitions = config.layers || [config.layer];
  const registry = new Map();
  let current = null;
  const bounds = map.options.maxBounds;

  for (const definition of definitions) {
    if (!definition?.id || !definition.url || registry.has(definition.id)) {
      throw new TypeError('Each base layer needs a unique id and a tile URL');
    }
    const layer = L.tileLayer(definition.url, {
      tileSize: config.tileSize,
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
      maxNativeZoom: definition.nativeZoom ?? config.nativeZoom,
      minNativeZoom: definition.minNativeZoom ?? 0,
      bounds, noWrap: true, tms: false, detectRetina: false,
      attribution: definition.attribution || '', keepBuffer: 2,
    });
    const entry = { definition, layer, failures: new Set() };
    const report = (status) => {
      if (current === entry) onChange({ id: definition.id, label: definition.label || definition.id, status });
    };
    const tileKey = ({ coords }) => coords ? `${coords.z}/${coords.x}/${coords.y}` : 'unknown';
    layer.on('loading', () => report(entry.failures.size ? 'error' : 'loading'));
    layer.on('tileerror', (event) => {
      entry.failures.add(tileKey(event));
      if (current === entry) {
        report('error');
        onTileError({ layerId: definition.id });
      }
    });
    layer.on('tileload', (event) => entry.failures.delete(tileKey(event)));
    layer.on('tileunload', (event) => {
      if (entry.failures.delete(tileKey(event)) && !entry.failures.size) {
        report(layer.isLoading() ? 'loading' : 'ready');
      }
    });
    layer.on('load', () => report(entry.failures.size ? 'error' : 'ready'));
    registry.set(definition.id, entry);
  }

  function select(id) {
    const next = registry.get(id);
    if (!next) throw new RangeError(`Unknown map style: ${id}`);
    if (next === current) return false;
    if (current) map.removeLayer(current.layer);
    current = next;
    current.failures.clear();
    onChange({ id, label: next.definition.label || id, status: 'loading' });
    next.layer.addTo(map);
    return true;
  }

  select(config.defaultLayerId || config.layer?.id || definitions[0].id);
  return {
    select,
    get id() { return current?.definition.id; },
    get layer() { return current?.layer; },
    destroy() {
      for (const { layer } of registry.values()) { layer.off(); map.removeLayer(layer); }
      registry.clear(); current = null;
    },
  };
}
