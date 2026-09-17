import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface AppSettings {
  clockInReminders: boolean;
  leaveStatusUpdates: boolean;
  assignmentAlerts: boolean;
  missedClockOutAlerts: boolean;
  language: string;
  distanceUnit: string;
}

const KEY = 'afbex.settings';

export const DEFAULT_SETTINGS: AppSettings = {
  clockInReminders: true,
  leaveStatusUpdates: true,
  assignmentAlerts: true,
  missedClockOutAlerts: false,
  language: 'English',
  distanceUnit: 'Kilometers',
};

export async function getSettings(): Promise<AppSettings> {
  const raw = Platform.OS === 'web' ? localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as AppSettings) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(value: AppSettings) {
  const payload = JSON.stringify(value);
  if (Platform.OS === 'web') {
    localStorage.setItem(KEY, payload);
    return;
  }
  await SecureStore.setItemAsync(KEY, payload);
}
