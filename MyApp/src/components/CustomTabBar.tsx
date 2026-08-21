import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

const TABS: { name: string; label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'index', label: 'Home', icon: 'home-outline', active: 'home' },
  { name: 'visits', label: 'Visits', icon: 'business-outline', active: 'business' },
  { name: 'leaves', label: 'Leaves', icon: 'document-text-outline', active: 'document-text' },
  { name: 'calendar', label: 'Calendar', icon: 'calendar-outline', active: 'calendar' },
  { name: 'profile', label: 'Profile', icon: 'person-outline', active: 'person' },
];

interface Props {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}

export function CustomTabBar({ state, navigation }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map((tab) => {
        const route = state.routes.find((item) => item.name === tab.name);
        if (!route) return null;
        const index = state.routes.indexOf(route);
        const focused = state.index === index;
        return (
          <Pressable
            key={tab.name}
            onPress={() => navigation.navigate(route.name)}
            style={styles.item}>
            <Ionicons
              name={focused ? tab.active : tab.icon}
              size={22}
              color={focused ? Colors.brand : Colors.tabInactive}
            />
            <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 11,
    color: Colors.tabInactive,
    fontWeight: '500',
  },
  labelActive: {
    color: Colors.brand,
    fontWeight: '700',
  },
});
