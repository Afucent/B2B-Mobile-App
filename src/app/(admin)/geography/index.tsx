import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import {
  createArea,
  createCity,
  createRegion,
  createState,
  listAreas,
  listCities,
  listRegions,
  listStates,
  type GeoItem,
} from '@/lib/api/geography';

type Tab = 'states' | 'cities' | 'regions' | 'areas';

export default function AdminGeographyScreen() {
  const { canCreate } = usePermissions();
  const [tab, setTab] = useState<Tab>('states');
  const [items, setItems] = useState<GeoItem[]>([]);
  const [parents, setParents] = useState<GeoItem[]>([]);
  const [parentId, setParentId] = useState('');
  const [name, setName] = useState('');
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

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (tab === 'states') await createState({ name: name.trim() });
      else if (tab === 'cities') {
        if (!parentId) throw new Error('Select a state');
        await createCity({ name: name.trim(), state_id: parentId });
      } else if (tab === 'regions') {
        if (!parentId) throw new Error('Select a city');
        await createRegion({ name: name.trim(), city_id: parentId });
      } else {
        if (!parentId) throw new Error('Select a region');
        await createArea({ name: name.trim(), region_id: parentId });
      }
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  const tabs: Tab[] = ['states', 'cities', 'regions', 'areas'];

  return (
    <RequireModuleAccess module="geography">
      <View style={styles.flex}>
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

        {canCreate('geography') ? (
          <View style={styles.add}>
            <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
            <PrimaryButton label="Add" onPress={() => void add()} loading={busy} />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xl }}
          ListEmptyComponent={<Text style={styles.meta}>No items.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              {item.status ? <Text style={styles.sub}>{item.status}</Text> : null}
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </View>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
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
  chipOn: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipText: { color: Colors.heading, fontWeight: '600', fontSize: 13, textTransform: 'capitalize' },
  chipTextOn: { color: '#fff' },
  add: { gap: Spacing.sm },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  name: { fontWeight: '700', color: Colors.heading },
  sub: { color: Colors.muted, fontSize: 12, marginTop: 2 },
});
