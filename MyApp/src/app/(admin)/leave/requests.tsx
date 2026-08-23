import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import {
  approveLeaveRequest,
  listLeaveRequestsAdmin,
  rejectLeaveRequest,
  type LeaveRequestAdmin,
} from '@/lib/api/leaveAdmin';

export default function AdminLeaveRequestsScreen() {
  const { canApprove } = usePermissions();
  const [items, setItems] = useState<LeaveRequestAdmin[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await listLeaveRequestsAdmin();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function act(id: string, action: 'approve' | 'reject') {
    setBusyId(id);
    try {
      if (action === 'approve') await approveLeaveRequest(id);
      else await rejectLeaveRequest(id);
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId('');
    }
  }

  return (
    <RequireModuleAccess module="leave_requests">
      <View style={styles.flex}>
      <ScreenHeader title="Leave requests" onBack={() => router.back()} />
      <View style={styles.body}>
        {loading ? <Text style={styles.meta}>Loading…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xl }}
          ListEmptyComponent={!loading ? <Text style={styles.meta}>No requests.</Text> : null}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.name}>{item.employee_name ?? 'Employee'}</Text>
              <Text style={styles.sub}>
                {item.leave_type_name ?? 'Leave'} · {item.start_date} → {item.end_date}
              </Text>
              <Text style={styles.status}>{item.status}</Text>
              {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}
              {canApprove('leave') && item.status === 'pending' ? (
                <View style={styles.actions}>
                  <OutlineButton
                    label="Approve"
                    onPress={() => void act(item.id, 'approve')}
                    disabled={busyId === item.id}
                  />
                  <OutlineButton
                    label="Reject"
                    onPress={() => void act(item.id, 'reject')}
                    disabled={busyId === item.id}
                  />
                </View>
              ) : null}
            </View>
          )}
        />
      </View>
    </View>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { flex: 1, padding: Spacing.md },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 6,
  },
  name: { fontWeight: '700', color: Colors.heading },
  sub: { color: Colors.muted, fontSize: 12 },
  status: { color: Colors.brand, fontWeight: '700', textTransform: 'capitalize' },
  reason: { color: Colors.text, fontSize: 13 },
  actions: { gap: Spacing.sm, marginTop: Spacing.sm },
});
