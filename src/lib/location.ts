import * as Location from 'expo-location';
import { Linking } from 'react-native';

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address: string | null;
}

export type LocationBlockReason = 'ok' | 'services_off' | 'denied' | 'undetermined';

export async function diagnoseLocation(): Promise<LocationBlockReason> {
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) return 'services_off';
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status === 'granted') return 'ok';
  if (permission.status === 'denied' && permission.canAskAgain === false) return 'denied';
  if (permission.status === 'denied') return 'denied';
  return 'undetermined';
}

export async function openDeviceSettings() {
  await Linking.openSettings();
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
      address = [place.name, place.street, place.district, place.city, place.region]
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
