import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { PermissionsAndroid, Platform } from 'react-native';

import { pingLocation } from '@/lib/api/attendance';
import { getToken } from '@/lib/storage';

export const BACKGROUND_LOCATION_TASK = 'afbex-background-location';

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      console.warn('[background-location] task error', error.message);
      return;
    }
    if (!data?.locations?.length || !(await getToken())) return;

    const location = data.locations[data.locations.length - 1];
    await pingLocation(
      location.coords.latitude,
      location.coords.longitude,
      location.coords.accuracy ?? undefined,
    )
      .then(() => console.log('[background-location] ping sent'))
      .catch((pingError) => console.warn('[background-location] ping failed', pingError));
  },
);

async function requestNotificationPermission() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function requestBackgroundLocationPermission() {
  if (Platform.OS === 'web') return false;

  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;

  const background = await Location.requestBackgroundPermissionsAsync();
  return background.status === 'granted';
}

export async function startBackgroundLocation(intervalMinutes: number) {
  if (Platform.OS === 'web' || !(await TaskManager.isAvailableAsync())) return false;

  const background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== 'granted') return false;
  if (!(await requestNotificationPermission())) return false;

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (alreadyStarted) return true;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: intervalMinutes * 60_000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'AFBEX location tracking',
      notificationBody: 'Location is tracked while you are clocked in.',
      notificationColor: '#008C87',
      killServiceOnDestroy: false,
    },
  });
  console.log('[background-location] task started');
  return true;
}

export async function stopBackgroundLocation() {
  if (Platform.OS === 'web' || !(await TaskManager.isAvailableAsync())) return;
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}