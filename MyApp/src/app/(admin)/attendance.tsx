import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getAttendanceDashboardSummary, type AttendanceSummary } from '@/lib/api/fieldOps';

export default function AdminAttendanceScreen() {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void getAttendanceDashboardSummary()
        .then(setSummary)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
        .finally(() => setLoading(false));
    }, []),
  );

  const cards = [
    { label: 'Present', value: summary?.present },
    { label: 'Absent', value: summary?.absent },
    { label: 'On leave', value: summary?.on_leave },
    { label: 'Total users', value: summary?.total_users },
  ];

  return (
    <RequireModuleAccess module="attendance">
      <View style={styles.flex}>
      <ScreenHeader title="Attendance" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        {loading ? <Text style={styles.meta}>Loading…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.grid}>
          {cards.map((card) => (
            <View key={card.label} style={styles.card}>
              <Text style={styles.value}>{card.value ?? '—'}</Text>
              <Text style={styles.label}>{card.label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          Use Live tracking for per-employee GPS status. Field ops settings control shift windows and
          geofence rules.
        </Text>
      </ScrollView>
    </View>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.md },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  card: {
    width: '48%',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand,
  },
  value: { fontSize: 26, fontWeight: '800', color: Colors.heading },
  label: { marginTop: 4, color: Colors.muted, fontSize: 13, fontWeight: '600' },
  note: { color: Colors.text, lineHeight: 20 },
});
