import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { getAttendanceDashboardSummary, type AttendanceSummary } from '@/lib/api/fieldOps';

export default function DashboardStats() {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setError('');
    try {
      setSummary(await getAttendanceDashboardSummary());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const cards = [
    { label: 'Present', value: summary?.present },
    { label: 'Absent', value: summary?.absent },
    { label: 'On leave', value: summary?.on_leave },
    { label: 'Clocked in', value: summary?.clocked_in },
    { label: 'Total employees', value: summary?.total_employees },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Organisation dashboard</Text>
      {loading ? <Text style={styles.meta}>Loading dashboard…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.grid}>
        {cards.map((card) => (
          <View key={card.label} style={styles.card}>
            <Text style={styles.value}>{card.value ?? '—'}</Text>
            <Text style={styles.label}>{card.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  heading: { fontSize: 16, fontWeight: '800', color: Colors.heading },
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
  value: { fontSize: 28, fontWeight: '800', color: Colors.heading },
  label: { marginTop: 4, color: Colors.muted, fontSize: 13, fontWeight: '600' },
});
