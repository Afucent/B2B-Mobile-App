import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';

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

function numField(
  value: number | undefined,
  onChange: (v: number | undefined) => void,
) {
  return {
    value: value != null ? String(value) : '',
    onChangeText: (v: string) => onChange(v ? Number(v) : undefined),
    keyboardType: 'numeric' as const,
  };
}

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
          clock_in_window_minutes: form.clock_in_window_minutes,
          auto_clock_out_enabled: Boolean(form.auto_clock_out_enabled),
          working_days: form.working_days ?? [],
          late_clock_in_threshold_minutes: form.late_clock_in_threshold_minutes,
          early_clock_out_threshold_minutes: form.early_clock_out_threshold_minutes,
          gps_ping_interval_minutes: form.gps_ping_interval_minutes,
          gps_off_threshold_minutes: form.gps_off_threshold_minutes,
          location_accuracy_threshold_m: form.location_accuracy_threshold_m,
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
        <KeyboardSafeScrollView contentContainerStyle={styles.body}>
          <Text style={styles.sectionTitle}>Shift configuration</Text>
          <TextField
            label="Shift start (HH:MM)"
            value={form.shift_start_time ?? ''}
            onChangeText={(v) => patch({ shift_start_time: v })}
            editable={editable}
          />
          <TextField
            label="Shift end (HH:MM)"
            value={form.shift_end_time ?? ''}
            onChangeText={(v) => patch({ shift_end_time: v })}
            editable={editable}
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
          <TextField
            label="Clock-in window (mins before shift)"
            {...numField(form.clock_in_window_minutes, (v) => patch({ clock_in_window_minutes: v }))}
            editable={editable}
          />
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

          <Text style={styles.sectionTitle}>Threshold settings</Text>
          <TextField
            label="Late clock-in threshold (mins)"
            {...numField(form.late_clock_in_threshold_minutes, (v) =>
              patch({ late_clock_in_threshold_minutes: v }),
            )}
            editable={editable}
          />
          <TextField
            label="Early clock-out threshold (mins)"
            {...numField(form.early_clock_out_threshold_minutes, (v) =>
              patch({ early_clock_out_threshold_minutes: v }),
            )}
            editable={editable}
          />

          <Text style={styles.sectionTitle}>GPS tracking settings</Text>
          <TextField
            label="GPS ping interval (mins)"
            {...numField(form.gps_ping_interval_minutes, (v) =>
              patch({ gps_ping_interval_minutes: v }),
            )}
            editable={editable}
          />
          <TextField
            label="GPS-off threshold (mins)"
            {...numField(form.gps_off_threshold_minutes, (v) => patch({ gps_off_threshold_minutes: v }))}
            editable={editable}
          />
          <Text style={styles.hint}>
            Must be greater than or equal to GPS ping interval.
          </Text>
          <TextField
            label="Location accuracy threshold (meters)"
            {...numField(form.location_accuracy_threshold_m, (v) =>
              patch({ location_accuracy_threshold_m: v }),
            )}
            editable={editable}
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
  sectionTitle: { fontWeight: '800', color: Colors.heading, fontSize: 15, marginTop: 4 },
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
