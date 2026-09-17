import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

export default function AdminLayout() {
  const { status } = useAuth();
  const { hasAnyAdminRead } = usePermissions();

  if (status === 'signedOut') {
    return <Redirect href="/(auth)/login" />;
  }

  if (status === 'signedIn' && !hasAnyAdminRead) {
    return <Redirect href="/(app)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
