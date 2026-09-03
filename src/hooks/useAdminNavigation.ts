import { useMemo } from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  buildAdminNavigation,
  type AdminNavContext,
  type AdminNavSection,
} from '@/lib/adminNavigation';
import { isFieldTrackingEnabled } from '@/lib/permissions';
import { usePermissions } from '@/hooks/usePermissions';

export function useAdminNavigation(): {
  sections: AdminNavSection[];
  moduleCount: number;
  ctx: AdminNavContext;
} {
  const { user } = useAuth();
  const { canView, canCreate, canManage } = usePermissions();

  return useMemo(() => {
    const ctx: AdminNavContext = {
      canView,
      canCreate,
      canManage,
      fieldTrackingEnabled: isFieldTrackingEnabled(user?.organization?.enabled_modules),
    };
    const sections = buildAdminNavigation(ctx);
    const moduleCount = sections.reduce((sum, section) => sum + section.links.length, 0);
    return { sections, moduleCount, ctx };
  }, [canView, canCreate, canManage, user?.organization?.enabled_modules]);
}
