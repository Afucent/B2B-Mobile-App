import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SafeScreen, useContentBottomInset } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill, statusTone } from '@/components/ui/StatusPill';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import {
  createLeaveType,
  deleteLeaveType,
  listLeaveTypesAdmin,
  updateLeaveType,
  updateLeaveTypeStatus,
  type LeaveTypeAdmin,
} from '@/lib/api/leaveAdmin';
import { listAssignableRoles, type RoleOption } from '@/lib/api/users';
import {
  emptyLeaveTypeForm,
  leaveTypeToForm,
  toLeaveTypePayload,
  validateLeaveTypeForm,
  type LeaveTypeFormValues,
} from '@/lib/leaveTypeForm';
import { formatRoleName } from '@/lib/permissions';

const LIST_STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
] as const;

export default function AdminLeaveTypesScreen() {
  const bottomInset = useContentBottomInset();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [items, setItems] = useState<LeaveTypeAdmin[]>([]);
  const [values, setValues] = useState(emptyLeaveTypeForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof LIST_STATUS_FILTERS)[number]['id']>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState('');
  const showForm =
    canCreate('leave_types') || (Boolean(editingId) && canEdit('leave_types'));

  useEffect(() => {
    void listAssignableRoles()
      .then((data) =>
        setRoles(
          data.filter((r) => {
            const n = r.name.trim().toLowerCase().replace(/\s+/g, '_');
            return n !== 'tenant_member' && n !== 'organization_admin';
          }),
        ),
      )
      .catch(() => setRoles([]));
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    void listLeaveTypesAdmin({
      search: search.trim() || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    })
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => reload(), 250);
      return () => clearTimeout(t);
    }, [reload]),
  );

  function setField<K extends keyof LeaveTypeFormValues>(key: K, value: LeaveTypeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleRole(id: string) {
    setValues((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(id)
        ? prev.roleIds.filter((x) => x !== id)
        : [...prev.roleIds, id],
    }));
  }

  function startEdit(item: LeaveTypeAdmin) {
    setEditingId(item.id);
    setValues(leaveTypeToForm(item));
    setErrors({});
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setValues(emptyLeaveTypeForm());
    setErrors({});
  }

  async function saveType() {
    const nextErrors = validateLeaveTypeForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (editingId && !canEdit('leave_types')) return;
    if (!editingId && !canCreate('leave_types')) return;

    setSaving(true);
    setError('');
    try {
      // New types start active; status changes use Activate/Deactivate on each card.
      const payload = toLeaveTypePayload(
        editingId ? values : { ...values, status: 'active' },
      );
      if (editingId) {
        await updateLeaveType(editingId, payload);
        setEditingId(null);
      } else {
        await createLeaveType(payload);
      }
      setValues(emptyLeaveTypeForm());
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? 'Update failed' : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function onToggleStatus(item: LeaveTypeAdmin) {
    const next = item.status === 'inactive' ? 'active' : 'inactive';
    setBusyId(item.id);
    try {
      await updateLeaveTypeStatus(item.id, next);
      reload();
    } catch (err) {
      Alert.alert('Status', err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setBusyId('');
    }
  }

  function onDelete(item: LeaveTypeAdmin) {
    Alert.alert('Delete leave type', `Delete “${item.name}”? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void confirmDelete(item.id),
      },
    ]);
  }

  async function confirmDelete(id: string) {
    setBusyId(id);
    try {
      await deleteLeaveType(id);
      if (editingId === id) cancelEdit();
      reload();
    } catch (err) {
      Alert.alert('Delete', err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyId('');
    }
  }

  return (
    <RequireModuleAccess module="leave_types" allowCreate>
      <SafeScreen>
        <ScreenHeader title="Leave types" onBack={() => router.back()} />
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomInset }]}
          ListHeaderComponent={
            <View style={styles.formWrap}>
              {showForm ? (
                <>
                  <Text style={styles.formTitle}>
                    {editingId ? 'Edit leave type' : 'Leave type details'}
                  </Text>
                  <TextField
                    label="Name *"
                    value={values.name}
                    onChangeText={(v) => setField('name', v)}
                    error={errors.name}
                    autoCapitalize="words"
                  />
                  <TextField
                    label="Code"
                    value={values.code}
                    onChangeText={(v) => setField('code', v.toUpperCase())}
                    error={errors.code}
                    autoCapitalize="characters"
                  />
                  <TextField
                    label="Annual days *"
                    value={values.annualDays}
                    onChangeText={(v) => setField('annualDays', v)}
                    error={errors.annualDays}
                    keyboardType="numeric"
                  />

                  <Text style={styles.rolesLabel}>Available for roles</Text>
                  <Text style={styles.rolesHint}>Empty = available for all roles</Text>
                  <View style={styles.rolesBox}>
                    {roles.length === 0 ? (
                      <Text style={styles.meta}>No roles loaded yet.</Text>
                    ) : (
                      roles.map((role) => (
                        <Pressable key={role.id} style={styles.roleRow} onPress={() => toggleRole(role.id)}>
                          <View style={[styles.checkbox, values.roleIds.includes(role.id) && styles.checkboxOn]}>
                            {values.roleIds.includes(role.id) ? (
                              <Text style={styles.checkMark}>✓</Text>
                            ) : null}
                          </View>
                          <Text style={styles.roleName}>{formatRoleName(role.name)}</Text>
                        </Pressable>
                      ))
                    )}
                  </View>

                  <PrimaryButton
                    label={editingId ? 'Save changes' : 'Add leave type'}
                    onPress={() => void saveType()}
                    loading={saving}
                  />
                  {editingId ? <OutlineButton label="Cancel edit" onPress={cancelEdit} /> : null}
                </>
              ) : null}

              <TextField
                label="Search"
                value={search}
                onChangeText={setSearch}
                placeholder="Search leave types"
                autoCapitalize="none"
              />
              <Text style={styles.filterLabel}>Show</Text>
              <View style={styles.chipRow}>
                {LIST_STATUS_FILTERS.map((opt) => {
                  const active = statusFilter === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setStatusFilter(opt.id)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {loading ? <Text style={styles.meta}>Loading leave types…</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Text style={styles.listTitle}>Configured types</Text>
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                No leave types yet. Add one above to get started.
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const busy = busyId === item.id;
            const inactive = item.status === 'inactive';
            const meta = [
              item.code,
              item.annual_days != null ? `${item.annual_days} days/yr` : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <View style={styles.row}>
                <View style={styles.rowTop}>
                  <View style={styles.rowTitleBlock}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {meta ? (
                      <Text style={styles.sub} numberOfLines={1}>
                        {meta}
                      </Text>
                    ) : null}
                  </View>
                  <StatusPill
                    label={item.status ?? 'active'}
                    tone={statusTone(item.status)}
                    style={styles.statusPill}
                  />
                </View>
                {(canEdit('leave_types') || canDelete('leave_types')) ? (
                  <View style={styles.actions}>
                    {canEdit('leave_types') ? (
                      <>
                        <Pressable
                          style={[styles.actionBtn, styles.actionNeutral, busy && styles.actionDisabled]}
                          disabled={busy}
                          onPress={() => startEdit(item)}>
                          <Text style={styles.actionNeutralText}>Edit</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.actionBtn, styles.actionSoft, busy && styles.actionDisabled]}
                          disabled={busy}
                          onPress={() => void onToggleStatus(item)}>
                          <Text style={styles.actionSoftText}>
                            {inactive ? 'Activate' : 'Deactivate'}
                          </Text>
                        </Pressable>
                      </>
                    ) : null}
                    {canDelete('leave_types') ? (
                      <Pressable
                        style={[styles.actionBtn, styles.actionDanger, busy && styles.actionDisabled]}
                        disabled={busy}
                        onPress={() => onDelete(item)}>
                        <Text style={styles.actionDangerText}>Delete</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      </SafeScreen>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.md, gap: Spacing.sm },
  formWrap: { gap: Spacing.sm, marginBottom: Spacing.md },
  formTitle: { fontSize: 16, fontWeight: '800', color: Colors.heading },
  listTitle: { fontSize: 14, fontWeight: '800', color: Colors.heading, marginTop: Spacing.sm },
  meta: { color: Colors.muted, fontSize: 13 },
  empty: { color: Colors.muted, fontSize: 13, lineHeight: 20, paddingVertical: Spacing.sm },
  error: { color: Colors.danger },
  filterLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.brandSoft,
    borderColor: Colors.brand,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  chipTextActive: { color: Colors.brand, fontWeight: '700' },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
    gap: 6,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitleBlock: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '700', color: Colors.heading },
  sub: { color: Colors.muted, fontSize: 12, lineHeight: 16 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  actionDisabled: { opacity: 0.55 },
  actionNeutral: {
    backgroundColor: Colors.brand,
  },
  actionNeutralText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionSoft: {
    backgroundColor: Colors.brandSoft,
    borderWidth: 1,
    borderColor: Colors.brand,
  },
  actionSoftText: {
    color: Colors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  actionDanger: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  actionDangerText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  rolesLabel: { fontSize: 12, fontWeight: '700', color: Colors.heading, marginTop: 4 },
  rolesHint: { fontSize: 11, color: Colors.muted, marginTop: -4 },
  rolesBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
    maxHeight: 160,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  roleName: { color: Colors.heading, fontSize: 14 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
