import { apiRequest } from '@/lib/api/client';

export interface FieldVisit {
  id: string;
  employee_id: string;
  employee_name?: string | null;
  dealer_id: string;
  dealer_name?: string | null;
  dealer_address?: string | null;
  assigned_by_id?: string | null;
  scheduled_at: string;
  status: string;
  unplanned: boolean;
  unplanned_reason?: string | null;
  notes?: string | null;
  photo_url?: string | null;
  completed_at?: string | null;
  check_in_latitude?: number | null;
  check_in_longitude?: number | null;
  created_at: string;
}

export function assignVisit(data: {
  employee_id: string;
  dealer_id: string;
  scheduled_at: string;
}) {
  return apiRequest<FieldVisit>('/visits/assign', { method: 'POST', body: data });
}

export function assignVisitsBatch(data: {
  employee_id: string;
  days: Array<{ date: string; dealer_ids: string[] }>;
}) {
  return apiRequest<{ items: FieldVisit[]; total: number }>('/visits/assign-batch', {
    method: 'POST',
    body: data,
  });
}

export type VisitAssignOption = { id: string; name: string };
export type VisitAssignEmployeeOption = VisitAssignOption & {
  dealers: VisitAssignOption[];
};

export function getVisitAssignOptions() {
  return apiRequest<{
    employees: VisitAssignEmployeeOption[];
    dealers: VisitAssignOption[];
  }>('/visits/assign-options');
}

export function getMyVisits(day?: string) {
  const q = day ? `?day=${encodeURIComponent(day)}` : '';
  return apiRequest<{ items: FieldVisit[]; total: number }>(`/visits/my${q}`);
}

export function getMyVisitHistory(params?: {
  from_date?: string;
  to_date?: string;
  offset?: number;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params?.from_date) q.set('from_date', params.from_date);
  if (params?.to_date) q.set('to_date', params.to_date);
  if (params?.offset != null) q.set('offset', String(params.offset));
  if (params?.limit != null) q.set('limit', String(params.limit));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiRequest<{ items: FieldVisit[]; total: number }>(`/visits/my/history${suffix}`);
}

export function getVisitHistory(params?: {
  employee_id?: string;
  from_date?: string;
  to_date?: string;
  status?: string;
  offset?: number;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params?.employee_id) q.set('employee_id', params.employee_id);
  if (params?.from_date) q.set('from_date', params.from_date);
  if (params?.to_date) q.set('to_date', params.to_date);
  if (params?.status) q.set('status', params.status);
  if (params?.offset != null) q.set('offset', String(params.offset));
  if (params?.limit != null) q.set('limit', String(params.limit));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiRequest<{ items: FieldVisit[]; total: number }>(`/visits/history${suffix}`);
}

export function completeVisit(
  visitId: string,
  data: { notes?: string; photo_url?: string; latitude?: number; longitude?: number },
) {
  return apiRequest<FieldVisit>(`/visits/${visitId}/complete`, { method: 'POST', body: data });
}

export function createUnplannedVisit(data: {
  dealer_id: string;
  reason: string;
  notes?: string;
  photo_url?: string;
  latitude?: number;
  longitude?: number;
}) {
  return apiRequest<FieldVisit>('/visits/unplanned', { method: 'POST', body: data });
}
