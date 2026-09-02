import type { Href } from 'expo-router';

export const routes = {
  splash: '/' as Href,
  app: '/(app)' as Href,
  home: '/(app)' as Href,
  visits: '/(app)/visits' as Href,
  leaves: '/(app)/leaves' as Href,
  calendar: '/(app)/calendar' as Href,
  profile: '/(app)/profile' as Href,
  login: '/(auth)/login' as Href,
  forgot: '/(auth)/forgot-password' as Href,
  reset: '/(auth)/reset-password' as Href,
  otp: '/(auth)/otp' as Href,
  clockIn: '/clock-in' as Href,
  clockInConfirmed: '/clock-in-confirmed' as Href,
  clockOut: '/clock-out' as Href,
  shiftComplete: '/shift-complete' as Href,
};
