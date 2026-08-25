import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import {
  approveLeaveRequest,
  listLeaveRequestsAdmin,
  rejectLeaveRequest,
  type LeaveRequestAdmin,
} from '@/lib/api/leaveAdmin';
import { displayYmdRange } from '@/lib/leaveUi';

export default function AdminLeaveRequestsScreen() {
  const { canEdit, canApprove } = usePermissions();
  const canDecide =
    canEdit('leave_requests') || canApprove('leave') || canApprove('leave_requests');
  const [items, setItems] = useState<LeaveRequestAdmin[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [rejectTarget, setRejectTarget] = useState<LeaveRequestAdmin | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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

  async function onApprove(id: string) {
    setBusyId(id);
    try {
      await approveLeaveRequest(id);
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId('');
    }
  }

  async function onRejectConfirm() {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      Alert.alert('Reject', 'Enter a rejection reason.');
      return;
    }
    setBusyId(rejectTarget.id);
    try {
      await rejectLeaveRequest(rejectTarget.id, reason);
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusyId('');
    }
  }

  return (
    <RequireModuleAccess module="leave_requests" allowCreate>
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
            renderItem={({ item }) => {
              const from = item.from_date || item.start_date || '';
              const to = item.to_date || item.end_date || '';
              return (
                <View style={styles.row}>
                  <Text style={styles.name}>{item.employee_name ?? 'Employee'}</Text>
                  <Text style={styles.sub}>
                    {item.leave_type_name ?? 'Leave'} · {displayYmdRange(from, to)}
                  </Text>
                  <Text style={styles.status}>{item.status}</Text>
                  {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}
                  {canDecide && item.status === 'pending' ? (
                    <View style={styles.actions}>
                      <OutlineButton
                        label="Approve"
                        onPress={() => void onApprove(item.id)}
                        disabled={busyId === item.id}
                      />
                      <OutlineButton
                        label="Reject"
                        onPress={() => {
                          setRejectTarget(item);
                          setRejectReason('');
                        }}
                        disabled={busyId === item.id}
                      />
                    </View>
                  ) : null}
                </View>
              );
            }}
          />
        </View>

        <Modal visible={Boolean(rejectTarget)} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Reject leave request</Text>
              <Text style={styles.meta}>
                {rejectTarget?.employee_name ?? 'Employee'} ·{' '}
                {rejectTarget?.leave_type_name ?? 'Leave'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Rejection reason *"
                placeholderTextColor={Colors.muted}
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
              />
              <PrimaryButton
                label="Confirm reject"
                onPress={() => void onRejectConfirm()}
                loading={busyId === rejectTarget?.id}
              />
              <Pressable
                onPress={() => {
                  setRejectTarget(null);
                  setRejectReason('');
                }}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.heading },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    textAlignVertical: 'top',
    color: Colors.heading,
  },
  cancel: { textAlign: 'center', color: Colors.muted, fontWeight: '700', paddingVertical: 8 },
});
