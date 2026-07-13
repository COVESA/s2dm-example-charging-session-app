export type LatLng = {
  lat: number;
  lng: number;
};

export function geoJsonPointToLatLng(value: unknown): LatLng {
  if (
    typeof value !== "object" ||
    value === null ||
    !("type" in value) ||
    value.type !== "Point" ||
    !("coordinates" in value) ||
    !Array.isArray(value.coordinates) ||
    value.coordinates.length !== 2
  ) {
    throw new Error("Expected a GeoJSON Point");
  }

  const [lng, lat] = value.coordinates;
  if (
    typeof lng !== "number" ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180 ||
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90
  ) {
    throw new Error("GeoJSON Point coordinates are invalid");
  }

  return { lat, lng };
}
