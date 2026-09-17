import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { TabNavSection } from '@/lib/tabNavigation';

type Props = {
  sections: TabNavSection[];
};

export default function TabModuleLinks({ sections }: Props) {
  if (sections.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.links.map((link) => (
            <Pressable
              key={link.href as string}
              style={styles.row}
              onPress={() => router.push(link.href)}>
              <View style={styles.copy}>
                <Text style={styles.title}>{link.title}</Text>
                {link.subtitle ? <Text style={styles.subtitle}>{link.subtitle}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.lg },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  copy: { flex: 1 },
  title: { fontWeight: '700', color: Colors.heading, fontSize: 15 },
  subtitle: { color: Colors.muted, fontSize: 12, marginTop: 2 },
});
