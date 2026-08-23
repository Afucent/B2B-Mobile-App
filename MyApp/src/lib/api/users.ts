import { apiRequest } from '@/lib/api/client';

export interface AdminUser {
  id: string;
  name: string;
  personal_email: string;
  mobile: string | null;
  status: string;
  designation?: string | null;
  access_surface?: string;
  roles?: { id: string; name: string }[];
}

export interface UserListResponse {
  items: AdminUser[];
  total: number;
}

export interface RoleOption {
  id: string;
  name: string;
}

export function listUsers(offset = 0, limit = 50, search?: string) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  if (search?.trim()) params.set('search', search.trim());
  return apiRequest<UserListResponse>(`/users?${params.toString()}`);
}

export function getUser(id: string) {
  return apiRequest<AdminUser>(`/users/${id}`);
}

export function listAssignableRoles() {
  return apiRequest<RoleOption[]>('/users/roles');
}

export function createUser(data: Record<string, unknown>) {
  return apiRequest<{ user: AdminUser }>('/users', {
    method: 'POST',
    body: data,
  });
}

export function updateUser(id: string, data: Record<string, unknown>) {
  return apiRequest<AdminUser>(`/users/${id}`, {
    method: 'PUT',
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
