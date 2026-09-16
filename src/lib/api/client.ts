import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getPersistedApiBase, getToken, persistApiBase } from '@/lib/storage';

const DEFAULT_REQUEST_TIMEOUT_MS = 180_000;
const DEFAULT_MUTATION_TIMEOUT_MS = 300_000;
const API_PATH = '/api/v1';
const DEFAULT_API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? '8000';

export class ApiRequestError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail ?? '';
  }
}

function getExpoDevHost(): string | null {
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    Constants.expoConfig?.hostUri ??
    null;
  if (!debuggerHost) return null;
  const host = debuggerHost.split(':')[0]?.trim();
  return host || null;
}

/** True for typical home/office LAN IPs the phone can reach on the same Wi‑Fi. */
function isLanHost(host: string): boolean {
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}

let rememberedApiBase: string | null = null;
let storeHydrate: Promise<void> | null = null;

export function isPlaceholderApiBase(url: string) {
  return /10\.0\.2\.[0-9]+|127\.0\.0\.1|localhost/i.test(url);
}

function configuredApiBase(): string | null {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  return configured || null;
}

export function hydrateApiBaseCache(url: string | null | undefined) {
  if (url?.trim()) {
    rememberedApiBase = url.trim().replace(/\/$/, '');
  }
}

/** Wait for SecureStore. Release APK must use EXPO_PUBLIC_API_URL baked in at EAS build time. */
export async function ensureApiBaseReady(): Promise<string> {
  const configured = configuredApiBase();
  if (configured) {
    if (rememberedApiBase !== configured) {
      rememberedApiBase = configured;
      void persistApiBase(configured);
    }
    return configured;
  }

  if (__DEV__) {
    const metroUrl = resolveApiBase({ persist: true });
    if (metroUrl && !isPlaceholderApiBase(metroUrl)) {
      return metroUrl;
    }
  }

  if (rememberedApiBase && !isPlaceholderApiBase(rememberedApiBase)) {
    return rememberedApiBase;
  }
  if (!storeHydrate) {
    storeHydrate = getPersistedApiBase()
      .then((url) => {
        if (url && !isPlaceholderApiBase(url)) hydrateApiBaseCache(url);
      })
      .catch(() => undefined);
  }
  await storeHydrate;
  return resolveApiBase();
}

function rememberApiBase(url: string, persist = true) {
  if (!url || url.includes('10.0.2.2') || url.includes('localhost')) return;
  rememberedApiBase = url;
  if (persist) void persistApiBase(url);
}

function resolveApiBase(options?: { persist?: boolean }): string {
  const persist = options?.persist !== false;
  const configured = configuredApiBase();

  if (configured) {
    rememberApiBase(configured, persist);
    return configured;
  }

  // In Expo Go / Metro, the phone already reached this LAN host for JS.
  if (__DEV__) {
    const devHost = getExpoDevHost();
    if (devHost && isLanHost(devHost)) {
      const url = `http://${devHost}:${DEFAULT_API_PORT}${API_PATH}`;
      rememberApiBase(url, persist);
      return url;
    }
  }

  if (rememberedApiBase && !isPlaceholderApiBase(rememberedApiBase)) {
    return rememberedApiBase;
  }

  if (__DEV__ && Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_API_PORT}${API_PATH}`;
  }
  if (__DEV__) {
    return `http://localhost:${DEFAULT_API_PORT}${API_PATH}`;
  }

  // Release build without EXPO_PUBLIC_API_URL (EAS cloud does not read gitignored .env).
  return `http://10.0.2.2:${DEFAULT_API_PORT}${API_PATH}`;
}

/** Resolved per request so Expo hostUri updates are picked up after reload. */
export function getApiBase(): string {
  return resolveApiBase();
}

/** @deprecated use getApiBase() — kept for call sites that import a constant */
export const API_BASE = resolveApiBase({ persist: false });

function formatApiError(detail: unknown, fallback: string) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg ?? 'Validation error')
      .join(' ');
  }
  return fallback;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  timeout?: number;
}

function resolveRequestTimeoutMs(method: string, timeoutOverride?: number): number {
  if (timeoutOverride !== undefined && timeoutOverride > 0) {
    return timeoutOverride;
  }
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  return isMutation ? DEFAULT_MUTATION_TIMEOUT_MS : DEFAULT_REQUEST_TIMEOUT_MS;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, headers, timeout, ...rest } = options;
  const method = (rest.method ?? 'GET').toUpperCase();
  const requestTimeoutMs = resolveRequestTimeoutMs(method, timeout);
  const apiBase = await ensureApiBaseReady();

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = await getToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  const url = `${apiBase}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiRequestError(
        'Request timed out. The server is taking too long to respond.',
        0,
      );
    }
    let hint: string;
    if (isPlaceholderApiBase(apiBase)) {
      hint =
        'This APK has no API URL baked in. Set EXPO_PUBLIC_API_URL in eas.json (preview/production env) or EAS secrets, then rebuild the APK. Local .env is not used on EAS cloud builds.';
    } else if (/^https:\/\//i.test(apiBase)) {
      hint = 'Check internet/VPN and that the server is up. Firewall on your PC is not needed for HTTPS stage URLs.';
    } else {
      hint = `Same Wi‑Fi alone is not enough — allow TCP port ${DEFAULT_API_PORT} on the PC (Admin PowerShell): cd D:\\Afucent\\B2B-E-Commerce._Backend\\scripts; .\\allow-port-8000.ps1`;
    }
    throw new ApiRequestError(`Unable to reach the server at ${apiBase}. ${hint}`, 0);
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    const error = data as { detail?: unknown } | null;
    throw new ApiRequestError(
      formatApiError(error?.detail, 'Request failed'),
      response.status,
      error?.detail,
    );
  }

  return data as T;
}
