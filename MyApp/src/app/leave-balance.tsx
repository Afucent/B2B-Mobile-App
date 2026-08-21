import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { getLeaveBalance, type LeaveBalance } from '@/lib/api/leave';
import { fiscalPeriod } from '@/lib/leaveUi';

export default function LeaveBalanceScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<LeaveBalance[]>([]);
  const fy = fiscalPeriod();

  useFocusEffect(
    useCallback(() => {
      void getLeaveBalance()
        .then((res) => setItems(res.items.filter((item) => item.is_active)))
        .catch(() => setItems([]));
    }, []),
  );

  const total = items.reduce((sum, item) => sum + (item.balance || 0), 0);

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Leave Balance" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.fyRow}>
          <Text style={styles.fyLabel}>Current Fiscal Period</Text>
          <Text style={styles.fyValue}>{fy.label}</Text>
        </View>

        <Text style={styles.hero}>{total}</Text>
        <Text style={styles.heroSub}>days available</Text>

        {items.map((item) => {
          const quota = item.annual_days ?? item.balance;
          const remaining = item.balance;
          const used = Math.max(0, (quota || 0) - remaining);
          const ratio = quota ? Math.min(1, used / quota) : remaining > 0 ? 1 : 0;
          return (
            <View key={item.leave_type_id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.name}>{item.leave_type_name}</Text>
                <Text style={styles.frac}>
                  {used}/{quota || 0}
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
              </View>
              <Text style={styles.remain}>{remaining} remaining</Text>
            </View>
          );
        })}

        {items.length === 0 ? (
          <Text style={styles.empty}>Leave balances are not configured yet.</Text>
        ) : (
          <Text style={styles.reset}>Balance resets {fy.reset}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { paddingHorizontal: 16, gap: 8 },
  fyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  fyLabel: { color: Colors.muted },
  fyValue: { fontWeight: '800', color: Colors.heading },
  hero: {
    textAlign: 'center',
    fontSize: 56,
    fontWeight: '800',
    color: Colors.brand,
    marginTop: 12,
  },
  heroSub: { textAlign: 'center', color: Colors.muted, marginTop: -8, marginBottom: 12 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontWeight: '800', color: Colors.heading },
  frac: { color: Colors.muted, fontWeight: '700' },
  track: { height: 6, borderRadius: 99, backgroundColor: Colors.borderLight, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: Colors.brand, borderRadius: 99 },
  remain: { color: Colors.muted, fontSize: 13 },
  empty: { textAlign: 'center', color: Colors.muted, marginVertical: 16 },
  reset: { textAlign: 'center', color: Colors.muted, marginVertical: 8 },
});
