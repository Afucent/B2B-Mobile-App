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
  getFieldOperationsSettings,
  updateFieldOperationsSettings,
  type FieldOperationsSettings,
} from '@/lib/api/org';

const WEEKDAYS: { key: string; label: string }[] = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

export default function FieldOpsSettingsScreen() {
  const { canEdit } = usePermissions();
  const editable = canEdit('organization');
  const [form, setForm] = useState<Partial<FieldOperationsSettings>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getFieldOperationsSettings()
        .then(setForm)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
    }, []),
  );

  function patch(next: Partial<FieldOperationsSettings>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  function toggleDay(key: string) {
    const current = new Set(form.working_days ?? []);
    if (current.has(key)) current.delete(key);
    else current.add(key);
    patch({ working_days: Array.from(current) });
  }

  async function save() {
    if (!editable) return;
    setBusy(true);
    setError('');
    try {
      setForm(
        await updateFieldOperationsSettings({
          shift_start_time: form.shift_start_time,
          shift_end_time: form.shift_end_time,
          auto_clock_out_enabled: Boolean(form.auto_clock_out_enabled),
          working_days: form.working_days ?? [],
          clock_in_geofence_radius_m: form.clock_in_geofence_radius_m,
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
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Working days</Text>
            <Text style={styles.hint}>Only these days appear in Visit assign.</Text>
            <View style={styles.days}>
              {WEEKDAYS.map((day) => {
                const on = (form.working_days ?? []).includes(day.key);
                return (
                  <View key={day.key} style={styles.dayRow}>
                    <Text style={styles.dayLabel}>{day.label}</Text>
                    <Switch
                      value={on}
                      onValueChange={() => toggleDay(day.key)}
                      disabled={!editable}
                      trackColor={{ true: Colors.switchOn }}
                    />
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Auto clock-out</Text>
              <Text style={styles.hint}>
                If on, employee clocks out automatically at shift end ({form.shift_end_time || '—'}).
              </Text>
            </View>
            <Switch
              value={Boolean(form.auto_clock_out_enabled)}
              onValueChange={(v) => patch({ auto_clock_out_enabled: v })}
              disabled={!editable}
              trackColor={{ true: Colors.switchOn }}
            />
          </View>
          <TextField
            label="Clock-in geofence (m)"
            value={form.clock_in_geofence_radius_m != null ? String(form.clock_in_geofence_radius_m) : ''}
            onChangeText={(v) => patch({ clock_in_geofence_radius_m: v ? Number(v) : undefined })}
            keyboardType="numeric"
          />
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
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 8,
  },
  cardLabel: { fontWeight: '800', color: Colors.heading },
  hint: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  days: { gap: 4 },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel: { color: Colors.heading, fontWeight: '600' },
  switchRow: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchLabel: { fontWeight: '700', color: Colors.heading },
  error: { color: Colors.danger },
});
