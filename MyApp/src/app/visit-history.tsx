import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { getMyVisitHistory, getVisitHistory, type FieldVisit } from '@/lib/api/visits';
import { listUsers, type AdminUser } from '@/lib/api/users';
import { formatClock, formatDate } from '@/lib/format';
import { ymd } from '@/lib/leaveUi';

export default function VisitHistoryScreen() {
  const { canView } = usePermissions();
  const isAdmin = canView('visit_history');
  return isAdmin ? (
    <RequireModuleAccess module="visit_history">
      <VisitHistoryContent admin />
    </RequireModuleAccess>
  ) : (
    <VisitHistoryContent admin={false} />
  );
}

function coordsLabel(lat?: number | null, lon?: number | null) {
  if (lat == null || lon == null) return null;
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function openMap(opts: {
  lat?: number | null;
  lon?: number | null;
  title: string;
  subtitle?: string;
}) {
  if (opts.lat == null || opts.lon == null) return;
  router.push({
    pathname: '/visit-map',
    params: {
      lat: String(opts.lat),
      lon: String(opts.lon),
      title: opts.title,
      subtitle: opts.subtitle ?? '',
    },
  });
}

function VisitHistoryContent({ admin }: { admin: boolean }) {
  const [items, setItems] = useState<FieldVisit[]>([]);
  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [employeeId, setEmployeeId] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (admin) {
        void listUsers(0, 100)
          .then((res) => setEmployees(res.items))
          .catch(() => setEmployees([]));
      }
    }, [admin]),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = admin
        ? await getVisitHistory({
            employee_id: employeeId === 'all' ? undefined : employeeId,
            from_date: fromDate || undefined,
            to_date: toDate || undefined,
            status: 'completed',
          })
        : await getMyVisitHistory({
            from_date: fromDate || undefined,
            to_date: toDate || undefined,
          });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [admin, employeeId, fromDate, toDate]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Visit history" onBack={() => router.back()} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.filters}>
            <Text style={styles.sub}>
              {admin
                ? 'Completed visits with check-in and check-out details.'
                : 'Your completed visits with check-in / check-out location, time, notes and photo.'}
            </Text>
            {admin ? (
              <ScrollChips
                label="Employee"
                value={employeeId}
                onChange={setEmployeeId}
                options={[
                  { id: 'all', name: 'All' },
                  ...employees.map((e) => ({ id: e.id, name: e.name })),
                ]}
              />
            ) : null}
            <View style={styles.dateRow}>
              <Pressable
                style={styles.dateChip}
                onPress={() => setFromDate(ymd(new Date(Date.now() - 7 * 86400000)))}>
                <Text style={styles.dateChipText}>Last 7 days</Text>
              </Pressable>
              <Pressable
                style={styles.dateChip}
                onPress={() =>
                  setFromDate(ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
                }>
                <Text style={styles.dateChipText}>This month</Text>
              </Pressable>
              <Pressable
                style={styles.dateChip}
                onPress={() => {
                  setFromDate('');
                  setToDate('');
                }}>
                <Text style={styles.dateChipText}>All</Text>
              </Pressable>
            </View>
            {loading ? <Text style={styles.meta}>Loading…</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={!loading ? <Text style={styles.meta}>No completed visits found.</Text> : null}
        renderItem={({ item }) => {
          const checkInCoords = coordsLabel(item.reached_latitude, item.reached_longitude);
          const checkOutCoords = coordsLabel(item.check_in_latitude, item.check_in_longitude);
          const checkOutAt = item.completed_at ?? item.scheduled_at;
          return (
            <View style={styles.row}>
              <Text style={styles.name}>{item.dealer_name ?? 'Dealer'}</Text>
              {admin ? <Text style={styles.emp}>{item.employee_name}</Text> : null}
              {item.dealer_address ? (
                <Text style={styles.addr} numberOfLines={2}>
                  {item.dealer_address}
                </Text>
              ) : null}

              <View style={styles.detailBlock}>
                <View style={styles.blockHead}>
                  <Text style={styles.blockTitle}>Check-in</Text>
                  <Pressable
                    style={styles.mapIcon}
                    disabled={item.reached_latitude == null || item.reached_longitude == null}
                    onPress={() =>
                      openMap({
                        lat: item.reached_latitude,
                        lon: item.reached_longitude,
                        title: 'Check-in location',
                        subtitle: item.dealer_name ?? undefined,
                      })
                    }>
                    <Ionicons
                      name="map"
                      size={18}
                      color={
                        item.reached_latitude != null ? Colors.brand : Colors.muted
                      }
                    />
                  </Pressable>
                </View>
                <Detail
                  label="Time"
                  value={
                    item.reached_at
                      ? `${formatDate(item.reached_at)} · ${formatClock(item.reached_at)}`
                      : '—'
                  }
                />
                <Detail
                  label="Location"
                  value={item.reached_address || checkInCoords || '—'}
                />
              </View>

              <View style={styles.detailBlock}>
                <View style={styles.blockHead}>
                  <Text style={styles.blockTitle}>Check-out</Text>
                  <Pressable
                    style={styles.mapIcon}
                    disabled={item.check_in_latitude == null || item.check_in_longitude == null}
                    onPress={() =>
                      openMap({
                        lat: item.check_in_latitude,
                        lon: item.check_in_longitude,
                        title: 'Check-out location',
                        subtitle: item.dealer_name ?? undefined,
                      })
                    }>
                    <Ionicons
                      name="map"
                      size={18}
                      color={
                        item.check_in_latitude != null ? Colors.brand : Colors.muted
                      }
                    />
                  </Pressable>
                </View>
                <Detail
                  label="Time"
                  value={`${formatDate(checkOutAt)} · ${formatClock(checkOutAt)}`}
                />
                <Detail label="Location" value={checkOutCoords || '—'} />
              </View>

              {item.unplanned ? (
                <Text style={styles.tag}>Unplanned · {item.unplanned_reason}</Text>
              ) : null}

              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notes}>{item.notes?.trim() ? item.notes : '—'}</Text>
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.photo} contentFit="cover" />
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ScrollChips({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.filterLabel}>{label}</Text>
      <FlatList
        horizontal
        data={options}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chip, value === item.id && styles.chipActive]}
            onPress={() => onChange(item.id)}>
            <Text style={[styles.chipText, value === item.id && styles.chipTextActive]}>
              {item.name}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  filters: { gap: Spacing.sm, marginBottom: Spacing.sm },
  sub: { color: Colors.muted, lineHeight: 20 },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
    textTransform: 'uppercase',
  },
  dateRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dateChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateChipText: { fontSize: 12, fontWeight: '600', color: Colors.heading },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  chipTextActive: { color: '#fff' },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand,
  },
  name: { fontWeight: '800', color: Colors.heading, fontSize: 15 },
  emp: { color: Colors.brand, fontWeight: '700' },
  addr: { color: Colors.muted, fontSize: 12 },
  detailBlock: {
    marginTop: 8,
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 10,
  },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  blockTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.brand,
    textTransform: 'uppercase',
  },
  mapIcon: { padding: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  detailLabel: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  detailValue: {
    color: Colors.heading,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  tag: { color: Colors.pendingText, fontSize: 11, fontWeight: '700', marginTop: 6 },
  notesLabel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
    textTransform: 'uppercase',
  },
  notes: { color: Colors.text, fontSize: 13 },
  photo: {
    width: '100%',
    height: 140,
    borderRadius: Radius.md,
    marginTop: 8,
    backgroundColor: Colors.borderLight,
  },
});
