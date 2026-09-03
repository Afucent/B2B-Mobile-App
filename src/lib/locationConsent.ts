import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'afbex.location_consent';

export async function hasLocationConsent() {
  const raw = Platform.OS === 'web' ? localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  return raw === '1';
}

export async function setLocationConsent(granted: boolean) {
  const value = granted ? '1' : '0';
  if (Platform.OS === 'web') {
    localStorage.setItem(KEY, value);
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
}
