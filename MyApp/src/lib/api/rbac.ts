import { apiRequest } from '@/lib/api/client';

export interface Permission {
  id: string;
  module: string;
  action: string;
  scope: string;
}

export interface TenantRole {
  id: string;
  name: string;
  description: string | null;
  status: string;
  access_surface: string;
  user_count: number;
  is_system: boolean;
  permissions: Permission[];
  web_permission_ids?: string[];
  mobile_permission_ids?: string[];
}

export function listTenantPermissions() {
  return apiRequest<Permission[]>('/rbac/permissions');
}

export function listTenantRoles() {
  return apiRequest<{ items: TenantRole[]; total: number }>('/rbac/roles');
}

export function createTenantRole(data: {
  name: string;
  description?: string | null;
  access_surface?: string;
  permission_ids?: string[];
  web_permission_ids?: string[];
  mobile_permission_ids?: string[];
}) {
  return apiRequest<TenantRole>('/rbac/roles', {
    method: 'POST',
    body: data,
  });
}

export function updateTenantRole(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    status?: string;
    access_surface?: string;
    permission_ids?: string[];
    web_permission_ids?: string[];
    mobile_permission_ids?: string[];
  },
) {
  return apiRequest<TenantRole>(`/rbac/roles/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export function deleteTenantRole(id: string) {
  return apiRequest<void>(`/rbac/roles/${id}`, { method: 'DELETE' });
}
