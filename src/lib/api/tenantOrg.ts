import { apiRequest } from '@/lib/api/client';

export interface OrgProfile {
  id: string;
  name: string;
  company_code: string;
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
    method: 'PUT',
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
