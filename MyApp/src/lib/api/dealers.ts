import { apiRequest } from '@/lib/api/client';

export interface Dealer {
  id: string;
  name: string;
  code: string;
  type_name: string;
  address: string | null;
  city_name?: string | null;
  area_name?: string | null;
  region_name?: string | null;
  state_name?: string | null;
  contact?: string;
  email?: string | null;
  created_at?: string;
  status: string;
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
