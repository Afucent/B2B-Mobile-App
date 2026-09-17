import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';

interface Props {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  /** When true, skips top safe-area padding (parent SafeScreen already includes top). */
  embedded?: boolean;
  subtitle?: string;
}

export function ScreenHeader({ title, onBack, right, embedded, subtitle }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: embedded ? Spacing.sm : insets.top + Spacing.sm },
      ]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={({ pressed }) => [styles.side, pressed && styles.sidePressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={Colors.heading} />
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.side}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  side: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidePressed: {
    backgroundColor: Colors.surface,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  title: {
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: Colors.heading,
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.muted,
  },
});
