export const MARKER_STORAGE_KEY = 'gta-v-map.markers.v1';
export const USER_MARKER_ICONS = Object.freeze(['pin', 'star', 'flag']);
export const MAX_USER_MARKERS = 1000;

function validateBounds(bounds) {
  if (!bounds || ['minX', 'minY', 'maxX', 'maxY'].some((key) => !Number.isFinite(bounds[key]))
      || bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) {
    throw new TypeError('Некорректные границы карты.');
  }
}

export function validateMarkerInput(input, bounds) {
  validateBounds(bounds);
  if (!input || typeof input !== 'object') throw new TypeError('Укажите параметры метки.');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 80) throw new RangeError('Название должно содержать от 1 до 80 символов.');
  if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) {
    throw new TypeError('Координаты X и Y должны быть числами.');
  }
  if (input.x < bounds.minX || input.x > bounds.maxX || input.y < bounds.minY || input.y > bounds.maxY) {
    throw new RangeError('Координаты находятся за границами карты.');
  }
  const icon = input.icon ?? 'pin';
  if (!USER_MARKER_ICONS.includes(icon)) throw new RangeError('Выберите значок метки.');
  return { name, x: input.x, y: input.y, icon };
}

function defaultId() {
  return globalThis.crypto?.randomUUID?.() ?? `mark-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Browser storage is optional: a failed write must not discard the session's edits. */
export class MarkerStore {
  constructor({ bounds, storage = null, onStorageError = () => {}, idFactory = defaultId, now = () => new Date().toISOString() }) {
    validateBounds(bounds);
    this.bounds = { ...bounds };
    this.storage = storage;
    this.onStorageError = onStorageError;
    this.idFactory = idFactory;
    this.now = now;
    this.markers = [];
    this.warnings = new Set();
    this.load();
  }

  warn(type, message) {
    if (this.warnings.has(type)) return;
    this.warnings.add(type);
    this.onStorageError(message);
  }

  load() {
    if (!this.storage || typeof this.storage.getItem !== 'function' || typeof this.storage.setItem !== 'function') {
      this.warn('unavailable', 'Хранилище браузера недоступно. Метки сохранятся только до закрытия страницы.');
      return;
    }
    let raw;
    try { raw = this.storage.getItem(MARKER_STORAGE_KEY); }
    catch {
      this.warn('read', 'Не удалось прочитать сохранённые метки. Новые метки пока доступны в этой вкладке.');
      return;
    }
    if (raw === null || raw === undefined || raw === '') return;
    let envelope;
    try { envelope = JSON.parse(raw); }
    catch {
      this.warn('corrupt', 'Сохранённые метки повреждены и не загружены. Можно добавить новые.');
      return;
    }
    if (envelope?.version !== 1 || !Array.isArray(envelope.markers)) {
      this.warn('corrupt', 'Формат сохранённых меток не поддерживается. Можно добавить новые.');
      return;
    }
    const ids = new Set();
    let ignored = 0;
    for (const entry of envelope.markers) {
      try {
        if (this.markers.length >= MAX_USER_MARKERS || typeof entry?.id !== 'string'
            || !entry.id || entry.id.length > 100 || ids.has(entry.id)
            || typeof entry.createdAt !== 'string' || !Number.isFinite(Date.parse(entry.createdAt))) {
          throw new TypeError('Invalid stored marker');
        }
        const marker = { id: entry.id, ...validateMarkerInput(entry, this.bounds), createdAt: entry.createdAt };
        ids.add(marker.id);
        this.markers.push(marker);
      } catch { ignored += 1; }
    }
    if (ignored) this.warn('corrupt', 'Некоторые сохранённые метки повреждены или находятся вне карты и были пропущены.');
  }

  persist() {
    if (!this.storage || typeof this.storage.setItem !== 'function') return;
    try {
      this.storage.setItem(MARKER_STORAGE_KEY, JSON.stringify({ version: 1, markers: this.markers }));
    } catch {
      this.warn('write', 'Не удалось сохранить метки в браузере. Изменения доступны только в этой вкладке.');
    }
  }

  getMarkers() { return this.markers.map((marker) => ({ ...marker })); }

  get(id) {
    const marker = this.markers.find((entry) => entry.id === id);
    return marker ? { ...marker } : null;
  }

  add(input) {
    if (this.markers.length >= MAX_USER_MARKERS) throw new RangeError(`Можно сохранить не более ${MAX_USER_MARKERS} меток.`);
    const values = validateMarkerInput(input, this.bounds);
    let id;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      id = this.idFactory();
      if (typeof id === 'string' && id.length > 0 && id.length <= 100 && !this.markers.some((entry) => entry.id === id)) break;
      id = undefined;
    }
    if (!id) throw new Error('Не удалось создать идентификатор метки. Попробуйте ещё раз.');
    const createdAt = this.now();
    if (typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) throw new TypeError('Некорректное время создания метки.');
    const marker = { id, ...values, createdAt };
    this.markers.push(marker);
    this.persist();
    return { ...marker };
  }

  update(id, patch) {
    const index = this.markers.findIndex((entry) => entry.id === id);
    if (index === -1) throw new RangeError('Метка не найдена.');
    const current = this.markers[index];
    const values = validateMarkerInput({ ...current, ...patch }, this.bounds);
    const marker = { id: current.id, ...values, createdAt: current.createdAt };
    this.markers[index] = marker;
    this.persist();
    return { ...marker };
  }

  remove(id) {
    const index = this.markers.findIndex((entry) => entry.id === id);
    if (index === -1) return false;
    this.markers.splice(index, 1);
    this.persist();
    return true;
  }
}
