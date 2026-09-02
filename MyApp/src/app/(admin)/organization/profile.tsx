import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { getOrgProfile, updateOrgProfile, type OrgProfile } from '@/lib/api/tenantOrg';

export default function OrgProfileScreen() {
  const { canEdit } = usePermissions();
  const editable = canEdit('organization');
  const [form, setForm] = useState<Partial<OrgProfile>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getOrgProfile()
        .then(setForm)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
    }, []),
  );

  function patch(next: Partial<OrgProfile>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  async function save() {
    if (!editable) return;
    setBusy(true);
    setError('');
    try {
      setForm(
        await updateOrgProfile({
          name: form.name,
          domain_name: form.domain_name,
          domain_email: form.domain_email,
          registered_address: form.registered_address,
          gst_tax_id: form.gst_tax_id,
          currency: form.currency,
          language: form.language,
          timezone: form.timezone,
          company_description: form.company_description,
        }),
      );
      Alert.alert('Saved', 'Organisation profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequireModuleAccess module="organization">
      <View style={styles.flex}>
      <ScreenHeader title="Organisation profile" onBack={() => router.back()} />
      <KeyboardSafeScrollView contentContainerStyle={styles.body}>
        <TextField label="Name" value={form.name ?? ''} onChangeText={(v) => patch({ name: v })} autoCapitalize="words" />
        <View>
          <Text style={styles.codeLabel}>Company code</Text>
          <Text style={styles.codeValue}>{form.company_code ?? '—'}</Text>
        </View>
        <TextField label="Domain" value={form.domain_name ?? ''} onChangeText={(v) => patch({ domain_name: v })} />
        <TextField label="Domain email" value={form.domain_email ?? ''} onChangeText={(v) => patch({ domain_email: v })} keyboardType="email-address" />
        <TextField label="Address" value={form.registered_address ?? ''} onChangeText={(v) => patch({ registered_address: v })} autoCapitalize="sentences" />
        <TextField label="GST / Tax ID" value={form.gst_tax_id ?? ''} onChangeText={(v) => patch({ gst_tax_id: v })} />
        <TextField label="Currency" value={form.currency ?? ''} onChangeText={(v) => patch({ currency: v })} />
        <TextField label="Language" value={form.language ?? ''} onChangeText={(v) => patch({ language: v })} />
        <TextField label="Timezone" value={form.timezone ?? ''} onChangeText={(v) => patch({ timezone: v })} />
        <TextField label="Description" value={form.company_description ?? ''} onChangeText={(v) => patch({ company_description: v })} autoCapitalize="sentences" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {editable ? <PrimaryButton label="Save" onPress={() => void save()} loading={busy} /> : null}
      </KeyboardSafeScrollView>
    </View>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  error: { color: Colors.danger },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.heading,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  codeValue: { color: Colors.muted, fontSize: 16, fontWeight: '600' },
});
