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
  max_consecutive_days?: number | null;
  allocation_mode?: string;
  role_ids?: string[];
}

export interface LeaveRequestAdmin {
  id: string;
  employee_id?: string;
  employee_name?: string;
  leave_type_id?: string;
  leave_type_name?: string;
  from_date: string;
  to_date: string;
  /** @deprecated use from_date */
  start_date?: string;
  /** @deprecated use to_date */
  end_date?: string;
  number_of_days?: number;
  status: string;
  reason?: string | null;
  rejection_reason?: string | null;
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

export type LeaveTypeListParams = {
  search?: string;
  status?: string;
  page?: number;
  page_size?: number;
};

export function listLeaveTypesAdmin(params: LeaveTypeListParams | string = {}) {
  const opts: LeaveTypeListParams =
    typeof params === 'string' ? { status: params } : params ?? {};
  const q = new URLSearchParams({
    page: String(opts.page ?? 1),
    page_size: String(opts.page_size ?? 100),
  });
  if (opts.status) q.set('status', opts.status);
  if (opts.search?.trim()) q.set('search', opts.search.trim());
  return apiRequest<{ items: LeaveTypeAdmin[]; total: number }>(`/leave-types?${q.toString()}`);
}

export function listActiveLeaveTypes() {
  return listLeaveTypesAdmin({ status: 'active' }).then((res) => res.items);
}

export function getLeaveType(id: string) {
  return apiRequest<LeaveTypeAdmin>(`/leave-types/${id}`);
}

export function createLeaveType(data: Record<string, unknown>) {
  return apiRequest<LeaveTypeAdmin>('/leave-types', { method: 'POST', body: data });
}

export function updateLeaveType(id: string, data: Record<string, unknown>) {
  return apiRequest<LeaveTypeAdmin>(`/leave-types/${id}`, { method: 'PUT', body: data });
}

export function updateLeaveTypeStatus(id: string, status: string) {
  return apiRequest<LeaveTypeAdmin>(`/leave-types/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function deleteLeaveType(id: string) {
  return apiRequest<{ message: string }>(`/leave-types/${id}`, { method: 'DELETE' });
}

export type LeaveRequestListParams = {
  search?: string;
  status?: string;
  leave_type_id?: string;
  employee_id?: string;
  role_id?: string;
  city?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  page_size?: number;
};

export function listLeaveRequestsAdmin(params: LeaveRequestListParams | string = {}) {
  const opts: LeaveRequestListParams =
    typeof params === 'string' ? { status: params } : params ?? {};
  const q = new URLSearchParams();
  if (opts.search?.trim()) q.set('search', opts.search.trim());
  if (opts.status) q.set('status', opts.status);
  if (opts.leave_type_id) q.set('leave_type_id', opts.leave_type_id);
  if (opts.employee_id) q.set('employee_id', opts.employee_id);
  if (opts.role_id) q.set('role_id', opts.role_id);
  if (opts.city) q.set('city', opts.city);
  if (opts.from_date) q.set('from_date', opts.from_date);
  if (opts.to_date) q.set('to_date', opts.to_date);
  if (opts.page != null) q.set('page', String(opts.page));
  if (opts.page_size != null) q.set('page_size', String(opts.page_size));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiRequest<{ items: LeaveRequestAdmin[]; total: number }>(`/leave-requests${suffix}`);
}

export function createLeaveRequest(data: {
  leave_type_id: string;
  from_date: string;
  to_date: string;
  reason: string;
  employee_id?: string;
}) {
  return apiRequest<LeaveRequestAdmin>('/leave-requests', { method: 'POST', body: data });
}

export function approveLeaveRequest(id: string) {
  return apiRequest<LeaveRequestAdmin>(`/leave-requests/${id}/approve`, { method: 'PATCH' });
}

export function rejectLeaveRequest(id: string, rejectionReason: string) {
  return apiRequest<LeaveRequestAdmin>(`/leave-requests/${id}/reject`, {
    method: 'PATCH',
    body: { rejection_reason: rejectionReason },
  });
}

export function cancelLeaveRequest(id: string) {
  return apiRequest<LeaveRequestAdmin>(`/leave-requests/${id}/cancel`, {
    method: 'PATCH',
  });
}

export function extendLeaveRequest(id: string, toDate: string) {
  return apiRequest<LeaveRequestAdmin>(`/leave-requests/${id}/extend`, {
    method: 'PATCH',
    body: { to_date: toDate },
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

export type OrgLeaveBalanceRow = {
  employee_id: string;
  employee_name: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_code: string;
  annual_days?: number | null;
  balance: number;
  used_days?: number;
};

export function listOrgLeaveBalances() {
  return apiRequest<{ items: OrgLeaveBalanceRow[] }>('/leave/org-balances');
}
