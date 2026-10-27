import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCoordinateQuery, searchPlaces } from '../js/search.js';

const bounds = { minX: -8000, minY: -8000, maxX: 8000, maxY: 8000 };
const places = [
  { id: 'station', name: 'Полиция Палето-Бэй', aliases: ['Paleto Bay police', 'Шериф'], x: -400, y: 6000 },
  { id: 'store', name: 'Магазин 24/7', aliases: ['Store'], x: 100, y: 200 },
];
test('coordinate queries handle signs, decimals, separators and labels without swapping axes', () => {
  for (const query of ['-12.5, 34.25', '−12.5;34.25', '(-12.5 34.25)', 'X: -12.5 Y: 34.25']) {
    assert.deepEqual(parseCoordinateQuery(query, bounds), { x: -12.5, y: 34.25 });
  }
  assert.deepEqual(parseCoordinateQuery('-8000,8000', bounds), { x: -8000, y: 8000 });
  assert.equal(parseCoordinateQuery('24/7', bounds), null);
  assert.equal(parseCoordinateQuery('Полиция Палето-Бэй', bounds), null);
});
test('malformed, non-finite and off-map coordinates fail with actionable messages', () => {
  for (const query of ['12', '12,34,56', 'NaN,0', 'Infinity,0', '1e999,0']) {
    assert.throws(() => parseCoordinateQuery(query, bounds));
  }
  assert.throws(() => parseCoordinateQuery('8001,0', bounds), /границами/);
});
test('name search finds Russian and English aliases, numeric place names and personal markers', () => {
  assert.equal(searchPlaces('paleto police', places, [], bounds)[0].id, 'station');
  assert.equal(searchPlaces('ШЕРИФ', places, [], bounds)[0].id, 'station');
  assert.equal(searchPlaces('24/7', places, [], bounds)[0].id, 'store');
  const result = searchPlaces('мой дом', places, [{ id: 'home', name: 'Мой дом', x: 0, y: 0 }], bounds);
  assert.equal(result[0].kind, 'user');
  assert.equal(result[0].id, 'home');
  assert.deepEqual(searchPlaces('нет такого', places, [], bounds), []);
});
test('coordinate results and catalogue filtering preserve valid map geometry', () => {
  assert.deepEqual(searchPlaces('100,-200', [], [], bounds)[0], {
    id: 'coordinate:100,-200', name: 'Координаты 100, -200', x: 100, y: -200, kind: 'coordinate', category: 'landmark',
  });
  assert.deepEqual(searchPlaces('bad', [{ id: 'bad', name: 'bad', x: NaN, y: 0 }], [], bounds), []);
});
