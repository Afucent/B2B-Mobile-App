import { apiRequest } from '@/lib/api/client';

export interface OrgProfile {
  id: string;
  name: string;
  company_code: string;
  industry_type?: string;
  industry_label?: string;
  plan_name?: string | null;
  plan_duration_months?: number | null;
  status?: string;
  admin?: {
    name: string;
    personal_email: string;
    mobile?: string | null;
    designation?: string | null;
  };
  domain_name?: string | null;
  domain_email?: string | null;
  registered_address?: string | null;
  gst_tax_id?: string | null;
  currency?: string;
  language?: string;
  timezone?: string;
  logo_url?: string | null;
  company_description?: string | null;
}

export interface FieldOpsSettings {
  shift_start_time?: string | null;
  shift_end_time?: string | null;
  late_grace_minutes?: number | null;
  auto_clock_out?: boolean;
  geofence_radius_meters?: number | null;
}

export function getOrgProfile() {
  return apiRequest<OrgProfile>('/tenant/organization/profile');
}

export function updateOrgProfile(data: Record<string, unknown>) {
  return apiRequest<OrgProfile>('/tenant/organization/profile', {
    method: 'PATCH',
    body: data,
  });
}

export function getFieldOpsSettings() {
  return apiRequest<FieldOpsSettings>('/tenant/organization/settings/field-operations');
}

export function updateFieldOpsSettings(data: Record<string, unknown>) {
  return apiRequest<FieldOpsSettings>('/tenant/organization/settings/field-operations', {
    method: 'PUT',
    body: data,
  });
}

export function getOrgPrivacy() {
  return apiRequest<{ privacy_policy?: string | null; data_disclosure_statement?: string | null }>(
    '/tenant/organization/privacy',
  );
}

export function updateOrgPrivacy(data: Record<string, unknown>) {
  return apiRequest('/tenant/organization/privacy', {
    method: 'PUT',
    body: data,
  });
}

export function requestPlanUpgrade() {
  return apiRequest<{ message: string }>('/tenant/organization/plan/upgrade-request', {
    method: 'POST',
  });
}

export interface OfficeLocation {
  id: string;
  name: string;
  address: string;
  radius_m: number;
  status: string;
}

export interface GeofenceSettings {
  default_geofence_radius_m: number;
  enforce_geofence: boolean;
  bypass_approval_required: boolean;
  multiple_locations_enabled: boolean;
  tracking_interval_minutes: number;
  track_only_working_hours: boolean;
  locations: OfficeLocation[];
}

export function getGeofenceSettings() {
  return apiRequest<GeofenceSettings>('/tenant/organization/settings/geofence');
}

export function updateGeofenceSettings(data: Partial<Omit<GeofenceSettings, 'locations'>>) {
  return apiRequest<GeofenceSettings>('/tenant/organization/settings/geofence', {
    method: 'PATCH',
    body: data,
  });
}

export function resetGeofenceSettings() {
  return apiRequest<GeofenceSettings>('/tenant/organization/settings/geofence/reset', {
    method: 'POST',
  });
}

export function createOfficeLocation(data: {
  name: string;
  address: string;
  radius_m?: number;
  status?: string;
}) {
  return apiRequest<OfficeLocation>('/tenant/organization/settings/locations', {
    method: 'POST',
    body: data,
  });
}
