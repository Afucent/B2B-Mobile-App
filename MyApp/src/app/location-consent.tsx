import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Colors, Radius } from '@/constants/theme';
import { setLocationConsent } from '@/lib/locationConsent';
import { continueLocationAction } from '@/lib/locationGate';

const SPEC = [
  { label: 'Data Collected', value: 'GPS coordinates' },
  { label: 'Trigger Points', value: 'Clock-In/Out & Visit Logs' },
  { label: 'Tracking Window', value: 'Active Shifts Only' },
  { label: 'Access Role', value: 'Admin / Regional Manager' },
];

export default function LocationConsentScreen() {
  const insets = useSafeAreaInsets();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [consent, setConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const target = next || '/clock-in';

  async function onAllow() {
    if (!consent) return;
    setLoading(true);
    await setLocationConsent(true);
    await continueLocationAction(target);
    setLoading(false);
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.hero}>
        <View style={styles.iconRing}>
          <Ionicons name="location" size={28} color={Colors.brand} />
        </View>
        <Text style={styles.title}>Turn on location access</Text>
        <Text style={styles.copy}>
          We track your location only during your shift to verify clock-ins and dealer visits. Location is
          captured at clock-in, clock-out, and each dealer check-in. It stops the moment you clock out.
        </Text>
      </View>

      <View style={styles.spec}>
        <Text style={styles.specTitle}>COLLECTION SPECIFICATION (FR-LOC-07)</Text>
        {SPEC.map((row) => (
          <View key={row.label} style={styles.specRow}>
            <Text style={styles.specLabel}>{row.label}</Text>
            <Text style={styles.specValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.checkRow} onPress={() => setConsent((v) => !v)}>
        <View style={[styles.box, consent && styles.boxOn]}>
          {consent ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </View>
        <Text style={styles.checkLabel}>I understand and consent to shift-based location capturing.</Text>
      </Pressable>

      <View style={{ flex: 1 }} />
      <PrimaryButton
        label="Allow Location Access"
        onPress={() => void onAllow()}
        disabled={!consent}
        loading={loading}
      />
      <Text style={styles.policy}>Required to use AFBEX (Policy BR-02)</Text>
      <Pressable onPress={() => router.back()} style={styles.cancel}>
        <Text style={styles.cancelText}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface, paddingHorizontal: 20 },
  hero: { alignItems: 'center', paddingHorizontal: 8 },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.heading, textAlign: 'center' },
  copy: {
    marginTop: 10,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
  },
  spec: {
    marginTop: 24,
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  specTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: Colors.heading,
  },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  specLabel: { color: Colors.muted, fontSize: 13 },
  specValue: { color: Colors.heading, fontWeight: '700', fontSize: 13, textAlign: 'right', flex: 1 },
  checkRow: { flexDirection: 'row', gap: 10, marginTop: 18, alignItems: 'flex-start' },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: Colors.brand },
  checkLabel: { flex: 1, color: Colors.heading, fontSize: 13, lineHeight: 18 },
  policy: { textAlign: 'center', color: Colors.muted, fontSize: 12, marginTop: 10 },
  cancel: { alignItems: 'center', marginTop: 8 },
  cancelText: { color: Colors.muted, fontWeight: '600' },
});
