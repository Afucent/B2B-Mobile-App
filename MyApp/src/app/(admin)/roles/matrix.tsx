import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  listTenantPermissions,
  listTenantRoles,
  updateTenantRole,
  type Permission,
  type TenantRole,
} from '@/lib/api/rbac';

const ACTIONS = ['read', 'create', 'update', 'delete', 'approve', 'types_manage'] as const;

export default function AdminRolesMatrixScreen() {
  const { roleId: initialRoleId } = useLocalSearchParams<{ roleId?: string }>();
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roleId, setRoleId] = useState(initialRoleId ?? '');
  const [surface, setSurface] = useState<'web' | 'mobile'>('mobile');
  const [webIds, setWebIds] = useState<Set<string>>(new Set());
  const [mobileIds, setMobileIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = roles.find((r) => r.id === roleId) ?? null;
  const locked = selected?.name === 'organization_admin' || selected?.is_system === true;

  const byModule = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const load = useCallback(async () => {
    setError('');
    try {
      const [roleRes, perms] = await Promise.all([listTenantRoles(), listTenantPermissions()]);
      setRoles(roleRes.items);
      setPermissions(perms);
      const pick = initialRoleId || roleRes.items[0]?.id || '';
      setRoleId(pick);
      const role = roleRes.items.find((r) => r.id === pick);
      applyRolePerms(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matrix');
    }
  }, [initialRoleId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function applyRolePerms(role?: TenantRole) {
    if (!role) {
      setWebIds(new Set());
      setMobileIds(new Set());
      return;
    }
    const web =
      role.web_permission_ids ??
      role.permissions.filter((p) => p.scope === 'tenant').map((p) => p.id);
    const mobile = role.mobile_permission_ids ?? web;
    setWebIds(new Set(web));
    setMobileIds(new Set(mobile));
  }

  function selectRole(id: string) {
    setRoleId(id);
    applyRolePerms(roles.find((r) => r.id === id));
  }

  function toggle(permId: string) {
    if (locked) return;
    const setter = surface === 'web' ? setWebIds : setMobileIds;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  }

  function isChecked(permId: string) {
    return (surface === 'web' ? webIds : mobileIds).has(permId);
  }

  async function save() {
    if (!selected || locked) return;
    setBusy(true);
    setError('');
    try {
      await updateTenantRole(selected.id, {
        web_permission_ids: [...webIds],
        mobile_permission_ids: [...mobileIds],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequireModuleAccess module="permission_matrix">
      <View style={styles.flex}>
      <ScreenHeader title="Permission matrix" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.group}>Role</Text>
        <View style={styles.chips}>
          {roles.map((role) => (
            <Pressable
              key={role.id}
              style={[styles.chip, roleId === role.id && styles.chipOn]}
              onPress={() => selectRole(role.id)}>
              <Text style={[styles.chipText, roleId === role.id && styles.chipTextOn]}>{role.name}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.chips}>
          {(['web', 'mobile'] as const).map((s) => (
            <Pressable
              key={s}
              style={[styles.chip, surface === s && styles.chipOn]}
              onPress={() => setSurface(s)}>
              <Text style={[styles.chipText, surface === s && styles.chipTextOn]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        {locked ? (
          <Text style={styles.lock}>organization_admin / system roles are locked.</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {byModule.map(([module, perms]) => (
          <View key={module} style={styles.module}>
            <Text style={styles.moduleTitle}>{module}</Text>
            {ACTIONS.map((action) => {
              const perm = perms.find((p) => p.action === action);
              if (!perm) return null;
              const on = isChecked(perm.id);
              return (
                <Pressable
                  key={perm.id}
                  style={styles.checkRow}
                  onPress={() => toggle(perm.id)}
                  disabled={locked}>
                  <View style={[styles.box, on && styles.boxOn]} />
                  <Text style={styles.checkLabel}>{action}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}

        {!locked ? <PrimaryButton label="Save" onPress={() => void save()} loading={busy} /> : null}
      </ScrollView>
    </View>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  group: { color: Colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
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
  chipText: { color: Colors.heading, fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  lock: { color: Colors.pendingText, fontWeight: '600' },
  error: { color: Colors.danger },
  module: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  moduleTitle: { fontWeight: '800', color: Colors.brand, textTransform: 'capitalize' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  boxOn: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  checkLabel: { color: Colors.heading, fontWeight: '600' },
});
