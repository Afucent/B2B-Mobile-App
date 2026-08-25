import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import {
  listTenantPermissions,
  listTenantRoles,
  updateTenantRole,
  type Permission,
  type TenantRole,
} from '@/lib/api/rbac';
import {
  formatRoleName,
  HIDDEN_ORG_MODULES,
  MATRIX_MODULE_ORDER,
  MODULE_LABELS,
} from '@/lib/permissions';
import { isHiddenRoleName, normalizeRoleKey } from '@/lib/password';

type MatrixColumn = 'view' | 'create' | 'edit' | 'delete';

const EDIT_ACTIONS = new Set(['update', 'write']);
const COLUMN_LABELS: Record<MatrixColumn | 'full', string> = {
  full: 'Full',
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
};

const MODULE_HINTS: Record<string, string> = {
  leave_requests: 'Create = Apply leave · Edit = Approve / Reject',
  attendance: 'Admin attendance board (View). Clock is under My Attendance & Leave',
  live_location: 'Admin live map only (View). Start/End is User Tracking',
  my_attendance_leave: 'View = open page · Create = clock in/out + apply leave',
  user_tracking: 'Create = Start / End user tracking',
  leave_types: 'Create / Edit / Delete leave type configs',
  team_calendar: 'View-only team leave calendar',
  role_library: 'Create / delete custom roles',
  permission_matrix: 'Edit = change role permissions',
};

type ModuleRow = {
  module: string;
  label: string;
  hint?: string;
  view?: Permission;
  create?: Permission;
  edit: Permission[];
  delete?: Permission;
  editExtras: Permission[];
};

function buildModuleRows(permissions: Permission[]): ModuleRow[] {
  const byModule = new Map<string, Permission[]>();
  for (const p of permissions) {
    if (!p?.module || !p?.id) continue;
    if (HIDDEN_ORG_MODULES.has(p.module)) continue;
    const list = byModule.get(p.module) ?? [];
    list.push(p);
    byModule.set(p.module, list);
  }

  const modules = (MATRIX_MODULE_ORDER as readonly string[]).filter((m) => byModule.has(m));

  return modules.map((module) => {
    const modulePerms = byModule.get(module) ?? [];
    const edit = modulePerms.filter((p) => EDIT_ACTIONS.has(p.action));
    const editExtras =
      module === 'users'
        ? modulePerms.filter((p) =>
            ['status_update', 'role_assign', 'activation_resend'].includes(p.action),
          )
        : [];
    return {
      module,
      label: MODULE_LABELS[module] ?? module.replace(/_/g, ' '),
      hint: MODULE_HINTS[module],
      view: modulePerms.find((p) => p.action === 'read'),
      create: modulePerms.find((p) => p.action === 'create'),
      edit,
      delete: modulePerms.find((p) => p.action === 'delete'),
      editExtras,
    };
  });
}

function idsForColumn(row: ModuleRow, column: MatrixColumn): string[] {
  if (column === 'view' && row.view) return [row.view.id];
  if (column === 'create' && row.create) return [row.create.id];
  if (column === 'edit') {
    return [...row.edit.map((p) => p.id), ...row.editExtras.map((p) => p.id)];
  }
  if (column === 'delete' && row.delete) return [row.delete.id];
  return [];
}

function columnChecked(selected: Set<string>, row: ModuleRow, column: MatrixColumn) {
  if (column === 'edit') {
    const primary = row.edit.map((p) => p.id);
    if (primary.length === 0 && row.editExtras.length === 0) return false;
    if (primary.length === 0) {
      return row.editExtras.every((p) => selected.has(p.id));
    }
    return primary.every((id) => selected.has(id));
  }
  const ids = idsForColumn(row, column);
  if (ids.length === 0) return false;
  return ids.every((id) => selected.has(id));
}

function toggleColumn(
  selected: Set<string>,
  row: ModuleRow,
  column: MatrixColumn,
  checked: boolean,
): Set<string> {
  const next = new Set(selected);
  for (const id of idsForColumn(row, column)) {
    if (checked) next.add(id);
    else next.delete(id);
  }
  return next;
}

