import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import LocationMap from '@/components/LocationMap';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Spacing } from '@/constants/theme';

export default function VisitMapScreen() {
  const params = useLocalSearchParams<{
    lat?: string;
    lon?: string;
    title?: string;
    subtitle?: string;
  }>();
  const lat = Number(params.lat);
  const lon = Number(params.lon);
  const valid = Number.isFinite(lat) && Number.isFinite(lon);

  return (
    <View style={styles.flex}>
      <ScreenHeader title={params.title || 'Location'} onBack={() => router.back()} />
      <View style={styles.body}>
        {params.subtitle ? <Text style={styles.sub}>{params.subtitle}</Text> : null}
        {valid ? (
          <LocationMap
            latitude={lat}
            longitude={lon}
            height={360}
            markers={[{ id: 'pin', latitude: lat, longitude: lon, label: params.title || 'Pin' }]}
          />
        ) : (
          <Text style={styles.error}>Location not available.</Text>
        )}
        {valid ? (
          <Text style={styles.coords}>
            {lat.toFixed(5)}, {lon.toFixed(5)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: 10 },
  sub: { color: Colors.muted, lineHeight: 20 },
  coords: { color: Colors.heading, fontWeight: '700', textAlign: 'center' },
  error: { color: Colors.danger },
});
