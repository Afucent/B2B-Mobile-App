import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

interface Props {
  title: string;
  subtitle: string;
}

export function Stamp({ title, subtitle }: Props) {
  return (
    <View style={styles.stamp}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: Colors.stamp,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    transform: [{ rotate: '-8deg' }],
  },
  title: {
    color: Colors.stamp,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  sub: {
    marginTop: 4,
    color: Colors.stamp,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
