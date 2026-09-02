import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import LocationMap from '@/components/LocationMap';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { uploadMedia } from '@/lib/api/uploads';
import { completeVisit } from '@/lib/api/visits';
import { formatClock, formatLongDate } from '@/lib/format';
import { requestLocation, type DeviceLocation } from '@/lib/location';

function routeParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function VisitCheckOutScreen() {
  const params = useLocalSearchParams<{
    visitId?: string | string[];
    dealerName?: string | string[];
    reachedAt?: string | string[];
  }>();
  const visitId = routeParam(params.visitId);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
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

  async function takePhoto() {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (cam.status !== 'granted') {
      setError('Camera permission is required for check-out photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

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
      let photoUrl: string | undefined;
      if (photo) photoUrl = await uploadMedia(photo);
      await completeVisit(visitId, {
        notes: notes.trim() || undefined,
        photo_url: photoUrl,
        latitude: next.latitude,
        longitude: next.longitude,
        address: next.address,
      });
      router.replace('/visit-history');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-out failed');
    } finally {
      setLoading(false);
    }
  }

  const lat = loc?.latitude;
  const lon = loc?.longitude;
  const reachedAt = routeParam(params.reachedAt);

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Check-out" onBack={() => router.back()} />
      <KeyboardSafeScrollView contentContainerStyle={styles.body}>
        <Text style={styles.dealer}>{routeParam(params.dealerName) || 'Dealer'}</Text>
        {reachedAt ? (
          <Text style={styles.meta}>Checked in · {formatClock(reachedAt)}</Text>
        ) : null}

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
            <Ionicons name="time-outline" size={16} color={Colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>TIME</Text>
              <Text style={styles.value}>
                {formatLongDate(now)} · {formatClock(now.toISOString())}
              </Text>
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

        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Write check-out notes…"
          placeholderTextColor={Colors.muted}
          multiline
          style={styles.area}
        />

        <Text style={styles.label}>Location photo</Text>
        <View style={styles.proofRow}>
          <Pressable style={styles.addPhoto} onPress={() => void takePhoto()}>
            <Ionicons name="camera-outline" size={22} color={Colors.muted} />
            <Text style={styles.addText}>Click photo</Text>
          </Pressable>
          {photo ? <Image source={{ uri: photo }} style={styles.preview} /> : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label="Submit check-out"
          loading={loading}
          disabled={locLoading}
          onPress={() => void submit()}
        />
      </KeyboardSafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: 10, paddingBottom: 32 },
  dealer: { fontSize: 18, fontWeight: '800', color: Colors.heading },
  meta: { color: Colors.muted, marginTop: -4 },
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
  label: { fontWeight: '800', color: Colors.heading, marginTop: 4 },
  area: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    textAlignVertical: 'top',
    backgroundColor: Colors.background,
    color: Colors.heading,
  },
  proofRow: { flexDirection: 'row', gap: 12 },
  addPhoto: {
    width: 110,
    height: 110,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 6,
  },
  addText: { color: Colors.muted, fontSize: 11 },
  preview: { flex: 1, height: 110, borderRadius: Radius.md },
  error: { color: Colors.danger },
});
