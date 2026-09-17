import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors } from '@/constants/theme';

interface Props {
  label: string;
  onPress: () => void;
}

export function LinkButton({ label, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  label: { color: Colors.brand, fontSize: 16, fontWeight: '700' },
});
