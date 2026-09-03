import type { Href } from 'expo-router';
import { router } from 'expo-router';

import { hasLocationConsent } from '@/lib/locationConsent';
import { diagnoseLocation } from '@/lib/location';

export async function routeForLocationAction(next: string): Promise<Href | null> {
  if (!(await hasLocationConsent())) {
    return { pathname: '/location-consent', params: { next } } as Href;
  }
  const status = await diagnoseLocation();
  if (status === 'services_off') {
    return { pathname: '/location-required', params: { reason: 'off', next } } as Href;
  }
  if (status === 'denied') {
    return { pathname: '/location-required', params: { reason: 'denied', next } } as Href;
  }
  return null;
}

export async function continueLocationAction(next: string) {
  const block = await routeForLocationAction(next);
  if (block) {
    router.replace(block);
    return false;
  }
  router.replace(next as Href);
  return true;
}
