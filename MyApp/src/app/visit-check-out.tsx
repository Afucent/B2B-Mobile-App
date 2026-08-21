import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { formatClock } from '@/lib/format';
import { durationClock } from '@/lib/geo';
import { requestLocation } from '@/lib/location';
import { getVisit, saveVisit } from '@/lib/visits';

export default function VisitCheckOutScreen() {
  const { visitId } = useLocalSearchParams<{ visitId?: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [now] = useState(new Date());
  const [visit, setVisit] = useState<Awaited<ReturnType<typeof getVisit>>>(null);

  useEffect(() => {
    if (!visitId) return;
    void getVisit(visitId).then(setVisit);
  }, [visitId]);

  async function onCheckOut() {
    if (!visit) return;
    setLoading(true);
    setError('');
    try {
      await requestLocation();
      const out = new Date().toISOString();
      await saveVisit({ ...visit, checkOutAt: out });
      router.replace({
        pathname: '/visit-complete',
        params: {
          visitId: visit.id,
          out,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to capture location.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Check Out" onBack={() => router.back()} />
      <Text style={styles.sub}>Log terminal checkpoint departure</Text>
      <View style={styles.body}>
        <View style={styles.loc}>
          <Ionicons name="location" size={16} color={Colors.muted} />
          <Text style={styles.locText}>{visit?.dealerName ?? 'Dealer'}</Text>
        </View>
        <Text style={styles.checked}>Checked in at  {visit ? formatClock(visit.checkInAt) : '—'}</Text>

        <View style={styles.card}>
          <Text style={styles.section}>VISIT SUMMARY</Text>
          <Row label="Duration so far" value={visit ? durationClock(visit.checkInAt, now.toISOString()) : '—'} />
          <Row label="Notes Added" value={visit?.notes ? 'Yes' : 'No'} ok={Boolean(visit?.notes)} />
          <Row label="Photo Attached" value={visit?.photoUri ? '1 file' : 'None'} ok={Boolean(visit?.photoUri)} />
        </View>

        <View style={styles.info}>
          <Ionicons name="information-circle" size={18} color={Colors.infoText} />
          <Text style={styles.infoText}>
            Your secure GPS location coordinates will be permanently recorded with this check-out timestamp.
          </Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ flex: 1 }} />
        <PrimaryButton label="Check Out" loading={loading} disabled={!visit} onPress={() => void onCheckOut()} />
      </View>
    </View>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {ok != null ? (
          <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={ok ? Colors.success : Colors.muted} />
        ) : null}
        <Text style={[styles.rowValue, ok ? { color: Colors.success } : null]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  sub: { textAlign: 'center', color: Colors.muted, marginTop: -8, marginBottom: 8 },
  body: { flex: 1, padding: 16, gap: 10, paddingBottom: 24 },
  loc: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locText: { fontWeight: '800', color: Colors.heading, fontSize: 18 },
  checked: { color: Colors.muted },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
  },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: Colors.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: Colors.muted },
  rowValue: { fontWeight: '700', color: Colors.heading },
  info: {
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.md,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
  },
  infoText: { flex: 1, color: Colors.infoText, fontSize: 13, lineHeight: 18 },
  error: { color: Colors.danger },
});
