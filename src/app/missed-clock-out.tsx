import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LinkButton } from '@/components/ui/LinkButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { formatClock, formatDate } from '@/lib/format';
import { getMissedClockOut, saveMissedClockOut, type MissedClockOutNotice } from '@/lib/visits';

export default function MissedClockOutScreen() {
  const [notice, setNotice] = useState<MissedClockOutNotice | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getMissedClockOut().then(setNotice);
    }, []),
  );

  const reviewed = notice?.status === 'reviewed';

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Missed Clock-Out" onBack={() => router.back()} />
      <View style={styles.body}>
        <View style={[styles.banner, reviewed ? styles.ok : styles.warn]}>
          <Ionicons
            name={reviewed ? 'checkmark-circle' : 'warning'}
            size={20}
            color={reviewed ? Colors.success : Colors.pendingText}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, reviewed && { color: Colors.successText }]}>
              {reviewed ? 'Auto-close reviewed' : 'Shift auto-closed'}
            </Text>
            <Text style={[styles.bannerCopy, reviewed && { color: Colors.successText }]}>
              {reviewed
                ? 'This auto clock-out has been reviewed and approved by your manager.'
                : "You didn't clock out before cutoff. System closed your shift automatically."}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.section}>SHIFT LOG SUMMARY</Text>
            <View style={[styles.pill, reviewed ? styles.pillOk : styles.pillFlag]}>
              <Text style={[styles.pillText, reviewed ? styles.pillOkText : styles.pillFlagText]}>
                {reviewed ? 'Reviewed' : 'Flagged'}
              </Text>
            </View>
          </View>
          <Row label="Date" value={notice ? formatDate(new Date(`${notice.date}T00:00:00`)) : '—'} />
          <Row label="Expected Clock-Out" value={notice?.expectedOut ?? '06:00 PM'} />
          <Row label="Auto Clock-Out" value={notice?.autoOut ?? '11:59 PM'} accent />
          {reviewed ? (
            <Row label="Reviewed By" value={notice?.reviewedBy ?? 'Manager'} />
          ) : (
            <Row label="Status" value="FLAGGED_REVIEW" accent />
          )}
        </View>

        <Text style={styles.note}>
          {reviewed
            ? 'If details are incorrect, you can still request a correction to adjust hours. Approved hours will sync to payroll.'
            : 'This missed clock-out has been logged. Request a manual adjustment if the auto-closed time does not reflect your actual shift finish.'}
        </Text>

        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="Request Correction"
          onPress={() =>
            router.push({
              pathname: '/request-correction',
              params: {
                date: notice?.date,
                clockOut: notice?.expectedOut,
              },
            })
          }
        />
        <LinkButton
          label="Dismiss"
          onPress={() => {
            if (notice) {
              void saveMissedClockOut({ ...notice, dismissed: true }).then(() => router.replace('/(app)'));
            } else {
              router.replace('/(app)');
            }
          }}
        />
      </View>
    </View>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, accent && { color: Colors.brand }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { flex: 1, padding: 16, gap: 14, paddingBottom: 24 },
  banner: { borderRadius: Radius.lg, padding: 14, flexDirection: 'row', gap: 10 },
  warn: { backgroundColor: Colors.pendingBg },
  ok: { backgroundColor: Colors.successBg },
  bannerTitle: { fontWeight: '800', color: Colors.heading, marginBottom: 4 },
  bannerCopy: { color: Colors.text, fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: Colors.muted },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillFlag: { backgroundColor: Colors.pendingBg },
  pillOk: { backgroundColor: Colors.visitedBg },
  pillText: { fontSize: 11, fontWeight: '700' },
  pillFlagText: { color: Colors.pendingText },
  pillOkText: { color: Colors.visitedText },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: Colors.muted },
  rowValue: { fontWeight: '700', color: Colors.heading },
  note: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
});
