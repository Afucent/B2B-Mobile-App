import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getDealer } from '@/lib/api/dealers';
import { uploadMedia } from '@/lib/api/uploads';
import { completeVisit, createUnplannedVisit, getMyVisits } from '@/lib/api/visits';
import { formatClock } from '@/lib/format';
import { requestLocation } from '@/lib/location';

export default function VisitCompleteScreen() {
  const params = useLocalSearchParams<{
    visitId?: string;
    dealerId?: string;
    reason?: string;
    unplanned?: string;
  }>();
  const [title, setTitle] = useState('Dealer visit');
  const [subtitle, setSubtitle] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (params.visitId) {
      void getMyVisits().then((res) => {
        const visit = res.items.find((v) => v.id === params.visitId);
        if (visit) {
          setTitle(visit.dealer_name ?? 'Visit');
          setSubtitle(`Scheduled ${formatClock(visit.scheduled_at)}`);
        }
      });
    } else if (params.dealerId) {
      void getDealer(params.dealerId).then((dealer) => {
        setTitle(dealer.name);
        setSubtitle(params.reason ? `Reason: ${params.reason}` : 'Unplanned visit');
      });
    }
  }, [params.visitId, params.dealerId, params.reason]);

  async function pickPhoto() {
    const library = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (library.status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const loc = await requestLocation().catch(() => null);
      let photoUrl: string | undefined;
      if (photo) photoUrl = await uploadMedia(photo);

      if (params.unplanned === '1' && params.dealerId && params.reason) {
        await createUnplannedVisit({
          dealer_id: params.dealerId,
          reason: params.reason,
          notes: notes.trim() || undefined,
          photo_url: photoUrl,
          latitude: loc?.latitude,
          longitude: loc?.longitude,
        });
      } else if (params.visitId) {
        await completeVisit(params.visitId, {
          notes: notes.trim() || undefined,
          photo_url: photoUrl,
          latitude: loc?.latitude,
          longitude: loc?.longitude,
        });
      } else {
        setError('Missing visit details.');
        return;
      }
      router.replace('/(app)/field');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Complete visit" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.chip}>
          <Ionicons name="location" size={14} color={Colors.brand} />
          <Text style={styles.chipText}>{title}{subtitle ? ` · ${subtitle}` : ''}</Text>
        </View>

        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Products discussed, orders, issues..."
          placeholderTextColor={Colors.muted}
          multiline
          style={styles.area}
        />

        <Text style={styles.label}>Photo proof</Text>
        <View style={styles.proofRow}>
          <Pressable style={styles.addPhoto} onPress={() => void pickPhoto()}>
            <Ionicons name="camera-outline" size={22} color={Colors.muted} />
            <Text style={styles.addText}>Add photo</Text>
          </Pressable>
          {photo ? <Image source={{ uri: photo }} style={styles.preview} /> : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Submit visit" loading={loading} onPress={() => void submit()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: 10, paddingBottom: 32 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { color: Colors.muted, fontSize: 13, flex: 1 },
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
