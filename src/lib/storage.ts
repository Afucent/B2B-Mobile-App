import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'afbex.access_token';
const COMPANY_KEY = 'afbex.company_code';
const API_BASE_KEY = 'afbex.api_base';

/** Readable after the first unlock so background pings still auth with the screen off. */
export const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
}

async function getItem(key: string) {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
}

async function deleteItem(key: string) {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
}

export async function getToken() {
  return getItem(TOKEN_KEY);
}

export async function setToken(token: string) {
  await setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  await deleteItem(TOKEN_KEY);
}

export async function getCompanyCode() {
  return getItem(COMPANY_KEY);
}

export async function setCompanyCode(code: string) {
  await setItem(COMPANY_KEY, code);
}

export async function persistApiBase(url: string) {
  const trimmed = url.trim().replace(/\/$/, '');
  if (!trimmed || trimmed.includes('10.0.2.2') || trimmed.includes('localhost')) return;
  await setItem(API_BASE_KEY, trimmed);
}

export async function getPersistedApiBase() {
  return getItem(API_BASE_KEY);
}
