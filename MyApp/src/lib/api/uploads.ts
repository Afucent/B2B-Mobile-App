import { getApiBase } from '@/lib/api/client';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { getToken } from '@/lib/storage';

export async function uploadMedia(uri: string, filename = 'photo.jpg'): Promise<string> {
  const token = await getToken();
  const form = new FormData();
  form.append('file', { uri, name: filename, type: 'image/jpeg' } as unknown as Blob);
  form.append('kind', 'media');
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/uploads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Upload failed');
  }
  const data = (await res.json()) as { url: string; key?: string };
  return resolveMediaUrl(data.url) ?? resolveMediaUrl(data.key) ?? data.url;
}
