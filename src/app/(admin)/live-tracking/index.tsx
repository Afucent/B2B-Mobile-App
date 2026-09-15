import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import LiveGlobeMap from '@/components/LiveGlobeMap';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { SafeScreen, useContentBottomInset } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill, statusTone } from '@/components/ui/StatusPill';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getLiveTrackingPanel, type LiveEmployeeRow } from '@/lib/api/fieldOps';
import { formatLiveStatus } from '@/lib/format';

export default function AdminLiveTrackingScreen() {
  const bottomInset = useContentBottomInset();
  const [items, setItems] = useState<LiveEmployeeRow[]>([]);
  const [pingMinutes, setPingMinutes] = useState(5);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void getLiveTrackingPanel()
        .then((res) => {
          setItems(res.items);
          setPingMinutes(res.gps_ping_interval_minutes ?? 5);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load panel'))
        .finally(() => setLoading(false));
    }, []),
  );

  const markers = useMemo(
    () =>
      items
        .filter((item) => item.last_latitude != null && item.last_longitude != null)
        .map((item) => ({
          id: item.employee_id,
          latitude: item.last_latitude as number,
          longitude: item.last_longitude as number,
          label: item.employee_name,
          initials: item.employee_initials,
          avatarUrl: item.avatar_url,
          status: item.status,
          address: item.last_address,
          color:
            item.status === 'active'
              ? '#2E7D32'
              : item.status === 'in_transit'
                ? '#1976D2'
                : item.status === 'idle'
                  ? '#ED6C02'
                  : item.status === 'gps_off'
                    ? '#D32F2F'
                    : '#757575',
        })),
    [items],
  );

  return (
    <RequireModuleAccess module="live_location">
      <SafeScreen>
        <ScreenHeader title="Live tracking" onBack={() => router.back()} />
        <LiveGlobeMap
          height={markers.length > 1 ? 340 : 300}
          pingMinutes={pingMinutes}
          markers={markers}
          onMarkerPress={(id) => setFocusId(id)}
        />
        {markers.length === 0 && !loading ? (
          <Text style={styles.emptyMap}>
            No live GPS points yet. Employees appear after Start Tracking.
          </Text>
        ) : null}
        <View style={styles.body}>
          {loading ? <Text style={styles.meta}>Loading live locations…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.section}>
            {markers.length > 1 ? 'Employees on map' : 'Live tracking'} · {items.length}
          </Text>
          <FlatList
            data={items}
            keyExtractor={(item) => item.employee_id}
            contentContainerStyle={{ gap: Spacing.sm, paddingBottom: bottomInset }}
            ListEmptyComponent={
              !loading ? (
                <Text style={styles.empty}>No employees are sharing live location right now.</Text>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  focusId === item.employee_id && styles.rowActive,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => {
                  setFocusId(item.employee_id);
                  router.push({
                    pathname: '/(admin)/live-tracking/[employeeId]',
                    params: { employeeId: item.employee_id },
                  });
                }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.name}>{item.employee_name}</Text>
                  {item.designation ? <Text style={styles.sub}>{item.designation}</Text> : null}
                  {item.last_address ? (
                    <Text style={styles.sub} numberOfLines={1}>
                      {item.last_address}
                    </Text>
                  ) : null}
                  <StatusPill
                    label={formatLiveStatus(item.status) || item.status || 'Unknown'}
                    tone={statusTone(item.status)}
                  />
                </View>
                <Text style={styles.link}>Details</Text>
              </Pressable>
            )}
          />
        </View>
      </SafeScreen>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  emptyMap: {
    color: Colors.muted,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  section: { fontWeight: '800', color: Colors.heading, marginBottom: 10, fontSize: 15 },
  meta: { color: Colors.muted, marginBottom: 8 },
  empty: { color: Colors.muted, lineHeight: 20, paddingVertical: Spacing.md },
  error: { color: Colors.danger, marginBottom: 8, fontWeight: '600' },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  rowActive: { borderColor: Colors.brand, backgroundColor: Colors.brandSoft },
  rowPressed: { opacity: 0.92 },
  name: { fontWeight: '700', color: Colors.heading, fontSize: 16 },
  sub: { color: Colors.muted, fontSize: 13 },
  link: { color: Colors.brand, fontWeight: '700', fontSize: 13 },
});
