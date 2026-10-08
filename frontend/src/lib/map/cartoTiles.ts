const CARTO_RASTER_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

/**
 * CARTO raster (PNG) basemap URL.
 * `CARTO_API_KEY` is exposed to the client in `next.config.ts` and sent as `?key=`.
 */
export function cartoTileUrl(): string {
  const apiKey = process.env.CARTO_API_KEY?.trim();
  if (!apiKey) return CARTO_RASTER_TILE_URL;
  return `${CARTO_RASTER_TILE_URL}?key=${encodeURIComponent(apiKey)}`;
}
