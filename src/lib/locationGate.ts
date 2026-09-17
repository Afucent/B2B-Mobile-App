import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { hasLocationConsent } from '@/lib/locationConsent';
import { diagnoseLocation } from '@/lib/location';

const PENDING_KEY = 'afbex.pending_attendance';

export type PendingAttendanceAction =
  | { type: 'start-tracking'; returnTo: string; pingMinutes: number }
  | { type: 'resume'; returnTo: string };

let pendingMemory: PendingAttendanceAction | null = null;

export async function setPendingAttendanceAction(action: PendingAttendanceAction | null) {
  pendingMemory = action;
  if (Platform.OS === 'web') {
    if (action) localStorage.setItem(PENDING_KEY, JSON.stringify(action));
    else localStorage.removeItem(PENDING_KEY);
    return;
  }
  if (action) {
    await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(action));
    return;
  }
  await SecureStore.deleteItemAsync(PENDING_KEY).catch(() => undefined);
}

export async function takePendingAttendanceAction(): Promise<PendingAttendanceAction | null> {
  const memory = pendingMemory;
  pendingMemory = null;
  let stored: PendingAttendanceAction | null = null;
  try {
    const raw =
      Platform.OS === 'web'
        ? localStorage.getItem(PENDING_KEY)
        : await SecureStore.getItemAsync(PENDING_KEY);
    if (raw) stored = JSON.parse(raw) as PendingAttendanceAction;
  } catch {
    stored = null;
  }
  if (Platform.OS === 'web') localStorage.removeItem(PENDING_KEY);
  else await SecureStore.deleteItemAsync(PENDING_KEY).catch(() => undefined);
  return memory ?? stored;
}

export async function routeForLocationAction(
  next: string,
  options?: { requireAlways?: boolean },
): Promise<Href | null> {
  const requireAlways = Boolean(options?.requireAlways);
  // Start Tracking never uses the in-app consent sheet — Location Required first.
  if (!requireAlways && !(await hasLocationConsent())) {
    return {
      pathname: '/location-consent',
      params: { next, always: '0' },
    } as Href;
  }
  const status = await diagnoseLocation({ always: requireAlways });
  if (status === 'ok') return null;
  if (status === 'services_off') {
    return { pathname: '/location-required', params: { reason: 'off', next } } as Href;
  }
  if (requireAlways) {
    return {
      pathname: '/location-required',
      params: { reason: status === 'denied' ? 'denied' : 'background', next },
    } as Href;
  }
  if (status === 'denied') {
    return { pathname: '/location-required', params: { reason: 'denied', next } } as Href;
  }
  return null;
}

export async function continueLocationAction(next: string, options?: { requireAlways?: boolean }) {
  const block = await routeForLocationAction(next, options);
  if (block) {
    router.replace(block);
    return false;
  }
  router.replace(next as Href);
  return true;
}
