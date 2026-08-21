import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { clockIn } from '@/lib/api/attendance';
import { formatClock, formatLongDate, mapPreviewUrl } from '@/lib/format';
import { requestLocation, type DeviceLocation } from '@/lib/location';

export default function ClockInScreen() {
  const [loc, setLoc] = useState<DeviceLocation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setLoc(await requestLocation());
      } catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
        if (code === 'services_off') {
          router.replace({ pathname: '/location-required', params: { reason: 'off', next: '/clock-in' } });
          return;
        }
        if (code === 'denied') {
          router.replace({ pathname: '/location-required', params: { reason: 'denied', next: '/clock-in' } });
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to read GPS.');
      }
    })();
  }, []);

  async function onClockIn() {
    if (!loc) return;
    setLoading(true);
    setError('');
    try {
      const record = await clockIn(loc.latitude, loc.longitude);
      router.replace({
        pathname: '/clock-in-confirmed',
        params: {
          time: record.clock_in_time,
          address: record.clock_in_address ?? loc.address ?? '',
          accuracy: String(loc.accuracy ?? 3),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clock-in failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Clock In" onBack={() => router.back()} />
      <View style={styles.mapWrap}>
        {loc ? (
          <Image
            source={{ uri: mapPreviewUrl(loc.latitude, loc.longitude) }}
            style={styles.map}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.map, styles.mapFallback]}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
        <View style={styles.gpsBadge}>
          <Text style={styles.gpsText}>{loc ? 'GPS  ACQUIRED' : 'GPS  LOCATING'}</Text>
        </View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.locCard}>
          <Text style={styles.locLabel}>Current Location</Text>
          <Text style={styles.locValue}>{loc?.address || 'Acquiring device location…'}</Text>
          {loc ? (
            <Text style={styles.coords}>
              Lat: {loc.latitude.toFixed(4)}  ·  Lon: {loc.longitude.toFixed(4)}
            </Text>
          ) : null}
        </View>

        <Text style={styles.timeLabel}>Current Time</Text>
        <Text style={styles.time}>{formatClock(now.toISOString())}</Text>
        <Text style={styles.date}>{formatLongDate(now)}</Text>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            Your location will be recorded with this clock-in. Only verified device location is accepted.
          </Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Clock In" onPress={() => void onClockIn()} loading={loading} disabled={!loc} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  mapWrap: { height: 220, backgroundColor: Colors.mapOverlay },
  map: { width: '100%', height: '100%' },
  mapFallback: { alignItems: 'center', justifyContent: 'center' },
  gpsBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(20,20,20,0.72)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  gpsText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  sheet: { padding: 20, gap: 10, flex: 1 },
  locCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
  },
  locLabel: { color: Colors.brand, fontWeight: '700', marginBottom: 4 },
  locValue: { fontSize: 16, fontWeight: '700', color: Colors.heading },
  coords: { marginTop: 6, color: Colors.muted, fontSize: 12 },
  timeLabel: { textAlign: 'center', color: Colors.muted, marginTop: 8 },
  time: { textAlign: 'center', fontSize: 40, fontWeight: '800', color: Colors.heading },
  date: { textAlign: 'center', color: Colors.muted, marginTop: -6 },
  note: { flexDirection: 'row', gap: 8, marginTop: 8 },
  noteText: { color: Colors.muted, fontSize: 13, lineHeight: 18, flex: 1 },
  error: { color: Colors.danger, fontSize: 13 },
});
