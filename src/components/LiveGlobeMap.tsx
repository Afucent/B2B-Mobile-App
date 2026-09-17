import { useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { resolveMediaUrl } from '@/lib/mediaUrl';

export type LiveGlobeMarker = {
  id: string;
  latitude: number;
  longitude: number;
  label?: string;
  color?: string;
  status?: string;
  avatarUrl?: string | null;
  initials?: string;
  address?: string | null;
};

type Props = {
  height?: number;
  markers?: LiveGlobeMarker[];
  onMarkerPress?: (id: string) => void;
  /** Compact embed (dashboard) — hide legend badge. */
  compact?: boolean;
  pingMinutes?: number;
};

const INDIA_CENTER = { lng: 78.9629, lat: 20.5937 };
const INDIA_ZOOM = 3.35;

function markerInitials(label?: string, initials?: string): string {
  if (initials?.trim()) return initials.trim().slice(0, 2).toUpperCase();
  const parts = (label || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function buildHtml(
  markers: LiveGlobeMarker[],
  compact: boolean,
  pingMinutes: number,
): string {
  const payload = JSON.stringify(
    markers.map((m) => ({
      id: m.id,
      latitude: m.latitude,
      longitude: m.longitude,
      label: m.label ?? '',
      color: m.color || '#2E7D32',
      status: (m.status || '').replace(/_/g, ' '),
      address: m.address ?? '',
      initials: markerInitials(m.label, m.initials),
      avatarUrl: resolveMediaUrl(m.avatarUrl) || null,
    })),
  );

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.7.1/dist/maplibre-gl.css"/>
<script src="https://unpkg.com/maplibre-gl@5.7.1/dist/maplibre-gl.js"></script>
<style>
  html,body,#map{margin:0;height:100%;width:100%;background:#01050b;overflow:hidden;}
  .pin{
    width:36px;height:36px;border-radius:999px;border:2px solid #fff;color:#fff;
    font:700 11px/32px sans-serif;text-align:center;overflow:hidden;cursor:pointer;
    box-shadow:0 0 0 4px rgba(46,125,50,.2),0 4px 16px rgba(0,0,0,.45);
  }
  .pin img{width:100%;height:100%;object-fit:cover;display:block;border-radius:999px;}
  .overlay-btn{
    position:absolute;right:12px;top:12px;z-index:5;
    border:1px solid rgba(255,255,255,.2);background:rgba(7,20,38,.85);
    color:#fff;font:600 11px sans-serif;border-radius:8px;padding:6px 10px;
  }
  .badge{
    position:absolute;left:12px;top:12px;z-index:5;
    background:rgba(255,255,255,.92);color:#1a1a1a;font:600 11px sans-serif;
    border-radius:8px;padding:6px 10px;
  }
  .maplibregl-ctrl-bottom-right{margin:0 8px 8px 0;}
</style>
</head>
<body>
<div id="map"></div>
<button class="overlay-btn" id="btnIndia" type="button">India</button>
${
  compact
    ? ''
    : `<p class="badge">Live map · auto-refresh ${pingMinutes}m</p>`
}
<script>
const markers = ${payload};
const INDIA = [${INDIA_CENTER.lng}, ${INDIA_CENTER.lat}];
const GLOBE = [0, 10];
const GLOBE_ZOOM = 1.35;
const HAS_MARKERS = markers.length > 0;
const STYLE = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri'
    },
    englishLabels: {
      type: 'raster',
      tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 18,
      attribution: 'Labels © Esri'
    }
  },
  layers: [
    { id: 'space', type: 'background', paint: { 'background-color': '#01050b' } },
    {
      id: 'satellite-earth',
      type: 'raster',
      source: 'satellite',
      paint: {
        'raster-saturation': -0.08,
        'raster-contrast': 0.13,
        'raster-brightness-min': 0.04,
        'raster-brightness-max': 0.9
      }
    },
    {
      id: 'english-place-labels',
      type: 'raster',
      source: 'englishLabels',
      paint: { 'raster-opacity': 0.9 }
    }
  ]
};

const map = new maplibregl.Map({
  container: 'map',
  style: STYLE,
  center: HAS_MARKERS ? INDIA : GLOBE,
  zoom: HAS_MARKERS ? ${INDIA_ZOOM} : GLOBE_ZOOM,
  pitch: 0,
  bearing: 0,
  antialias: true,
  maxZoom: 18,
  minZoom: 0.8,
  dragRotate: true,
  touchZoomRotate: true,
  touchPitch: true,
  attributionControl: true
});

map.addControl(new maplibregl.NavigationControl({
  visualizePitch: true,
  showCompass: true,
  showZoom: true
}), 'bottom-right');

const layerMarkers = [];

function clearMarkers() {
  while (layerMarkers.length) {
    const m = layerMarkers.pop();
    try { m.remove(); } catch (e) {}
  }
}

function addMarkers() {
  clearMarkers();
  markers.forEach(function (item) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pin';
    el.style.background = item.color || '#2E7D32';
    el.title = item.label || '';
    if (item.avatarUrl) {
      const img = document.createElement('img');
      img.src = item.avatarUrl;
      img.alt = '';
      el.appendChild(img);
    } else {
      el.textContent = (item.initials || '?').slice(0, 2);
    }

    const popup = document.createElement('div');
    popup.innerHTML =
      '<strong>' + String(item.label || '').replace(/</g, '&lt;') + '</strong>' +
      (item.status ? '<p style="margin:4px 0 0">' + String(item.status).replace(/</g, '&lt;') + '</p>' : '') +
      (item.address ? '<p style="margin:3px 0 0">' + String(item.address).replace(/</g, '&lt;') + '</p>' : '');

    el.addEventListener('click', function () {
      map.flyTo({
        center: [item.longitude, item.latitude],
        zoom: 12,
        pitch: 48,
        duration: 1400
      });
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', id: item.id }));
      }
    });

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([item.longitude, item.latitude])
      .setPopup(new maplibregl.Popup({ offset: 24, closeButton: true }).setDOMContent(popup))
      .addTo(map);
    layerMarkers.push(marker);
  });

  if (layerMarkers.length === 1) {
    const only = markers[0];
    map.flyTo({
      center: [only.longitude, only.latitude],
      zoom: 11,
      pitch: 35,
      duration: 1200
    });
  } else if (layerMarkers.length > 1) {
    const bounds = new maplibregl.LngLatBounds();
    markers.forEach(function (m) { bounds.extend([m.longitude, m.latitude]); });
    map.fitBounds(bounds, { padding: 56, maxZoom: 12, duration: 1000 });
  } else {
    // Full Earth sphere when nobody is actively tracking.
    map.jumpTo({ center: GLOBE, zoom: GLOBE_ZOOM, pitch: 0, bearing: 0 });
  }
}

