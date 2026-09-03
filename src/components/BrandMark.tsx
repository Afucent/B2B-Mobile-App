import { StyleSheet, View } from 'react-native';

export function BrandMark({ size = 120, color = '#fff' }: { size?: number; color?: string }) {
  const ring = Math.max(2.5, size * 0.028);
  const mid = size * 0.58;
  const inner = size * 0.16;

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderColor: color,
          borderWidth: ring,
        },
      ]}>
      <View
        style={[
          styles.circle,
          {
            width: mid,
            height: mid,
            borderColor: color,
            borderWidth: ring,
          },
        ]}>
        <View
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
