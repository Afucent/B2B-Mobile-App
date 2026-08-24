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
};

type Props = {
  latitude: number;
  longitude: number;
  zoom?: number;
  height?: number;
  markers?: Marker[];
  onMarkerPress?: (id: string) => void;
};

export default function LocationMap({
  latitude,
  longitude,
  zoom = 15,
  height = 220,
  markers,
  onMarkerPress,
}: Props) {
  const allMarkers = markers?.length
    ? markers
    : [{ id: 'center', latitude, longitude, label: 'You', color: '#0F766E' }];

  const html = useMemo(() => {
    const payload = JSON.stringify(allMarkers);
    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{margin:0;height:100%;width:100%;}
.pin{width:28px;height:28px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);
  display:flex;align-items:center;justify-content:center;color:#fff;font:700 10px sans-serif;}
.lbl{font:600 11px sans-serif;white-space:nowrap;}
</style>
</head><body>
<div id="map"></div>
<script>
const markers = ${payload};
const map = L.map('map', { zoomControl: true }).setView([${latitude}, ${longitude}], ${zoom});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' }).addTo(map);
const layerMarkers = [];
markers.forEach((m) => {
  const color = m.color || '#0F766E';
  const initials = (m.label || '?').split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase();
  const icon = L.divIcon({
    className: '',
    html: '<div class="pin" style="background:' + color + '">' + initials + '</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
  const mk = L.marker([m.latitude, m.longitude], { icon }).addTo(map);
  layerMarkers.push(mk);
  if (m.label) mk.bindPopup('<div class="lbl">' + m.label + '</div>');
  mk.on('click', () => {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(m.id);
  });
});
if (layerMarkers.length > 1) {
  const group = L.featureGroup(layerMarkers);
  map.fitBounds(group.getBounds().pad(0.2));
}
</script></body></html>`;
  }, [allMarkers, latitude, longitude, zoom]);

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
