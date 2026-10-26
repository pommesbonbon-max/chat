import { MAP_CONFIG } from './config.js';

function finiteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return value;
}

function positiveNumber(value, name) {
  finiteNumber(value, name);
  if (value <= 0) throw new RangeError(`${name} must be positive`);
  return value;
}

/** Validate geometry without guessing bounds or silently stretching a raster. */
export function validateConfig(config = MAP_CONFIG) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('Map config must be an object');
  }
  const { worldBounds: bounds, raster } = config;
  if (!bounds || !raster) {
    throw new TypeError('Map config requires worldBounds and raster');
  }
  for (const key of ['minX', 'minY', 'maxX', 'maxY']) {
    finiteNumber(bounds[key], `worldBounds.${key}`);
  }
  const worldWidth = positiveNumber(bounds.maxX - bounds.minX, 'world width');
  const worldHeight = positiveNumber(bounds.maxY - bounds.minY, 'world height');
  for (const key of ['width', 'height']) {
    positiveNumber(raster[key], `raster.${key}`);
    if (!Number.isSafeInteger(raster[key])) {
      throw new RangeError(`raster.${key} must be a positive safe integer`);
    }
  }
  for (const key of ['offsetX', 'offsetY']) {
    finiteNumber(raster[key], `raster.${key}`);
    if (raster[key] < 0) throw new RangeError(`raster.${key} cannot be negative`);
  }
  const scaleX = positiveNumber(raster.width / worldWidth, 'horizontal scale');
  const scaleY = positiveNumber(raster.height / worldHeight, 'vertical scale');
  const tolerance = Math.max(scaleX, scaleY) * 1e-10;
  if (Math.abs(scaleX - scaleY) > tolerance) {
    throw new RangeError('Raster and world bounds must have an isotropic scale');
  }
  if (!Number.isSafeInteger(config.tileSize) || config.tileSize <= 0) {
    throw new RangeError('tileSize must be a positive safe integer');
  }
  if (!Number.isSafeInteger(config.nativeZoom) || config.nativeZoom < 0) {
    throw new RangeError('nativeZoom must be a non-negative safe integer');
  }
  finiteNumber(config.minZoom, 'minZoom');
  finiteNumber(config.maxZoom, 'maxZoom');
  if (config.minZoom > config.maxZoom) {
    throw new RangeError('minZoom cannot exceed maxZoom');
  }
  positiveNumber(scaleX / 2 ** config.nativeZoom, 'base scale');
  for (const zoom of [config.minZoom, config.maxZoom]) {
    const factor = positiveNumber(2 ** (zoom - config.nativeZoom), 'zoom scale');
    positiveNumber(scaleX * factor, 'pixel scale');
  }
  return config;
}

function geometryAtZoom(zoom, config) {
  validateConfig(config);
  finiteNumber(zoom, 'zoom');
  const factor = positiveNumber(2 ** (zoom - config.nativeZoom), 'zoom scale');
  const { worldBounds: bounds, raster } = config;
  const scale = positiveNumber(
    (raster.width / (bounds.maxX - bounds.minX)) * factor,
    'pixel scale',
  );
  return { bounds, raster, factor, scale };
}

/** World X/Y to continuous XYZ-canvas pixels (pixel edges, not pixel centers). */
export function worldToPixel(x, y, zoom = MAP_CONFIG.nativeZoom, config = MAP_CONFIG) {
  finiteNumber(x, 'world x');
  finiteNumber(y, 'world y');
  const { bounds, raster, factor, scale } = geometryAtZoom(zoom, config);
  return {
    x: finiteNumber(raster.offsetX * factor + (x - bounds.minX) * scale, 'pixel x'),
    y: finiteNumber(raster.offsetY * factor + (bounds.maxY - y) * scale, 'pixel y'),
  };
}

/** Canvas pixels back to world coordinates; off-map points are not clamped. */
export function pixelToWorld(u, v, zoom = MAP_CONFIG.nativeZoom, config = MAP_CONFIG) {
  finiteNumber(u, 'pixel x');
  finiteNumber(v, 'pixel y');
  const { bounds, raster, factor, scale } = geometryAtZoom(zoom, config);
  return {
    x: finiteNumber(bounds.minX + (u - raster.offsetX * factor) / scale, 'world x'),
    y: finiteNumber(bounds.maxY - (v - raster.offsetY * factor) / scale, 'world y'),
  };
}

/** Leaflet's [lat, lng] slots carry game [Y, X], never geographic degrees. */
export function worldToLatLng(x, y) {
  finiteNumber(x, 'world x');
  finiteNumber(y, 'world y');
  return [y, x];
}

/** Retain CRS.Simple's projection and 2^zoom scale; invert Y exactly once. */
export function createGameCRS(L, config = MAP_CONFIG) {
  validateConfig(config);
  if (!L?.CRS?.Simple || typeof L?.Util?.extend !== 'function'
      || typeof L?.Transformation !== 'function') {
    throw new TypeError('createGameCRS requires Leaflet CRS.Simple and Transformation');
  }
  const { worldBounds: bounds, raster, nativeZoom } = config;
  const nativeFactor = 2 ** nativeZoom;
  const scale = raster.width / (bounds.maxX - bounds.minX) / nativeFactor;
  const offsetX = raster.offsetX / nativeFactor - scale * bounds.minX;
  const offsetY = raster.offsetY / nativeFactor + scale * bounds.maxY;
  finiteNumber(offsetX, 'CRS horizontal offset');
  finiteNumber(offsetY, 'CRS vertical offset');
  return L.Util.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(scale, offsetX, -scale, offsetY),
  });
}
