import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { FieldOperationsSettings } from '@/lib/api/org';
import { buildFieldOpsSettingRows } from '@/lib/fieldOpsSettingsUi';

type Props = {
  settings: FieldOperationsSettings | null | undefined;
  title?: string;
  loading?: boolean;
  compact?: boolean;
};

export default function FieldOpsSettingsSummary({
  settings,
  title = 'Organisation shift & GPS settings',
  loading = false,
  compact = false,
}: Props) {
  const rows = buildFieldOpsSettingRows(settings);

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>Loading settings…</Text>
      </View>
    );
  }

  if (!settings || rows.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>Settings unavailable. Check your connection or permissions.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {rows.map((row) => (
        <View key={row.label} style={[styles.row, compact && styles.rowCompact]}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  title: { fontWeight: '800', color: Colors.heading, fontSize: 14 },
  meta: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  rowCompact: { paddingVertical: 2 },
  label: { flex: 1, color: Colors.muted, fontSize: 12, fontWeight: '600' },
  value: { flex: 1, color: Colors.heading, fontSize: 12, fontWeight: '700', textAlign: 'right' },
});
