import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { getDealer, type Dealer } from '@/lib/api/dealers';
import { getFieldOperationsSettings } from '@/lib/api/org';
import { formatDate, mapPreviewUrl } from '@/lib/format';
import { formatDistanceKm, haversineMeters } from '@/lib/geo';
import { geocodeAddress, requestLocation, type DeviceLocation } from '@/lib/location';
import { routeForLocationAction } from '@/lib/locationGate';
import { getActiveVisit, listFavorites, toggleFavorite, visitsForDay } from '@/lib/visits';

export default function DealerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [loc, setLoc] = useState<DeviceLocation | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radius, setRadius] = useState(500);
  const [stats, setStats] = useState({ last: '—', month: 0 });
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const item = await getDealer(id).catch(() => null);
      setDealer(item);
      const favs = await listFavorites();
      setFavorite(favs.includes(id));
      const settings = await getFieldOperationsSettings().catch(() => null);
      if (settings?.dealer_geofence_radius_m) setRadius(settings.dealer_geofence_radius_m);
      const logs = await visitsForDay();
      const active = await getActiveVisit();
      setActiveId(active?.dealerId === id ? active.id : null);
      const forDealer = logs.filter((v) => v.dealerId === id && v.checkOutAt);
      setStats({
        last: forDealer[0]?.checkOutAt ? formatDate(forDealer[0].checkOutAt) : '—',
        month: forDealer.length,
      });
      try {
        setLoc(await requestLocation());
      } catch {
        setLoc(null);
      }
      const geo = await geocodeAddress(
        [item?.address, item?.area_name, item?.city_name].filter(Boolean).join(', '),
      );
      setCoords(geo);
    })();
  }, [id]);

  const distance =
    loc && coords ? haversineMeters(loc.latitude, loc.longitude, coords.latitude, coords.longitude) : null;
  const inside = distance != null && distance <= radius;
  const mapLat = coords?.latitude ?? loc?.latitude ?? 28.5355;
  const mapLon = coords?.longitude ?? loc?.longitude ?? 77.391;

  async function onCheckIn() {
    const block = await routeForLocationAction(`/visit-check-in?id=${id}`);
    if (block) {
      router.push(block);
      return;
    }
    router.push({
      pathname: '/visit-check-in',
      params: {
        id: id ?? '',
        distance: distance != null ? String(Math.round(distance)) : '',
        radius: String(radius),
        inside: inside ? '1' : '0',
      },
    });
  }

  if (!dealer) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Dealer Detail" onBack={() => router.back()} />
        <ActivityIndicator color={Colors.brand} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader
        title="Dealer Detail"
        onBack={() => router.back()}
        right={
          <Pressable onPress={() => void toggleFavorite(dealer.id).then(setFavorite)} hitSlop={8}>
            <Ionicons name={favorite ? 'star' : 'star-outline'} size={22} color={Colors.brand} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.mapWrap}>
          <Image source={{ uri: mapPreviewUrl(mapLat, mapLon) }} style={styles.map} contentFit="cover" />
          <View style={styles.geoBadge}>
            <Text style={styles.geoText}>GEOFENCE   ENABLED</Text>
          </View>
          <View style={styles.ring} />
        </View>

        <Text style={styles.name}>{dealer.name}</Text>
        <Text style={styles.addr}>{dealer.address || 'Registered dealer location'}</Text>
        <Text style={styles.region}>
          {[dealer.region_name, dealer.city_name, dealer.area_name].filter(Boolean).join(' · ') || dealer.type_name}
        </Text>
        <Text style={styles.assigned}>
          Assigned since{' '}
          <Text style={styles.assignedVal}>
            {dealer.created_at ? formatDate(dealer.created_at) : '—'}
          </Text>
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Visit Intelligence</Text>
          <Row label="Last visited" value={stats.last} />
          <Row label="Visits this month" value={String(stats.month)} />
          <Row label="Target frequency" value="Weekly" />
        </View>

        <View style={[styles.geoRow, inside ? styles.geoIn : styles.geoOut]}>
          <Ionicons name={inside ? 'checkmark-circle' : 'navigate'} size={16} color={inside ? Colors.success : Colors.pendingText} />
          <Text style={[styles.geoStatus, { color: inside ? Colors.successText : Colors.pendingText }]}>
            {inside ? 'In Geofence' : 'Outside Geofence'}
            {distance != null ? ` · ${formatDistanceKm(distance)} away` : ''}
          </Text>
        </View>

        <PrimaryButton
          label={activeId ? 'Check Out' : 'Check In'}
          onPress={() => {
            if (activeId) {
              router.push({ pathname: '/visit-check-out', params: { visitId: activeId } });
              return;
            }
            void onCheckIn();
          }}
        />
        <Text style={styles.hint}>Your location will be compared against the dealer's registered address.</Text>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: 16, paddingBottom: 40, gap: 8 },
  mapWrap: {
    height: 180,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.mapOverlay,
  },
  map: { width: '100%', height: '100%' },
  geoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(20,20,20,0.7)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  geoText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(46, 204, 113, 0.7)',
    alignSelf: 'center',
    top: 30,
    left: '50%',
    marginLeft: -60,
  },
  name: { fontSize: 22, fontWeight: '800', color: Colors.heading, marginTop: 8 },
  addr: { color: Colors.heading, fontWeight: '600' },
  region: { color: Colors.muted, fontSize: 13 },
  assigned: { color: Colors.muted, fontSize: 13, marginBottom: 8 },
  assignedVal: { color: Colors.heading, fontWeight: '700' },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontWeight: '800', color: Colors.heading },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: Colors.muted },
  rowValue: { fontWeight: '700', color: Colors.heading },
  geoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.md,
    padding: 12,
  },
  geoIn: { backgroundColor: Colors.successBg },
  geoOut: { backgroundColor: Colors.pendingBg },
  geoStatus: { fontWeight: '700', flex: 1 },
  hint: { textAlign: 'center', color: Colors.muted, fontSize: 12, marginTop: 4 },
});
