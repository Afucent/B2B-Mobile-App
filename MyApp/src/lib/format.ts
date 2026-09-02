const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
};

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
};

const WEEKDAY_OPTS: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  timeZone: 'Asia/Kolkata',
};

export function formatClock(iso?: string | null, fallback = '—') {
  if (!iso) return fallback;
  return new Date(iso).toLocaleTimeString('en-IN', TIME_OPTS).replace(' am', ' AM').replace(' pm', ' PM');
}

export function formatDate(iso?: string | Date | null) {
  const date = iso instanceof Date ? iso : iso ? new Date(iso) : new Date();
  return date.toLocaleDateString('en-US', DATE_OPTS);
}

export function formatWeekday(iso?: string | Date | null) {
  const date = iso instanceof Date ? iso : iso ? new Date(iso) : new Date();
  return date.toLocaleDateString('en-US', WEEKDAY_OPTS);
}

export function formatLongDate(iso?: string | Date | null) {
  const date = iso instanceof Date ? iso : iso ? new Date(iso) : new Date();
  const day = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const weekday = date.toLocaleDateString('en-US', WEEKDAY_OPTS);
  return `${day} · ${weekday}`;
}

export function greetingForNow() {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }).format(new Date()),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'A';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function employeeCode(userId: string) {
  return `EMP-${userId.split('-')[0]?.toUpperCase() ?? '0000'}`;
}

export function durationLabel(fromIso?: string | null, to = new Date()) {
  if (!fromIso) return '0h 0m';
  const start = new Date(fromIso).getTime();
  const mins = Math.max(0, Math.round((to.getTime() - start) / 60000));
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${hours}h ${minutes}m`;
}

export function hoursToLabel(hours?: number | null) {
  if (hours == null) return '0h 0m';
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}h ${m}m`;
}

export function formatKm(km?: number | null) {
  return `${(km ?? 0).toFixed(1)} km`;
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isMobileNumber(value: string) {
  return /^\d{10}$/.test(value.trim().replace(/\s+/g, ''));
}

export function formatLiveStatus(status?: string | null) {
  const key = (status ?? '').toLowerCase();
  if (key === 'gps_off') return 'Last ping stale';
  if (key === 'in_transit') return 'In transit';
  if (key === 'active') return 'Active';
  if (key === 'idle') return 'Idle';
  if (key === 'offline') return 'Offline';
  return status ? status.replace(/_/g, ' ') : '';
}

export function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    number: /\d/.test(password),
    uppercase: /[A-Z]/.test(password),
  };
}

export function mapPreviewUrl(lat: number, lon: number, width = 720, height = 420) {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=15&size=${width}x${height}&markers=${lat},${lon},ol-marker`;
}

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}
