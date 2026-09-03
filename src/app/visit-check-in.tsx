import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { LinkButton } from '@/components/ui/LinkButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { getDealer } from '@/lib/api/dealers';
import { formatDistanceKm, haversineMeters, todayKey } from '@/lib/geo';
import { geocodeAddress, requestLocation } from '@/lib/location';
import { getActiveVisit, saveVisit } from '@/lib/visits';

export default function VisitCheckInScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    distance?: string;
    radius?: string;
    inside?: string;
    unplanned?: string;
    reason?: string;
  }>();
  const [loading, setLoading] = useState(false);
  const [you, setYou] = useState('Current GPS position');
  const [dealerAddr, setDealerAddr] = useState('Registered dealer location');
  const [name, setName] = useState('Dealer');
  const [distance, setDistance] = useState(Number(params.distance || 0));
  const radius = Number(params.radius || 500);
  const mismatch = params.inside !== '1';

  useEffect(() => {
    if (!params.id) return;
    void (async () => {
      const dealer = await getDealer(params.id!).catch(() => null);
      if (dealer) {
        setName(dealer.name);
        setDealerAddr(dealer.address || [dealer.area_name, dealer.city_name].filter(Boolean).join(', ') || dealer.name);
      }
      try {
        const loc = await requestLocation();
        setYou(loc.address || 'Current GPS position');
        const geo = await geocodeAddress(dealer?.address);
        if (geo) {
          setDistance(Math.round(haversineMeters(loc.latitude, loc.longitude, geo.latitude, geo.longitude)));
        }
      } catch {
        // keep defaults
      }
    })();
  }, [params.id]);

  async function checkIn(flagged: boolean) {
    if (!params.id) return;
    const existing = await getActiveVisit();
    if (existing && existing.dealerId !== params.id) {
      Alert.alert('Active visit', 'Check out of the current dealer before starting another visit.');
      return;
    }
    setLoading(true);
    const loc = await requestLocation().catch(() => null);
    const id = existing?.id ?? `${Date.now()}`;
    await saveVisit({
      id,
      dealerId: params.id,
      dealerName: name,
      dealerAddress: dealerAddr,
      date: todayKey(),
      checkInAt: existing?.checkInAt ?? new Date().toISOString(),
      flagged,
      unplanned: params.unplanned === '1',
      unplannedReason: params.reason,
      distanceMeters: loc && distance ? distance : distance || null,
      geofenceRadiusM: radius,
      reviewStatus: flagged ? 'flagged' : undefined,
    });
    setLoading(false);
    router.replace({ pathname: '/visit-notes', params: { visitId: id } });
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Check-In" onBack={() => router.back()} />
      <View style={styles.body}>
        {mismatch ? (
          <View style={styles.banner}>
            <Ionicons name="warning" size={18} color={Colors.pendingText} />
            <Text style={styles.bannerTitle}>Location mismatch detected</Text>
          </View>
        ) : (
          <View style={[styles.banner, styles.ok]}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={[styles.bannerTitle, { color: Colors.successText }]}>Inside dealer geofence</Text>
          </View>
        )}

        <Text style={styles.copy}>
          {mismatch
            ? 'You are checking in from a location outside the registered geofence for this dealer.'
            : `You are within the allowed ${radius} m geofence for this dealer.`}
        </Text>

        <View style={styles.card}>
          <Text style={styles.kicker}>YOUR LOCATION</Text>
          <Text style={styles.value}>{you}</Text>
          <Text style={[styles.kicker, { marginTop: 16 }]}>DEALER LOCATION</Text>
          <Text style={styles.value}>{dealerAddr}</Text>
          <View style={styles.split}>
            <View>
              <Text style={styles.kicker}>Measured distance</Text>
              <Text style={[styles.metric, mismatch && { color: Colors.danger }]}>
                {formatDistanceKm(distance || null)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.kicker}>Allowed geofence radius</Text>
              <Text style={styles.metric}>{radius} m</Text>
            </View>
          </View>
        </View>

        {mismatch ? (
          <Text style={styles.flagNote}>
            This check-in will be flagged for manager review (BR-06). You can still proceed.
          </Text>
        ) : null}

        <View style={{ flex: 1 }} />
        <PrimaryButton
          label={mismatch ? 'Check In Anyway' : 'Check In'}
          loading={loading}
          onPress={() => void checkIn(mismatch)}
        />
        <LinkButton label="Cancel" onPress={() => router.back()} />
        {mismatch ? (
          <Text style={styles.foot}>Flagged visits are reviewed by your manager.</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { flex: 1, padding: 16, gap: 12, paddingBottom: 24 },
  banner: {
    backgroundColor: Colors.pendingBg,
    borderRadius: Radius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ok: { backgroundColor: Colors.successBg },
  bannerTitle: { fontWeight: '800', color: Colors.heading, flex: 1 },
  copy: { color: Colors.text, lineHeight: 20 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 6,
  },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: Colors.muted },
  value: { fontWeight: '700', color: Colors.heading, fontSize: 16 },
  split: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  metric: { fontSize: 22, fontWeight: '800', color: Colors.heading, marginTop: 4 },
  flagNote: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  foot: { textAlign: 'center', color: Colors.muted, fontSize: 12 },
});
