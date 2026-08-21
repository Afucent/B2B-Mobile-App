import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { LinkButton } from '@/components/ui/LinkButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { continueLocationAction } from '@/lib/locationGate';
import { openDeviceSettings } from '@/lib/location';

export default function LocationRequiredScreen() {
  const { reason, next } = useLocalSearchParams<{ reason?: string; next?: string }>();
  const denied = reason === 'denied';
  const target = next || '/clock-in';

  const steps = denied
    ? [
        'Open device Settings',
        'Find AFBEX under Apps',
        'Tap Permissions',
        'Allow Location: Always or While Using',
      ]
    : ['Open device Settings', 'Tap Location / Security', 'Turn on location services', 'Return to AFBEX'];

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Location Required" onBack={() => router.back()} />
      <View style={styles.body}>
        <View style={[styles.banner, denied ? styles.bannerWarn : styles.bannerOff]}>
          <Ionicons name="warning" size={18} color={denied ? Colors.pendingText : Colors.pendingText} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>
              {denied ? 'Location permission denied' : 'Location is turned off'}
            </Text>
            <Text style={styles.bannerCopy}>
              {denied
                ? 'AFBEX needs location access to verify your clock-in. Grant permission in settings.'
                : 'Turn on location services on your device to clock in.'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.how}>HOW TO {denied ? 'GRANT PERMISSION' : 'ENABLE ON YOUR DEVICE'}</Text>
          {steps.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={styles.num}>
                <Text style={styles.numText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />
        <PrimaryButton
          label={denied ? 'Open App Settings' : 'Open Settings'}
          onPress={() => void openDeviceSettings()}
        />
        <LinkButton
          label="Back to Dashboard"
          onPress={() => router.replace('/(app)')}
        />
        <Text style={styles.foot}>
          {denied
            ? 'Location is required per company policy (BR-02).'
            : "You won't be clocked in until location is available."}
        </Text>
        <LinkButton label="Try again" onPress={() => void continueLocationAction(target)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { flex: 1, padding: 16, gap: 14, paddingBottom: 24 },
  banner: {
    borderRadius: Radius.lg,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  bannerOff: { backgroundColor: Colors.pendingBg },
  bannerWarn: { backgroundColor: Colors.pendingBg },
  bannerTitle: { fontWeight: '800', color: Colors.heading, marginBottom: 4 },
  bannerCopy: { color: Colors.text, fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 14,
  },
  how: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: Colors.muted },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  num: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { color: Colors.brand, fontWeight: '800' },
  stepText: { color: Colors.heading, fontWeight: '600', flex: 1 },
  foot: { textAlign: 'center', color: Colors.muted, fontSize: 12 },
});
