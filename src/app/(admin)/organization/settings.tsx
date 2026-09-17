import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';
import { SafeScreen, useContentBottomInset } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill, statusTone } from '@/components/ui/StatusPill';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import {
  createOfficeLocation,
  getGeofenceSettings,
  resetGeofenceSettings,
  updateGeofenceSettings,
  type GeofenceSettings,
  type OfficeLocation,
} from '@/lib/api/tenantOrg';

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

export default function OrgSettingsScreen() {
  const bottomInset = useContentBottomInset();
  const { canView, canEdit, canDelete } = usePermissions();
  const editable = canEdit('organization');
  const canReset = canDelete('organization');
  const canOpenFieldOps = canView('shift_gps_settings');
  const [form, setForm] = useState<Partial<GeofenceSettings>>({});
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locRadius, setLocRadius] = useState<number | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const applySettings = useCallback((data: GeofenceSettings) => {
    setForm(data);
    setLocations(data.locations ?? []);
  }, []);

  const load = useCallback(() => {
    void getGeofenceSettings()
      .then(applySettings)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [applySettings]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function patch(next: Partial<GeofenceSettings>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  async function save() {
    if (!editable) return;
    setBusy(true);
    setError('');
    try {
      applySettings(
        await updateGeofenceSettings({
          default_geofence_radius_m: form.default_geofence_radius_m,
          enforce_geofence: Boolean(form.enforce_geofence),
          bypass_approval_required: Boolean(form.bypass_approval_required),
          multiple_locations_enabled: Boolean(form.multiple_locations_enabled),
          tracking_interval_minutes: form.tracking_interval_minutes,
          track_only_working_hours: Boolean(form.track_only_working_hours),
        }),
      );
      Alert.alert('Saved', 'Geofence settings updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  function confirmReset() {
    if (!canReset) return;
    Alert.alert('Reset to defaults', 'Restore geofence settings to organisation defaults?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => void doReset(),
      },
    ]);
  }

  async function doReset() {
    setBusy(true);
    setError('');
    try {
      applySettings(await resetGeofenceSettings());
      Alert.alert('Reset', 'Geofence settings restored to defaults.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  async function addLocation() {
    if (!editable) return;
    if (!locName.trim() || !locAddress.trim()) {
      setError('Location name and address are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await createOfficeLocation({
        name: locName.trim(),
        address: locAddress.trim(),
        radius_m: locRadius,
        status: 'active',
      });
      setLocations((prev) => [...prev, created]);
      setLocName('');
      setLocAddress('');
      setLocRadius(undefined);
      Alert.alert('Added', 'Office location created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add location');
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequireModuleAccess module="organization">
      <SafeScreen>
        <ScreenHeader title="Organisation settings" onBack={() => router.back()} />
        <KeyboardSafeScrollView contentContainerStyle={[styles.body, { paddingBottom: bottomInset }]}>
          {canOpenFieldOps ? (
            <View style={styles.card}>
              <Text style={styles.title}>Field operations</Text>
              <Text style={styles.copy}>
                Shift windows, late grace, auto clock-out, and GPS tracking are managed under Field ops
                settings.
              </Text>
              <OutlineButton
                label="Open field ops settings"
                onPress={() => router.push('/(admin)/field-ops-settings')}
              />
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Geofence</Text>
          <TextField
            label="Default geofence radius (m)"
            {...numField(form.default_geofence_radius_m, (v) =>
              patch({ default_geofence_radius_m: v }),
            )}
            editable={editable}
          />
          <SwitchRow
            label="Enforce geofence"
            value={Boolean(form.enforce_geofence)}
            onChange={(v) => patch({ enforce_geofence: v })}
            disabled={!editable}
          />
          <SwitchRow
            label="Bypass approval required"
            value={Boolean(form.bypass_approval_required)}
            onChange={(v) => patch({ bypass_approval_required: v })}
            disabled={!editable}
          />
          <SwitchRow
            label="Multiple locations enabled"
            value={Boolean(form.multiple_locations_enabled)}
            onChange={(v) => patch({ multiple_locations_enabled: v })}
            disabled={!editable}
          />
          <TextField
            label="Tracking interval (mins)"
            {...numField(form.tracking_interval_minutes, (v) =>
              patch({ tracking_interval_minutes: v }),
            )}
            editable={editable}
          />
          <SwitchRow
            label="Track only during working hours"
            value={Boolean(form.track_only_working_hours)}
            onChange={(v) => patch({ track_only_working_hours: v })}
            disabled={!editable}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {editable ? <PrimaryButton label="Save" onPress={() => void save()} loading={busy} /> : null}
          {canReset ? (
            <OutlineButton label="Reset to defaults" onPress={confirmReset} disabled={busy} />
          ) : null}

          <Text style={styles.sectionTitle}>Office locations</Text>
          {locations.length === 0 ? (
            <Text style={styles.empty}>
              No office locations yet. Add one below so geofencing can check attendance.
            </Text>
          ) : (
            locations.map((loc) => (
              <View key={loc.id} style={styles.locRow}>
                <View style={styles.locTop}>
                  <Text style={styles.locName}>{loc.name}</Text>
                  {loc.status ? (
                    <StatusPill label={loc.status} tone={statusTone(loc.status)} />
                  ) : null}
                </View>
                <Text style={styles.hint}>
                  {loc.address} · {loc.radius_m}m
                </Text>
              </View>
            ))
          )}

          {editable ? (
            <View style={styles.addCard}>
              <Text style={styles.cardLabel}>Add location</Text>
              <TextField label="Name" value={locName} onChangeText={setLocName} autoCapitalize="words" />
              <TextField
                label="Address"
                value={locAddress}
                onChangeText={setLocAddress}
                autoCapitalize="sentences"
              />
              <TextField
                label="Radius (m)"
                {...numField(locRadius, setLocRadius)}
              />
              <OutlineButton label="Add location" onPress={() => void addLocation()} disabled={busy} />
            </View>
          ) : null}
        </KeyboardSafeScrollView>
      </SafeScreen>
    </RequireModuleAccess>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: Colors.switchOn }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, gap: Spacing.md },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  title: { fontWeight: '800', color: Colors.heading, fontSize: 16 },
  copy: { color: Colors.text, lineHeight: 20 },
  sectionTitle: { fontWeight: '800', color: Colors.heading, fontSize: 15, marginTop: 4 },
  cardLabel: { fontWeight: '800', color: Colors.heading },
  hint: { color: Colors.muted, fontSize: 13 },
  empty: { color: Colors.muted, fontSize: 13, lineHeight: 20 },
  switchRow: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchLabel: { flex: 1, fontWeight: '700', color: Colors.heading },
  locRow: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md + 2,
    gap: 6,
  },
  locTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  locName: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.heading },
  addCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  error: { color: Colors.danger },
});
