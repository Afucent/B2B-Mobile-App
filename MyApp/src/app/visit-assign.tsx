import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { listDealersAdmin, type Dealer } from '@/lib/api/dealers';
import { assignVisit, getVisitHistory, type FieldVisit } from '@/lib/api/visits';
import { listUsers, type AdminUser } from '@/lib/api/users';
import { formatClock, formatDate } from '@/lib/format';

export default function VisitAssignScreen() {
  return (
    <RequireModuleAccess module="visit_assign" allowCreate>
      <VisitAssignContent />
    </RequireModuleAccess>
  );
}

function VisitAssignContent() {
  const [items, setItems] = useState<FieldVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getVisitHistory({ status: 'assigned', limit: 100 });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending visits');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Visit assign" onBack={() => router.back()} />
      <View style={styles.body}>
        <Text style={styles.sub}>Pending assigned visits. Tap Add visit to schedule one.</Text>
        <OutlineButton label="+ Add visit" onPress={() => setModalOpen(true)} />
        {loading ? <Text style={styles.meta}>Loading…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: Spacing.sm, paddingBottom: 40 }}
          ListEmptyComponent={!loading ? <Text style={styles.meta}>No pending visits.</Text> : null}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.employee_name ?? 'Employee'}</Text>
                <Text style={styles.addr}>{item.dealer_name ?? 'Dealer'}</Text>
                <Text style={styles.addr}>
                  {formatDate(item.scheduled_at)} · {formatClock(item.scheduled_at)}
                </Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>Pending</Text>
              </View>
            </View>
          )}
        />
      </View>

      <AssignVisitModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onAssigned={async () => {
          setModalOpen(false);
          await load();
        }}
      />
    </View>
  );
}

function AssignVisitModal({
  visible,
  onClose,
  onAssigned,
}: {
  visible: boolean;
  onClose: () => void;
  onAssigned: () => Promise<void>;
}) {
  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [dealerId, setDealerId] = useState('');
  const [when, setWhen] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [showDealerPicker, setShowDealerPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setEmployeeId('');
    setDealerId('');
    setWhen(new Date());
    setError('');
    void Promise.all([listUsers(0, 100), listDealersAdmin()])
      .then(([users, dealerRes]) => {
        setEmployees(users.items);
        setDealers(dealerRes.items);
      })
      .catch(() => {});
  }, [visible]);

  async function submit() {
    if (!employeeId || !dealerId) {
      setError('Choose employee and dealer.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await assignVisit({
        employee_id: employeeId,
        dealer_id: dealerId,
        scheduled_at: when.toISOString(),
      });
      await onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assign failed');
    } finally {
      setLoading(false);
    }
  }

  const employee = employees.find((e) => e.id === employeeId);
  const dealer = dealers.find((d) => d.id === dealerId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Add visit</Text>
          <ScrollView contentContainerStyle={{ gap: Spacing.sm }} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Employee *</Text>
            <Pressable style={styles.select} onPress={() => setShowEmployeePicker(true)}>
              <Text style={styles.selectText}>{employee?.name ?? 'Select employee'}</Text>
            </Pressable>

            <Text style={styles.label}>Dealer *</Text>
            <Pressable style={styles.select} onPress={() => setShowDealerPicker(true)}>
              <Text style={styles.selectText}>{dealer?.name ?? 'Select dealer'}</Text>
            </Pressable>

            <Text style={styles.label}>Date *</Text>
            <Pressable style={styles.select} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.selectText}>{formatDate(when)}</Text>
            </Pressable>
            {showDatePicker ? (
              <DateTimePicker
                value={when}
                mode="date"
                onChange={(_, date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (date) {
                    const next = new Date(when);
                    next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                    setWhen(next);
                  }
                }}
              />
            ) : null}

            <Text style={styles.label}>Time *</Text>
            <Pressable style={styles.select} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.selectText}>
                {when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>
            {showTimePicker ? (
              <DateTimePicker
                value={when}
                mode="time"
                onChange={(_, date) => {
                  setShowTimePicker(Platform.OS === 'ios');
                  if (date) {
                    const next = new Date(when);
                    next.setHours(date.getHours(), date.getMinutes(), 0, 0);
                    setWhen(next);
                  }
                }}
              />
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <PrimaryButton label="Assign visit" loading={loading} onPress={() => void submit()} />
            <OutlineButton label="Cancel" onPress={onClose} />
          </ScrollView>
        </View>
      </View>

      <PickerModal
        visible={showEmployeePicker}
        title="Choose employee"
        options={employees.map((e) => ({ id: e.id, name: e.name }))}
        onClose={() => setShowEmployeePicker(false)}
        onSelect={(id) => {
          setEmployeeId(id);
          setShowEmployeePicker(false);
        }}
      />
      <PickerModal
        visible={showDealerPicker}
        title="Choose dealer"
        options={dealers.map((d) => ({ id: d.id, name: d.name }))}
        onClose={() => setShowDealerPicker(false)}
        onSelect={(id) => {
          setDealerId(id);
          setShowDealerPicker(false);
        }}
      />
    </Modal>
  );
}

function PickerModal({
  visible,
  title,
  options,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: { id: string; name: string }[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <View style={styles.pickerCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 320 }}
            renderItem={({ item }) => (
              <Pressable style={styles.pickerRow} onPress={() => onSelect(item.id)}>
                <Text style={styles.name}>{item.name}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.meta}>No options.</Text>}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { flex: 1, padding: Spacing.md, gap: Spacing.sm },
  sub: { color: Colors.muted, lineHeight: 20 },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: { fontWeight: '700', color: Colors.heading },
  addr: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  pill: {
    backgroundColor: Colors.pendingBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { color: Colors.pendingText, fontWeight: '800', fontSize: 11 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.md,
    maxHeight: '88%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.heading, marginBottom: 8 },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.heading,
    textTransform: 'uppercase',
  },
  select: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    backgroundColor: Colors.background,
  },
  selectText: { fontWeight: '700', color: Colors.heading },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  pickerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  pickerRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
});
