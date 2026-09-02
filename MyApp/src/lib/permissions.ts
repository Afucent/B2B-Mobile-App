import type { PermissionBrief } from '@/lib/api/auth';

export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'write';

export const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'Users',
  organization: 'Organisation',
  role_library: 'Role library',
  permission_matrix: 'Permission matrix',
  geography: 'Geography',
  dealers: 'Dealers',
  leave_types: 'Leave types',
  leave_requests: 'Requests',
  attendance: 'Attendance',
  team_calendar: 'Team Calendar',
  live_location: 'Live Location Tracking',
  visit_assign: 'Visit Assign',
  visit_history: 'Visit History',
  field_visits: 'Field Visits',
  my_attendance_leave: 'My Attendance & Leave',
  user_tracking: 'User Tracking',
  leave: 'Leave (legacy)',
  rbac: 'Roles (legacy)',
};

export const MATRIX_MODULE_ORDER = [
  'dashboard',
  'users',
  'organization',
  'role_library',
  'permission_matrix',
  'geography',
  'dealers',
  'leave_types',
  'leave_requests',
  'attendance',
  'team_calendar',
  'live_location',
  'visit_assign',
  'visit_history',
  'field_visits',
  'my_attendance_leave',
  'user_tracking',
] as const;

export const HIDDEN_ORG_MODULES = new Set([
  'ai_insights',
  'catalog',
  'orders',
  'credit',
  'claims_returns',
  'leave',
  'rbac',
]);

/** Modules that unlock the admin experience when the user has read access. */
export const ADMIN_READ_MODULES = [
  'dashboard',
  'users',
  'organization',
  'role_library',
  'permission_matrix',
  'geography',
  'dealers',
  'leave_types',
  'leave_requests',
  'attendance',
  'team_calendar',
  'live_location',
  'visit_assign',
  'visit_history',
  'user_tracking',
  'rbac',
  'leave',
] as const;

export const FIELD_TRACKING_MODULE_KEYS = [
  'inventory',
  'sales',
  'ai_insights',
  'geography',
  'dealers',
  'leave',
] as const;

