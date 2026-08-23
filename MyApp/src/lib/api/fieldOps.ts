import { apiRequest } from '@/lib/api/client';

export interface AttendanceSummary {
  present?: number;
  absent?: number;
  on_leave?: number;
  total_employees?: number;
  clocked_in?: number;
}

export interface LiveEmployeeRow {
  employee_id: string;
  employee_name: string;
  designation?: string | null;
  status?: string;
  last_captured_at?: string | null;
  last_latitude?: number | null;
  last_longitude?: number | null;
  last_address?: string | null;
  clock_in_time?: string | null;
}

export function getAttendanceDashboardSummary() {
  return apiRequest<AttendanceSummary>('/attendance/dashboard-summary');
}

export function getLiveTrackingPanel() {
  return apiRequest<{ items: LiveEmployeeRow[]; stats?: Record<string, number> }>('/attendance/panel');
}

export function getEmployeeLiveDetail(employeeId: string) {
  return apiRequest<Record<string, unknown>>(`/attendance/live/${employeeId}`);
}
