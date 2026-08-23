import { apiRequest } from '@/lib/api/client';

export interface LeaveTypeAdmin {
  id: string;
  name: string;
  code?: string | null;
  category?: string;
  status?: string;
  annual_days?: number | null;
  annual_quota?: number | null;
  carry_forward?: boolean;
  carry_forward_max?: number | null;
  encashable?: boolean;
  role_ids?: string[];
}

export interface LeaveRequestAdmin {
  id: string;
  employee_name?: string;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string | null;
}

export interface CalendarLeaveEntry {
  request_id: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_code: string;
  from_date: string;
  to_date: string;
  days: number;
  status: string;
}

export interface CalendarEmployeeRow {
  employee_id: string;
  employee_name: string;
  leaves: CalendarLeaveEntry[];
}

export interface CalendarSummary {
  on_leave_today: number;
  pending_requests: number;
  approved_this_week: number;
  team_strength_percent: number;
}

export interface LeaveCalendarResponse {
  month: string;
  employees: CalendarEmployeeRow[];
  summary: CalendarSummary;
}

export function listLeaveTypesAdmin(status?: string) {
  const params = new URLSearchParams({ page: '1', page_size: '100' });
  if (status) params.set('status', status);
  return apiRequest<{ items: LeaveTypeAdmin[]; total: number }>(`/leave-types?${params.toString()}`);
}

export function listActiveLeaveTypes() {
  return listLeaveTypesAdmin('active').then((res) => res.items);
}

export function createLeaveType(data: Record<string, unknown>) {
  return apiRequest<LeaveTypeAdmin>('/leave-types', { method: 'POST', body: data });
}

export function updateLeaveType(id: string, data: Record<string, unknown>) {
  return apiRequest<LeaveTypeAdmin>(`/leave-types/${id}`, { method: 'PUT', body: data });
}

export function listLeaveRequestsAdmin(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest<{ items: LeaveRequestAdmin[]; total: number }>(`/leave-requests${q}`);
}

export function approveLeaveRequest(id: string) {
  return apiRequest<LeaveRequestAdmin>(`/leave-requests/${id}/approve`, { method: 'POST' });
}

export function rejectLeaveRequest(id: string, reason?: string) {
  return apiRequest<LeaveRequestAdmin>(`/leave-requests/${id}/reject`, {
    method: 'POST',
    body: { reason: reason ?? null },
  });
}

export function getLeaveCalendar(params: {
  month: string;
  employee_id?: string;
  leave_type_id?: string;
  region_id?: string;
}) {
  const q = new URLSearchParams({ month: params.month });
  if (params.employee_id) q.set('employee_id', params.employee_id);
  if (params.leave_type_id) q.set('leave_type_id', params.leave_type_id);
  if (params.region_id) q.set('region_id', params.region_id);
  return apiRequest<LeaveCalendarResponse>(`/leave-calendar?${q.toString()}`);
}
