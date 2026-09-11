import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import LocationMap from '@/components/LocationMap';
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void getLiveTrackingPanel()
        .then((res) => setItems(res.items))
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
        })),
    [items],
  );

  const focus = focusId ? items.find((i) => i.employee_id === focusId) : items[0];
  const hasPins = markers.length > 0;
  const centerLat = hasPins ? (focus?.last_latitude ?? markers[0].latitude) : 20;
  const centerLon = hasPins ? (focus?.last_longitude ?? markers[0].longitude) : 0;

  return (
    <RequireModuleAccess module="live_location">
      <SafeScreen>
        <ScreenHeader title="Live tracking" onBack={() => router.back()} />
        <LocationMap
          latitude={centerLat}
          longitude={centerLon}
          height={markers.length > 1 ? 320 : 260}
          zoom={hasPins ? (markers.length > 3 ? 5 : markers.length > 1 ? 11 : 14) : 2}
          markers={markers}
          onMarkerPress={(id) => setFocusId(id)}
        />
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
