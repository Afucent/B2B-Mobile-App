import { apiRequest } from '@/lib/api/client';

export interface LeaveBalance {
  leave_type_id: string;
  leave_type_name: string;
  leave_type_code: string;
  annual_days: number | null;
  allocation_mode: string;
  is_active: boolean;
  balance: number;
  used_days?: number;
}

export interface LeaveRequest {
  id: string;
  leave_type_id: string;
  leave_type_name: string;
  from_date: string;
  to_date: string;
  number_of_days: number;
  reason: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

export interface LeaveType {
  id: string;
  name: string;
  code?: string | null;
  annual_days?: number | null;
  annual_quota?: number;
  allocation_mode?: string;
  max_consecutive_days?: number | null;
  status?: string;
  is_active?: boolean;
}

export function getLeaveBalance() {
  return apiRequest<{ items: LeaveBalance[] }>('/leave/balance');
}

export function getMyLeaveRequests() {
  return apiRequest<LeaveRequest[]>('/leave/my-requests');
}

/** @deprecated Prefer listLeaveTypesForMe — kept for older callers. */
export function getLeaveTypes() {
  return listLeaveTypesForMe().then((items) =>
    items.map((item) => ({
      ...item,
      annual_quota: item.annual_days ?? item.annual_quota ?? 0,
      is_active: item.is_active ?? (item.status === 'active' || item.status == null),
    })),
  );
}

export function listLeaveTypesForMe() {
  return apiRequest<LeaveType[]>('/leave-types/for-me');
}

export function getLeaveWorkingDays() {
  return apiRequest<{ working_days: string[] }>('/leave/working-days');
}

export function createLeaveRequest(data: {
  leave_type_id: string;
  from_date: string;
  to_date: string;
  reason: string;
  employee_id?: string;
}) {
  return apiRequest<LeaveRequest>('/leave-requests', {
    method: 'POST',
    body: data,
  });
}

/** @deprecated Prefer createLeaveRequest (same web endpoint). */
export function applyLeave(data: {
  leave_type_id: string;
  from_date: string;
  to_date: string;
  reason: string;
}) {
  return createLeaveRequest(data);
}
