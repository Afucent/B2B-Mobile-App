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

export const DEFAULT_WORKING_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
] as const;

const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function normalizedWorkingDays(workingDays?: string[] | null): Set<string> {
  const source =
    workingDays && workingDays.length > 0 ? workingDays : [...DEFAULT_WORKING_DAYS];
  const allowed = new Set(source.map((day) => day.trim().toLowerCase()).filter(Boolean));
  return allowed.size > 0 ? allowed : new Set(DEFAULT_WORKING_DAYS);
}

export function isWorkingDayIso(iso: string, workingDays?: string[] | null): boolean {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const key = WEEKDAY_KEYS[date.getDay()] ?? '';
  if (!key) return false;
  return normalizedWorkingDays(workingDays).has(key);
}

export function computeWorkingDaysBetween(
  fromDate: string,
  toDate: string,
  workingDays?: string[] | null,
): number {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
  const allowed = normalizedWorkingDays(workingDays);
  let total = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = WEEKDAY_KEYS[cursor.getDay()];
    if (key && allowed.has(key)) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

export function addWorkingDaysInclusive(
  fromDate: string,
  count: number,
  workingDays?: string[] | null,
): string {
  if (count <= 0) return fromDate;
  const allowed = normalizedWorkingDays(workingDays);
  const cursor = new Date(`${fromDate}T00:00:00`);
  if (Number.isNaN(cursor.getTime())) return '';
  let remaining = count;
  while (remaining > 0) {
    const key = WEEKDAY_KEYS[cursor.getDay()];
    if (key && allowed.has(key)) {
      remaining -= 1;
      if (remaining === 0) break;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return ymd(cursor);
}

export function dateInLeaveRanges(
  iso: string,
  ranges: Array<{ from_date: string; to_date: string }>,
): boolean {
  return ranges.some((range) => iso >= range.from_date && iso <= range.to_date);
}

export function cancelLeaveBreakdown(
  fromDate: string,
  toDate: string,
  cancelDay = ymd(new Date()),
  workingDays?: string[] | null,
): { daysUsed: number; daysRefunded: number; originalDays: number } {
  const originalDays = computeWorkingDaysBetween(fromDate, toDate, workingDays);
  if (!originalDays) return { daysUsed: 0, daysRefunded: 0, originalDays: 0 };
  if (cancelDay <= fromDate) {
    return { daysUsed: 0, daysRefunded: originalDays, originalDays };
  }
  if (cancelDay > toDate) {
    return { daysUsed: originalDays, daysRefunded: 0, originalDays };
  }
  const usedEndDate = parseYmd(cancelDay);
  usedEndDate.setDate(usedEndDate.getDate() - 1);
  const daysUsed = computeWorkingDaysBetween(fromDate, ymd(usedEndDate), workingDays);
  return {
    daysUsed,
    daysRefunded: originalDays - daysUsed,
    originalDays,
  };
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
