import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useAuth } from '@/context/AuthContext';

/** White AFBEX FSA / Afucent splash — full clear logo, no circle crop. */
const SPLASH_BG = '#FFFFFF';

export default function SplashGate() {
  const { status } = useAuth();
  const sessionReady = status !== 'loading';
  const [minTimeDone, setMinTimeDone] = useState(false);

  useEffect(() => {
    void SplashScreen.hideAsync();
    const t = setTimeout(() => setMinTimeDone(true), 1400);
    return () => clearTimeout(t);
  }, []);

  if (!sessionReady || !minTimeDone) {
    return (
      <View style={styles.splash}>
        <StatusBar style="dark" />
        <Image
          source={require('@/assets/images/logo_png.png')}
          style={styles.logo}
          accessibilityLabel="AFBEX FSA by Afucent"
        />
        <Text style={styles.status}>VERIFYING SESSION...</Text>
      </View>
    );
  }

  if (status === 'signedIn') return <Redirect href="/(app)" />;
  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: SPLASH_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logo: {
    width: '100%',
    maxWidth: 320,
    height: 110,
    resizeMode: 'contain',
  },
  status: {
    marginTop: 28,
    color: '#9AA4AE',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
});
