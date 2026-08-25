import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { LinkButton } from '@/components/ui/LinkButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { getVisitAssignOptions } from '@/lib/api/visits';
import { UNPLANNED_REASONS } from '@/lib/visits';

type DealerOption = { id: string; name: string };

export default function UnplannedVisitScreen() {
  const [query, setQuery] = useState('');
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [allDealers, setAllDealers] = useState<DealerOption[]>([]);
  const [selected, setSelected] = useState<DealerOption | null>(null);
  const [reason, setReason] = useState<string | null>(UNPLANNED_REASONS[0]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void getVisitAssignOptions()
      .then((res) => setAllDealers(res.dealers ?? []))
      .catch(() => setAllDealers([]));
  }, []);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? allDealers.filter((d) => d.name.toLowerCase().includes(q))
      : allDealers;
    setDealers(filtered.slice(0, 20));
  }, [query, allDealers]);

  async function start() {
    if (!selected || !reason) return;
    setLoading(true);
    router.push({
      pathname: '/visit-complete',
      params: {
        dealerId: selected.id,
        dealerName: selected.name,
        reason: reason ?? '',
        unplanned: '1',
      },
    });
    setLoading(false);
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Unplanned Visit" onBack={() => router.back()} />
      <Text style={styles.sub}>Log immediate off-schedule checkpoint</Text>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.warn}>
          <Ionicons name="warning" size={16} color={Colors.pendingText} />
          <Text style={styles.warnText}>
            Log a visit to a dealer not on your assigned list for today. A valid business reason is required.
          </Text>
        </View>

        <Text style={styles.label}>Search dealer *</Text>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Colors.muted} />
          <TextInput
            value={selected ? selected.name : query}
            onChangeText={(value) => {
              setSelected(null);
              setQuery(value);
            }}
            placeholder="Type dealer name..."
            placeholderTextColor={Colors.muted}
            style={styles.search}
          />
        </View>
        {!selected
          ? dealers.map((dealer) => (
              <Pressable key={dealer.id} style={styles.option} onPress={() => setSelected(dealer)}>
                <Ionicons name="location-outline" size={16} color={Colors.muted} />
                <Text style={styles.optionText}>{dealer.name}</Text>
              </Pressable>
            ))
          : null}

        <Text style={styles.label}>Reason for unplanned visit *</Text>
        <Pressable style={styles.select} onPress={() => setOpen((v) => !v)}>
          <Text style={[styles.selectText, !reason && { color: Colors.muted }]}>
            {reason || 'Nearby opportunity'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={Colors.muted} />
        </Pressable>
        {open
          ? UNPLANNED_REASONS.map((item) => (
              <Pressable
                key={item}
                style={styles.option}
                onPress={() => {
                  setReason(item);
                  setOpen(false);
                }}>
                <Text style={styles.optionText}>{item}</Text>
              </Pressable>
            ))
          : null}

        <Text style={styles.note}>Note: Unplanned visits are logged and instantly visible to your regional sales manager.</Text>
        <PrimaryButton
          label="Continue to check-in"
          loading={loading}
          disabled={!selected || !reason}
          onPress={() => void start()}
        />
        <LinkButton label="Cancel" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  sub: { textAlign: 'center', color: Colors.muted, marginTop: -6 },
  body: { padding: 16, gap: 10, paddingBottom: 32 },
  warn: {
    backgroundColor: Colors.pendingBg,
    borderRadius: Radius.md,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
  },
  warnText: { flex: 1, color: Colors.heading, fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '800', color: Colors.heading, marginTop: 8 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 48,
  },
  search: { flex: 1, color: Colors.heading },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  optionText: { color: Colors.heading, fontWeight: '600' },
  select: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    height: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
  },
  selectText: { fontWeight: '600', color: Colors.heading },
  note: { color: Colors.muted, fontSize: 12, lineHeight: 18 },
});
