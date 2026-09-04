import { useMemo } from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  ADMIN_READ_MODULES,
  canCreateInModule,
  canDeleteInModule,
  canEditInModule,
  canViewModule,
  hasPermission,
} from '@/lib/permissions';

function isOrganizationAdmin(roles: { name: string }[] | undefined): boolean {
  return (roles ?? []).some(
    (r) => r.name.trim().toLowerCase().replace(/\s+/g, '_') === 'organization_admin',
  );
}
function isEmployee(roles: { name: string }[] | undefined): boolean {
  return (roles ?? []).some(
    (r) => r.name.trim().toLowerCase().replace(/\s+/g, '_') === 'employee',
  );
}

export function usePermissions() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const orgAdmin = isOrganizationAdmin(user?.roles);
  const employee = isEmployee(user?.roles);

  return useMemo(() => {
    const has = (module: string, action: string, scope = 'tenant') =>
      orgAdmin || hasPermission(permissions, module, action, scope);

    const canView = (module: string) => orgAdmin || canViewModule(permissions, module);
    const canCreate = (module: string) => orgAdmin || canCreateInModule(permissions, module);
    const canDelete = (module: string) => orgAdmin || canDeleteInModule(permissions, module);
    const canApprove = (module: string) => orgAdmin || hasPermission(permissions, module, 'approve');
    const canManage = (module: string) => {
      if (orgAdmin) return true;
      if (module === 'leave_types' || module === 'leave') {
        return (
          hasPermission(permissions, 'leave_types', 'types_manage') ||
          hasPermission(permissions, 'leave', 'types_manage') ||
          hasPermission(permissions, 'leave_types', 'create') ||
          hasPermission(permissions, 'leave_types', 'update') ||
          hasPermission(permissions, 'leave_types', 'delete')
        );
      }
      return hasPermission(permissions, module, 'types_manage');
    };
    const canEdit = (module: string) => orgAdmin || canEditInModule(permissions, module);

    const hasAnyAdminRead =
      orgAdmin || ADMIN_READ_MODULES.some((module) => canViewModule(permissions, module));

    const showMyAttendanceLeave =
      !orgAdmin &&
      (canViewModule(permissions, 'my_attendance_leave') ||
        canCreateInModule(permissions, 'my_attendance_leave') ||
        hasPermission(permissions, 'leave_requests', 'create') ||
        hasPermission(permissions, 'attendance', 'create'));

    return {
      permissions,
      isOrgAdmin: orgAdmin,
      isEmployee: employee,
      has,
      canView,
      canCreate,
      canEdit,
      canDelete,
      canApprove,
      canManage,
      hasAnyAdminRead,
      showMyAttendanceLeave,
    };
  }, [permissions, orgAdmin]);
}
