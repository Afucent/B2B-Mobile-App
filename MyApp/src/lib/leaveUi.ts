import { Colors } from '@/constants/theme';

export function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseYmd(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function displayYmd(value: string) {
  return parseYmd(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function displayYmdRange(from: string, to: string) {
  const start = parseYmd(from);
  const end = parseYmd(to);
  if (from === to) return displayYmd(from);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${displayYmd(from)} – ${displayYmd(to)}`;
}

export function inclusiveDays(from: string, to: string) {
  const start = parseYmd(from).getTime();
  const end = parseYmd(to).getTime();
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

export function fiscalPeriod(date = new Date()) {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return {
    label: `FY ${startYear}–${String(startYear + 1).slice(2)}`,
    reset: `Apr 1, ${startYear + 1}`,
  };
}

export function leaveStatusMeta(status: string) {
  const key = status.toLowerCase();
  if (key === 'approved') {
    return { label: 'Approved', bg: Colors.successBg, color: Colors.successText };
  }
  if (key === 'rejected') {
    return { label: 'Rejected', bg: Colors.dangerBg, color: Colors.danger };
  }
  return { label: key === 'pending' ? 'Pending' : status, bg: Colors.pendingBg, color: Colors.pendingText };
}
