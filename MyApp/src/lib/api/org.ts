import { apiRequest } from '@/lib/api/client';

export interface FieldOperationsSettings {
  shift_start_time: string;
  shift_end_time: string;
  clock_in_window_minutes?: number;
  auto_clock_out_time?: string;
  auto_clock_out_enabled?: boolean;
  working_days?: string[];
  late_clock_in_threshold_minutes?: number;
  early_clock_out_threshold_minutes?: number;
  clock_in_geofence_radius_m?: number;
  dealer_geofence_radius_m?: number;
  gps_ping_interval_minutes?: number;
  gps_off_threshold_minutes?: number;
  location_accuracy_threshold_m?: number;
}

export function getFieldOperationsSettings() {
  return apiRequest<FieldOperationsSettings>('/tenant/organization/settings/field-operations');
}

export function updateFieldOperationsSettings(data: Partial<FieldOperationsSettings>) {
  return apiRequest<FieldOperationsSettings>('/tenant/organization/settings/field-operations', {
    method: 'PUT',
    body: data,
  });
}
