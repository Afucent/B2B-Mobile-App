import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { createUser, listAssignableRoles, type RoleOption } from '@/lib/api/users';

const SURFACES = ['web', 'mobile', 'both'] as const;

export default function AdminCreateUserScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [accessSurface, setAccessSurface] = useState<(typeof SURFACES)[number]>('both');
  const [roleId, setRoleId] = useState('');
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      void listAssignableRoles()
        .then((res) => {
          setRoles(res);
          if (res[0]) setRoleId(res[0].id);
        })
        .catch(() => setRoles([]));
    }, []),
  );

  async function submit() {
    setError('');
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Name, email and password are required.');
      return;
    }
    setBusy(true);
    try {
      await createUser({
        name: name.trim(),
        personal_email: email.trim(),
        mobile: mobile.trim() || null,
        password,
        access_surface: accessSurface,
        role_id: roleId || undefined,
      });
      Alert.alert('Created', 'Employee created successfully.', [
        { text: 'OK', onPress: () => router.back() },
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
      <ScreenHeader title="New employee" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextField label="Mobile" value={mobile} onChangeText={setMobile} keyboardType="numeric" />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />

        <Text style={styles.group}>Access surface</Text>
        <View style={styles.chips}>
          {SURFACES.map((s) => (
            <Pressable
              key={s}
              style={[styles.chip, accessSurface === s && styles.chipOn]}
              onPress={() => setAccessSurface(s)}>
              <Text style={[styles.chipText, accessSurface === s && styles.chipTextOn]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.group}>Role</Text>
        <View style={styles.chips}>
          {roles.map((role) => (
            <Pressable
              key={role.id}
              style={[styles.chip, roleId === role.id && styles.chipOn]}
              onPress={() => setRoleId(role.id)}>
              <Text style={[styles.chipText, roleId === role.id && styles.chipTextOn]}>{role.name}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Create" onPress={() => void submit()} loading={busy} />
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
  error: { color: Colors.danger },
});
