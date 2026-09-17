import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

import {
  diagnoseLocation as diagnoseLocationPermissions,
  requestAlwaysLocationAccess,
  requestForegroundLocationAccess,
  type AlwaysLocationResult,
} from '@/lib/locationPermissions';

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address: string | null;
}

export type LocationBlockReason = 'ok' | 'services_off' | 'denied' | 'undetermined' | 'background';

export async function diagnoseLocation(opts?: { always?: boolean }): Promise<LocationBlockReason> {
  const status = await diagnoseLocationPermissions(opts);
  return status;
}

export { requestAlwaysLocationAccess, requestForegroundLocationAccess };
export type { AlwaysLocationResult };

export async function openDeviceSettings() {
  await openAppLocationSettings();
}

/** Opens the system Location permission page (Allow all the time lives here, not in the app). */
export async function openAppLocationSettings() {
  if (Platform.OS === 'android') {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status !== Location.PermissionStatus.GRANTED) {
      await Location.requestForegroundPermissionsAsync();
    }
    // Android 11+ only adds "Allow all the time" to this page after a background-permission request.
    await Location.requestBackgroundPermissionsAsync().catch(() => undefined);
    return;
  }
  await Linking.openSettings();
}

export async function getLastKnownLocation(): Promise<DeviceLocation | null> {
  const position = await Location.getLastKnownPositionAsync().catch(() => null);
  if (!position?.coords) return null;
  const { latitude, longitude, accuracy } = position.coords;
  return { latitude, longitude, accuracy: accuracy ?? null, address: null };
}

export async function requestLocation(): Promise<DeviceLocation> {
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) {
    throw Object.assign(new Error('Location services are turned off.'), { code: 'services_off' });
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw Object.assign(new Error('Location permission is required to verify this action.'), {
      code: permission.canAskAgain === false ? 'denied' : 'denied',
    });
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  const { latitude, longitude, accuracy } = position.coords;
  let address: string | null = null;
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const place = places[0];
    if (place) {
      address = [
        place.name,
        place.street,
        place.district,
        place.subregion,
        place.city,
        place.region,
        place.postalCode ? `PIN ${place.postalCode}` : null,
        place.country,
      ]
        .filter(Boolean)
        .join(', ');
    }
  } catch {
    address = null;
  }

  return { latitude, longitude, accuracy: accuracy ?? null, address };
}

export async function geocodeAddress(query: string | null | undefined) {
  if (!query?.trim()) return null;
  try {
    const results = await Location.geocodeAsync(query.trim());
    const first = results[0];
    if (!first) return null;
    return { latitude: first.latitude, longitude: first.longitude };
  } catch {
    return null;
  }
}
