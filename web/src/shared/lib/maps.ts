/**
 * Directions links. Lives here rather than in CampMap so a camp card can offer
 * "get directions" without pulling the Leaflet chunk into the list bundle.
 */
export function googleMapsHref(
  lat: number | null,
  lng: number | null,
  fallbackQuery: string,
): string {
  if (lat !== null && lng !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery)}`;
}
