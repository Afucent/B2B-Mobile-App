import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius } from '@/constants/theme';
import { saveCorrection } from '@/lib/corrections';
import { formatDate } from '@/lib/format';

export default function RequestCorrectionScreen() {
  const params = useLocalSearchParams<{ date?: string; clockOut?: string }>();
  const today = new Date();
  const [date, setDate] = useState(
    params.date ||
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
  );
  const [clockIn, setClockIn] = useState('09:00 AM');
  const [clockOut, setClockOut] = useState(params.clockOut || '06:00 PM');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const displayDate = useMemo(() => formatDate(new Date(`${date}T00:00:00`)), [date]);

  async function onSubmit() {
    if (!reason.trim()) {
      Alert.alert('Correction', 'Enter a reason for this correction.');
      return;
    }
    setSaving(true);
    const id = `${Date.now()}`;
    await saveCorrection({
      id,
      date,
      clockIn,
      clockOut,
      reason: reason.trim(),
      status: 'pending',
      submittedAt: new Date().toISOString(),
      managerName: 'your reporting manager',
    });
    setSaving(false);
    router.replace({ pathname: '/correction-request', params: { id } });
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Request Correction" onBack={() => router.back()} />
      <KeyboardSafeScrollView contentContainerStyle={styles.body}>
        <Text style={styles.copy}>
          Request a correction for a missed or incorrect attendance entry. Corrections require manager validation.
        </Text>
        <TextField label="Date of correction" value={displayDate} onChangeText={() => undefined} />
        <Text style={styles.hint}>Use YYYY-MM-DD in the field below if you need a different date.</Text>
        <TextField label="Correction date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-08-07" />
        <TextField label="Correct clock-in time" value={clockIn} onChangeText={setClockIn} />
        <TextField label="Correct clock-out time" value={clockOut} onChangeText={setClockOut} />
        <TextField
          label="Reason for correction"
          value={reason}
          onChangeText={setReason}
          placeholder="Forgot to clock out before leaving site"
        />
        <View style={styles.note}>
          <Text style={styles.noteText}>Requires manager approval. You will be notified once the decision is logged.</Text>
        </View>
        <PrimaryButton label="Submit Request" onPress={() => void onSubmit()} loading={saving} />
      </KeyboardSafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  body: { padding: 20, gap: 14, paddingBottom: 40 },
  copy: { fontSize: 15, lineHeight: 22, color: Colors.text },
  hint: { fontSize: 12, color: Colors.muted, marginTop: -8 },
  note: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 12,
  },
  noteText: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
});
