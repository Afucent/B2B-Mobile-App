import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { listTenantRoles, type TenantRole } from '@/lib/api/rbac';

export default function AdminRolesScreen() {
  const { canView } = usePermissions();
  const [items, setItems] = useState<TenantRole[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await listTenantRoles();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <RequireModuleAccess module="role_library">
      <View style={styles.flex}>
        <ScreenHeader title="Role library" onBack={() => router.back()} />
        <View style={styles.body}>
          {canView('permission_matrix') ? (
            <OutlineButton
              label="Permission matrix"
              onPress={() => router.push('/(admin)/roles/matrix')}
            />
          ) : null}
        {loading ? <Text style={styles.meta}>Loading…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xl }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push({ pathname: '/(admin)/roles/matrix', params: { roleId: item.id } })
              }>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>
                  {item.access_surface} · {item.user_count} users
                </Text>
              </View>
              <Text style={styles.link}>Matrix</Text>
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
  },
  name: { fontWeight: '700', color: Colors.heading },
  sub: { color: Colors.muted, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  link: { color: Colors.brand, fontWeight: '700', fontSize: 13 },
});
