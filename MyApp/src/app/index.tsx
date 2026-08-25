import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function SplashGate() {
  const { status } = useAuth();
  const sessionReady = status !== 'loading';

  useEffect(() => {
    if (!sessionReady) return;
    void SplashScreen.hideAsync();
  }, [sessionReady]);

  if (!sessionReady) {
    // Keep the native Expo splash (dark green AFBEX) until auth finishes.
    return <View style={{ flex: 1, backgroundColor: Colors.splash }} />;
  }

  if (status === 'signedIn') return <Redirect href="/(app)" />;
  return <Redirect href="/(auth)/login" />;
}
