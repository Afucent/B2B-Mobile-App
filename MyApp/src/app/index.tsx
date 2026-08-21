import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

const MIN_SPLASH_MS = 1800;

export default function SplashGate() {
  const { status } = useAuth();
  const [minTimeDone, setMinTimeDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  const sessionReady = status !== 'loading';
  if (sessionReady && minTimeDone) {
    if (status === 'signedIn') return <Redirect href="/(app)" />;
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <BrandMark size={124} />
        <Text style={styles.brand}>AFBEX</Text>
        <Text style={styles.caption}>VERIFYING SESSION...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.splash,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingBottom: 24,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 6,
    marginTop: 4,
  },
  caption: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    letterSpacing: 3.4,
    fontWeight: '600',
    marginTop: -4,
  },
});
