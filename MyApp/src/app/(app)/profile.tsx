import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { getEmployeeLiveDetail, type EmployeeLiveDetail } from '@/lib/api/attendance';
import { employeeCode, initials } from '@/lib/format';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [live, setLive] = useState<EmployeeLiveDetail | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void getEmployeeLiveDetail(user.id)
        .then(setLive)
        .catch(() => setLive(null));
    }, [user]),
  );

  return (
    <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <Text style={styles.screenTitle}>My Profile</Text>
        <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
          <Text style={styles.gear}>⚙</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{initials(user?.name ?? 'A')}</Text>
          </View>
        )}
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.role}>{live?.designation || 'Field Sales Executive'}</Text>
      </View>

      <View style={styles.card}>
        <Row label="Employee ID" value={live?.employee_code ?? employeeCode(user?.id ?? '')} />
        <Row label="Mobile" value={user?.mobile ?? '—'} />
        <Row label="Email" value={user?.personal_email ?? '—'} />
        <Row label="Region" value={live?.region_label ?? '—'} />
        <Row label="City" value="—" />
        <Row label="Reporting manager" value="—" />
        <Row label="Joining date" value="—" />
        <Row label="Company code" value={user?.organization?.company_code ?? '—'} last />
      </View>
      <Text style={styles.foot}>Contact system administrator to update this information.</Text>
    </ScrollView>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  screenTitle: { fontSize: 22, fontWeight: '800', color: Colors.heading },
  gear: { fontSize: 20, color: Colors.heading },
  hero: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.brand, fontSize: 28, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', color: Colors.heading },
  role: { color: Colors.muted },
  card: { backgroundColor: Colors.background, borderRadius: 16 },
  row: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  label: { color: Colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  value: { fontWeight: '700', color: Colors.heading, flex: 1.2, textAlign: 'right' },
  foot: { textAlign: 'center', color: Colors.muted, marginTop: 16, fontSize: 12 },
});
