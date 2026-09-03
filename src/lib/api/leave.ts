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
  annual_quota: number;
  is_active: boolean;
}

export function getLeaveBalance() {
  return apiRequest<{ items: LeaveBalance[] }>('/leave/balance');
}

export function getMyLeaveRequests() {
  return apiRequest<LeaveRequest[]>('/leave/my-requests');
}

export function getLeaveTypes() {
  return apiRequest<LeaveType[]>('/leave/types');
}

export function applyLeave(data: {
  leave_type_id: string;
  from_date: string;
  to_date: string;
  reason: string;
}) {
  return apiRequest<LeaveRequest>('/leave/apply', {
    method: 'POST',
    body: data,
  });
}
