import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/context/AuthContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="clock-in" />
          <Stack.Screen name="clock-in-confirmed" />
          <Stack.Screen name="clock-out" />
          <Stack.Screen name="shift-complete" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="request-correction" />
          <Stack.Screen name="correction-request" />
          <Stack.Screen name="assignment" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="location-consent" />
          <Stack.Screen name="location-required" />
          <Stack.Screen name="missed-clock-out" />
          <Stack.Screen name="dealer-detail" />
          <Stack.Screen name="visit-check-in" />
          <Stack.Screen name="visit-notes" />
          <Stack.Screen name="visit-check-out" />
          <Stack.Screen name="visit-complete" />
          <Stack.Screen name="unplanned-visit" />
          <Stack.Screen name="visit-history" />
          <Stack.Screen name="apply-leave" />
          <Stack.Screen name="leave-applied" />
          <Stack.Screen name="leave-balance" />
          <Stack.Screen name="leave-management" />
          <Stack.Screen name="visit-assign" />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
