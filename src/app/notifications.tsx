import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationRoute,
  type AppNotification,
} from '@/lib/api/notifications';
import { formatRelativeTime } from '@/lib/format';

const NOTIFICATION_REFRESH_MS = 15_000;

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    const data = await listNotifications().catch(() => ({ items: [], unread_count: 0 }));
    setItems(data.items);
    setUnread(data.unread_count);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (AppState.currentState === 'active') void load();
    }, NOTIFICATION_REFRESH_MS);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });

    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
    };
  }, [load]);

  const visible = filter === 'unread' ? items.filter((item) => !item.read_at) : items;

  async function onOpen(item: AppNotification) {
    if (!item.read_at) {
      await markNotificationRead(item.id).catch(() => undefined);
      await load();
    }
    const route = resolveNotificationRoute(item);
    if (route) {
      router.push(route as never);
    }
  }

  async function onDelete(item: AppNotification) {
    await deleteNotification(item.id).catch(() => undefined);
    await load();
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader
        title="Notifications"
        onBack={() => router.back()}
        right={
          unread ? (
            <View style={styles.count}>
              <Text style={styles.countText}>{unread}</Text>
            </View>
          ) : null
        }
      />
      <View style={styles.tabs}>
        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={`Unread (${unread})`} active={filter === 'unread'} onPress={() => setFilter('unread')} />
        {unread ? (
          <Chip
            label="Mark all read"
            active={false}
            onPress={() => void markAllNotificationsRead().then(load)}
          />
        ) : null}
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {visible.length === 0 ? (
          <Text style={styles.empty}>No notifications yet.</Text>
        ) : (
          visible.map((item) => {
            const unreadItem = !item.read_at;
            return (
              <View key={item.id} style={[styles.card, unreadItem && styles.cardUnread]}>
                <Pressable onPress={() => void onOpen(item)} style={styles.cardPressable}>
                  <View style={[styles.icon, unreadItem && styles.iconUnread]}>
                    <Ionicons
                      name={iconFor(item)}
                      size={18}
                      color={unreadItem ? Colors.brand : Colors.muted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.title}>{item.title}</Text>
                      {unreadItem ? <View style={styles.dot} /> : null}
                    </View>
                    <Text style={styles.message}>{item.message}</Text>
                    <Text style={styles.time}>{formatRelativeTime(item.created_at)}</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => void onDelete(item)}
                  style={styles.deleteBtn}
                  accessibilityLabel={`Delete ${item.title}`}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.brand} />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function iconFor(item: AppNotification): keyof typeof Ionicons.glyphMap {
  const hay = `${item.title} ${item.category} ${item.event_type}`.toLowerCase();
  if (hay.includes('leave')) return 'briefcase-outline';
  if (hay.includes('visit')) return 'navigate-outline';
  if (hay.includes('attendance') || hay.includes('tracking') || hay.includes('clock')) {
    return 'time-outline';
  }
  if (hay.includes('security') || hay.includes('password')) return 'shield-checkmark-outline';
  if (hay.includes('employee') || hay.includes('assignment') || hay.includes('dealer')) {
    return 'people-outline';
  }
  return 'notifications-outline';
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  count: {
    backgroundColor: Colors.brand,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.background,
  },
  chipOn: { backgroundColor: Colors.brandSoft },
  chipText: { fontWeight: '700', color: Colors.muted },
  chipTextOn: { color: Colors.brand },
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  empty: { color: Colors.muted, textAlign: 'center', marginTop: 24 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardPressable: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  cardUnread: { backgroundColor: Colors.surfaceWarm },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconUnread: { backgroundColor: Colors.brandSoft },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontWeight: '800', color: Colors.heading, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.brand },
  message: { color: Colors.text, marginTop: 4, fontSize: 13, lineHeight: 18 },
  time: { color: Colors.muted, marginTop: 6, fontSize: 12 },
});
