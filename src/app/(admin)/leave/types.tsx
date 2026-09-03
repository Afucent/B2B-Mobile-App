import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import PermissionGate from '@/components/PermissionGate';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { createLeaveType, listLeaveTypesAdmin, type LeaveTypeAdmin } from '@/lib/api/leaveAdmin';
import { listAssignableRoles, type RoleOption } from '@/lib/api/users';
import {
  emptyLeaveTypeForm,
  toLeaveTypePayload,
  validateLeaveTypeForm,
  type LeaveTypeFormValues,
} from '@/lib/leaveTypeForm';
import { formatRoleName } from '@/lib/permissions';

const STATUSES = ['active', 'inactive'] as const;

export default function AdminLeaveTypesScreen() {
  const [items, setItems] = useState<LeaveTypeAdmin[]>([]);
  const [values, setValues] = useState(emptyLeaveTypeForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
    void listLeaveTypesAdmin()
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
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

  async function addType() {
    const nextErrors = validateLeaveTypeForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setCreating(true);
    setError('');
    try {
      await createLeaveType(toLeaveTypePayload(values));
      setValues(emptyLeaveTypeForm());
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  return (
    <RequireModuleAccess module="leave_types" allowCreate>
      <View style={styles.flex}>
        <ScreenHeader title="Leave types" onBack={() => router.back()} />
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.formWrap}>
              <PermissionGate module="leave_types" action="create">
                <Text style={styles.formTitle}>Leave type details</Text>
                <TextField
                  label="Name *"
                  value={values.name}
                  onChangeText={(v) => setField('name', v)}
                  error={errors.name}
                  autoCapitalize="words"
                />
                <TextField
                  label="Code *"
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
                <OptionRow
                  label="Status *"
                  options={[...STATUSES]}
                  value={values.status}
                  onChange={(v) => setField('status', v)}
                  format={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
                />

                <Text style={styles.rolesLabel}>Available for roles</Text>
                <Text style={styles.rolesHint}>Empty = available for all roles</Text>
                <View style={styles.rolesBox}>
                  {roles.length === 0 ? (
                    <Text style={styles.meta}>No roles loaded.</Text>
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

                <PrimaryButton label="Add leave type" onPress={() => void addType()} loading={creating} />
              </PermissionGate>

              {loading ? <Text style={styles.meta}>Loading…</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Text style={styles.listTitle}>Configured types</Text>
            </View>
          }
          ListEmptyComponent={!loading ? <Text style={styles.meta}>No leave types.</Text> : null}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>
                {[
                  item.code,
                  item.status,
                  item.annual_days != null ? `${item.annual_days} days/yr` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          )}
        />
      </View>
    </RequireModuleAccess>
  );
}

function OptionRow<T extends string>({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
  format: (value: T) => string;
}) {
  return (
    <View style={styles.optionWrap}>
      <Text style={styles.optionLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            style={[styles.optionChip, value === opt && styles.optionChipActive]}
            onPress={() => onChange(opt)}>
            <Text style={[styles.optionText, value === opt && styles.optionTextActive]}>{format(opt)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },
  formWrap: { gap: Spacing.sm, marginBottom: Spacing.md },
  formTitle: { fontSize: 16, fontWeight: '800', color: Colors.heading },
  listTitle: { fontSize: 14, fontWeight: '800', color: Colors.heading, marginTop: Spacing.sm },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  name: { fontWeight: '700', color: Colors.heading },
  sub: { color: Colors.muted, fontSize: 12, marginTop: 2 },
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
  optionWrap: { gap: 6 },
  optionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.heading,
    textTransform: 'uppercase',
  },
  optionRow: { gap: 8 },
  optionChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionChipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  optionText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  optionTextActive: { color: '#fff' },
});
