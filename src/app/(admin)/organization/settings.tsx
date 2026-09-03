import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';

export default function OrgSettingsScreen() {
  return (
    <RequireModuleAccess module="organization">
      <View style={styles.flex}>
      <ScreenHeader title="Organisation settings" onBack={() => router.back()} />
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.title}>Field operations</Text>
          <Text style={styles.copy}>
            Shift windows, late grace, auto clock-out, and GPS tracking are managed under Field ops
            settings.
          </Text>
          <OutlineButton
            label="Open field ops settings"
            onPress={() => router.push('/(admin)/field-ops-settings')}
          />
        </View>
      </View>
    </View>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  title: { fontWeight: '800', color: Colors.heading, fontSize: 16 },
  copy: { color: Colors.text, lineHeight: 20 },
});
