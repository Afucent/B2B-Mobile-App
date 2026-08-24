import { apiRequest } from '@/lib/api/client';

export interface AttendanceRecord {
  id: string;
  organization_id: string;
  employee_id: string;
  date: string;
  clock_in_time: string;
  clock_in_latitude: number;
  clock_in_longitude: number;
  clock_in_address: string | null;
  clock_out_time: string | null;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_out_address: string | null;
  working_hours: number | null;
  late_flag: boolean;
  early_flag: boolean;
  geofence_valid: boolean | null;
  status: string;
  location_tracking_enabled: boolean;
  start_location_label: string | null;
  end_location_label: string | null;
}

export interface TodayStatus {
  is_clocked_in: boolean;
  tracking_active: boolean;
  record: AttendanceRecord | null;
}

export interface LiveVisit {
  id: string;
  store_name: string;
  started_at: string | null;
  duration_label: string;
  status: 'completed' | 'in_progress' | string;
}

export interface EmployeeLiveDetail {
  employee_id: string;
  employee_name: string;
  employee_code: string | null;
  designation: string | null;
  region_label: string | null;
  status: string;
  status_label: string;
  clock_in_time: string | null;
  last_ping_label?: string | null;
  last_ping_at?: string | null;
  late_minutes?: number | null;
  working_duration_label: string | null;
  distance_today_km: number;
  visits_completed: number;
  visits_assigned: number;
  gps_status: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  visits: LiveVisit[];
  attendance_record_id: string | null;
}

export function getTodayStatus() {
  return apiRequest<TodayStatus>('/attendance/today-status');
}

export function clockIn(latitude: number, longitude: number) {
  return apiRequest<AttendanceRecord>('/attendance/clock-in', {
    method: 'POST',
    body: { latitude, longitude },
  });
}

export function clockOut(latitude: number, longitude: number) {
  return apiRequest<AttendanceRecord>('/attendance/clock-out', {
    method: 'POST',
    body: { latitude, longitude },
  });
}

export function pingLocation(latitude: number, longitude: number, accuracy?: number) {
  return apiRequest('/attendance/location-ping', {
    method: 'POST',
    body: {
      latitude,
      longitude,
      accuracy_meters: accuracy,
    },
  });
}

export function startLocation(latitude: number, longitude: number, startLocationLabel?: string) {
  return apiRequest<AttendanceRecord>('/attendance/location/start', {
    method: 'POST',
    body: {
      latitude,
      longitude,
      start_location_label: startLocationLabel,
    },
  });
}

export function endLocation(latitude: number, longitude: number, endLocationLabel?: string) {
  return apiRequest<AttendanceRecord>('/attendance/location/end', {
    method: 'POST',
    body: {
      latitude,
      longitude,
      end_location_label: endLocationLabel,
    },
  });
}

export function getEmployeeLiveDetail(employeeId: string) {
  return apiRequest<EmployeeLiveDetail>(`/attendance/live/${employeeId}`);
}

export function getMyHistory(limit = 30) {
  return apiRequest<{ items: AttendanceRecord[]; total: number }>(
    `/attendance/my-history?limit=${limit}`,
  );
}
