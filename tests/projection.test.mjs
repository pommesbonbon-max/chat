import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_CONFIG } from '../js/config.js';
import {
  createGameCRS,
  pixelToWorld,
  validateConfig,
  worldToLatLng,
  worldToPixel,
} from '../js/projection.js';

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} ≠ ${expected}`);
}

// The phase-1 mathematical example remains an explicit fixture, not source metadata.
const provisional = {
  ...MAP_CONFIG,
  worldBounds: { minX: -8000, minY: -8000, maxX: 8000, maxY: 8000 },
  raster: { width: 8192, height: 8192, offsetX: 0, offsetY: 0 },
  nativeZoom: 5,
  calibration: 'unverified',
  tileMode: 'diagnostic',
};

const padded = {
  ...provisional,
  worldBounds: { minX: -100, minY: -200, maxX: 500, maxY: 100 },
  raster: { width: 1200, height: 600, offsetX: 128, offsetY: 64 },
  nativeZoom: 3,
};

test('provisional native raster corners, center and one-unit scale are explicit', () => {
  const native = (x, y) => worldToPixel(x, y, 5, provisional);
  assert.deepEqual(native(-8000, 8000), { x: 0, y: 0 });
  assert.deepEqual(native(8000, -8000), { x: 8192, y: 8192 });
  assert.deepEqual(native(0, 0), { x: 4096, y: 4096 });
  close(native(1, 0).x - native(0, 0).x, 0.512, 'native pixel scale');
});

test('inverse works across native, fractional and overzoom levels, including outside bounds', () => {
  const points = [[0, 0], [-8000, 8000], [8000, -8000], [123.456, -789.123], [9000, -10000]];
  for (const zoom of [0, 2, 3.5, 5, 6]) {
    for (const [x, y] of points) {
      const pixel = worldToPixel(x, y, zoom, provisional);
      const world = pixelToWorld(pixel.x, pixel.y, zoom, provisional);
      close(world.x, x, `inverse x at zoom ${zoom}`);
      close(world.y, y, `inverse y at zoom ${zoom}`);
    }
  }
  assert.deepEqual(worldToPixel(0, 0, 0, provisional), { x: 128, y: 128 });
  assert.deepEqual(worldToPixel(0, 0, 6, provisional), { x: 8192, y: 8192 });
});

test('source canvas uses the documented community affine at bundled native zoom 5', () => {
  assert.equal(MAP_CONFIG.calibration, 'community');
  assert.equal(MAP_CONFIG.tileMode, 'xyz');
  assert.equal(MAP_CONFIG.nativeZoom, 5);
  assert.equal(MAP_CONFIG.layer.minNativeZoom, 0);
  const origin = worldToPixel(0, 0);
  close(origin.x, 3885.48, 'source origin x');
  close(origin.y, 4967.2, 'source origin y');
  const control = worldToPixel(1000, 2000, 5);
  close(control.x, 4287.88, 'source control x');
  close(control.y, 4162.4, 'source control y');
  for (const [x, y] of [[0, 0], [-4000, 8000], [123.456, -789.123]]) {
    const pixel = worldToPixel(x, y, 5);
    close(pixel.x * 4, 1.6096 * x + 15541.92, 'original source z7 affine x');
    close(pixel.y * 4, -1.6096 * y + 19868.8, 'original source z7 affine y');
  }
});

test('full source canvas corners invert without cropping or altering the aspect ratio', () => {
  const { minX, minY, maxX, maxY } = MAP_CONFIG.worldBounds;
  const corners = [
    [0, 0, minX, maxY],
    [8192, 0, maxX, maxY],
    [0, 8192, minX, minY],
    [8192, 8192, maxX, minY],
  ];
  for (const [u, v, x, y] of corners) {
    const world = pixelToWorld(u, v, 5);
    close(world.x, x, 'source corner world x');
    close(world.y, y, 'source corner world y');
    const pixel = worldToPixel(x, y, 5);
    close(pixel.x, u, 'source corner canvas x');
    close(pixel.y, v, 'source corner canvas y');
  }
  close(maxX - minX, maxY - minY, 'square canvas world extent');
});

test('rectangular useful image retains isotropic scale and independent canvas padding', () => {
  assert.equal(validateConfig(padded), padded);
  assert.deepEqual(worldToPixel(-100, 100, 3, padded), { x: 128, y: 64 });
  assert.deepEqual(worldToPixel(500, -200, 3, padded), { x: 1328, y: 664 });
  assert.deepEqual(worldToPixel(-100, 100, 2, padded), { x: 64, y: 32 });
  for (const zoom of [0, 2.5, 3, 6]) {
    const pixel = worldToPixel(147, -61, zoom, padded);
    const world = pixelToWorld(pixel.x, pixel.y, zoom, padded);
    close(world.x, 147, 'padded inverse x');
    close(world.y, -61, 'padded inverse y');
  }
});

const mockLeaflet = {
  CRS: { Simple: { scale: (zoom) => 2 ** zoom, projection: { id: 'LonLat' } } },
  Util: { extend: Object.assign },
  Transformation: class {
    constructor(a, b, c, d) { Object.assign(this, { a, b, c, d }); }
    transform(point, scale) {
      return { x: (this.a * point.x + this.b) * scale, y: (this.c * point.y + this.d) * scale };
    }
  },
};

test('CRS agrees with pixel equations, preserves inherited scale and leaves Simple unchanged', () => {
  for (const config of [MAP_CONFIG, provisional, padded]) {
    const crs = createGameCRS(mockLeaflet, config);
    assert.equal(crs.projection, mockLeaflet.CRS.Simple.projection);
    assert.equal(crs.scale, mockLeaflet.CRS.Simple.scale);
    for (const zoom of [0, 2.5, config.nativeZoom, 6]) {
      for (const [x, y] of [[0, 0], [config.worldBounds.minX, config.worldBounds.maxY], [143, -251]]) {
        const pixel = crs.transformation.transform({ x, y }, crs.scale(zoom));
        const expected = worldToPixel(x, y, zoom, config);
        close(pixel.x, expected.x, 'CRS x');
        close(pixel.y, expected.y, 'CRS y');
      }
    }
  }
  assert.equal(mockLeaflet.CRS.Simple.transformation, undefined);
  const t = createGameCRS(mockLeaflet, provisional).transformation;
  assert.deepEqual([t.a, t.b, t.c, t.d], [0.016, 128, -0.016, 128]);
  assert.deepEqual(worldToLatLng(123, -456), [-456, 123]);
});

test('invalid bounds, anisotropy, dimensions, padding and zoom configuration fail visibly', () => {
  const invalid = [
    null,
    {},
    { ...MAP_CONFIG, worldBounds: { ...MAP_CONFIG.worldBounds, minX: MAP_CONFIG.worldBounds.maxX } },
    { ...MAP_CONFIG, worldBounds: { ...MAP_CONFIG.worldBounds, maxY: Infinity } },
    { ...MAP_CONFIG, raster: { ...MAP_CONFIG.raster, height: 4096 } },
    { ...MAP_CONFIG, raster: { ...MAP_CONFIG.raster, width: 0 } },
    { ...MAP_CONFIG, raster: { ...MAP_CONFIG.raster, offsetX: -1 } },
    { ...MAP_CONFIG, tileSize: 0 },
    { ...MAP_CONFIG, nativeZoom: 1.5 },
    { ...MAP_CONFIG, nativeZoom: 2048 },
    { ...MAP_CONFIG, minZoom: 7 },
    { ...MAP_CONFIG, maxZoom: NaN },
  ];
  for (const config of invalid) {
    assert.throws(() => validateConfig(config));
    assert.throws(() => createGameCRS(mockLeaflet, config));
  }
});

test('non-numeric coordinates, invalid zooms and a missing Leaflet instance are rejected', () => {
  assert.throws(() => worldToPixel('1', 2), /finite number/);
  assert.throws(() => worldToPixel(1, 2, Infinity), /finite number/);
  assert.throws(() => worldToPixel(1, 2, 2000), /finite number|positive/);
  assert.throws(() => pixelToWorld(NaN, 2), /finite number/);
  assert.throws(() => worldToLatLng(1, undefined), /finite number/);
  assert.throws(() => createGameCRS(null), /Leaflet/);
});
