import { apiRequest } from '@/lib/api/client';

export interface Dealer {
  id: string;
  name: string;
  code: string;
  type_name: string;
  dealer_type_id?: string;
  address: string | null;
  city_name?: string | null;
  area_name?: string | null;
  region_name?: string | null;
  state_name?: string | null;
  state_id?: string;
  city_id?: string;
  region_id?: string;
  area_id?: string;
  contact?: string;
  email?: string | null;
  created_at?: string;
  status: string;
}

export type DealerType = {
  id: string;
  name: string;
  status?: string;
};

export type DealerListParams = {
  search?: string;
  status?: string;
  dealer_type_id?: string;
  state_id?: string;
  city_id?: string;
  region_id?: string;
  area_id?: string;
  page?: number;
  page_size?: number;
};

export function listDealerTypes() {
  return apiRequest<DealerType[]>('/dealers/types');
}

export function listDealers(search?: string) {
  const query = new URLSearchParams({
    page: '1',
    page_size: '50',
    status: 'active',
  });
  if (search?.trim()) query.set('search', search.trim());
  return apiRequest<{ items: Dealer[]; total: number }>(`/dealers?${query.toString()}`);
}

export function getDealer(id: string) {
  return apiRequest<Dealer>(`/dealers/${id}`);
}

export function listDealersAdmin(params: DealerListParams | string = {}) {
  const opts: DealerListParams =
    typeof params === 'string' ? { search: params } : params ?? {};
  const query = new URLSearchParams({
    page: String(opts.page ?? 1),
    page_size: String(opts.page_size ?? 100),
  });
  if (opts.search?.trim()) query.set('search', opts.search.trim());
  if (opts.status) query.set('status', opts.status);
  if (opts.dealer_type_id) query.set('dealer_type_id', opts.dealer_type_id);
  if (opts.state_id) query.set('state_id', opts.state_id);
  if (opts.city_id) query.set('city_id', opts.city_id);
  if (opts.region_id) query.set('region_id', opts.region_id);
  if (opts.area_id) query.set('area_id', opts.area_id);
  return apiRequest<{ items: Dealer[]; total: number }>(`/dealers?${query.toString()}`);
}

export function createDealer(data: Record<string, unknown>) {
  return apiRequest<Dealer>('/dealers', { method: 'POST', body: data });
}

export function updateDealer(id: string, data: Record<string, unknown>) {
  return apiRequest<Dealer>(`/dealers/${id}`, { method: 'PUT', body: data });
}

export function updateDealerStatus(id: string, status: string) {
  return apiRequest<Dealer>(`/dealers/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function deleteDealer(id: string) {
  return apiRequest<{ message: string }>(`/dealers/${id}`, { method: 'DELETE' });
}
