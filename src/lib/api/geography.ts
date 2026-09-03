import { apiRequest } from '@/lib/api/client';

export interface GeoItem {
  id: string;
  name: string;
  code?: string | null;
  status?: string;
  state_id?: string;
  city_id?: string;
  region_id?: string;
}

export interface GeoList {
  items: GeoItem[];
  total: number;
  page?: number;
  page_size?: number;
}

export function listStates() {
  return apiRequest<GeoList>('/geography/states?page=1&page_size=100');
}

export function listCities(stateId?: string) {
  const q = new URLSearchParams({ page: '1', page_size: '100' });
  if (stateId) q.set('state_id', stateId);
  return apiRequest<GeoList>(`/geography/cities?${q.toString()}`);
}

export function listRegions(cityId?: string) {
  const q = new URLSearchParams({ page: '1', page_size: '100' });
  if (cityId) q.set('city_id', cityId);
  return apiRequest<GeoList>(`/geography/regions?${q.toString()}`);
}

export function listAreas(regionId?: string) {
  const q = new URLSearchParams({ page: '1', page_size: '100' });
  if (regionId) q.set('region_id', regionId);
  return apiRequest<GeoList>(`/geography/areas?${q.toString()}`);
}

export function createState(data: { name: string; code?: string | null }) {
  return apiRequest<GeoItem>('/geography/states', { method: 'POST', body: data });
}

export function createCity(data: { name: string; state_id: string }) {
  return apiRequest<GeoItem>('/geography/cities', { method: 'POST', body: data });
}

export function createRegion(data: { name: string; city_id: string }) {
  return apiRequest<GeoItem>('/geography/regions', { method: 'POST', body: data });
}

export function createArea(data: { name: string; region_id: string }) {
  return apiRequest<GeoItem>('/geography/areas', { method: 'POST', body: data });
}

export function updateGeo(
  kind: 'states' | 'cities' | 'regions' | 'areas',
  id: string,
  data: Record<string, unknown>,
) {
  return apiRequest<GeoItem>(`/geography/${kind}/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export function deleteGeo(kind: 'states' | 'cities' | 'regions' | 'areas', id: string) {
  return apiRequest<void>(`/geography/${kind}/${id}`, { method: 'DELETE' });
}
