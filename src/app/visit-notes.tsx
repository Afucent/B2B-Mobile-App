import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LinkButton } from '@/components/ui/LinkButton';
import {
  KeyboardSafeScrollView,
  useScrollFieldIntoView,
} from '@/components/ui/KeyboardSafeScrollView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { formatClock } from '@/lib/format';
import { getVisit, saveVisit } from '@/lib/visits';

export default function VisitNotesScreen() {
  const { visitId } = useLocalSearchParams<{ visitId?: string }>();
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [meta, setMeta] = useState({ name: 'Dealer', time: '' });
  const [saving, setSaving] = useState(false);
  const notesField = useScrollFieldIntoView();

  useEffect(() => {
    if (!visitId) return;
    void getVisit(visitId).then((visit) => {
      if (!visit) return;
      setNotes(visit.notes ?? '');
      setPhoto(visit.photoUri);
      setMeta({ name: visit.dealerName, time: formatClock(visit.checkInAt) });
    });
  }, [visitId]);

  async function persist(andContinue: boolean) {
    if (!visitId) return;
    const visit = await getVisit(visitId);
    if (!visit) return;
    setSaving(true);
    await saveVisit({ ...visit, notes, photoUri: photo });
    setSaving(false);
    if (andContinue) router.replace('/(app)/visits');
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      const library = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (library.status !== 'granted') return;
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
      if (!result.canceled) setPhoto(result.assets[0].uri);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Visit Notes" onBack={() => router.back()} />
      <KeyboardSafeScrollView contentContainerStyle={styles.body}>
        <View style={styles.chip}>
          <Ionicons name="location" size={14} color={Colors.brand} />
          <Text style={styles.chipText}>
            {meta.name} · Checked in at {meta.time || '—'}
          </Text>
        </View>
        <Text style={styles.label}>Notes</Text>
        <View ref={notesField.ref} collapsable={false}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            onFocus={notesField.onFocus}
            placeholder="What happened during this visit? Products discussed, orders taken, issues raised..."
            placeholderTextColor={Colors.muted}
            multiline
            style={styles.area}
          />
        </View>
        <Text style={styles.label}>Proof of Visit</Text>
        <View style={styles.proofRow}>
          <Pressable style={styles.addPhoto} onPress={() => void pickPhoto()}>
            <Ionicons name="camera-outline" size={22} color={Colors.muted} />
            <Text style={styles.addText}>Add photo{'\n'}as proof</Text>
          </Pressable>
          {photo ? <Image source={{ uri: photo }} style={styles.preview} /> : <View style={styles.placeholder} />}
        </View>
        <PrimaryButton label="Save & Continue" loading={saving} onPress={() => void persist(true)} />
        <LinkButton label="Skip for now" onPress={() => void persist(true)} />
        <Text style={styles.foot}>Notes and photos are visible to your manager.</Text>
      </KeyboardSafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: 16, gap: 10, paddingBottom: 32 },
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
  addText: { color: Colors.muted, fontSize: 11, textAlign: 'center' },
  preview: { flex: 1, height: 110, borderRadius: Radius.md },
  placeholder: {
    flex: 1,
    height: 110,
    borderRadius: Radius.md,
    backgroundColor: Colors.borderLight,
  },
  foot: { textAlign: 'center', color: Colors.muted, fontSize: 12 },
});
