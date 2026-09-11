import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import {
  createTenantRole,
  deleteTenantRole,
  listTenantRoles,
  updateTenantRole,
  type TenantRole,
} from '@/lib/api/rbac';
import {
  formatRoleName,
  HIDDEN_ORG_MODULES,
  MATRIX_MODULE_ORDER,
  MODULE_LABELS,
} from '@/lib/permissions';
import { isHiddenRoleName, normalizeRoleKey } from '@/lib/password';

function roleSortKey(name: string): [number, string] {
  const key = normalizeRoleKey(name);
  if (key === 'organization_admin') return [0, key];
  if (key === 'dealer') return [1, key];
  return [2, key];
}

export default function AdminRolesScreen() {
  const { canView, canCreate, canEdit, canDelete, isOrgAdmin } = usePermissions();
  const [items, setItems] = useState<TenantRole[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canManageRoles = isOrgAdmin || canCreate('role_library') || canCreate('rbac');
  const canEditRoles = isOrgAdmin || canEdit('role_library') || canEdit('rbac');
  const canDeleteRoles = isOrgAdmin || canDelete('role_library') || canDelete('rbac');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await listTenantRoles();
      const raw = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      const visible = [...raw]
        .filter((r) => r?.id && r?.name && !isHiddenRoleName(r.name))
        .sort((a, b) => {
          const [ka, na] = roleSortKey(a.name);
          const [kb, nb] = roleSortKey(b.name);
          return ka !== kb ? ka - kb : na.localeCompare(nb);
        });
      setItems(visible);
      setSelectedId((cur) => {
        if (cur && visible.some((r) => r.id === cur)) return cur;
        return visible[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q),
    );
  }, [items, search]);

  const selected = items.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected || selected.is_system) {
      setEditName('');
      setEditDescription('');
      return;
    }
    setEditName(selected.name);
    setEditDescription(selected.description ?? '');
  }, [selected?.id, selected?.name, selected?.description, selected?.is_system]);

  const accessSummary = useMemo(() => {
    if (!selected) return [];
    const modules = new Set(
      (selected.permissions ?? [])
        .filter((p) => p.action === 'read')
        .filter((p) => !HIDDEN_ORG_MODULES.has(p.module))
        .filter((p) => (MATRIX_MODULE_ORDER as readonly string[]).includes(p.module))
        .map((p) => MODULE_LABELS[p.module] ?? p.module),
    );
    return [...modules].slice(0, 6);
  }, [selected]);

  async function handleCreate() {
    if (!canManageRoles) return;
    if (!newName.trim()) {
      setError('Role name is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await createTenantRole({
        name: newName.trim(),
        description: newDescription.trim() || null,
        access_surface: 'both',
        permission_ids: [],
      });
      setItems((prev) => [...prev, created]);
      setSelectedId(created.id);
      setShowCreate(false);
      setNewName('');
      setNewDescription('');
      setMessage('Role created with no permissions. Open Permission matrix to assign access.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveRole() {
    if (!selected || selected.is_system || !canEditRoles) return;
    const name = editName.trim();
    const description = editDescription.trim();
    if (name.length < 2) {
      setError('Role name must contain at least 2 characters.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateTenantRole(selected.id, {
        name,
        description: description || null,
      });
      setItems((prev) => prev.map((role) => (role.id === updated.id ? updated : role)));
      setMessage('Role details updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setBusy(false);
    }
  }

  function handleDelete(role: TenantRole) {
    if (!canDeleteRoles || role.is_system) return;
    if (normalizeRoleKey(role.name) === 'dealer') return;
    Alert.alert('Delete role', `Delete role "${formatRoleName(role.name)}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteTenantRole(role.id);
              setItems((prev) => prev.filter((r) => r.id !== role.id));
              if (selectedId === role.id) setSelectedId(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to delete role');
            }
          })();
        },
      },
    ]);
  }

  return (
    <RequireModuleAccess modules={['rbac', 'role_library', 'permission_matrix']}>
      <SafeScreen>
        <ScreenHeader title="Role library" onBack={() => router.back()} />
        <KeyboardSafeScrollView contentContainerStyle={styles.body}>
          {canManageRoles ? (
            <OutlineButton
              label={showCreate ? 'Cancel create' : '+ Create custom role'}
              onPress={() => setShowCreate((v) => !v)}
            />
          ) : null}

          {showCreate ? (
            <View style={styles.createCard}>
              <TextField
                label="Role name *"
                value={newName}
                onChangeText={setNewName}
                autoCapitalize="words"
              />
              <TextField
                label="Description"
                value={newDescription}
                onChangeText={setNewDescription}
                autoCapitalize="sentences"
              />
              <PrimaryButton
                label="Create role"
                onPress={() => void handleCreate()}
                loading={busy}
              />
            </View>
          ) : null}

          <TextField
            label="Search roles"
            value={search}
            onChangeText={setSearch}
            placeholder="Name or description"
            autoCapitalize="none"
          />

          {loading ? <Text style={styles.meta}>Loading…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.ok}>{message}</Text> : null}

          {!loading && filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No roles found</Text>
              <Text style={styles.emptyCopy}>
                Try a different search, or create a custom role to get started.
              </Text>
            </View>
          ) : null}

          {filtered.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.row, selectedId === item.id && styles.rowOn]}
              onPress={() => setSelectedId(item.id)}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name}>{formatRoleName(item.name)}</Text>
                <Text style={styles.sub}>
                  {item.user_count ?? 0} users · {item.permissions?.length ?? 0} permissions
                </Text>
              </View>
              <StatusPill
                label={item.is_system ? 'System' : 'Custom'}
                tone={item.is_system ? 'muted' : 'brand'}
              />
            </Pressable>
          ))}

          {selected ? (
            <View style={styles.detail}>
              {!selected.is_system && canEditRoles ? (
                <>
                  <TextField
                    label="Role name *"
                    value={editName}
                    onChangeText={setEditName}
                    autoCapitalize="words"
                  />
                  <TextField
                    label="Description"
                    value={editDescription}
                    onChangeText={setEditDescription}
                    autoCapitalize="sentences"
                  />
                  <PrimaryButton
                    label="Save role"
                    onPress={() => void handleSaveRole()}
                    loading={busy}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.detailTitle}>{formatRoleName(selected.name)}</Text>
                  <Text style={styles.sub}>{selected.description || 'No description'}</Text>
                </>
              )}
              <Text style={styles.sub}>
                {selected.user_count ?? 0} assigned users · {selected.permissions?.length ?? 0}{' '}
                permissions
              </Text>
              {accessSummary.length > 0 ? (
                <Text style={styles.sub}>Can view: {accessSummary.join(', ')}</Text>
              ) : (
                <Text style={styles.sub}>No view permissions yet</Text>
              )}
              {/* {(canView('permission_matrix') || canView('rbac') || canView('role_library')) ? (
                <OutlineButton
                  label="Edit permissions in matrix"
                  onPress={() =>
                    router.push({
                      pathname: '/(admin)/roles/matrix',
                      params: { roleId: selected.id },
                    })
                  }
                />
              ) : null} */}
              {canDeleteRoles &&
              !selected.is_system &&
              normalizeRoleKey(selected.name) !== 'dealer' ? (
                <Pressable style={styles.dangerBtn} onPress={() => handleDelete(selected)}>
                  <Text style={styles.dangerText}>Delete role</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </KeyboardSafeScrollView>
      </SafeScreen>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, gap: Spacing.sm },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  ok: { color: Colors.brand, fontWeight: '600' },
  emptyWrap: { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.md, alignItems: 'center', gap: 6 },
  emptyTitle: { color: Colors.heading, fontWeight: '700', fontSize: 15, textAlign: 'center' },
  emptyCopy: { color: Colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  createCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowOn: { borderColor: Colors.brand, backgroundColor: Colors.brandSoft },
  name: { fontWeight: '700', color: Colors.heading, fontSize: 15 },
  sub: { color: Colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  detail: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
  },
  detailTitle: { fontWeight: '800', color: Colors.heading, fontSize: 16 },
  dangerBtn: {
    minHeight: 44,
    borderRadius: Radius.md,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: { color: Colors.danger, fontWeight: '700' },
});
