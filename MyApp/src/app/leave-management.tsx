import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TabModuleLinks from '@/components/TabModuleLinks';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { isFieldTrackingEnabled } from '@/lib/permissions';
import { buildLeavesTabSections, canAccessLeaveManagement } from '@/lib/tabNavigation';

export default function LeaveManagementScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isOrgAdmin, showMyAttendanceLeave, hasAnyAdminRead, has, canView, canCreate, canManage } =
    usePermissions();

  const ctx = {
    isOrgAdmin,
    showMyAttendanceLeave,
    hasAnyAdminRead,
    has,
    canView,
    fieldTrackingEnabled: isFieldTrackingEnabled(user?.organization?.enabled_modules),
  };

  if (!canAccessLeaveManagement(ctx)) {
    return <Redirect href="/(app)/clock" />;
  }

  const sections = buildLeavesTabSections({
    canView,
    canCreate,
    canManage,
    fieldTrackingEnabled: ctx.fieldTrackingEnabled,
  });

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Leave & Attendance" onBack={() => router.replace('/(app)/clock')} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.subtitle}>
          Manage leave types, approve requests, team calendar, and attendance clock-in/out.
        </Text>

        {sections.length === 0 ? (
          <Text style={styles.empty}>No leave or attendance admin access for your role.</Text>
        ) : (
          <TabModuleLinks sections={sections} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.md, gap: Spacing.md },
  subtitle: { color: Colors.muted, lineHeight: 20 },
  empty: { color: Colors.muted, marginTop: Spacing.md },
});
