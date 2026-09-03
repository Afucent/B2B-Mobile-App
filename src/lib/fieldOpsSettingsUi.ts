import type { FieldOperationsSettings } from '@/lib/api/org';
import { formatClock } from '@/lib/format';

function formatShiftTime(hhmm: string | undefined) {
  if (!hhmm) return '—';
  return formatClock(new Date(`1970-01-01T${hhmm}:00`).toISOString());
}

export function formatShiftRange(settings: FieldOperationsSettings | null | undefined) {
  if (!settings?.shift_start_time || !settings?.shift_end_time) {
    return 'Shift settings unavailable';
  }
  return `${formatShiftTime(settings.shift_start_time)} – ${formatShiftTime(settings.shift_end_time)}`;
}

export type FieldOpsSettingRow = { label: string; value: string };

export function buildFieldOpsSettingRows(
  settings: FieldOperationsSettings | null | undefined,
): FieldOpsSettingRow[] {
  if (!settings) return [];

  const rows: FieldOpsSettingRow[] = [
    { label: 'Shift', value: formatShiftRange(settings) },
    {
      label: 'Clock-in window',
      value:
        settings.clock_in_window_minutes != null
          ? `${settings.clock_in_window_minutes} min before shift`
          : '—',
    },
    {
      label: 'Auto clock-out',
      value: settings.auto_clock_out_enabled
        ? `On at ${formatShiftTime(settings.shift_end_time)}`
        : 'Off',
    },
    {
      label: 'Late clock-in threshold',
      value:
        settings.late_clock_in_threshold_minutes != null
          ? `${settings.late_clock_in_threshold_minutes} min`
          : '—',
    },
    {
      label: 'Early clock-out threshold',
      value:
        settings.early_clock_out_threshold_minutes != null
          ? `${settings.early_clock_out_threshold_minutes} min`
          : '—',
    },
    {
      label: 'GPS ping interval',
      value:
        settings.gps_ping_interval_minutes != null
          ? `${settings.gps_ping_interval_minutes} min`
          : '—',
    },
    {
      label: 'GPS-off threshold',
      value:
        settings.gps_off_threshold_minutes != null
          ? `${settings.gps_off_threshold_minutes} min`
          : '—',
    },
    {
      label: 'Location accuracy',
      value:
        settings.location_accuracy_threshold_m != null
          ? `${settings.location_accuracy_threshold_m} m`
          : '—',
    },
  ];

  if (settings.working_days?.length) {
    rows.splice(1, 0, {
      label: 'Working days',
      value: settings.working_days
        .map((d) => d.slice(0, 3).replace(/^./, (c) => c.toUpperCase()))
        .join(', '),
    });
  }

  return rows;
}
