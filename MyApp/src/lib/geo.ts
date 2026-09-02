export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

export function formatDistanceKm(meters: number | null | undefined) {
  if (meters == null || Number.isNaN(meters)) return '—';
  const km = meters / 1000;
  if (km < 0.05) return `${Math.round(meters)} m`;
  return `${km.toFixed(1)} km`;
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function durationClock(fromIso: string, toIso?: string) {
  const end = toIso ? new Date(toIso).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - new Date(fromIso).getTime()) / 60000));
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export function durationStamp(fromIso: string, toIso: string) {
  const mins = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`.replace(/^0h /, '');
}