function roleSortKey(name: string): [number, string] {
  const key = normalizeRoleKey(name);
  if (key === 'organization_admin') return [0, key];
  if (key === 'dealer') return [1, key];
  return [2, key];
}

function normalizePermissions(data: unknown): Permission[] {
  if (Array.isArray(data)) return data as Permission[];
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: Permission[] }).items;
  }
  return [];
}

function normalizeRoles(data: unknown): TenantRole[] {
  if (Array.isArray(data)) return data as TenantRole[];
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: TenantRole[] }).items;
  }
  return [];
}

export default function AdminRolesMatrixScreen() {
  const { roleId: initialRoleId } = useLocalSearchParams<{ roleId?: string }>();
  const { canEdit, isOrgAdmin } = usePermissions();
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roleId, setRoleId] = useState(initialRoleId ?? '');
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const moduleRows = useMemo(() => buildModuleRows(permissions), [permissions]);
  const matrixPermissionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of moduleRows) {
      for (const col of ['view', 'create', 'edit', 'delete'] as MatrixColumn[]) {
        for (const id of idsForColumn(row, col)) ids.add(id);
      }
    }
    return ids;
  }, [moduleRows]);

  const selected = roles.find((r) => r.id === roleId) ?? null;
  const roleName = selected ? normalizeRoleKey(selected.name) : '';
  const matrixLocked =
    roleName === 'organization_admin' ||
    (Boolean(selected?.is_system) && roleName !== 'dealer');
  const canEditMatrix = isOrgAdmin || canEdit('permission_matrix') || canEdit('rbac');
  const matrixReadOnly = !selected || matrixLocked || !canEditMatrix;

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [roleRes, permData] = await Promise.all([
        listTenantRoles(),
        listTenantPermissions(),
      ]);
      const visible = normalizeRoles(roleRes)
        .filter((r) => r?.id && r?.name && !isHiddenRoleName(r.name))
        .sort((a, b) => {
          const [ka, na] = roleSortKey(a.name);
          const [kb, nb] = roleSortKey(b.name);
          return ka !== kb ? ka - kb : na.localeCompare(nb);
        });
      setRoles(visible);

      const catalog = normalizePermissions(permData).filter(
        (p) => p?.id && p?.module && !HIDDEN_ORG_MODULES.has(p.module),
      );
      setPermissions(catalog);

      const pick =
        (initialRoleId && visible.find((r) => r.id === initialRoleId)?.id) ||
        visible[0]?.id ||
        '';
      setRoleId(pick);
      const role = visible.find((r) => r.id === pick);
      const matrixIds = new Set(
        catalog
          .filter((p) => (MATRIX_MODULE_ORDER as readonly string[]).includes(p.module))
          .map((p) => p.id),
      );
      setSelectedPermIds(
        new Set((role?.permissions ?? []).map((p) => p.id).filter((id) => matrixIds.has(id))),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matrix');
      setRoles([]);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [initialRoleId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function selectRole(id: string) {
    setRoleId(id);
    const role = roles.find((r) => r.id === id);
    setSelectedPermIds(
      new Set(
        (role?.permissions ?? []).map((p) => p.id).filter((pid) => matrixPermissionIds.has(pid)),
      ),
    );
    setMessage('');
  }

  async function save() {
    if (!selected || matrixReadOnly) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const permission_ids = Array.from(selectedPermIds).filter((id) =>
        matrixPermissionIds.has(id),
      );
      const updated = await updateTenantRole(selected.id, { permission_ids });
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelectedPermIds(
        new Set(
          (updated.permissions ?? [])
            .map((p) => p.id)
            .filter((id) => matrixPermissionIds.has(id)),
        ),
      );
      setMessage(
        permission_ids.length === 0 ? 'All permissions cleared.' : 'Permissions updated.',
      );
      Alert.alert('Saved', 'Permissions updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequireModuleAccess modules={['rbac', 'role_library', 'permission_matrix']}>
      <View style={styles.flex}>
        <ScreenHeader title="Permission matrix" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.hint}>
            View = see only. Create / Edit / Delete are separate. Full grants all actions for
            that module.
          </Text>

          <Text style={styles.group}>Role</Text>
          {loading ? <Text style={styles.meta}>Loading roles & permissions…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && roles.length === 0 ? (
            <Text style={styles.meta}>No roles available.</Text>
          ) : null}

          <View style={styles.chips}>
            {roles.map((role) => (
              <Pressable
                key={role.id}
                style={[styles.chip, roleId === role.id && styles.chipOn]}
                onPress={() => selectRole(role.id)}>
                <Text style={[styles.chipText, roleId === role.id && styles.chipTextOn]}>
                  {formatRoleName(role.name)}
                </Text>
              </Pressable>
            ))}
          </View>

          {selected ? (
            <Text style={styles.selectedRole}>
              Editing: {formatRoleName(selected.name)}
              {matrixLocked ? ' (locked)' : ''}
            </Text>
          ) : null}

          {matrixLocked ? (
            <Text style={styles.lock}>
              Organisation Admin / other system roles (except Dealer) are locked.
            </Text>
          ) : null}
          {!canEditMatrix && !matrixLocked && selected ? (
            <Text style={styles.lock}>You can view this matrix but cannot edit it.</Text>
          ) : null}
          {message ? <Text style={styles.ok}>{message}</Text> : null}

          {!loading && moduleRows.length === 0 ? (
            <Text style={styles.meta}>
              No permission modules returned. Check Permission matrix access on the backend.
            </Text>
          ) : null}

          {moduleRows.map((row) => {
            const allIds = (['view', 'create', 'edit', 'delete'] as MatrixColumn[]).flatMap(
              (col) => idsForColumn(row, col),
            );
            const fullChecked =
              allIds.length > 0 && allIds.every((id) => selectedPermIds.has(id));
            return (
              <View key={row.module} style={styles.module}>
                <Text style={styles.moduleTitle}>{row.label}</Text>
                {row.hint ? <Text style={styles.moduleHint}>{row.hint}</Text> : null}

                <View style={styles.cols}>
                  {allIds.length > 0 ? (
                    <CheckCell
                      label={COLUMN_LABELS.full}
                      checked={fullChecked}
                      disabled={matrixReadOnly}
                      onToggle={(checked) => {
                        const next = new Set(selectedPermIds);
                        for (const id of allIds) {
                          if (checked) next.add(id);
                          else next.delete(id);
                        }
                        setSelectedPermIds(next);
                      }}
                    />
                  ) : (
                    <Text style={styles.dash}>{COLUMN_LABELS.full} —</Text>
                  )}

                  {(['view', 'create', 'edit', 'delete'] as MatrixColumn[]).map((col) => {
                    const ids = idsForColumn(row, col);
                    if (ids.length === 0) {
                      return (
                        <Text key={col} style={styles.dash}>
                          {COLUMN_LABELS[col]} —
                        </Text>
                      );
                    }
                    return (
                      <CheckCell
                        key={col}
                        label={COLUMN_LABELS[col]}
                        checked={columnChecked(selectedPermIds, row, col)}
                        disabled={matrixReadOnly}
                        onToggle={(checked) =>
                          setSelectedPermIds(
                            toggleColumn(selectedPermIds, row, col, checked),
                          )
                        }
                      />
                    );
                  })}
                </View>
              </View>
            );
          })}

          {!matrixReadOnly && !loading ? (
            <PrimaryButton label="Save permissions" onPress={() => void save()} loading={busy} />
          ) : null}
        </ScrollView>
      </View>
    </RequireModuleAccess>
  );
}

function CheckCell({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <Pressable
      style={[styles.checkRow, disabled && { opacity: 0.45 }]}
      disabled={disabled}
      onPress={() => onToggle(!checked)}>
      <View style={[styles.box, checked && styles.boxOn]} />
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  hint: { color: Colors.muted, fontSize: 13 },
  group: { color: Colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  meta: { color: Colors.muted },
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
  selectedRole: { fontWeight: '700', color: Colors.heading },
  lock: { color: Colors.pendingText, fontWeight: '600' },
  error: { color: Colors.danger },
  ok: { color: Colors.brand, fontWeight: '600' },
  module: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  moduleTitle: { fontWeight: '800', color: Colors.brand },
  moduleHint: { color: Colors.muted, fontSize: 11, marginTop: -4 },
  cols: { gap: 8 },
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
  dash: { color: Colors.muted, fontSize: 12 },
});
