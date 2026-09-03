import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { listDealersAdmin, type Dealer } from '@/lib/api/dealers';

export default function AdminDealersScreen() {
  const { canCreate } = usePermissions();
  const [items, setItems] = useState<Dealer[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q?: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await listDealersAdmin(q);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dealers');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(search);
    }, [load, search]),
  );

  return (
    <RequireModuleAccess module="dealers" allowCreate>
      <View style={styles.flex}>
      <ScreenHeader title="Dealers" onBack={() => router.back()} />
      <View style={styles.body}>
        <TextField label="Search" value={search} onChangeText={setSearch} placeholder="Name or code" />
        {canCreate('dealers') ? (
          <OutlineButton label="Add dealer" onPress={() => router.push('/(admin)/dealers/form')} />
        ) : null}
        {loading ? <Text style={styles.meta}>Loading…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xl }}
          ListEmptyComponent={!loading ? <Text style={styles.meta}>No dealers found.</Text> : null}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push({ pathname: '/(admin)/dealers/form', params: { id: item.id } })
              }>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>
                  {item.code} · {item.status}
                </Text>
              </View>
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
  body: { flex: 1, padding: Spacing.md, gap: Spacing.sm },
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
