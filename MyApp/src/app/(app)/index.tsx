import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DashboardStats from '@/components/DashboardStats';
import { APP_VERSION, Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { canViewDashboard } from '@/lib/tabNavigation';
import { firstName, greetingForNow, initials } from '@/lib/format';
import { isFieldTrackingEnabled } from '@/lib/permissions';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isOrgAdmin, showMyAttendanceLeave, hasAnyAdminRead, has, canView } = usePermissions();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const name = user?.name ?? 'there';

  const showDashboard = canViewDashboard({
    isOrgAdmin,
    showMyAttendanceLeave,
    hasAnyAdminRead,
    has,
    canView,
    fieldTrackingEnabled: isFieldTrackingEnabled(user?.organization?.enabled_modules),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    await new Promise((r) => setTimeout(r, 400));
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.flex}>
      <View style={{ height: insets.top, backgroundColor: Colors.background }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}>
        <View style={styles.topRow}>
          <View>
            <View style={styles.brandRow}>
              <Text style={styles.logo}>AFBEX</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>v{APP_VERSION}</Text>
              </View>
            </View>
            <Text style={styles.hello}>
              {greetingForNow()}, {firstName(name)}
            </Text>
          </View>
          <View style={styles.topActions}>
            <Pressable style={styles.iconBtn} onPress={() => router.push('/notifications')}>
              <Ionicons name="notifications-outline" size={22} color={Colors.heading} />
            </Pressable>
            <Pressable onPress={() => router.push('/(app)/profile')}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initials(name)}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {showDashboard ? (
          <DashboardStats refreshKey={refreshKey} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.welcomeTitle}>Welcome back</Text>
            <Text style={styles.welcomeCopy}>
              Use the tabs below for clock-in, field visits, leave management, and your profile.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.md, paddingBottom: 32, gap: Spacing.md },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { fontSize: 26, fontWeight: '800', color: Colors.brand },
  badge: {
    backgroundColor: Colors.brandSoft,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: Colors.brand, fontSize: 11, fontWeight: '700' },
  hello: { marginTop: 4, color: Colors.muted, fontSize: 15 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 8,
  },
  welcomeTitle: { fontSize: 18, fontWeight: '800', color: Colors.heading },
  welcomeCopy: { color: Colors.muted, lineHeight: 20 },
});
