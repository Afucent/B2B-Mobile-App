import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RequireEmployeeTab from '@/components/RequireEmployeeTab';
import TabModuleLinks from '@/components/TabModuleLinks';
import { Colors, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { buildRolesTabSections } from '@/lib/tabNavigation';

export default function RolesScreen() {
  return (
    <RequireEmployeeTab tab="roles">
      <RolesContent />
    </RequireEmployeeTab>
  );
}

function RolesContent() {
  const insets = useSafeAreaInsets();
  const { canView, canCreate, canManage } = usePermissions();

  const sections = buildRolesTabSections({
    canView,
    canCreate,
    canManage,
    fieldTrackingEnabled: true,
  });

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: 40 }]}>
      <Text style={styles.title}>Users & roles</Text>
      <Text style={styles.subtitle}>Manage users, roles, permissions and dealer assignments</Text>
      <TabModuleLinks sections={sections} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  content: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: Colors.heading },
  subtitle: { color: Colors.muted, marginTop: -4 },
});
