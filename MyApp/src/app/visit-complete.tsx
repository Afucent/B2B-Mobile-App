import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { uploadMedia } from '@/lib/api/uploads';
import { completeVisit, createUnplannedVisit, getVisitAssignOptions } from '@/lib/api/visits';
import { formatClock, formatLongDate } from '@/lib/format';
import { requestLocation, type DeviceLocation } from '@/lib/location';

export default function VisitCheckInSubmitScreen() {
  const params = useLocalSearchParams<{
    visitId?: string;
    dealerId?: string;
    dealerName?: string;
    dealerAddress?: string;
    scheduledAt?: string;
    reachedAt?: string;
    reachedAddress?: string;
    reachedLat?: string;
    reachedLon?: string;
    reason?: string;
    unplanned?: string;
  }>();
  const [title, setTitle] = useState(params.dealerName || 'Dealer');
  const [address, setAddress] = useState(params.dealerAddress || '');
  const [scheduledLabel, setScheduledLabel] = useState(
    params.scheduledAt
      ? `${formatLongDate(params.scheduledAt)} · ${formatClock(params.scheduledAt)}`
      : '',
  );
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [loc, setLoc] = useState<DeviceLocation | null>(null);
  const [now] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(true);
  const [error, setError] = useState('');

  const reachedAt = params.reachedAt || '';
  const reachedCoords =
    params.reachedLat && params.reachedLon
      ? `${Number(params.reachedLat).toFixed(5)}, ${Number(params.reachedLon).toFixed(5)}`
      : '';

  useEffect(() => {
    if (params.dealerName) setTitle(params.dealerName);
    if (params.dealerAddress) setAddress(params.dealerAddress);
    if (params.scheduledAt) {
      setScheduledLabel(
        `${formatLongDate(params.scheduledAt)} · ${formatClock(params.scheduledAt)}`,
      );
    } else if (params.dealerId) {
      void getVisitAssignOptions()
        .then((res) => {
          const dealer = res.dealers.find((d) => d.id === params.dealerId);
          setTitle(dealer?.name ?? 'Dealer');
          setScheduledLabel(params.reason ? `Unplanned · ${params.reason}` : 'Unplanned visit');
        })
        .catch(() => {
          setTitle('Dealer');
          setScheduledLabel(params.reason ? `Unplanned · ${params.reason}` : 'Unplanned visit');
        });
    }
  }, [
    params.dealerName,
    params.dealerAddress,
    params.scheduledAt,
    params.dealerId,
    params.reason,
  ]);

  useEffect(() => {
    void (async () => {
      setLocLoading(true);
      try {
        setLoc(await requestLocation());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to read GPS.');
      } finally {
        setLocLoading(false);
      }
    })();
  }, []);

  async function takePhoto() {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (cam.status !== 'granted') {
      setError('Camera permission is required to capture location photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const next = loc ?? (await requestLocation());
      setLoc(next);
      let photoUrl: string | undefined;
      if (photo) photoUrl = await uploadMedia(photo);

      if (params.unplanned === '1' && params.dealerId && params.reason) {
        await createUnplannedVisit({
          dealer_id: params.dealerId,
          reason: params.reason,
          notes: notes.trim() || undefined,
          photo_url: photoUrl,
          latitude: next.latitude,
          longitude: next.longitude,
        });
      } else if (params.visitId) {
        await completeVisit(params.visitId, {
          notes: notes.trim() || undefined,
          photo_url: photoUrl,
          latitude: next.latitude,
          longitude: next.longitude,
        });
      } else {
        setError('Missing visit details.');
        return;
      }
      router.replace('/visit-history');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Check-in" onBack={() => router.back()} />
      <KeyboardSafeScrollView contentContainerStyle={styles.body}>
        <View style={styles.selectedCard}>
          <Text style={styles.kicker}>SELECTED VISIT</Text>
          <Text style={styles.dealer}>{title}</Text>
          {address ? <Text style={styles.addr}>{address}</Text> : null}
          {scheduledLabel ? <Text style={styles.meta}>{scheduledLabel}</Text> : null}
        </View>

        {reachedAt ? (
          <View style={styles.card}>
            <Text style={styles.kicker}>REACHED TIME</Text>
            <Text style={styles.value}>
              {formatLongDate(reachedAt)} · {formatClock(reachedAt)}
            </Text>
            <Text style={[styles.kicker, { marginTop: 10 }]}>REACHED LOCATION</Text>
            <Text style={styles.value}>
              {params.reachedAddress || reachedCoords || loc?.address || 'GPS saved'}
            </Text>
          </View>
        ) : (
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
        )}

        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Write check-in notes…"
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
          label="Submit check-in"
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
  selectedCard: {
    backgroundColor: Colors.brandSoft,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 4,
  },
  dealer: { fontSize: 18, fontWeight: '800', color: Colors.heading },
  addr: { color: Colors.text, fontSize: 13 },
  meta: { color: Colors.muted, fontSize: 12, marginTop: 2 },
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
  label: { fontWeight: '800', color: Colors.heading, marginTop: 6 },
  area: {
    minHeight: 120,
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
