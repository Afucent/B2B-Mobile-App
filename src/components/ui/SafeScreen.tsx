import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
  type Edge,
} from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

type Props = {
  children: ReactNode;
  /**
   * Defaults to left/right only.
   * Top is handled by ScreenHeader; bottom by useContentBottomInset on scroll content
   * (avoids double-padding with FlatList/ScrollView).
   */
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
};

/**
 * Screen shell with SafeAreaContext insets for side margins.
 * Pair with ScreenHeader (top) and useContentBottomInset (scroll bottom).
 */
export function SafeScreen({
  children,
  edges = ['left', 'right'],
  style,
  backgroundColor = Colors.surface,
}: Props) {
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor }, style]}>
      {children}
    </SafeAreaView>
  );
}

/** Bottom padding for scroll/list content so actions clear the home indicator. */
export function useContentBottomInset(extra: number = Spacing.xl) {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, Spacing.sm) + extra;
}

/** Horizontal + bottom padding helpers for list content containers. */
export function useScreenContentPadding(extraBottom: number = Spacing.xl) {
  const insets = useSafeAreaInsets();
  return {
    paddingHorizontal: Spacing.md,
    paddingBottom: Math.max(insets.bottom, Spacing.sm) + extraBottom,
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
