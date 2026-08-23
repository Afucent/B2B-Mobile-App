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

function defaultApiBase() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  // In dev, follow the same LAN host Metro uses so USB/Wi‑Fi devices reach the PC backend.
  if (__DEV__) {
    const devHost = getExpoDevHost();
    if (devHost) {
      return `http://${devHost}:${DEFAULT_API_PORT}${API_PATH}`;
    }
    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${DEFAULT_API_PORT}${API_PATH}`;
    }
    return `http://localhost:${DEFAULT_API_PORT}${API_PATH}`;
  }

  if (configured) {
    return configured;
  }
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_API_PORT}${API_PATH}`;
  }
  return `http://localhost:${DEFAULT_API_PORT}${API_PATH}`;
}

export const API_BASE = defaultApiBase();

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

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
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
      'Unable to reach the server. Check your connection and that the backend is running.',
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
