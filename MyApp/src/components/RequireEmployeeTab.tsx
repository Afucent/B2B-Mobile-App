import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { isFieldTrackingEnabled } from '@/lib/permissions';
import { getVisibleAppTabs } from '@/lib/tabNavigation';

type TabName = 'clock' | 'field' | 'roles';

export default function RequireEmployeeTab({
  tab,
  children,
}: {
  tab: TabName;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const { isOrgAdmin, showMyAttendanceLeave, hasAnyAdminRead, has, canView } = usePermissions();
  const visible = getVisibleAppTabs({
    isOrgAdmin,
    showMyAttendanceLeave,
    hasAnyAdminRead,
    has,
    canView,
    fieldTrackingEnabled: isFieldTrackingEnabled(user?.organization?.enabled_modules),
  });

  if (!visible.includes(tab)) {
    return <Redirect href="/(app)" />;
  }

  return <>{children}</>;
}
