import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type CorrectionStatus = 'pending' | 'approved' | 'rejected';

export interface CorrectionRequest {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string;
  reason: string;
  status: CorrectionStatus;
  submittedAt: string;
  decidedAt?: string;
  rejectionReason?: string;
  managerName: string;
}

const KEY = 'afbex.corrections';

async function readRaw() {
  if (Platform.OS === 'web') return localStorage.getItem(KEY);
  return SecureStore.getItemAsync(KEY);
}

async function writeRaw(value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(KEY, value);
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
}

export async function listCorrections(): Promise<CorrectionRequest[]> {
  const raw = await readRaw();
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CorrectionRequest[];
  } catch {
    return [];
  }
}

export async function saveCorrection(item: CorrectionRequest) {
  const items = await listCorrections();
  const next = [item, ...items.filter((row) => row.id !== item.id)];
  await writeRaw(JSON.stringify(next));
}

export async function getCorrection(id: string) {
  const items = await listCorrections();
  return items.find((row) => row.id === id) ?? null;
}

export async function cancelCorrection(id: string) {
  const items = await listCorrections();
  await writeRaw(JSON.stringify(items.filter((row) => row.id !== id)));
}