export const PERMISSION_EQUIVALENTS: Record<string, Array<[string, string]>> = {
  'leave_types:read': [
    ['leave_types', 'read'],
    ['leave', 'read'],
    ['leave', 'types_manage'],
  ],
  'leave_types:create': [
    ['leave_types', 'create'],
    ['leave', 'types_manage'],
  ],
  'leave_types:update': [
    ['leave_types', 'update'],
    ['leave', 'types_manage'],
  ],
  'leave_types:delete': [
    ['leave_types', 'delete'],
    ['leave', 'types_manage'],
  ],
  'leave_requests:read': [
    ['leave_requests', 'read'],
    ['leave', 'read'],
    ['leave', 'approve'],
  ],
  'leave_requests:create': [
    ['leave_requests', 'create'],
    ['leave', 'apply'],
    ['my_attendance_leave', 'create'],
  ],
  'leave_requests:update': [
    ['leave_requests', 'update'],
    ['leave', 'approve'],
  ],
  'team_calendar:read': [
    ['team_calendar', 'read'],
    ['leave', 'read'],
  ],
  'attendance:create': [
    ['attendance', 'create'],
    ['attendance', 'clock'],
    ['my_attendance_leave', 'create'],
  ],
  'attendance:read': [['attendance', 'read']],
  'attendance:clock': [
    ['attendance', 'clock'],
    ['attendance', 'create'],
    ['my_attendance_leave', 'create'],
  ],
  'my_attendance_leave:read': [
    ['my_attendance_leave', 'read'],
    ['my_attendance_leave', 'create'],
    ['attendance', 'create'],
    ['attendance', 'clock'],
    ['leave_requests', 'create'],
    ['leave', 'apply'],
  ],
  'my_attendance_leave:create': [
    ['my_attendance_leave', 'create'],
    ['attendance', 'create'],
    ['attendance', 'clock'],
    ['leave_requests', 'create'],
    ['leave', 'apply'],
  ],
  'user_tracking:read': [
    ['user_tracking', 'read'],
    ['user_tracking', 'create'],
    ['live_location', 'create'],
    ['live_location', 'track'],
    ['attendance', 'location_track'],
  ],
  'user_tracking:create': [
    ['user_tracking', 'create'],
    ['live_location', 'create'],
    ['live_location', 'track'],
    ['attendance', 'location_track'],
  ],
  'live_location:create': [
    ['live_location', 'create'],
    ['live_location', 'track'],
    ['attendance', 'location_track'],
    ['user_tracking', 'create'],
  ],
  'live_location:read': [['live_location', 'read']],
  'live_location:track': [
    ['live_location', 'track'],
    ['live_location', 'create'],
    ['attendance', 'location_track'],
    ['user_tracking', 'create'],
  ],
  'role_library:read': [
    ['role_library', 'read'],
    ['rbac', 'read'],
  ],
  'role_library:create': [
    ['role_library', 'create'],
    ['rbac', 'create'],
  ],
  'role_library:update': [
    ['role_library', 'update'],
    ['rbac', 'update'],
  ],
  'role_library:delete': [
    ['role_library', 'delete'],
    ['rbac', 'delete'],
  ],
  'permission_matrix:read': [
    ['permission_matrix', 'read'],
    ['rbac', 'read'],
  ],
  'permission_matrix:update': [
    ['permission_matrix', 'update'],
    ['rbac', 'update'],
  ],
  'rbac:read': [
    ['rbac', 'read'],
    ['role_library', 'read'],
    ['permission_matrix', 'read'],
  ],
  'rbac:create': [
    ['rbac', 'create'],
    ['role_library', 'create'],
  ],
  'rbac:update': [
    ['rbac', 'update'],
    ['role_library', 'update'],
    ['permission_matrix', 'update'],
  ],
  'rbac:delete': [
    ['rbac', 'delete'],
    ['role_library', 'delete'],
  ],
  'leave:read': [
    ['leave', 'read'],
    ['leave_types', 'read'],
    ['leave_requests', 'read'],
    ['team_calendar', 'read'],
  ],
  'leave:apply': [
    ['leave', 'apply'],
    ['leave_requests', 'create'],
    ['my_attendance_leave', 'create'],
  ],
  'leave:approve': [
    ['leave', 'approve'],
    ['leave_requests', 'update'],
  ],
  'leave:types_manage': [
    ['leave', 'types_manage'],
    ['leave_types', 'create'],
    ['leave_types', 'update'],
    ['leave_types', 'delete'],
  ],
};

function hasExact(
  permissions: PermissionBrief[],
  module: string,
  action: string,
  scope = 'tenant',
): boolean {
  return permissions.some(
    (p) => p.module === module && p.action === action && p.scope === scope,
  );
}

export function hasPermission(
  permissions: PermissionBrief[],
  module: string,
  action: string,
  scope = 'tenant',
): boolean {
  const key = `${module}:${action}`;
  const candidates = PERMISSION_EQUIVALENTS[key] ?? [[module, action] as [string, string]];
  return candidates.some(([m, a]) => hasExact(permissions, m, a, scope));
}

export function canViewModule(permissions: PermissionBrief[], module: string): boolean {
  return hasPermission(permissions, module, 'read');
}

export function canCreateInModule(permissions: PermissionBrief[], module: string): boolean {
  return hasPermission(permissions, module, 'create');
}

export function canEditInModule(permissions: PermissionBrief[], module: string): boolean {
  if (hasPermission(permissions, module, 'update')) return true;
  if (hasPermission(permissions, module, 'write')) return true;
  if (module === 'users') {
    return (
      hasPermission(permissions, module, 'status_update') ||
      hasPermission(permissions, module, 'role_assign') ||
      hasPermission(permissions, module, 'activation_resend')
    );
  }
  return false;
}

export function canDeleteInModule(permissions: PermissionBrief[], module: string): boolean {
  return hasPermission(permissions, module, 'delete');
}

export function isFieldTrackingEnabled(enabledModules: string[] | undefined): boolean {
  const enabled = new Set(enabledModules ?? []);
  return FIELD_TRACKING_MODULE_KEYS.some((key) => enabled.has(key));
}

export function formatRoleName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
