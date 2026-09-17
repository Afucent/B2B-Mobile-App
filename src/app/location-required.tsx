import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { LinkButton } from '@/components/ui/LinkButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useContentBottomInset } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { resumeAfterLocationReady } from '@/lib/attendanceActions';
import { diagnoseLocation, openAppLocationSettings } from '@/lib/location';
import { setLocationConsent } from '@/lib/locationConsent';

export default function LocationRequiredScreen() {
  const bottomInset = useContentBottomInset(24);
  const { reason, next } = useLocalSearchParams<{ reason?: string; next?: string }>();
  const servicesOff = reason === 'off';
  const target = next || '/(app)';
  const [busy, setBusy] = useState(false);

  const tryContinue = useCallback(async () => {
    const status = await diagnoseLocation({ always: !servicesOff });
    if (status === 'ok') {
      await setLocationConsent(true);
      await resumeAfterLocationReady(target);
    }
  }, [servicesOff, target]);

  useFocusEffect(
    useCallback(() => {
      void tryContinue();
    }, [tryContinue]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void tryContinue();
    });
    return () => sub.remove();
  }, [tryContinue]);

  const steps = servicesOff
    ? ['Open device Settings', 'Tap Location / Security', 'Turn on location services', 'Return to AFBEX']
    : [
        'Tap Open App Settings',
        'On Location permission, choose Allow all the time',
        'Return to AFBEX — tracking starts automatically',
      ];

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Location Required" onBack={() => router.back()} />
      <View style={[styles.body, { paddingBottom: bottomInset }]}>
        <View style={[styles.banner, servicesOff ? styles.bannerOff : styles.bannerWarn]}>
          <Ionicons name="warning" size={18} color={Colors.pendingText} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>
              {servicesOff ? 'Location is turned off' : 'Allow location all the time'}
            </Text>
            <Text style={styles.bannerCopy}>
              {servicesOff
                ? 'Turn on location services on your device to clock in and start tracking.'
                : 'Open phone Settings and set AFBEX Location to Allow all the time so pings continue with the app closed, in the background, on the lock screen, or with the display off.'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.how}>HOW TO {servicesOff ? 'ENABLE ON YOUR DEVICE' : 'GRANT PERMISSION'}</Text>
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
          label="Open App Settings"
          onPress={() => {
            setBusy(true);
            void openAppLocationSettings().finally(() => setBusy(false));
          }}
          loading={busy}
        />
        <LinkButton label="Back to Dashboard" onPress={() => router.replace('/(app)')} />
        <Text style={styles.foot}>
          {servicesOff
            ? "You won't be clocked in until location is available."
            : 'Choose Allow all the time in Settings, then return to the app.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { flex: 1, padding: 16, gap: 14 },

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
