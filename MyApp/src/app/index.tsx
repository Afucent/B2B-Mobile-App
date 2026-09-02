import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

/** Brand green only — no accent/stamp orange on splash. */
const SPLASH_BG = Colors.splash;

function PulseCircle({ delay, size }: { delay: number; size: number }) {
  const scale = useSharedValue(0.35);
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(2.6, { duration: 1600, easing: Easing.out(Easing.quad) }),
          withTiming(0.35, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 1600, easing: Easing.out(Easing.quad) }),
          withTiming(0.55, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

export default function SplashGate() {
  const { status } = useAuth();
  const sessionReady = status !== 'loading';
  const [minTimeDone, setMinTimeDone] = useState(false);

  useEffect(() => {
    void SplashScreen.hideAsync();
    const t = setTimeout(() => setMinTimeDone(true), 1600);
    return () => clearTimeout(t);
  }, []);

  if (!sessionReady || !minTimeDone) {
    return (
      <View style={styles.splash}>
        <View style={styles.rippleArea}>
          <PulseCircle delay={0} size={72} />
          <PulseCircle delay={320} size={72} />
          <PulseCircle delay={640} size={72} />
          <View style={styles.centerDot} />
        </View>
        <Text style={styles.brand}>AFBEX</Text>
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
  },
  rippleArea: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  circle: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  centerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 3,
  },
  status: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
});
