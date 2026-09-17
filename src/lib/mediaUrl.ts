import { getApiBase } from '@/lib/api/client';

/** Resolve stored media URLs for <Image uri> (fixes wrong API host/port in DB). */
export function resolveMediaUrl(url?: string | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;

  try {
    const apiBase = getApiBase();
    const api = new URL(apiBase);
    const marker = '/uploads/files/';

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const u = new URL(trimmed);
      const idx = u.pathname.indexOf(marker);
      if (idx >= 0) {
        const key = u.pathname.slice(idx + marker.length);
        return `${api.origin}${api.pathname.replace(/\/$/, '')}${marker}${key}${u.search}`;
      }
      return trimmed;
    }

    if (trimmed.startsWith('/')) {
      return `${api.origin}${trimmed}`;
    }

    if (trimmed.includes('/')) {
      return `${api.origin}${api.pathname.replace(/\/$/, '')}/uploads/files/${trimmed.replace(/^\//, '')}`;
    }
  } catch {
    return null;
  }

  return null;
}
