import { router } from 'expo-router';
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
import { useAuth } from '@/context/AuthContext';
import { createUser, listAssignableRoles, type RoleOption } from '@/lib/api/users';
import { formatRoleName } from '@/lib/permissions';
import {
  generatePassword,
  isAssignableRoleName,
  isDealerRoleName,
} from '@/lib/password';

const SURFACES = [
  { value: 'mobile' as const, label: 'Mobile app only' },
  { value: 'web' as const, label: 'Web only' },
  { value: 'both' as const, label: 'Both' },
];

export default function AdminCreateUserScreen() {
  const { user } = useAuth();
  const companyCode = user?.organization?.company_code ?? '';
  const [step, setStep] = useState<1 | 2>(1);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    personal_email: '',
    mobile: '',
    designation: '',
    department: '',
    role_id: '',
    dealer_ids: [] as string[],
    access_surface: 'both' as 'web' | 'mobile' | 'both',
    address: '',
    area: '',
    city: '',
    state: '',
    country: 'India',
    pin_code: '',
    password: '',
    confirm_password: '',
    skip_password: false,
    force_change_password: true,
    send_welcome_email: true,
  });

  useFocusEffect(
    useCallback(() => {
      void listAssignableRoles()
        .then((res) => {
          const assignable = res.filter((r) => isAssignableRoleName(r.name));
          setRoles(assignable);
          if (assignable[0]) {
            setForm((f) => ({ ...f, role_id: f.role_id || assignable[0].id }));
          }
        })
        .catch(() => setRoles([]));
    }, []),
  );

  const selectedRole = roles.find((r) => r.id === form.role_id);
  const isDealerRole = selectedRole ? isDealerRoleName(selectedRole.name) : false;

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validateStep1() {
    if (!form.name.trim() || !form.personal_email.trim() || !form.role_id) {
      setError('Name, email, and role are required.');
      return false;
    }
    if (!form.state.trim() || !form.city.trim() || !form.area.trim() || !form.pin_code.trim()) {
      setError('State, city, area, and pin code are mandatory.');
      return false;
    }
    if (!/^\d{4,10}$/.test(form.pin_code.trim())) {
      setError('Pin code must be digits only (4–10 numbers).');
      return false;
    }
    if (form.mobile && !/^\d{0,10}$/.test(form.mobile)) {
      setError('Mobile must be digits only (max 10).');
      return false;
    }
    return true;
  }

  function goToStep2() {
    setError('');
    if (!validateStep1()) return;
    setStep(2);
  }

  async function submit() {
    setError('');
    if (!form.skip_password) {
      if (!form.password || !form.confirm_password) {
        setError('Password is required, or enable Skip password.');
        return;
      }
      if (form.password !== form.confirm_password) {
        setError('Passwords do not match.');
        return;
      }
    }
    setBusy(true);
    try {
      const result = await createUser({
        name: form.name.trim(),
        personal_email: form.personal_email.trim(),
        mobile: form.mobile.trim() || null,
        designation: form.designation.trim() || null,
        department: form.department.trim() || null,
        role_id: form.role_id,
        dealer_ids: isDealerRole ? [] : form.dealer_ids,
        access_surface: form.access_surface,
        address: form.address.trim() || null,
        area: form.area.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim() || 'India',
        pin_code: form.pin_code.trim(),
        onboard_status: form.skip_password ? 'pending' : 'active',
        skip_password: form.skip_password,
        force_change_password: form.force_change_password,
        send_welcome_email: form.send_welcome_email,
        ...(form.skip_password
          ? {}
          : {
              password: form.password,
              confirm_password: form.confirm_password,
            }),
      });
      Alert.alert('Created', 'User created successfully.', [
        {
          text: 'OK',
          onPress: () =>
            router.replace({
              pathname: '/(admin)/users/[id]',
              params: { id: result.user.id },
            }),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequireModuleAccess module="users" action="create">
      <View style={styles.flex}>
        <ScreenHeader title="New user" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.step}>Step {step} of 2</Text>

          {step === 1 ? (
            <>
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

              <Text style={styles.group}>Role *</Text>
              <View style={styles.chips}>
                {roles.map((role) => (
                  <Pressable
                    key={role.id}
                    style={[styles.chip, form.role_id === role.id && styles.chipOn]}
                    onPress={() => {
                      update('role_id', role.id);
                      if (isDealerRoleName(role.name)) update('dealer_ids', []);
                    }}>
                    <Text
                      style={[
                        styles.chipText,
                        form.role_id === role.id && styles.chipTextOn,
                      ]}>
                      {formatRoleName(role.name)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.group}>Assign dealers</Text>
              <AssignDealersPicker
                disabled={isDealerRole}
                selectedIds={form.dealer_ids}
                onChange={(ids) => update('dealer_ids', ids)}
              />

              <TextField
                label="Address"
                value={form.address}
                onChangeText={(v) => update('address', v)}
                autoCapitalize="sentences"
              />
              <TextField
                label="State *"
                value={form.state}
                onChangeText={(v) => update('state', v)}
                autoCapitalize="words"
              />
              <TextField
                label="City *"
                value={form.city}
                onChangeText={(v) => update('city', v)}
                autoCapitalize="words"
              />
              <TextField
                label="Area *"
                value={form.area}
                onChangeText={(v) => update('area', v)}
                autoCapitalize="words"
              />
              <TextField
                label="Country *"
                value={form.country}
                onChangeText={(v) => update('country', v)}
                autoCapitalize="words"
              />
              <TextField
                label="Pin code *"
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

              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Continue" onPress={goToStep2} />
            </>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.group}>Company code</Text>
                <Text style={styles.value}>{companyCode || '—'}</Text>
              </View>

              <CheckRow
                label="Skip password (pending activation)"
                checked={form.skip_password}
                onPress={() => {
                  const next = !form.skip_password;
                  update('skip_password', next);
                  if (next) update('force_change_password', false);
                }}
              />

              {!form.skip_password ? (
                <>
                  <TextField
                    label="Password *"
                    value={form.password}
                    onChangeText={(v) => update('password', v)}
                    secureTextEntry
                  />
                  <TextField
                    label="Confirm password *"
                    value={form.confirm_password}
                    onChangeText={(v) => update('confirm_password', v)}
                    secureTextEntry
                  />
                  <OutlineButton
                    label="Generate password"
                    onPress={() => {
                      const pw = generatePassword();
                      update('password', pw);
                      update('confirm_password', pw);
                    }}
                  />
                </>
              ) : null}

              <CheckRow
                label="Send welcome email"
                checked={form.send_welcome_email}
                onPress={() => update('send_welcome_email', !form.send_welcome_email)}
              />
              <CheckRow
                label="Force change password on first login"
                checked={form.force_change_password}
                disabled={form.skip_password}
                onPress={() =>
                  !form.skip_password &&
                  update('force_change_password', !form.force_change_password)
                }
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}
              <OutlineButton label="Back" onPress={() => setStep(1)} />
              <PrimaryButton label="Create user" onPress={() => void submit()} loading={busy} />
            </>
          )}
        </ScrollView>
      </View>
    </RequireModuleAccess>
  );
}

function CheckRow({
  label,
  checked,
  onPress,
  disabled,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.checkRow, disabled && { opacity: 0.45 }]}
      onPress={onPress}
      disabled={disabled}>
      <View style={[styles.box, checked && styles.boxOn]} />
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  step: { color: Colors.brand, fontWeight: '700', fontSize: 13 },
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
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
  },
  value: { color: Colors.heading, fontSize: 16, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  boxOn: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  checkLabel: { color: Colors.heading, fontWeight: '600', flex: 1 },
  error: { color: Colors.danger },
});
