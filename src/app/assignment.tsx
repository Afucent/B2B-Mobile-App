import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { listDealers, type Dealer } from '@/lib/api/dealers';
import { formatDate } from '@/lib/format';

export default function AssignmentScreen() {
  const [dealers, setDealers] = useState<Dealer[]>([]);

  useFocusEffect(
    useCallback(() => {
      void listDealers()
        .then((res) => setDealers(res.items.slice(0, 8)))
        .catch(() => setDealers([]));
    }, []),
  );

  const regions = [...new Set(dealers.map((item) => item.area_name || item.city_name).filter(Boolean))];
  const cities = [...new Set(dealers.map((item) => item.city_name).filter(Boolean))];

  return (
    <View style={styles.flex}>
      <ScreenHeader title="New Assignment" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Assignment date</Text>
            <Text style={styles.metaValue}>{formatDate(new Date()).toUpperCase()}</Text>
          </View>
          <View style={styles.stamp}>
            <Text style={styles.stampText}>ASSIGNED</Text>
          </View>
        </View>

        <View style={styles.split}>
          <View style={styles.cell}>
            <Text style={styles.metaLabel}>Region</Text>
            <Text style={styles.cellValue}>{(regions[0] as string) || '—'}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.metaLabel}>City</Text>
            <Text style={styles.cellValue}>{(cities[0] as string) || '—'}</Text>
          </View>
        </View>

        <Text style={styles.section}>Assigned dealers route</Text>
        <View style={styles.route}>
          {dealers.length === 0 ? (
            <Text style={styles.empty}>No dealers assigned yet.</Text>
          ) : (
            dealers.map((dealer, index) => (
              <View key={dealer.id} style={styles.stop}>
                <View style={styles.rail}>
                  <View style={styles.num}>
                    <Text style={styles.numText}>{index + 1}</Text>
                  </View>
                  {index < dealers.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: 16 }}>
                  <Text style={styles.stopName}>{dealer.name}</Text>
                  <Text style={styles.stopAddr}>{dealer.address || dealer.area_name || '—'}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteLabel}>Manager’s note</Text>
          <Text style={styles.noteBody}>
            Complete introductory visits for the dealers on this route. Status updates sync after each visit.
          </Text>
        </View>

        <PrimaryButton
          label="Acknowledge Assignment  ✓"
          onPress={() => {
            Alert.alert('Assignment', 'Assignment acknowledged.');
            router.back();
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: 16, gap: 14, paddingBottom: 40 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  metaBox: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: 12,
    flex: 1,
    marginRight: 12,
  },
  metaLabel: { fontSize: 11, fontWeight: '800', color: Colors.muted, textTransform: 'uppercase' },
  metaValue: { fontWeight: '800', marginTop: 6, color: Colors.heading },
  stamp: {
    borderWidth: 2,
    borderColor: Colors.brand,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    transform: [{ rotate: '-8deg' }],
  },
  stampText: { color: Colors.brand, fontWeight: '800', letterSpacing: 1 },
  split: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1, backgroundColor: Colors.background, borderRadius: Radius.md, padding: 12 },
  cellValue: { fontWeight: '800', marginTop: 6, textTransform: 'uppercase' },
  section: { fontSize: 11, fontWeight: '800', color: Colors.muted, textTransform: 'uppercase' },
  route: { backgroundColor: Colors.background, borderRadius: Radius.lg, padding: 14 },
  empty: { color: Colors.muted },
  stop: { flexDirection: 'row', gap: 10 },
  rail: { width: 28, alignItems: 'center' },
  num: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  line: { width: 2, flex: 1, backgroundColor: Colors.brandSoft, marginVertical: 4 },
  stopName: { fontWeight: '800', color: Colors.heading },
  stopAddr: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  note: { backgroundColor: Colors.infoBg, borderRadius: Radius.md, padding: 14 },
  noteLabel: { color: Colors.infoText, fontWeight: '800', marginBottom: 4 },
  noteBody: { color: Colors.infoText, lineHeight: 20 },
});
