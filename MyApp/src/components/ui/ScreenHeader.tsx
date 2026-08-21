import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

interface Props {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function ScreenHeader({ title, onBack, right }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { paddingTop: insets.top + 8 }]}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} style={styles.side}>
          <Ionicons name="chevron-back" size={24} color={Colors.heading} />
        </Pressable>
      ) : (
        <View style={styles.side} />
      )}
      <Text style={styles.title}>{title}</Text>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: Colors.background,
  },
  side: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: Colors.heading,
  },
});
