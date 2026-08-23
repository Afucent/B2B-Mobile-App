import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getFieldOpsSettings,
  updateFieldOpsSettings,
  type FieldOpsSettings,
} from '@/lib/api/tenantOrg';

export default function FieldOpsSettingsScreen() {
  const { canEdit } = usePermissions();
  const editable = canEdit('organization');
  const [form, setForm] = useState<FieldOpsSettings>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getFieldOpsSettings()
        .then(setForm)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
    }, []),
  );

  function patch(next: Partial<FieldOpsSettings>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  async function save() {
    if (!editable) return;
    setBusy(true);
    setError('');
    try {
      setForm(
        await updateFieldOpsSettings({
          shift_start_time: form.shift_start_time || null,
          shift_end_time: form.shift_end_time || null,
          late_grace_minutes: form.late_grace_minutes ?? null,
          auto_clock_out: Boolean(form.auto_clock_out),
          geofence_radius_meters: form.geofence_radius_meters ?? null,
        }),
      );
      Alert.alert('Saved', 'Field ops settings updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequireModuleAccess module="organization">
      <View style={styles.flex}>
      <ScreenHeader title="Field ops settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <TextField
          label="Shift start (HH:MM)"
          value={form.shift_start_time ?? ''}
          onChangeText={(v) => patch({ shift_start_time: v })}
        />
        <TextField
          label="Shift end (HH:MM)"
          value={form.shift_end_time ?? ''}
          onChangeText={(v) => patch({ shift_end_time: v })}
        />
        <TextField
          label="Late grace (minutes)"
          value={form.late_grace_minutes != null ? String(form.late_grace_minutes) : ''}
          onChangeText={(v) => patch({ late_grace_minutes: v ? Number(v) : null })}
          keyboardType="numeric"
        />
        <TextField
          label="Geofence radius (m)"
          value={form.geofence_radius_meters != null ? String(form.geofence_radius_meters) : ''}
          onChangeText={(v) => patch({ geofence_radius_meters: v ? Number(v) : null })}
          keyboardType="numeric"
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Auto clock-out</Text>
          <Switch
            value={Boolean(form.auto_clock_out)}
            onValueChange={(v) => patch({ auto_clock_out: v })}
            disabled={!editable}
            trackColor={{ true: Colors.switchOn }}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {editable ? <PrimaryButton label="Save" onPress={() => void save()} loading={busy} /> : null}
      </ScrollView>
    </View>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  switchRow: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: { fontWeight: '700', color: Colors.heading },
  error: { color: Colors.danger },
});
