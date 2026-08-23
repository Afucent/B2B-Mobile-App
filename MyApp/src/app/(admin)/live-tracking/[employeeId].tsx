import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getEmployeeLiveDetail } from '@/lib/api/fieldOps';

export default function AdminLiveEmployeeScreen() {
  const { employeeId } = useLocalSearchParams<{ employeeId: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!employeeId) return;
      setLoading(true);
      void getEmployeeLiveDetail(employeeId)
        .then(setData)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load detail'))
        .finally(() => setLoading(false));
    }, [employeeId]),
  );

  const entries = data
    ? Object.entries(data).filter(([, v]) => v !== null && typeof v !== 'object')
    : [];
  const nested = data
    ? Object.entries(data).filter(([, v]) => v !== null && typeof v === 'object')
    : [];

  return (
    <RequireModuleAccess module="live_location">
      <View style={styles.flex}>
      <ScreenHeader title="Live detail" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        {loading ? <Text style={styles.meta}>Loading…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.card}>
          {entries.map(([key, value]) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{key}</Text>
              <Text style={styles.value}>{String(value)}</Text>
            </View>
          ))}
        </View>
        {nested.map(([key, value]) => (
          <View key={key} style={styles.card}>
            <Text style={styles.section}>{key}</Text>
            <Text style={styles.json}>{JSON.stringify(value, null, 2)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  field: { gap: 2 },
  label: { color: Colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  value: { color: Colors.heading, fontWeight: '600' },
  section: { fontWeight: '800', color: Colors.brand },
  json: { color: Colors.text, fontSize: 12, fontFamily: 'monospace' },
});
