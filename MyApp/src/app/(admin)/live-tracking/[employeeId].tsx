import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import LocationMap from '@/components/LocationMap';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getEmployeeLiveDetail } from '@/lib/api/fieldOps';
import { formatClock } from '@/lib/format';

type LiveDetail = {
  employee_id?: string;
  employee_name?: string;
  employee_initials?: string;
  avatar_url?: string | null;
  designation?: string | null;
  status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  last_ping_at?: string | null;
  clock_in_time?: string | null;
};

export default function AdminLiveEmployeeScreen() {
  const { employeeId } = useLocalSearchParams<{ employeeId: string }>();
  const [data, setData] = useState<LiveDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!employeeId) return;
      setLoading(true);
      void getEmployeeLiveDetail(employeeId)
        .then((res) => setData(res as LiveDetail))
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load detail'))
        .finally(() => setLoading(false));
    }, [employeeId]),
  );

  const lat = data?.latitude ?? null;
  const lon = data?.longitude ?? null;
  const hasMap = lat != null && lon != null;

  return (
    <RequireModuleAccess module="live_location">
      <View style={styles.flex}>
        <ScreenHeader
          title={data?.employee_name ?? 'Live location'}
          onBack={() => router.back()}
        />
        {hasMap ? (
          <LocationMap
            latitude={lat}
            longitude={lon}
            height={280}
            zoom={15}
            markers={[
              {
                id: employeeId,
                latitude: lat,
                longitude: lon,
                label: data?.employee_name ?? 'Employee',
                initials: data?.employee_initials,
                avatarUrl: data?.avatar_url,
              },
            ]}
          />
        ) : null}
        <ScrollView contentContainerStyle={styles.body}>
          {loading ? <Text style={styles.meta}>Loading…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && !hasMap ? (
            <Text style={styles.meta}>No live location available for this employee yet.</Text>
          ) : null}
          <View style={styles.card}>
            <Row label="Status" value={data?.status ?? '—'} />
            <Row label="Designation" value={data?.designation ?? '—'} />
            <Row label="Clock in" value={data?.clock_in_time ? formatClock(data.clock_in_time) : '—'} />
            <Row
              label="Last update"
              value={data?.last_ping_at ? formatClock(data.last_ping_at) : '—'}
            />
            <Row label="Address" value={data?.address ?? '—'} last />
          </View>
        </ScrollView>
      </View>
    </RequireModuleAccess>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.field, !last && styles.fieldBorder]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
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
    overflow: 'hidden',
  },
  field: { padding: Spacing.md, gap: 2 },
  fieldBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  label: { color: Colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  value: { color: Colors.heading, fontWeight: '600' },
});
