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
import { listUsers, type AdminUser } from '@/lib/api/users';

export default function AdminUsersScreen() {
  const { canCreate } = usePermissions();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q?: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await listUsers(0, 50, q);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
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
    <RequireModuleAccess module="users" allowCreate>
      <View style={styles.flex}>
      <ScreenHeader title="Employees" onBack={() => router.back()} />
      <View style={styles.body}>
        <TextField
          label="Search"
          value={search}
          onChangeText={setSearch}
          placeholder="Name or email"
          autoCapitalize="none"
        />
        {canCreate('users') ? (
          <OutlineButton label="Add employee" onPress={() => router.push('/(admin)/users/new')} />
        ) : null}
        {loading ? <Text style={styles.meta}>Loading…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xl }}
          ListEmptyComponent={!loading ? <Text style={styles.meta}>No employees found.</Text> : null}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push({ pathname: '/(admin)/users/[id]', params: { id: item.id } })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>{item.personal_email}</Text>
              </View>
              <Text style={styles.status}>{item.status}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: { fontWeight: '700', color: Colors.heading },
  sub: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  status: { color: Colors.brand, fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
});
