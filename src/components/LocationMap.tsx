import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors } from '@/constants/theme';

type Marker = {
  id: string;
  latitude: number;
  longitude: number;
  label?: string;
  color?: string;
  avatarUrl?: string | null;
  initials?: string;
};

type Props = {
  latitude: number;
  longitude: number;
  zoom?: number;
  height?: number;
  markers?: Marker[];
  onMarkerPress?: (id: string) => void;
};

function markerInitials(label?: string, initials?: string): string {
  if (initials?.trim()) return initials.trim().slice(0, 2).toUpperCase();
  const parts = (label || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

const WORLD_CENTER = { latitude: 20, longitude: 0 };
const WORLD_ZOOM = 2;

export default function LocationMap({
  latitude,
  longitude,
  zoom = 15,
  height = 220,
  markers,
  onMarkerPress,
}: Props) {
  const allMarkers =
    markers === undefined
      ? [{ id: 'center', latitude, longitude, label: 'You', color: '#0F766E' }]
      : markers;
  const worldView = allMarkers.length === 0;
  const viewLat = worldView ? WORLD_CENTER.latitude : latitude;
  const viewLon = worldView ? WORLD_CENTER.longitude : longitude;
  const viewZoom = worldView ? WORLD_ZOOM : zoom;

  const html = useMemo(() => {
    const payload = JSON.stringify(
      allMarkers.map((m) => ({
        ...m,
        initials: markerInitials(m.label, m.initials),
        avatarUrl: m.avatarUrl?.trim() || null,
      })),
    );
    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{margin:0;height:100%;width:100%;}
.pin{width:32px;height:32px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);
  display:flex;align-items:center;justify-content:center;color:#fff;font:700 11px sans-serif;overflow:hidden;background:#0F766E;}
.pin img{width:100%;height:100%;object-fit:cover;display:block;}
.lbl{font:600 11px sans-serif;white-space:nowrap;}
</style>
</head><body>
<div id="map"></div>
<script>
const markers = ${payload};
const map = L.map('map', { zoomControl: true }).setView([${viewLat}, ${viewLon}], ${viewZoom});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' }).addTo(map);
const layerMarkers = [];
markers.forEach((m) => {
  const color = m.color || '#0F766E';
  const initials = (m.initials || '?').slice(0, 2).toUpperCase();
  const inner = m.avatarUrl
    ? '<img src="' + String(m.avatarUrl).replace(/"/g, '&quot;') + '" alt=""/>'
    : initials;
  const icon = L.divIcon({
    className: '',
    html: '<div class="pin" style="background:' + color + '">' + inner + '</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
  const mk = L.marker([m.latitude, m.longitude], { icon }).addTo(map);
  layerMarkers.push(mk);
  if (m.label) mk.bindPopup('<div class="lbl">' + String(m.label).replace(/</g, '&lt;') + '</div>');
  mk.on('click', () => {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(m.id);
  });
});
if (layerMarkers.length > 1) {
  const group = L.featureGroup(layerMarkers);
  map.fitBounds(group.getBounds().pad(0.2));
} else if (layerMarkers.length === 0) {
  map.setView([${WORLD_CENTER.latitude}, ${WORLD_CENTER.longitude}], ${WORLD_ZOOM});
}
</script></body></html>`;
  }, [allMarkers, viewLat, viewLon, viewZoom]);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        onMessage={(event) => onMarkerPress?.(event.nativeEvent.data)}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.brand} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', backgroundColor: Colors.mapOverlay, overflow: 'hidden', borderRadius: 12 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.mapOverlay,
  },
});
