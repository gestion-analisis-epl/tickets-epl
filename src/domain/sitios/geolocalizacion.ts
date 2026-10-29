// La hoja de sitios trae la geolocalizacion como "lat,lng" (con o sin espacio tras la coma); algunos
// sitios traen "N/A" o "0". Solo una coordenada real cuenta: lo demas es "sin geolocalizacion".

export interface Coordenada {
  lat: number;
  lng: number;
}

const COORDENADA = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;

export function parsearGeolocalizacion(texto: string | null | undefined): Coordenada | null {
  const m = texto?.trim().match(COORDENADA);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

// Texto normalizado "lat,lng", o null si no es una coordenada real.
export function geolocalizacionValida(texto: string | null | undefined): string | null {
  const c = parsearGeolocalizacion(texto);
  return c ? `${c.lat},${c.lng}` : null;
}

// Mapa de OpenStreetMap para incrustar (sin llave de API), centrado en el punto y con el marcador.
export function urlMapaEmbebido({ lat, lng }: Coordenada): string {
  const dLng = 0.005;
  const dLat = 0.003;
  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function urlGoogleMaps({ lat, lng }: Coordenada): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
