import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import PermissionGate from '@/components/PermissionGate';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { SafeScreen, useContentBottomInset } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill, statusTone } from '@/components/ui/StatusPill';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { deleteDealer, listDealersAdmin, type Dealer } from '@/lib/api/dealers';

const STATUS_FILTERS = ['all', 'active', 'inactive'] as const;

export default function AdminDealersScreen() {
  const bottomInset = useContentBottomInset();
  const { canCreate, canDelete } = usePermissions();
  const [items, setItems] = useState<Dealer[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q?: string, statusFilter?: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await listDealersAdmin({
        search: q,
        status: statusFilter && statusFilter !== 'all' ? statusFilter : undefined,
      });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dealers');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(search, status);
    }, [load, search, status]),
  );

  function confirmDelete(item: Dealer) {
    if (!canDelete('dealers')) return;
    Alert.alert('Delete dealer', `Delete ${item.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void doDelete(item.id),
      },
    ]);
  }

  async function doDelete(id: string) {
    try {
      await deleteDealer(id);
      await load(search, status);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <RequireModuleAccess module="dealers" allowCreate>
      <SafeScreen>
        <ScreenHeader title="Dealers" onBack={() => router.back()} />
        <View style={styles.body}>
          <TextField label="Search" value={search} onChangeText={setSearch} placeholder="Name or code" />
          <View style={styles.chips}>
            {STATUS_FILTERS.map((s) => (
              <Pressable
                key={s}
                style={[styles.chip, status === s && styles.chipOn]}
                onPress={() => setStatus(s)}>
                <Text style={[styles.chipText, status === s && styles.chipTextOn]}>{s}</Text>
              </Pressable>
            ))}
          </View>
          {canCreate('dealers') ? (
            <OutlineButton label="Add dealer" onPress={() => router.push('/(admin)/dealers/form')} />
          ) : null}
          {loading ? <Text style={styles.meta}>Loading…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: Spacing.sm, paddingBottom: bottomInset }}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>No dealers found</Text>
                  <Text style={styles.emptyCopy}>
                    Adjust search or status filters, or add a new dealer.
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Pressable
                  style={{ flex: 1, gap: 4 }}
                  onPress={() =>
                    router.push({ pathname: '/(admin)/dealers/form', params: { id: item.id } })
                  }>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.sub}>{item.code}</Text>
                  <StatusPill label={item.status} tone={statusTone(item.status)} />
                </Pressable>
                <PermissionGate module="dealers" action="delete">
                  <Pressable hitSlop={8} onPress={() => confirmDelete(item)}>
                    <Text style={styles.delete}>Delete</Text>
                  </Pressable>
                </PermissionGate>
              </View>
            )}
          />
        </View>
      </SafeScreen>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: Spacing.md, gap: Spacing.sm },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  emptyWrap: { paddingVertical: Spacing.xl, paddingHorizontal: Spacing.md, alignItems: 'center', gap: 6 },
  emptyTitle: { color: Colors.heading, fontWeight: '700', fontSize: 15, textAlign: 'center' },
  emptyCopy: { color: Colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  chipOn: { backgroundColor: Colors.brandSoft, borderColor: Colors.brandSoft },
  chipText: { color: Colors.heading, fontWeight: '600', fontSize: 13, textTransform: 'capitalize' },
  chipTextOn: { color: Colors.brandDark },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: { fontWeight: '700', color: Colors.heading, fontSize: 15 },
  sub: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  delete: { color: Colors.danger, fontWeight: '700', fontSize: 13 },
});
