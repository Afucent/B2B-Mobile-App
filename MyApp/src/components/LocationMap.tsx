import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors } from '@/constants/theme';

type Marker = {
  id: string;
  latitude: number;
  longitude: number;
  label?: string;
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
    : [{ id: 'center', latitude, longitude, label: 'You' }];

  const html = useMemo(() => {
    const payload = JSON.stringify(allMarkers);
    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;height:100%;width:100%;} .lbl{font:600 11px sans-serif;white-space:nowrap;}</style>
</head><body>
<div id="map"></div>
<script>
const markers = ${payload};
const map = L.map('map', { zoomControl: true }).setView([${latitude}, ${longitude}], ${zoom});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' }).addTo(map);
markers.forEach((m) => {
  const mk = L.marker([m.latitude, m.longitude]).addTo(map);
  if (m.label) mk.bindPopup('<div class="lbl">' + m.label + '</div>');
  mk.on('click', () => {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(m.id);
  });
});
if (markers.length > 1) {
  const group = L.featureGroup(markers.map((m) => L.marker([m.latitude, m.longitude])));
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
  wrap: { width: '100%', backgroundColor: Colors.mapOverlay, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.mapOverlay,
  },
});
