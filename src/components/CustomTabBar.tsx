import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { isFieldTrackingEnabled } from '@/lib/permissions';
import { getVisibleAppTabs, type AppTabName } from '@/lib/tabNavigation';

const TABS: {
  name: AppTabName;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: keyof typeof Ionicons.glyphMap;
}[] = [
  { name: 'index', label: 'Home', icon: 'home-outline', active: 'home' },
  { name: 'clock', label: 'Clock', icon: 'time-outline', active: 'time' },
  { name: 'field', label: 'Field', icon: 'business-outline', active: 'business' },
  { name: 'roles', label: 'Roles', icon: 'shield-outline', active: 'shield' },
  { name: 'profile', label: 'Profile', icon: 'person-outline', active: 'person' },
];

interface Props {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}

export function CustomTabBar({ state, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isOrgAdmin, showMyAttendanceLeave, hasAnyAdminRead, has, canView } = usePermissions();

  const visibleTabs = getVisibleAppTabs({
    isOrgAdmin,
    showMyAttendanceLeave,
    hasAnyAdminRead,
    has,
    canView,
    fieldTrackingEnabled: isFieldTrackingEnabled(user?.organization?.enabled_modules),
  });

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.filter((tab) => visibleTabs.includes(tab.name)).map((tab) => {
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
    fontSize: 10,
    color: Colors.tabInactive,
    fontWeight: '500',
  },
  labelActive: {
    color: Colors.brand,
    fontWeight: '700',
  },
});