map.on('style.load', function () {
  try { map.setProjection({ type: 'globe' }); } catch (e) {}
  try {
    map.setSky({
      'sky-color': '#01050b',
      'sky-horizon-blend': 0.18,
      'horizon-color': '#153d63',
      'horizon-fog-blend': 0.25,
      'fog-color': '#01050b',
      'fog-ground-blend': 0.9
    });
  } catch (e) {}
  addMarkers();
  map.resize();
});

document.getElementById('btnIndia').addEventListener('click', function () {
  map.flyTo({
    center: INDIA,
    zoom: ${INDIA_ZOOM},
    pitch: 0,
    bearing: 0,
    duration: 1600
  });
});

setTimeout(function () { map.resize(); }, 120);
</script>
</body>
</html>`;
}

export default function LiveGlobeMap({
  height = 280,
  markers = [],
  onMarkerPress,
  compact = false,
  pingMinutes = 5,
}: Props) {
  const webRef = useRef<WebView>(null);
  const html = useMemo(
    () => buildHtml(markers, compact, pingMinutes),
    [markers, compact, pingMinutes],
  );

  function onMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string; id?: string };
      if (data.type === 'marker' && data.id) onMarkerPress?.(data.id);
    } catch {
      const raw = event.nativeEvent.data;
      if (raw) onMarkerPress?.(raw);
    }
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://unpkg.com' }}
        style={styles.webview}
        scrollEnabled={false}
        nestedScrollEnabled
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        onMessage={onMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.loadingText}>Loading 3D globe…</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: '#01050b',
    overflow: 'hidden',
    borderRadius: 12,
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#01050b',
  },
  loadingText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
});
