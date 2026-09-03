import { Redirect, Tabs } from 'expo-router';
import { useMemo } from 'react';

import { CustomTabBar } from '@/components/CustomTabBar';
import { useAuth } from '@/context/AuthContext';
import { getVisibleAppTabs } from '@/lib/tabNavigation';
import { usePermissions } from '@/hooks/usePermissions';
import { isFieldTrackingEnabled } from '@/lib/permissions';

export default function AppTabsLayout() {
  const { status, user } = useAuth();
  const { isOrgAdmin, showMyAttendanceLeave, hasAnyAdminRead, has, canView } = usePermissions();

  const visibleTabs = useMemo(
    () =>
      getVisibleAppTabs({
        isOrgAdmin,
        showMyAttendanceLeave,
        hasAnyAdminRead,
        has,
        canView,
        fieldTrackingEnabled: isFieldTrackingEnabled(user?.organization?.enabled_modules),
      }),
    [isOrgAdmin, showMyAttendanceLeave, hasAnyAdminRead, has, canView, user?.organization?.enabled_modules],
  );

  if (status === 'signedOut') {
    return <Redirect href="/(auth)/login" />;
  }

  const tabHref = (name: string) =>
    visibleTabs.includes(name as (typeof visibleTabs)[number]) ? undefined : null;

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="clock" options={{ title: 'Clock', href: tabHref('clock') }} />
      <Tabs.Screen name="field" options={{ title: 'Field', href: tabHref('field') }} />
      <Tabs.Screen name="roles" options={{ title: 'Roles', href: tabHref('roles') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      {/* Legacy / hidden routes */}
      <Tabs.Screen name="leaves" options={{ href: null }} />
      <Tabs.Screen name="visits" options={{ href: null, title: 'Visits' }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
    </Tabs>
  );
}
