import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { todayKey } from '@/lib/geo';

export interface VisitLog {
  id: string;
  dealerId: string;
  dealerName: string;
  dealerAddress: string;
  date: string;
  checkInAt: string;
  checkOutAt?: string;
  notes?: string;
  photoUri?: string;
  flagged: boolean;
  unplanned: boolean;
  unplannedReason?: string;
  distanceMeters?: number | null;
  geofenceRadiusM: number;
  reviewStatus?: 'flagged' | 'reviewed';
}

const KEY = 'afbex.visits';
const FAV_KEY = 'afbex.favorite_dealers';
const MISSED_KEY = 'afbex.missed_clockout';

export interface MissedClockOutNotice {
  id: string;
  date: string;
  expectedOut: string;
  autoOut: string;
  status: 'FLAGGED_REVIEW' | 'reviewed';
  reviewedBy?: string;
  dismissed?: boolean;
}

async function read(key: string) {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function write(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function listVisits(): Promise<VisitLog[]> {
  const raw = await read(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as VisitLog[];
  } catch {
    return [];
  }
}

export async function saveVisit(item: VisitLog) {
  const items = await listVisits();
  const next = [item, ...items.filter((row) => row.id !== item.id)];
  await write(KEY, JSON.stringify(next));
}

export async function getVisit(id: string) {
  const items = await listVisits();
  return items.find((row) => row.id === id) ?? null;
}

export async function getActiveVisit() {
  const items = await listVisits();
  return items.find((row) => row.date === todayKey() && !row.checkOutAt) ?? null;
}

export async function visitsForDay(date = todayKey()) {
  const items = await listVisits();
  return items.filter((row) => row.date === date);
}

export async function listFavorites(): Promise<string[]> {
  const raw = await read(FAV_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function toggleFavorite(dealerId: string) {
  const items = await listFavorites();
  const next = items.includes(dealerId) ? items.filter((id) => id !== dealerId) : [...items, dealerId];
  await write(FAV_KEY, JSON.stringify(next));
  return next.includes(dealerId);
}

export async function getMissedClockOut(): Promise<MissedClockOutNotice | null> {
  const raw = await read(MISSED_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MissedClockOutNotice;
  } catch {
    return null;
  }
}

export async function saveMissedClockOut(item: MissedClockOutNotice) {
  await write(MISSED_KEY, JSON.stringify(item));
}

export async function clearMissedClockOut() {
  await write(MISSED_KEY, '');
}

export const UNPLANNED_REASONS = [
  'Nearby opportunity',
  'Manager request',
  'Customer call',
  'Follow-up pending',
  'Other',
] as const;
