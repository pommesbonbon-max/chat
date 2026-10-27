import test from 'node:test';
import assert from 'node:assert/strict';
import { MarkerStore, MARKER_STORAGE_KEY, MAX_USER_MARKERS, validateMarkerInput } from '../js/marker-store.js';

const bounds = { minX: -100, minY: -200, maxX: 300, maxY: 400 };
const date = '2026-10-27T10:00:00.000Z';
function memoryStorage(initial) {
  const values = new Map(initial ? [[MARKER_STORAGE_KEY, initial]] : []);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function makeStore(options = {}) {
  let nextId = 0;
  return new MarkerStore({ bounds, storage: memoryStorage(), idFactory: () => `id-${++nextId}`, now: () => date, ...options });
}

test('CRUD persists game coordinates, icon and creation time across reloads', () => {
  const storage = memoryStorage();
  const store = makeStore({ storage });
  const added = store.add({ name: '  Дом  ', x: -23.75, y: 124.125, icon: 'star' });
  assert.deepEqual(added, { id: 'id-1', name: 'Дом', x: -23.75, y: 124.125, icon: 'star', createdAt: date });
  assert.deepEqual(makeStore({ storage }).getMarkers(), [added]);
  const updated = store.update(added.id, { name: 'База', x: 110, icon: 'flag', id: 'override', createdAt: 'override' });
  assert.equal(updated.id, added.id); assert.equal(updated.createdAt, date);
  assert.equal(updated.x, 110); assert.equal(updated.y, 124.125); assert.equal(updated.icon, 'flag');
  assert.deepEqual(makeStore({ storage }).getMarkers(), [updated]);
  assert.equal(store.remove(added.id), true); assert.equal(store.remove(added.id), false);
  assert.deepEqual(makeStore({ storage }).getMarkers(), []);
});

test('snapshots and return values cannot mutate stored markers', () => {
  const store = makeStore();
  const point = store.add({ name: 'Точка', x: 0, y: 0 });
  point.x = 999;
  const snapshot = store.getMarkers(); snapshot[0].name = 'Injected';
  const single = store.get(point.id); single.y = 999;
  assert.equal(store.get(point.id).x, 0); assert.equal(store.get(point.id).y, 0);
  assert.equal(store.get(point.id).name, 'Точка');
});

test('invalid names, finite coordinates, bounds and unsupported icons fail before writes', () => {
  const store = makeStore();
  for (const input of [
    { name: '', x: 0, y: 0 }, { name: ' '.repeat(8), x: 0, y: 0 },
    { name: 'x'.repeat(81), x: 0, y: 0 }, { name: 'A', x: '1', y: 0 },
    { name: 'A', x: NaN, y: 0 }, { name: 'A', x: 0, y: Infinity },
    { name: 'A', x: 301, y: 0 }, { name: 'A', x: 0, y: -201 },
    { name: 'A', x: 0, y: 0, icon: '<svg>' },
  ]) assert.throws(() => store.add(input));
  assert.deepEqual(store.getMarkers(), []);
  assert.deepEqual(validateMarkerInput({ name: '<img onerror=alert(1)>', x: -100, y: 400 }, bounds), {
    name: '<img onerror=alert(1)>', x: -100, y: 400, icon: 'pin',
  });
  assert.throws(() => store.update('missing', { name: 'B' }), /не найдена/);
});

test('malformed storage and unsupported versions are ignored with a warning', () => {
  for (const raw of ['{broken', 'null', '[]', JSON.stringify({ version: 2, markers: [] })]) {
    const warnings = [];
    const store = makeStore({ storage: memoryStorage(raw), onStorageError: (message) => warnings.push(message) });
    assert.deepEqual(store.getMarkers(), []); assert.equal(warnings.length, 1);
    assert.equal(store.add({ name: 'Новая', x: 0, y: 0 }).name, 'Новая');
  }
});

test('mixed corrupted and duplicate stored entries preserve only valid markers', () => {
  const valid = { id: 'ok', name: 'Место', x: 10, y: 20, icon: 'pin', createdAt: date };
  const raw = JSON.stringify({ version: 1, markers: [valid, valid, null, { ...valid, id: 'bad', x: 999 }, { ...valid, id: 'bad-date', createdAt: 'no' }] });
  const warnings = [];
  const store = makeStore({ storage: memoryStorage(raw), onStorageError: (message) => warnings.push(message) });
  assert.deepEqual(store.getMarkers(), [valid]); assert.equal(warnings.length, 1);
});

test('unavailable and failed writes preserve session edits and report durability limits', () => {
  const warnings = [];
  const storage = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  const store = makeStore({ storage, onStorageError: (message) => warnings.push(message) });
  const point = store.add({ name: 'Вкладка', x: 0, y: 0 });
  store.update(point.id, { y: 22 });
  assert.equal(store.get(point.id).y, 22); assert.equal(warnings.length, 1);
  assert.match(warnings[0], /только в этой вкладке/);
  const unavailable = [];
  const session = makeStore({ storage: null, onStorageError: (message) => unavailable.push(message) });
  session.add({ name: 'Без хранилища', x: 0, y: 0 });
  assert.equal(session.getMarkers().length, 1); assert.equal(unavailable.length, 1);
});

test('the marker limit prevents oversized persistence and duplicate generated ids fail safely', () => {
  const full = Array.from({ length: MAX_USER_MARKERS }, (_, index) => ({
    id: `point-${index}`, name: 'Точка', x: 0, y: 0, icon: 'pin', createdAt: date,
  }));
  const store = makeStore({ storage: memoryStorage(JSON.stringify({ version: 1, markers: full })) });
  assert.throws(() => store.add({ name: 'Лишняя', x: 0, y: 0 }), /1000/);
  const duplicate = makeStore({ idFactory: () => 'same' });
  duplicate.add({ name: 'A', x: 0, y: 0 });
  assert.throws(() => duplicate.add({ name: 'B', x: 0, y: 0 }), /идентификатор/);
  assert.equal(duplicate.getMarkers().length, 1);
});
