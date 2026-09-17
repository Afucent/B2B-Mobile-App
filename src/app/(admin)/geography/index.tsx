import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import PermissionGate from '@/components/PermissionGate';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SafeScreen, useContentBottomInset } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { StatusPill, statusTone } from '@/components/ui/StatusPill';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import {
  createArea,
  createCity,
  createRegion,
  createState,
  deleteGeo,
  listAreas,
  listCities,
  listRegions,
  listStates,
  updateGeo,
  updateGeoStatus,
  type GeoItem,
} from '@/lib/api/geography';

type Tab = 'states' | 'cities' | 'regions' | 'areas';

export default function AdminGeographyScreen() {
  const bottomInset = useContentBottomInset();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [tab, setTab] = useState<Tab>('states');
  const [items, setItems] = useState<GeoItem[]>([]);
  const [parents, setParents] = useState<GeoItem[]>([]);
  const [parentId, setParentId] = useState('');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      if (tab === 'states') {
        setItems((await listStates()).items);
        setParents([]);
        setParentId('');
      } else if (tab === 'cities') {
        const states = (await listStates()).items;
        setParents(states);
        const sid = parentId && states.some((s) => s.id === parentId) ? parentId : states[0]?.id ?? '';
        setParentId(sid);
        setItems(sid ? (await listCities(sid)).items : []);
      } else if (tab === 'regions') {
        const cities = (await listCities()).items;
        setParents(cities);
        const cid = parentId && cities.some((c) => c.id === parentId) ? parentId : cities[0]?.id ?? '';
        setParentId(cid);
        setItems(cid ? (await listRegions(cid)).items : []);
      } else {
        const areasParents = (await listRegions()).items;
        setParents(areasParents);
        const rid =
          parentId && areasParents.some((r) => r.id === parentId) ? parentId : areasParents[0]?.id ?? '';
        setParentId(rid);
        setItems(rid ? (await listAreas(rid)).items : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load geography');
    }
  }, [tab, parentId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, search]);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (tab === 'states') await createState({ name: name.trim(), status: 'active' });
      else if (tab === 'cities') {
        if (!parentId) throw new Error('Select a state');
        await createCity({ name: name.trim(), state_id: parentId, status: 'active' });
      } else if (tab === 'regions') {
        if (!parentId) throw new Error('Select a city');
        await createRegion({ name: name.trim(), city_id: parentId, status: 'active' });
      } else {
        if (!parentId) throw new Error('Select a region');
        await createArea({ name: name.trim(), region_id: parentId, status: 'active' });
      }
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(item: GeoItem) {
    setEditingId(item.id);
    setEditName(item.name);
  }

  async function saveEdit(item: GeoItem) {
    if (!canEdit('geography') || !editName.trim()) return;
    setBusy(true);
    setError('');
    try {
      await updateGeo(tab, item.id, { name: editName.trim() });
      setEditingId(null);
      setEditName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(item: GeoItem) {
    if (!canEdit('geography')) return;
    const next = item.status === 'active' ? 'inactive' : 'active';
    setBusy(true);
    setError('');
    try {
      await updateGeoStatus(tab, item.id, next);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(item: GeoItem) {
    if (!canDelete('geography')) return;
    Alert.alert('Delete', `Delete ${item.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void doDelete(item),
      },
    ]);
  }

  async function doDelete(item: GeoItem) {
    setBusy(true);
    setError('');
    try {
      await deleteGeo(tab, item.id);
      if (editingId === item.id) {
        setEditingId(null);
        setEditName('');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  const tabs: Tab[] = ['states', 'cities', 'regions', 'areas'];

  return (
    <RequireModuleAccess module="geography">
      <SafeScreen>
        <ScreenHeader title="Geography" onBack={() => router.back()} />
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.chips}>
            {tabs.map((t) => (
              <Pressable
                key={t}
                style={[styles.chip, tab === t && styles.chipOn]}
                onPress={() => {
                  setTab(t);
                  setParentId('');
                  setEditingId(null);
                  setSearch('');
                }}>
                <Text style={[styles.chipText, tab === t && styles.chipTextOn]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          {tab !== 'states' && parents.length > 0 ? (
            <View style={styles.chips}>
              {parents.slice(0, 20).map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.chip, parentId === p.id && styles.chipOn]}
                  onPress={() => setParentId(p.id)}>
                  <Text style={[styles.chipText, parentId === p.id && styles.chipTextOn]}>{p.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <TextField
            label="Search"
            value={search}
            onChangeText={setSearch}
            placeholder="Filter by name"
          />

          {canCreate('geography') ? (
            <View style={styles.add}>
              <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
              <PrimaryButton label="Add" onPress={() => void add()} loading={busy} />
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: Spacing.sm, paddingBottom: bottomInset }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No items yet</Text>
                <Text style={styles.emptyCopy}>
                  Nothing in this level yet. Add a name above or pick another parent.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isEditing = editingId === item.id;
              const active = item.status !== 'inactive';
              return (
                <View style={styles.row}>
                  {isEditing ? (
                    <TextField
                      label="Name"
                      value={editName}
                      onChangeText={setEditName}
                      autoCapitalize="words"
                    />
                  ) : (
                    <View style={{ gap: 6 }}>
                      <Text style={styles.name}>{item.name}</Text>
                      <StatusPill
                        label={item.status ?? '—'}
                        tone={statusTone(item.status)}
                      />
                    </View>
                  )}
                  <View style={styles.actions}>
                    <PermissionGate module="geography" action="update">
                      {isEditing ? (
                        <Pressable onPress={() => void saveEdit(item)} disabled={busy}>
                          <Text style={styles.actionPrimary}>Save</Text>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => startEdit(item)}>
                          <Text style={styles.action}>Edit</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => void toggleStatus(item)} disabled={busy}>
                        <Text style={styles.action}>{active ? 'Deactivate' : 'Activate'}</Text>
                      </Pressable>
                    </PermissionGate>
                    <PermissionGate module="geography" action="delete">
                      <Pressable onPress={() => confirmDelete(item)} disabled={busy}>
                        <Text style={styles.actionDanger}>Delete</Text>
                      </Pressable>
                    </PermissionGate>
                  </View>
                </View>
              );
            }}
          />
        </KeyboardAvoidingView>
      </SafeScreen>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: Spacing.md, gap: Spacing.sm },
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
  add: { gap: Spacing.sm },
  emptyWrap: { paddingVertical: Spacing.xl, paddingHorizontal: Spacing.md, alignItems: 'center', gap: 6 },
  emptyTitle: { color: Colors.heading, fontWeight: '700', fontSize: 15, textAlign: 'center' },
  emptyCopy: { color: Colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  error: { color: Colors.danger },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: Spacing.sm,
  },
  name: { fontWeight: '700', color: Colors.heading, fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  action: { color: Colors.heading, fontWeight: '700', fontSize: 13 },
  actionPrimary: { color: Colors.brand, fontWeight: '700', fontSize: 13 },
  actionDanger: { color: Colors.danger, fontWeight: '700', fontSize: 13 },
});
