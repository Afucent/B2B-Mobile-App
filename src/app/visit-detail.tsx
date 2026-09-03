import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { dealerLocationLines } from '@/lib/dealerAddress';
import { getMyVisit, type FieldVisit } from '@/lib/api/visits';
import { formatClock } from '@/lib/format';

function routeParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function VisitDetailScreen() {
  const params = useLocalSearchParams<{
    visitId?: string | string[];
    dealerName?: string | string[];
    checkedIn?: string | string[];
    reachedAt?: string | string[];
    day?: string | string[];
  }>();
  const visitId = routeParam(params.visitId);
  const [visit, setVisit] = useState<FieldVisit | null>(null);
  const [name, setName] = useState(routeParam(params.dealerName) || 'Dealer');
  const [checkedIn, setCheckedIn] = useState(routeParam(params.checkedIn) === '1');
  const [reachedAt, setReachedAt] = useState(routeParam(params.reachedAt));

  useFocusEffect(
    useCallback(() => {
      if (!visitId) return;
      void getMyVisit(visitId)
        .then((item) => {
          setVisit(item);
          setName(item.dealer_name ?? 'Dealer');
          setCheckedIn(Boolean(item.reached_at));
          setReachedAt(item.reached_at ?? '');
        })
        .catch(() => undefined);
    }, [visitId]),
  );

  const addressLines = visit ? dealerLocationLines(visit) : [];

  function openAction(next: '/visit-in' | '/visit-check-out') {
    router.push({
      pathname: next,
      params: {
        visitId,
        dealerName: name,
        reachedAt,
        day: routeParam(params.day),
      },
    });
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title={name} onBack={() => router.back()} />
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.locHead}>
            <Ionicons name="location" size={18} color={Colors.brand} />
            <Text style={styles.kicker}>DEALER LOCATION</Text>
          </View>

          {addressLines.length > 0 ? (
            addressLines.map((line, index) => (
              <Text key={`${line}-${index}`} style={index === 0 ? styles.addressMain : styles.addressLine}>
                {line}
              </Text>
            ))
          ) : (
            <Text style={styles.addressMain}>No address on file</Text>
          )}

          {visit?.dealer_area ? <InfoRow label="Area" value={visit.dealer_area} /> : null}
          {visit?.dealer_city ? <InfoRow label="City" value={visit.dealer_city} /> : null}
          {visit?.dealer_state ? <InfoRow label="State" value={visit.dealer_state} /> : null}
          {visit?.dealer_country ? <InfoRow label="Country" value={visit.dealer_country} /> : null}
          {visit?.dealer_pin_code ? <InfoRow label="PIN code" value={visit.dealer_pin_code} /> : null}

          {checkedIn && reachedAt ? (
            <Text style={styles.checked}>Checked in · {formatClock(reachedAt)}</Text>
          ) : (
            <Text style={styles.hint}>Check in when you arrive at the dealer.</Text>
          )}
        </View>

        <PrimaryButton
          label={checkedIn ? 'Checked in' : 'Check-in'}
          disabled={checkedIn}
          onPress={() => openAction('/visit-in')}
        />
        <Pressable
          style={[styles.outBtn, !checkedIn && styles.outDisabled]}
          disabled={!checkedIn}
          onPress={() => openAction('/visit-check-out')}>
          <Text style={[styles.outText, !checkedIn && styles.outTextDisabled]}>Check-out</Text>
        </Pressable>
        {!checkedIn ? (
          <Text style={styles.meta}>Check-out unlocks after Check-in.</Text>
        ) : null}
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { flex: 1, padding: Spacing.md, gap: 12 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: Colors.muted },
  addressMain: { fontSize: 16, fontWeight: '700', color: Colors.heading, lineHeight: 22 },
  addressLine: { fontSize: 14, fontWeight: '600', color: Colors.text, lineHeight: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  infoLabel: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  infoValue: { color: Colors.heading, fontSize: 12, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  hint: { color: Colors.muted, fontSize: 13, marginTop: 6 },
  checked: { color: Colors.brand, fontWeight: '700', fontSize: 13, marginTop: 6 },
  outBtn: {
    minHeight: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  outDisabled: { borderColor: Colors.border, opacity: 0.6 },
  outText: { color: Colors.brand, fontWeight: '800', fontSize: 16 },
  outTextDisabled: { color: Colors.muted },
  meta: { color: Colors.muted, fontSize: 12, textAlign: 'center' },
});
