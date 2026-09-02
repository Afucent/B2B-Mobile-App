import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { APP_VERSION, Colors, Radius } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_SETTINGS, getSettings, saveSettings, type AppSettings } from '@/lib/settings';

export default function SettingsScreen() {
  const { logout } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useFocusEffect(
    useCallback(() => {
      void getSettings().then(setSettings);
    }, []),
  );

  async function patch(next: Partial<AppSettings>) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    await saveSettings(merged);
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.group}>Notifications</Text>
        <View style={styles.card}>
          <Toggle label="Clock-In Reminders" value={settings.clockInReminders} onChange={(v) => void patch({ clockInReminders: v })} />
          <Toggle label="Leave Status Updates" value={settings.leaveStatusUpdates} onChange={(v) => void patch({ leaveStatusUpdates: v })} />
          <Toggle label="Assignment Alerts" value={settings.assignmentAlerts} onChange={(v) => void patch({ assignmentAlerts: v })} />
          <Toggle
            label="Missed Clock-Out Alerts"
            value={settings.missedClockOutAlerts}
            onChange={(v) => void patch({ missedClockOutAlerts: v })}
            last
          />
        </View>

        <Text style={styles.group}>General</Text>
        <View style={styles.card}>
          <NavRow
            label="Language"
            value={settings.language}
            onPress={() =>
              Alert.alert('Language', undefined, [
                { text: 'English', onPress: () => void patch({ language: 'English' }) },
                { text: 'Cancel', style: 'cancel' },
              ])
            }
          />
          <NavRow
            label="Distance Unit"
            value={settings.distanceUnit}
            onPress={() =>
              Alert.alert('Distance unit', undefined, [
                { text: 'Kilometers', onPress: () => void patch({ distanceUnit: 'Kilometers' }) },
                { text: 'Miles', onPress: () => void patch({ distanceUnit: 'Miles' }) },
                { text: 'Cancel', style: 'cancel' },
              ])
            }
            last
          />
        </View>

        <Text style={styles.group}>About</Text>
        <View style={styles.card}>
          <NavRow label="App Version" value={APP_VERSION} />
          <NavRow label="Terms of Service" onPress={() => Alert.alert('Terms of Service', 'Contact your administrator for the latest policy.')} />
          <NavRow label="Privacy Policy" onPress={() => Alert.alert('Privacy Policy', 'Contact your administrator for the latest policy.')} last />
        </View>

        <Text style={styles.danger}>Danger zone</Text>
        <Pressable
          style={styles.logout}
          onPress={() =>
            Alert.alert('Log out', 'End this session on this device?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Log Out',
                style: 'destructive',
                onPress: () => {
                  void logout().then(() => router.replace('/(auth)/login'));
                },
              },
            ])
          }>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
  last,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.switchOn }}
        thumbColor="#fff"
      />
    </View>
  );
}

function NavRow({
  label,
  value,
  onPress,
  last,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value ? `${value}  ${onPress ? '>' : ''}` : '>'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: 16, paddingBottom: 40 },
  group: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: Colors.muted,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    marginBottom: 8,
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  label: { fontSize: 15, color: Colors.heading },
  value: { color: Colors.muted, fontWeight: '600' },
  danger: {
    marginTop: 16,
    marginBottom: 8,
    color: Colors.danger,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  logout: {
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: Colors.danger, fontWeight: '800' },
});
