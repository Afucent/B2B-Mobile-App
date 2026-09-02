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
import { getOrgPrivacy, updateOrgPrivacy } from '@/lib/api/tenantOrg';

export default function OrgPrivacyScreen() {
  const { canEdit } = usePermissions();
  const editable = canEdit('organization');
  const [privacyPolicy, setPrivacyPolicy] = useState('');
  const [disclosure, setDisclosure] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getOrgPrivacy()
        .then((res) => {
          setPrivacyPolicy(res.privacy_policy ?? '');
          setDisclosure(res.data_disclosure_statement ?? '');
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
    }, []),
  );

  async function save() {
    if (!editable) return;
    setBusy(true);
    setError('');
    try {
      await updateOrgPrivacy({
        privacy_policy: privacyPolicy,
        data_disclosure_statement: disclosure,
      });
      Alert.alert('Saved', 'Privacy settings updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequireModuleAccess module="organization">
      <View style={styles.flex}>
      <ScreenHeader title="Organisation privacy" onBack={() => router.back()} />
      <KeyboardSafeScrollView contentContainerStyle={styles.body}>
        <TextField
          label="Privacy policy"
          value={privacyPolicy}
          onChangeText={setPrivacyPolicy}
          autoCapitalize="sentences"
        />
        <TextField
          label="Data disclosure"
          value={disclosure}
          onChangeText={setDisclosure}
          autoCapitalize="sentences"
        />
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
});
