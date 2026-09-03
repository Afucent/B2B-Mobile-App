import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'afbex.access_token';
const COMPANY_KEY = 'afbex.company_code';

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string) {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
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
