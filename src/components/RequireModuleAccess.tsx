import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

type GateAction = 'read' | 'create' | 'update' | 'delete';

type Props = {
  module?: string;
  modules?: string[];
  action?: GateAction;
  allowCreate?: boolean;
  children: ReactNode;
};

export default function RequireModuleAccess({
  module,
  modules,
  action = 'read',
  allowCreate = false,
  children,
}: Props) {
  const { status } = useAuth();
  const { canView, canCreate, canEdit, canDelete } = usePermissions();
  const loading = status === 'loading';
  const list = modules?.length ? modules : module ? [module] : [];

  const allowed =
    !loading &&
    list.some((m) => {
      if (action === 'read') {
        if (canView(m)) return true;
        if (allowCreate && canCreate(m)) return true;
        return false;
      }
      if (action === 'create') return canCreate(m);
      if (action === 'update') return canEdit(m);
      return canDelete(m);
    });

  useEffect(() => {
    if (loading) return;
    if (!allowed) {
      router.replace('/(app)');
    }
  }, [allowed, loading]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brand} />
        <Text style={styles.meta}>Loading…</Text>
      </View>
    );
  }

  if (!allowed) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>You do not have permission to access this page.</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  meta: { color: Colors.muted, textAlign: 'center' },
});
