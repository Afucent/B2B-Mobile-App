import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RequireEmployeeTab from '@/components/RequireEmployeeTab';
import TabModuleLinks from '@/components/TabModuleLinks';
import { Colors, Radius, Spacing } from '@/constants/theme';
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

        <Pressable style={styles.quickCard} onPress={() => router.push('/unplanned-visit')}>
          <Ionicons name="add-circle-outline" size={22} color={Colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.quickTitle}>Unplanned visit</Text>
            <Text style={styles.quickCopy}>Search dealer, add reason & notes</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
        </Pressable>
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
  quickCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickTitle: { fontWeight: '800', color: Colors.heading },
  quickCopy: { color: Colors.muted, fontSize: 12, marginTop: 2 },
});
