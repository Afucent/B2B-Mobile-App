import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LinkButton } from '@/components/ui/LinkButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Stamp } from '@/components/ui/Stamp';
import { Colors } from '@/constants/theme';
import { listDealers } from '@/lib/api/dealers';
import { formatClock, formatDate } from '@/lib/format';
import { getVisit, visitsForDay } from '@/lib/visits';

export default function VisitCompleteScreen() {
  const { visitId, out } = useLocalSearchParams<{ visitId?: string; out?: string }>();
  const [name, setName] = useState('Dealer');
  const [inAt, setInAt] = useState('');
  const [outAt, setOutAt] = useState(out ?? '');
  const [notes, setNotes] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [done, setDone] = useState(0);
  const [assigned, setAssigned] = useState(0);

  useEffect(() => {
    if (!visitId) return;
    void (async () => {
      const visit = await getVisit(visitId);
      if (visit) {
        setName(visit.dealerName);
        setInAt(visit.checkInAt);
        setOutAt(visit.checkOutAt ?? out ?? '');
        setNotes(Boolean(visit.notes));
        setPhoto(Boolean(visit.photoUri));
      }
      const logs = await visitsForDay();
      setDone(logs.filter((v) => v.checkOutAt).length);
      const dealers = await listDealers().catch(() => ({ items: [] }));
      setAssigned(Math.max(dealers.items.length, logs.length));
    })();
  }, [visitId, out]);

  const duration = (() => {
    if (!inAt || !outAt) return '—';
    const ms = new Date(outAt).getTime() - new Date(inAt).getTime();
    const mins = Math.max(0, Math.floor(ms / 60000));
    const secs = Math.max(0, Math.floor((ms % 60000) / 1000));
    return `${mins}m  ${String(secs).padStart(2, '0')}s`;
  })();

  return (
    <View style={styles.flex}>
      <Text style={styles.nav}>Confirmed</Text>
      <Text style={styles.sub}>Checkpoint Departure Stamp</Text>
      <View style={styles.body}>
        <Stamp
          title="VISIT COMPLETE"
          subtitle={`●  ${formatDate(outAt || new Date()).toUpperCase()}  ·  ${formatClock(outAt)}`}
        />
        <Text style={styles.caption}>Recorded Visit Duration</Text>
        <Text style={styles.time}>{duration}</Text>
        <View style={styles.rows}>
          <Row label="Dealer:" value={name} />
          <Row label="Check-in / Out:" value={`${formatClock(inAt)} – ${formatClock(outAt)}`} />
          <Row label="Visit Notes:" value={notes ? "Saved & Sync'd" : 'Skipped'} />
          <Row label="Photo Document:" value={photo ? 'Attached (Verified)' : 'Not attached'} ok={photo} />
        </View>
        <View style={styles.progress}>
          <Text style={styles.progressText}>
            You have completed {done} of {assigned || done} dealers today.
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <PrimaryButton label="Next Dealer" onPress={() => router.replace('/(app)/visits')} />
        <LinkButton label="Back to Dashboard" onPress={() => router.replace('/(app)')} />
      </View>
    </View>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, ok ? { color: Colors.success } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background, paddingTop: 56 },
  nav: { textAlign: 'center', fontSize: 18, fontWeight: '700', color: Colors.heading },
  sub: { textAlign: 'center', color: Colors.muted, marginTop: 4 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 36, gap: 10 },
  caption: { textAlign: 'center', color: Colors.muted, marginTop: 28 },
  time: { textAlign: 'center', fontSize: 40, fontWeight: '800', color: Colors.heading },
  rows: { marginTop: 20, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: Colors.muted },
  rowValue: { fontWeight: '700', color: Colors.heading, flex: 1, textAlign: 'right' },
  progress: {
    marginTop: 16,
    backgroundColor: Colors.successBg,
    borderRadius: 12,
    padding: 12,
  },
  progressText: { color: Colors.successText, fontWeight: '700', textAlign: 'center' },
  footer: { padding: 24, gap: 8 },
});
