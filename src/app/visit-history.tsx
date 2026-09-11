import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { DateField } from '@/components/ui/DateField';
import { SafeScreen, useContentBottomInset } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { getMyVisitHistory, getVisitHistory, type FieldVisit } from '@/lib/api/visits';
import { listUsers, type AdminUser } from '@/lib/api/users';
import { formatClock, formatDate } from '@/lib/format';
import { parseYmd, ymd } from '@/lib/leaveUi';
import { resolveMediaUrl } from '@/lib/mediaUrl';

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
  const bottomInset = useContentBottomInset();
  const params = useLocalSearchParams<{ employeeId?: string; employee_id?: string }>();
  const paramEmployeeId = params.employeeId || params.employee_id || '';
  const [items, setItems] = useState<FieldVisit[]>([]);
  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [employeeId, setEmployeeId] = useState(paramEmployeeId || 'all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (paramEmployeeId) setEmployeeId(paramEmployeeId);
    }, [paramEmployeeId]),
  );

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
    <SafeScreen>
      <ScreenHeader title="Visit history" onBack={() => router.back()} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset }]}
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
                onPress={() => {
                  setFromDate(ymd(new Date(Date.now() - 7 * 86400000)));
                  setToDate(ymd(new Date()));
                }}>
                <Text style={styles.dateChipText}>Last 7 days</Text>
              </Pressable>
              <Pressable
                style={styles.dateChip}
                onPress={() => {
                  setFromDate(ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
                  setToDate(ymd(new Date()));
                }}>
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
            <View style={styles.dateFields}>
              <View style={{ flex: 1 }}>
                <DateField
                  label="From"
                  value={fromDate || ymd(new Date(Date.now() - 30 * 86400000))}
                  onChange={(v) => {
                    setFromDate(v);
                    if (toDate && v > toDate) setToDate(v);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <DateField
                  label="To"
                  value={toDate || ymd(new Date())}
                  onChange={setToDate}
                  minimumDate={fromDate ? parseYmd(fromDate) : undefined}
                />
              </View>
            </View>
            {loading ? <Text style={styles.meta}>Loading…</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No completed visits</Text>
              <Text style={styles.emptyCopy}>
                Try another employee or date range, or check back after visits are finished.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const checkInCoords = coordsLabel(item.reached_latitude, item.reached_longitude);
          const checkOutCoords = coordsLabel(item.check_in_latitude, item.check_in_longitude);
          const checkOutAt = item.completed_at ?? item.scheduled_at;
          return (
            <View style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.name}>{item.dealer_name ?? 'Dealer'}</Text>
                <StatusPill label="Completed" tone="success" />
              </View>
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
                <StatusPill
                  label={`Unplanned · ${item.unplanned_reason ?? ''}`.trim()}
                  tone="pending"
                  style={{ marginTop: 6 }}
                />
              ) : null}

              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notes}>{item.notes?.trim() ? item.notes : '—'}</Text>
              {(() => {
                const photoSrc = resolveMediaUrl(item.photo_url);
                return photoSrc ? (
                  <Image source={{ uri: photoSrc }} style={styles.photo} contentFit="cover" />
                ) : null;
              })()}
            </View>
          );
        }}
      />
    </SafeScreen>
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
  list: { padding: Spacing.md, gap: Spacing.sm },
  filters: { gap: Spacing.sm, marginBottom: Spacing.sm },
  sub: { color: Colors.muted, lineHeight: 20 },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
    textTransform: 'uppercase',
  },
  dateRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dateFields: { flexDirection: 'row', gap: 8 },
  dateChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  chipActive: { backgroundColor: Colors.brandSoft, borderColor: Colors.brandSoft },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  chipTextActive: { color: Colors.brandDark },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  emptyWrap: { paddingVertical: Spacing.xl, paddingHorizontal: Spacing.md, alignItems: 'center', gap: 6 },
  emptyTitle: { color: Colors.heading, fontWeight: '700', fontSize: 15, textAlign: 'center' },
  emptyCopy: { color: Colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  name: { fontWeight: '800', color: Colors.heading, fontSize: 16, flex: 1 },
  emp: { color: Colors.brandDark, fontWeight: '700', fontSize: 13 },
  addr: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  detailBlock: {
    marginTop: 8,
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 12,
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
  notesLabel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
    textTransform: 'uppercase',
  },
  notes: { color: Colors.text, fontSize: 13, lineHeight: 18 },
  photo: {
    width: '100%',
    height: 140,
    borderRadius: Radius.md,
    marginTop: 8,
    backgroundColor: Colors.borderLight,
  },
});
