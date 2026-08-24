import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import LocationMap from '@/components/LocationMap';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getLiveTrackingPanel, type LiveEmployeeRow } from '@/lib/api/fieldOps';

export default function AdminLiveTrackingScreen() {
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
        })),
    [items],
  );

  const focus = focusId ? items.find((i) => i.employee_id === focusId) : items[0];
  const centerLat = focus?.last_latitude ?? 28.6139;
  const centerLon = focus?.last_longitude ?? 77.209;

  return (
    <RequireModuleAccess module="live_location">
      <View style={styles.flex}>
        <ScreenHeader title="Live tracking" onBack={() => router.back()} />
        <LocationMap
          latitude={centerLat}
          longitude={centerLon}
          height={markers.length > 1 ? 320 : 260}
          zoom={markers.length > 3 ? 5 : markers.length > 1 ? 11 : 14}
          markers={markers}
          onMarkerPress={(id) => setFocusId(id)}
        />
        <View style={styles.body}>
          {loading ? <Text style={styles.meta}>Loading…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.section}>
            {markers.length > 1 ? 'All employees on map' : 'Field team'} ({items.length})
          </Text>
          <FlatList
            data={items}
            keyExtractor={(item) => item.employee_id}
            contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xl }}
            ListEmptyComponent={!loading ? <Text style={styles.meta}>No live employees.</Text> : null}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.row, focusId === item.employee_id && styles.rowActive]}
                onPress={() => {
                  setFocusId(item.employee_id);
                  router.push({
                    pathname: '/(admin)/live-tracking/[employeeId]',
                    params: { employeeId: item.employee_id },
                  });
                }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.employee_name}</Text>
                  <Text style={styles.sub}>
                    {[item.designation, item.status, item.last_address].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={styles.link}>Live</Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { flex: 1, padding: Spacing.md },
  section: { fontWeight: '800', color: Colors.heading, marginBottom: 8 },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowActive: { borderWidth: 2, borderColor: Colors.brand },
  name: { fontWeight: '700', color: Colors.heading },
  sub: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  link: { color: Colors.brand, fontWeight: '700' },
});
