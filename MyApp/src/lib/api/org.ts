import { apiRequest } from '@/lib/api/client';

export interface FieldOperationsSettings {
  shift_start_time: string;
  shift_end_time: string;
  auto_clock_out_time: string;
  dealer_geofence_radius_m: number;
  clock_in_geofence_radius_m: number;
}

export function getFieldOperationsSettings() {
  return apiRequest<FieldOperationsSettings>('/tenant/organization/settings/field-operations');
}
