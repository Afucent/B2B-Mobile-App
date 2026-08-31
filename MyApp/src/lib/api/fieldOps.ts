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

export type AttendanceDayEntry = {
  employee_id: string;
  employee_name: string;
  employee_initials?: string;
  avatar_url?: string | null;
  designation?: string | null;
  attendance_record_id: string;
  clock_in_time: string;
  clock_out_time?: string | null;
  working_hours?: number | null;
  status?: string | null;
  on_location: boolean;
  last_latitude?: number | null;
  last_longitude?: number | null;
  last_address?: string | null;
  last_captured_at?: string | null;
};

export type AttendanceDayBoard = {
  date: string;
  items: AttendanceDayEntry[];
  clocked_in: number;
  clocked_out?: number;
  on_location: number;
  off_location: number;
};

export function getAttendanceDayBoard(date?: string) {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiRequest<AttendanceDayBoard>(`/attendance/day-board${q}`);
}

export function getLiveTrackingPanel() {
  return apiRequest<LiveTrackingPanel>('/attendance/panel');
}

export type EmployeeLiveDetail = {
  employee_id: string;
  employee_name?: string;
  employee_initials?: string;
  avatar_url?: string | null;
  designation?: string | null;
  status?: string | null;
  status_label?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  last_ping_at?: string | null;
  last_ping_label?: string | null;
  clock_in_time?: string | null;
  attendance_record_id?: string | null;
  gps_status?: string | null;
};

export function getEmployeeLiveDetail(employeeId: string) {
  return apiRequest<EmployeeLiveDetail>(`/attendance/live/${employeeId}`);
}

export type LocationTrailPoint = {
  id: string;
  attendance_record_id: string;
  employee_id: string;
  captured_at: string;
  latitude: number;
  longitude: number;
  address: string | null;
  accuracy_meters: number | null;
  source: string;
};

export type LocationTrail = {
  attendance_record_id: string | null;
  employee_id: string;
  points: LocationTrailPoint[];
  date?: string | null;
};

export function getAttendanceTrail(recordId: string) {
  return apiRequest<LocationTrail>(`/attendance/records/${recordId}/trail`);
}

export function getEmployeeTrailByDate(employeeId: string, date?: string) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiRequest<LocationTrail>(`/attendance/live/${employeeId}/trail${qs}`);
}
