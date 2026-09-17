const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const BACKGROUND_PERMISSIONS = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
];

function ensurePermission(androidManifest, permission) {
  const manifest = AndroidConfig.Manifest.ensureToolsAvailable(androidManifest);
  if (!Array.isArray(manifest.manifest['uses-permission'])) {
    manifest.manifest['uses-permission'] = [];
  }
  const list = manifest.manifest['uses-permission'];
  const existing = list.find((entry) => entry?.$?.['android:name'] === permission);
  if (existing) {
    delete existing.$['android:maxSdkVersion'];
    existing.$['tools:node'] = 'replace';
    return manifest;
  }
  list.push({
    $: {
      'android:name': permission,
      'tools:node': 'replace',
    },
  });
  return manifest;
}

/**
 * Force ACCESS_BACKGROUND_LOCATION into the merged manifest so Android Settings
 * shows "Allow all the time" (missing if the permission is stripped or maxSdk-limited).
 */
function withAndroidBackgroundLocation(config) {
  return withAndroidManifest(config, (config) => {
    for (const permission of BACKGROUND_PERMISSIONS) {
      config.modResults = ensurePermission(config.modResults, permission);
    }
    return config;
  });
}

module.exports = withAndroidBackgroundLocation;
