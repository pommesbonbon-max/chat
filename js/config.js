/**
 * Flamm64 atlas, using the community affine from oyuh/w3w-map.
 * Source z7: u = 1.6096 * X + 15541.92; v = -1.6096 * Y + 19868.8.
 * The bundled z0–5 subset has a 8192px canvas: divide z7 pixels by four.
 * This is community calibration, not independently verified 1:1 accuracy.
 * raster.width/height describe the useful image; offsetX/Y are its padding
 * inside the XYZ tile canvas, all measured at nativeZoom.
 */
const RASTER_SIZE = 8192;
const PIXELS_PER_GAME_UNIT = 0.4024;
const ORIGIN_PIXEL_X = 3885.48;
const ORIGIN_PIXEL_Y = 4967.2;
const ATTRIBUTION = 'GTA V © <a href="https://www.rockstargames.com/">Rockstar Games</a>'
  + ' · <a href="https://github.com/Flamm64/GTA-V-World-Map">Zslash / Martin Floden (Flamm64)</a>';
const BASE_LAYERS = ['atlas', 'satellite', 'roadmap'].map((id) => ({
  id,
  label: { atlas: 'Atlas', satellite: 'Satellite', roadmap: 'Roadmap' }[id],
  minNativeZoom: 0,
  url: `./assets/tiles/${id}/{z}/{x}/{y}.jpg`,
  attribution: ATTRIBUTION,
}));

export const MAP_CONFIG = {
  worldBounds: {
    minX: -ORIGIN_PIXEL_X / PIXELS_PER_GAME_UNIT,
    minY: (ORIGIN_PIXEL_Y - RASTER_SIZE) / PIXELS_PER_GAME_UNIT,
    maxX: (RASTER_SIZE - ORIGIN_PIXEL_X) / PIXELS_PER_GAME_UNIT,
    maxY: ORIGIN_PIXEL_Y / PIXELS_PER_GAME_UNIT,
  },
  raster: {
    width: RASTER_SIZE,
    height: RASTER_SIZE,
    offsetX: 0,
    offsetY: 0,
  },
  tileSize: 256,
  // Initial framing in source pixels; it does not crop tiles or change the CRS.
  viewPixelBounds: { minX: 2048, minY: 1536, maxX: 6656, maxY: 6912 },
  nativeZoom: 5,
  minZoom: 0,
  maxZoom: 6,
  calibration: 'community',
  tileMode: 'xyz',
  defaultLayerId: 'atlas',
  layers: BASE_LAYERS,
  layer: BASE_LAYERS[0],
};
