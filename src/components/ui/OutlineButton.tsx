import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function OutlineButton({ label, onPress, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
  },
  pressed: {
    backgroundColor: Colors.brandSoft,
    borderColor: Colors.brand,
  },
  disabled: { opacity: 0.55 },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.heading,
    letterSpacing: 0.1,
  },
});
