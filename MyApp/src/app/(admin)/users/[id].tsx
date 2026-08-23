import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getUser,
  listAssignableRoles,
  updateUserRole,
  updateUserStatus,
  type AdminUser,
  type RoleOption,
} from '@/lib/api/users';

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canEdit } = usePermissions();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const [u, roleRes] = await Promise.all([
        getUser(id),
        listAssignableRoles().catch(() => [] as RoleOption[]),
      ]);
      setUser(u);
      setRoles(roleRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function toggleStatus() {
    if (!user || !canEdit('users')) return;
    const next = user.status === 'active' ? 'inactive' : 'active';
    setBusy(true);
    try {
      setUser(await updateUserStatus(user.id, next));
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  function pickRole() {
    if (!user || !canEdit('users') || roles.length === 0) return;
    Alert.alert(
      'Change role',
      undefined,
      [
        ...roles.map((role) => ({
          text: role.name,
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                setUser(await updateUserRole(user.id, role.id));
              } catch (err) {
                Alert.alert('Error', err instanceof Error ? err.message : 'Role update failed');
              } finally {
                setBusy(false);
              }
            })();
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  return (
    <RequireModuleAccess module="users" allowCreate>
      <View style={styles.flex}>
      <ScreenHeader title="Employee" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!user && !error ? <Text style={styles.meta}>Loading…</Text> : null}
        {user ? (
          <View style={styles.card}>
            <Field label="Name" value={user.name} />
            <Field label="Email" value={user.personal_email} />
            <Field label="Mobile" value={user.mobile ?? '—'} />
            <Field label="Status" value={user.status} />
            <Field label="Access" value={user.access_surface ?? '—'} />
            <Field
              label="Roles"
              value={user.roles?.map((r) => r.name).join(', ') || '—'}
            />
            {canEdit('users') ? (
              <View style={styles.actions}>
                <OutlineButton
                  label={user.status === 'active' ? 'Set inactive' : 'Set active'}
                  onPress={() => void toggleStatus()}
                  disabled={busy}
                />
                <Pressable style={styles.roleBtn} onPress={pickRole} disabled={busy}>
                  <Text style={styles.roleBtnText}>Change role</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
    </RequireModuleAccess>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.md },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  field: { gap: 4 },
  label: { color: Colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  value: { color: Colors.heading, fontSize: 16, fontWeight: '600' },
  actions: { gap: Spacing.sm, marginTop: Spacing.sm },
  roleBtn: {
    minHeight: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBtnText: { color: Colors.brand, fontWeight: '700' },
});
