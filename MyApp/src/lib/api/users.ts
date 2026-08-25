import { apiRequest } from '@/lib/api/client';

export interface AdminUser {
  id: string;
  name: string;
  personal_email: string;
  mobile: string | null;
  status: string;
  designation?: string | null;
  department?: string | null;
  access_surface?: string;
  dealer_id?: string | null;
  dealer_ids?: string[];
  address?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pin_code?: string | null;
  roles?: { id: string; name: string }[];
  created_at?: string;
  updated_at?: string;
}

export interface UserListResponse {
  items: AdminUser[];
  total: number;
}

export interface RoleOption {
  id: string;
  name: string;
}

export type UserListOptions = {
  search?: string;
  status?: string;
  role_id?: string;
  city?: string;
  area?: string;
};

export function listUsers(offset = 0, limit = 50, options?: UserListOptions | string) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  const opts: UserListOptions =
    typeof options === 'string' ? { search: options } : options ?? {};
  if (opts.search?.trim()) params.set('search', opts.search.trim());
  if (opts.status) params.set('status', opts.status);
  if (opts.role_id) params.set('role_id', opts.role_id);
  if (opts.city) params.set('city', opts.city);
  if (opts.area) params.set('area', opts.area);
  return apiRequest<UserListResponse>(`/users?${params.toString()}`);
}

export function getUser(id: string) {
  return apiRequest<AdminUser>(`/users/${id}`);
}

export function listAssignableRoles() {
  return apiRequest<RoleOption[]>('/users/roles');
}

export type AssignableDealer = {
  id: string;
  name: string;
  personal_email: string;
  mobile: string | null;
  state: string | null;
  city: string | null;
  area: string | null;
};

export type AssignableDealerList = {
  items: AssignableDealer[];
  states: string[];
  cities: string[];
  areas: string[];
};

export function listAssignableDealers(
  params: {
    state?: string;
    city?: string;
    area?: string;
    for_user_id?: string;
  } = {},
) {
  const q = new URLSearchParams();
  if (params.state) q.set('state', params.state);
  if (params.city) q.set('city', params.city);
  if (params.area) q.set('area', params.area);
  if (params.for_user_id) q.set('for_user_id', params.for_user_id);
  const qs = q.toString();
  return apiRequest<AssignableDealerList>(
    `/users/assignable-dealers${qs ? `?${qs}` : ''}`,
  );
}

export type CreateUserPayload = {
  name: string;
  personal_email: string;
  mobile?: string | null;
  designation?: string | null;
  department?: string | null;
  role_id: string;
  dealer_id?: string | null;
  dealer_ids?: string[];
  access_surface?: 'web' | 'mobile' | 'both';
  address?: string | null;
  area?: string | null;
  city?: string;
  state?: string;
  country?: string;
  pin_code?: string;
  onboard_status?: 'active' | 'pending';
  password?: string;
  confirm_password?: string;
  skip_password?: boolean;
  force_change_password?: boolean;
  send_welcome_email?: boolean;
};

export function createUser(data: CreateUserPayload) {
  return apiRequest<{ user: AdminUser }>('/users', {
    method: 'POST',
    body: data,
  });
}

export type UpdateUserPayload = {
  name?: string;
  mobile?: string | null;
  personal_email?: string;
  designation?: string | null;
  department?: string | null;
  access_surface?: 'web' | 'mobile' | 'both';
  dealer_id?: string | null;
  dealer_ids?: string[];
  address?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pin_code?: string | null;
};

export function updateUser(id: string, data: UpdateUserPayload) {
  return apiRequest<AdminUser>(`/users/${id}`, {
    method: 'PATCH',
    body: data,
  });
}

export function updateUserStatus(id: string, status: string) {
  return apiRequest<AdminUser>(`/users/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function updateUserRole(id: string, roleId: string) {
  return apiRequest<AdminUser>(`/users/${id}/role`, {
    method: 'PATCH',
    body: { role_id: roleId },
  });
}

export function resendUserActivation(id: string) {
  return apiRequest<{ message: string }>(`/users/${id}/resend-activation`, {
    method: 'POST',
  });
}

export function deleteUser(id: string) {
  return apiRequest<{ message: string }>(`/users/${id}`, {
    method: 'DELETE',
  });
}

export function setUserPassword(
  id: string,
  data: {
    new_password: string;
    confirm_password: string;
    force_change_password?: boolean;
  },
) {
  return apiRequest<AdminUser>(`/users/${id}/password`, {
    method: 'PATCH',
    body: data,
  });
}

export type DealerAssignmentRow = {
  user_id: string;
  user_name: string;
  user_email: string;
  dealer_id: string;
  dealer_name: string;
  dealer_email: string;
  dealer_mobile: string | null;
  state: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
};

export function listDealerAssignments() {
  return apiRequest<DealerAssignmentRow[]>('/users/assignments/dealers');
}

export type UserSummary = {
  total_users: number;
  total_active: number;
  total_inactive: number;
  pending_credentials: number;
  mobile_access?: number;
  web_access?: number;
  both_access?: number;
};

export function getUserSummary() {
  return apiRequest<UserSummary>('/users/summary');
}

export function getUserFilterOptions() {
  return apiRequest<{ cities: string[]; areas: string[] }>('/users/filter-options');
}
