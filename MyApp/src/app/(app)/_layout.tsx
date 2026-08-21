import { Redirect, Tabs } from 'expo-router';

import { CustomTabBar } from '@/components/CustomTabBar';
import { useAuth } from '@/context/AuthContext';

export default function AppTabsLayout() {
  const { status } = useAuth();
  if (status === 'signedOut') {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="visits" options={{ title: 'Visits' }} />
      <Tabs.Screen name="leaves" options={{ title: 'Leaves' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
