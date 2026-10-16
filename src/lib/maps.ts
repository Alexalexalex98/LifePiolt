/** Indirizzo per cercare un luogo nell'app di mappe del telefono: Mappe su iPhone, Google Maps su Android, web altrove (modulo puro). */
export function mapsUrl(place: string, os: string): string {
  const q = encodeURIComponent(place.trim());
  if (os === 'ios') return `https://maps.apple.com/?q=${q}`;
  if (os === 'android') return `geo:0,0?q=${q}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
