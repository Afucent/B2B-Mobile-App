import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getToken } from '@/lib/storage';

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

function resolveApiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');

  // In Expo Go / metro, the phone already reached this host to download JS.
  // Prefer it for the API so a stale .env IP cannot break same-Wi‑Fi local backend.
  if (__DEV__) {
    const devHost = getExpoDevHost();
    if (devHost && isLanHost(devHost)) {
      return `http://${devHost}:${DEFAULT_API_PORT}${API_PATH}`;
    }
  }

  if (configured) {
    return configured;
  }

  if (__DEV__ && Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_API_PORT}${API_PATH}`;
  }
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_API_PORT}${API_PATH}`;
  }
  return `http://localhost:${DEFAULT_API_PORT}${API_PATH}`;
}

/** Resolved per request so Expo hostUri updates are picked up after reload. */
export function getApiBase(): string {
  return resolveApiBase();
}

/** @deprecated use getApiBase() — kept for call sites that import a constant */
export const API_BASE = resolveApiBase();

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
  const apiBase = getApiBase();

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
    throw new ApiRequestError(
      `Unable to reach the server at ${apiBase}. Same Wi‑Fi alone is not enough — Windows Firewall often blocks port ${DEFAULT_API_PORT}. On the PC run (Admin PowerShell): New-NetFirewallRule -DisplayName "AFBEX Backend 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Any`,
      0,
    );
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
