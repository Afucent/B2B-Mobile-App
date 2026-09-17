import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import LocationMap from '@/components/LocationMap';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { checkInVisit } from '@/lib/api/visits';
import { formatClock, formatLongDate } from '@/lib/format';
import { requestLocation, type DeviceLocation } from '@/lib/location';

function routeParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function VisitInScreen() {
  const params = useLocalSearchParams<{
    visitId?: string | string[];
    dealerName?: string | string[];
    day?: string | string[];
  }>();
  const visitId = routeParam(params.visitId);
  const [loc, setLoc] = useState<DeviceLocation | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function refreshLoc() {
      try {
        const next = await requestLocation();
        if (!cancelled) setLoc(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to read GPS.');
      } finally {
        if (!cancelled) setLocLoading(false);
      }
    }
    void refreshLoc();
    const ping = setInterval(() => void refreshLoc(), 15000);
    const clock = setInterval(() => setNow(new Date()), 30000);
    return () => {
      cancelled = true;
      clearInterval(ping);
      clearInterval(clock);
    };
  }, []);

  async function submit() {
    if (!visitId) {
      setError('Missing visit details.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = loc ?? (await requestLocation());
      setLoc(next);
      await checkInVisit(visitId, {
        latitude: next.latitude,
        longitude: next.longitude,
        address: next.address,
      });
      router.replace({
        pathname: '/visit-detail',
        params: {
          visitId,
          dealerName: routeParam(params.dealerName) || 'Dealer',
          checkedIn: '1',
          reachedAt: new Date().toISOString(),
          day: routeParam(params.day),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setLoading(false);
    }
  }

  const lat = loc?.latitude;
  const lon = loc?.longitude;

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Check-in" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.dealer}>{routeParam(params.dealerName) || 'Dealer'}</Text>

        <View style={styles.mapWrap}>
          {lat != null && lon != null ? (
            <LocationMap latitude={lat} longitude={lon} height={220} />
          ) : (
            <View style={styles.mapFallback}>
              <Text style={styles.mapFallbackText}>
                {locLoading ? 'Loading live map…' : 'Location unavailable'}
              </Text>
            </View>
          )}
          <View style={styles.gpsBadge}>
            <Text style={styles.gpsText}>LIVE LOCATION</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>DATE</Text>
              <Text style={styles.value}>{formatLongDate(now)}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={16} color={Colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>TIME</Text>
              <Text style={styles.value}>{formatClock(now.toISOString())}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={16} color={Colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>LOCATION</Text>
              <Text style={styles.value}>
                {locLoading
                  ? 'Fetching GPS…'
                  : loc?.address ||
                    (loc
                      ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`
                      : 'Location unavailable')}
              </Text>
            </View>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label="Submit check-in"
          loading={loading}
          disabled={locLoading}
          onPress={() => void submit()}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: 12, paddingBottom: 32 },
  dealer: { fontSize: 18, fontWeight: '800', color: Colors.heading },
  mapWrap: { position: 'relative' },
  mapFallback: {
    height: 220,
    borderRadius: 12,
    backgroundColor: Colors.mapOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFallbackText: { color: '#fff', fontWeight: '700' },
  gpsBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(15,118,110,0.92)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  gpsText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: Colors.muted },
  value: { fontWeight: '700', color: Colors.heading, fontSize: 15, marginTop: 2 },
  error: { color: Colors.danger },
});
