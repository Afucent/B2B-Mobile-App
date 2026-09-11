import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'pending' | 'muted';

const TONE_STYLES: Record<Tone, { bg: string; color: string }> = {
  neutral: { bg: Colors.borderLight, color: Colors.heading },
  brand: { bg: Colors.brandSoft, color: Colors.brandDark },
  success: { bg: Colors.successBg, color: Colors.successText },
  danger: { bg: Colors.dangerBg, color: Colors.dangerText },
  pending: { bg: Colors.pendingBg, color: Colors.pendingText },
  muted: { bg: Colors.surface, color: Colors.muted },
};

type Props = {
  label: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
};

export function statusTone(status?: string | null): Tone {
  const key = (status ?? '').toLowerCase();
  if (key === 'approved' || key === 'active' || key === 'completed' || key === 'present') {
    return 'success';
  }
  if (key === 'rejected' || key === 'inactive' || key === 'cancelled' || key === 'absent') {
    return 'danger';
  }
  if (key === 'pending' || key === 'assigned' || key === 'leave') {
    return 'pending';
  }
  return 'brand';
}

export function StatusPill({ label, tone = 'brand', style }: Props) {
  const colors = TONE_STYLES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.text, { color: colors.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
});
