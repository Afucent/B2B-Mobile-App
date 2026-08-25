import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import AssignDealersPicker from '@/components/AssignDealersPicker';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import {
  deleteUser,
  getUser,
  listAssignableRoles,
  resendUserActivation,
  setUserPassword,
  updateUser,
  updateUserRole,
  updateUserStatus,
  type AdminUser,
  type RoleOption,
} from '@/lib/api/users';
import { formatRoleName } from '@/lib/permissions';
import {
  generatePassword,
  isAssignableRoleName,
  isDealerRoleName,
  normalizeRoleKey,
} from '@/lib/password';

const SURFACES = [
  { value: 'mobile' as const, label: 'Mobile' },
  { value: 'web' as const, label: 'Web' },
  { value: 'both' as const, label: 'Both' },
];

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canEdit, canDelete, has } = usePermissions();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    name: '',
    personal_email: '',
    mobile: '',
    designation: '',
    department: '',
    address: '',
    area: '',
    city: '',
    state: '',
    country: 'India',
    pin_code: '',
    dealer_ids: [] as string[],
    access_surface: 'both' as 'web' | 'mobile' | 'both',
    status: '' as '' | 'active' | 'inactive',
  });
  const [roleId, setRoleId] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    new_password: '',
    confirm_password: '',
    force_change_password: true,
  });

  const fillFromUser = useCallback((userData: AdminUser) => {
    setForm({
      name: userData.name,
      personal_email: userData.personal_email,
      mobile: userData.mobile ?? '',
      designation: userData.designation ?? '',
      department: userData.department ?? '',
      address: userData.address ?? '',
      area: userData.area ?? '',
      city: userData.city ?? '',
      state: userData.state ?? '',
      country: userData.country ?? 'India',
      pin_code: userData.pin_code ?? '',
      dealer_ids: userData.dealer_ids ?? (userData.dealer_id ? [userData.dealer_id] : []),
      access_surface:
        userData.access_surface === 'web' || userData.access_surface === 'mobile'
          ? userData.access_surface
          : 'both',
      status:
        userData.status === 'pending_activation'
          ? ''
          : userData.status === 'inactive'
            ? 'inactive'
            : 'active',
    });
    setRoleId(userData.roles?.[0]?.id ?? '');
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const [u, roleRes] = await Promise.all([
        getUser(id),
        listAssignableRoles().catch(() => [] as RoleOption[]),
      ]);
      setUser(u);
      setRoles(roleRes.filter((r) => isAssignableRoleName(r.name)));
      fillFromUser(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    }
  }, [id, fillFromUser]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const currentRoleName = user?.roles?.[0]?.name ?? '';
  const isOrgAdminUser = normalizeRoleKey(currentRoleName) === 'organization_admin';
  const isDealerRole =
    isDealerRoleName(roles.find((r) => r.id === roleId)?.name ?? '') ||
    isDealerRoleName(currentRoleName);
  const isPending = user?.status === 'pending_activation';
  const canUpdateStatus = has('users', 'status_update');
  const canAssignRole = has('users', 'role_assign');

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function saveProfile() {
    if (!user || !canEdit('users')) return;
    if (canUpdateStatus && !form.status) {
      setError('Select a status before saving.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      let result = await updateUser(user.id, {
        name: form.name.trim(),
        personal_email: form.personal_email.trim(),
        mobile: form.mobile.trim() || null,
        designation: form.designation.trim() || null,
        department: form.department.trim() || null,
        address: form.address.trim() || null,
        area: form.area.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        country: form.country.trim() || 'India',
        pin_code: form.pin_code.trim() || null,
        dealer_ids: isDealerRole ? [] : form.dealer_ids,
        access_surface: form.access_surface,
      });
      if (canUpdateStatus && form.status && form.status !== user.status) {
        result = await updateUserStatus(user.id, form.status);
      }
      setUser(result);
      fillFromUser(result);
      setEditing(false);
      setMessage('User updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (!user || !canEdit('users')) return;
    if (!passwordForm.new_password || !passwordForm.confirm_password) {
      setError('Enter and confirm the new password.');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setUser(await setUserPassword(user.id, passwordForm));
      setPasswordForm({ new_password: '', confirm_password: '', force_change_password: true });
      setMessage('Password updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password update failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveRole() {
    if (!user || !canAssignRole || !roleId) return;
    setBusy(true);
    setError('');
    try {
      const updated = await updateUserRole(user.id, roleId);
      setUser(updated);
      fillFromUser(updated);
      if (isDealerRoleName(updated.roles?.[0]?.name ?? '')) {
        setForm((f) => ({ ...f, dealer_ids: [] }));
      }
      setMessage('Role updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Role update failed');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!user || !canDelete('users') || isPending) return;
    Alert.alert('Delete user', `Delete ${user.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await deleteUser(user.id);
              router.replace('/(admin)/users');
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Delete failed');
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  async function resend() {
    if (!user || !has('users', 'activation_resend')) return;
    setBusy(true);
    setError('');
    try {
      const res = await resendUserActivation(user.id);
      setMessage(res.message || 'Activation resent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend activation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequireModuleAccess module="users" allowCreate>
      <View style={styles.flex}>
        <ScreenHeader title="User" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.ok}>{message}</Text> : null}
          {!user && !error ? <Text style={styles.meta}>Loading…</Text> : null}

          {user ? (
            <>
              <View style={styles.card}>
                <Text style={styles.title}>{user.name}</Text>
                <Text style={styles.sub}>{user.personal_email}</Text>
                <Text style={styles.badge}>{user.status.replace(/_/g, ' ')}</Text>
                {!editing && canEdit('users') ? (
                  <OutlineButton label="Edit employee" onPress={() => setEditing(true)} />
                ) : null}
              </View>

              {editing ? (
                <View style={styles.card}>
                  <Text style={styles.section}>Edit employee</Text>
                  <TextField
                    label="Name *"
                    value={form.name}
                    onChangeText={(v) => update('name', v)}
                    autoCapitalize="words"
                  />
                  <TextField
                    label="Personal email *"
                    value={form.personal_email}
                    onChangeText={(v) => update('personal_email', v)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TextField
                    label="Mobile"
                    value={form.mobile}
                    onChangeText={(v) => update('mobile', v.replace(/\D/g, '').slice(0, 10))}
                    keyboardType="numeric"
                  />
                  <TextField
                    label="Designation"
                    value={form.designation}
                    onChangeText={(v) => update('designation', v)}
                    autoCapitalize="words"
                  />
                  <TextField
                    label="Department"
                    value={form.department}
                    onChangeText={(v) => update('department', v)}
                    autoCapitalize="words"
                  />
                  <TextField
                    label="Address"
                    value={form.address}
                    onChangeText={(v) => update('address', v)}
                  />
                  <TextField
                    label="State"
                    value={form.state}
                    onChangeText={(v) => update('state', v)}
                    autoCapitalize="words"
                  />
                  <TextField
                    label="City"
                    value={form.city}
                    onChangeText={(v) => update('city', v)}
                    autoCapitalize="words"
                  />
                  <TextField
                    label="Area"
                    value={form.area}
                    onChangeText={(v) => update('area', v)}
                    autoCapitalize="words"
                  />
                  <TextField
                    label="Pin code"
                    value={form.pin_code}
                    onChangeText={(v) => update('pin_code', v.replace(/\D/g, '').slice(0, 10))}
                    keyboardType="numeric"
                  />

                  <Text style={styles.group}>Access surface</Text>
                  <View style={styles.chips}>
                    {SURFACES.map((s) => (
                      <Pressable
                        key={s.value}
                        style={[styles.chip, form.access_surface === s.value && styles.chipOn]}
                        onPress={() => update('access_surface', s.value)}>
                        <Text
                          style={[
                            styles.chipText,
                            form.access_surface === s.value && styles.chipTextOn,
                          ]}>
                          {s.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {canUpdateStatus ? (
                    <>
                      <Text style={styles.group}>Status *</Text>
                      <View style={styles.chips}>
                        {(['active', 'inactive'] as const).map((s) => (
                          <Pressable
                            key={s}
                            style={[styles.chip, form.status === s && styles.chipOn]}
                            onPress={() => update('status', s)}>
                            <Text
                              style={[styles.chipText, form.status === s && styles.chipTextOn]}>
                              {s}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : null}

                  <Text style={styles.group}>Assign dealers</Text>
                  <AssignDealersPicker
                    disabled={isDealerRole}
                    selectedIds={form.dealer_ids}
                    onChange={(ids) => update('dealer_ids', ids)}
                    forUserId={user.id}
                  />

                  <PrimaryButton
                    label="Save changes"
                    onPress={() => void saveProfile()}
                    loading={busy}
                  />
                  <OutlineButton
                    label="Cancel"
                    onPress={() => {
                      fillFromUser(user);
                      setEditing(false);
                    }}
                  />
                </View>
              ) : (
                <View style={styles.card}>
                  <Field label="Mobile" value={user.mobile ?? '—'} />
                  <Field label="Designation" value={user.designation ?? '—'} />
                  <Field label="Department" value={user.department ?? '—'} />
                  <Field label="Access" value={user.access_surface ?? '—'} />
                  <Field
                    label="Location"
                    value={
                      [user.area, user.city, user.state, user.pin_code].filter(Boolean).join(', ') ||
                      '—'
                    }
                  />
                  <Field label="Address" value={user.address ?? '—'} />
                  <Field
                    label="Assigned dealers"
                    value={
                      (user.dealer_ids?.length ?? 0) > 0
                        ? `${user.dealer_ids!.length} dealer(s)`
                        : 'None'
                    }
                  />
                  <Field
                    label="Roles"
                    value={user.roles?.map((r) => formatRoleName(r.name)).join(', ') || '—'}
                  />
                </View>
              )}

              {canEdit('users') ? (
                <View style={styles.card}>
                  <Text style={styles.section}>Change password</Text>
                  <TextField
                    label="New password"
                    value={passwordForm.new_password}
                    onChangeText={(v) =>
                      setPasswordForm((p) => ({ ...p, new_password: v }))
                    }
                    secureTextEntry
                  />
                  <TextField
                    label="Confirm password"
                    value={passwordForm.confirm_password}
                    onChangeText={(v) =>
                      setPasswordForm((p) => ({ ...p, confirm_password: v }))
                    }
                    secureTextEntry
                  />
                  <OutlineButton
                    label="Generate"
                    onPress={() => {
                      const pw = generatePassword();
                      setPasswordForm((p) => ({
                        ...p,
                        new_password: pw,
                        confirm_password: pw,
                      }));
                    }}
                  />
                  <CheckRow
                    label="Force change on next login"
                    checked={passwordForm.force_change_password}
                    onPress={() =>
                      setPasswordForm((p) => ({
                        ...p,
                        force_change_password: !p.force_change_password,
                      }))
                    }
                  />
                  <PrimaryButton
                    label="Set password"
                    onPress={() => void savePassword()}
                    loading={busy}
                  />
                </View>
              ) : null}

              {canAssignRole && !isOrgAdminUser ? (
                <View style={styles.card}>
                  <Text style={styles.section}>Change role</Text>
                  <View style={styles.chips}>
                    {roles.map((role) => (
                      <Pressable
                        key={role.id}
                        style={[styles.chip, roleId === role.id && styles.chipOn]}
                        onPress={() => setRoleId(role.id)}>
                        <Text
                          style={[styles.chipText, roleId === role.id && styles.chipTextOn]}>
                          {formatRoleName(role.name)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <PrimaryButton
                    label="Update role"
                    onPress={() => void saveRole()}
                    loading={busy}
                  />
                </View>
              ) : null}

              {isPending && has('users', 'activation_resend') ? (
                <OutlineButton
                  label="Resend activation"
                  onPress={() => void resend()}
                  disabled={busy}
                />
              ) : null}

              {canDelete('users') && !isPending ? (
                <Pressable style={styles.dangerBtn} onPress={confirmDelete} disabled={busy}>
                  <Text style={styles.dangerText}>Delete user</Text>
                </Pressable>
              ) : null}
            </>
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

function CheckRow({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.checkRow} onPress={onPress}>
      <View style={[styles.box, checked && styles.boxOn]} />
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  ok: { color: Colors.brand, fontWeight: '600' },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.heading },
  sub: { color: Colors.muted, marginTop: -8 },
  badge: {
    alignSelf: 'flex-start',
    color: Colors.brand,
    fontWeight: '700',
    textTransform: 'capitalize',
    fontSize: 12,
  },
  section: { fontWeight: '800', color: Colors.heading, fontSize: 16 },
  group: { color: Colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  chipOn: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipText: { color: Colors.heading, fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  field: { gap: 4 },
  label: { color: Colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  value: { color: Colors.heading, fontSize: 16, fontWeight: '600' },
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
  checkLabel: { color: Colors.heading, fontWeight: '600', flex: 1 },
  dangerBtn: {
    minHeight: 48,
    borderRadius: Radius.md,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: { color: Colors.danger, fontWeight: '700' },
});
