import { apiRequest } from '@/lib/api/client';

export interface AttendanceSummary {
  date?: string;
  present: number;
  on_leave: number;
  absent: number;
  total_users?: number;
  /** @deprecated backend may omit; prefer total_users */
  total_employees?: number;
  clocked_in?: number;
}

export type LiveTrackingStatus = 'active' | 'in_transit' | 'idle' | 'gps_off' | 'offline';

export interface LiveEmployeeRow {
  employee_id: string;
  employee_name: string;
  employee_initials?: string;
  avatar_url?: string | null;
  designation?: string | null;
  role?: string | null;
  city?: string | null;
  status?: LiveTrackingStatus | string;
  last_captured_at?: string | null;
  last_latitude?: number | null;
  last_longitude?: number | null;
  last_address?: string | null;
  clock_in_time?: string | null;
  last_ping_label?: string | null;
}

export interface LiveTrackingPanel {
  items: LiveEmployeeRow[];
  stats?: Record<string, number>;
  gps_ping_interval_minutes?: number;
  gps_off_threshold_minutes?: number;
}

export function getAttendanceDashboardSummary(date?: string) {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiRequest<AttendanceSummary>(`/attendance/dashboard-summary${q}`);
}

export function getLiveTrackingPanel() {
  return apiRequest<LiveTrackingPanel>('/attendance/panel');
}

export function getEmployeeLiveDetail(employeeId: string) {
  return apiRequest<Record<string, unknown>>(`/attendance/live/${employeeId}`);
}
