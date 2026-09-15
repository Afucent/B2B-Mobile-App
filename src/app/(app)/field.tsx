import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RequireEmployeeTab from '@/components/RequireEmployeeTab';
import TabModuleLinks from '@/components/TabModuleLinks';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppRefresh } from '@/hooks/useAppRefresh';
import { formatDate } from '@/lib/format';
import { isFieldTrackingEnabled } from '@/lib/permissions';
import { buildFieldTabSections } from '@/lib/tabNavigation';

export default function FieldScreen() {
  return (
    <RequireEmployeeTab tab="field">
      <FieldContent />
    </RequireEmployeeTab>
  );
}

function FieldContent() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { canView, canCreate, canManage } = usePermissions();
  const { refreshing, refreshKey, onRefresh } = useAppRefresh();

  const fieldTrackingEnabled = isFieldTrackingEnabled(user?.organization?.enabled_modules);
  const fieldSections = buildFieldTabSections({
    canView,
    canCreate,
    canManage,
    fieldTrackingEnabled,
  });

  return (
    <View style={styles.flex} key={refreshKey}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}>
        <View style={styles.header}>
          <Text style={styles.title}>Field & Visits</Text>
          <Text style={styles.date}>{formatDate(new Date())}</Text>
        </View>

        <TabModuleLinks sections={fieldSections} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  content: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  header: { marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.heading },
  date: { color: Colors.muted, marginTop: 2 },
});
