import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RequireEmployeeTab from '@/components/RequireEmployeeTab';
import TabModuleLinks from '@/components/TabModuleLinks';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
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

  const fieldSections = buildFieldTabSections({
    canView,
    canCreate,
    canManage,
    fieldTrackingEnabled: isFieldTrackingEnabled(user?.organization?.enabled_modules),
  });

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: 120 }]}>
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
