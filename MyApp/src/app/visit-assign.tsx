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
import { getFieldOperationsSettings } from '@/lib/api/org';
import { assignVisitsBatch, getVisitHistory, type FieldVisit } from '@/lib/api/visits';
import { listUsers, type AdminUser } from '@/lib/api/users';
import { formatDate } from '@/lib/format';
import { ymd } from '@/lib/leaveUi';

const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function workingDatesInRange(startIso: string, endIso: string, workingDays: string[]) {
  const allowed = new Set(workingDays.map((d) => d.toLowerCase()));
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  const dates: string[] = [];
  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    if (allowed.has(WEEKDAY_KEYS[cur.getDay()])) dates.push(ymd(cur));
  }
  return dates;
}

function dayLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

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
                <Text style={styles.addr}>{formatDate(item.scheduled_at)}</Text>
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
  const [workingDays, setWorkingDays] = useState<string[]>([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
  ]);
  const [employeeId, setEmployeeId] = useState('');
  const [span, setSpan] = useState<'single' | 'range'>('single');
  const [startDate, setStartDate] = useState(() => ymd(new Date()));
  const [endDate, setEndDate] = useState(() => ymd(new Date()));
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [dayDealers, setDayDealers] = useState<Record<string, string[]>>({});
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setEmployeeId('');
    setSpan('single');
    const today = ymd(new Date());
    setStartDate(today);
    setEndDate(today);
    setDates([]);
    setDayDealers({});
    setError('');
    void Promise.all([listUsers(0, 100), listDealersAdmin(), getFieldOperationsSettings().catch(() => null)])
      .then(([users, dealerRes, settings]) => {
        setEmployees(users.items);
        setDealers(dealerRes.items);
        if (settings?.working_days?.length) setWorkingDays(settings.working_days);
      })
      .catch(() => {});
  }, [visible]);

  function generate() {
    const end = span === 'single' ? startDate : endDate;
    if (span === 'range' && end < startDate) {
      setError('End date must be after start date.');
      return;
    }
    const next = workingDatesInRange(startDate, end, workingDays);
    if (next.length === 0) {
      setError('No working days in this range. Check Field ops working-day toggles.');
      setDates([]);
      return;
    }
    setError('');
    setDayDealers((prev) => {
      const mapped: Record<string, string[]> = {};
      for (const date of next) mapped[date] = prev[date] ?? [];
      return mapped;
    });
    setDates(next);
  }

  function toggleDealer(date: string, dealerId: string) {
    setDayDealers((prev) => {
      const current = new Set(prev[date] ?? []);
      if (current.has(dealerId)) current.delete(dealerId);
      else current.add(dealerId);
      return { ...prev, [date]: Array.from(current) };
    });
  }

  function copyToAll(fromDate: string) {
    const source = dayDealers[fromDate] ?? [];
    setDayDealers((prev) => {
      const next = { ...prev };
      for (const date of dates) next[date] = [...source];
      return next;
    });
  }

  async function submit() {
    if (!employeeId) {
      setError('Choose an employee.');
      return;
    }
    if (dates.length === 0) {
      setError('Generate dates first.');
      return;
    }
    const days = dates.map((date) => ({ date, dealer_ids: dayDealers[date] ?? [] }));
    if (days.some((d) => d.dealer_ids.length === 0)) {
      setError('Select at least one dealer for every date.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await assignVisitsBatch({ employee_id: employeeId, days });
      await onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assign failed');
    } finally {
      setLoading(false);
    }
  }

  const employee = employees.find((e) => e.id === employeeId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Add visit</Text>
          <Text style={styles.sub}>Pick a range, then set dealers for each working day.</Text>
          <ScrollView contentContainerStyle={{ gap: Spacing.sm, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Employee *</Text>
            <Pressable style={styles.select} onPress={() => setShowEmployeePicker(true)}>
              <Text style={styles.selectText}>{employee?.name ?? 'Select employee'}</Text>
            </Pressable>

            <Text style={styles.label}>Visit span</Text>
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggle, span === 'single' && styles.toggleActive]}
                onPress={() => setSpan('single')}>
                <Text style={[styles.toggleText, span === 'single' && styles.toggleTextActive]}>Single day</Text>
              </Pressable>
              <Pressable
                style={[styles.toggle, span === 'range' && styles.toggleActive]}
                onPress={() => setSpan('range')}>
                <Text style={[styles.toggleText, span === 'range' && styles.toggleTextActive]}>Date range</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>{span === 'range' ? 'Start date' : 'Date'} *</Text>
            <Pressable style={styles.select} onPress={() => setPicking('start')}>
              <Text style={styles.selectText}>{startDate}</Text>
            </Pressable>
            {span === 'range' ? (
              <>
                <Text style={styles.label}>End date *</Text>
                <Pressable style={styles.select} onPress={() => setPicking('end')}>
                  <Text style={styles.selectText}>{endDate}</Text>
                </Pressable>
              </>
            ) : null}
            {picking ? (
              <DateTimePicker
                value={new Date(`${(picking === 'start' ? startDate : endDate)}T00:00:00`)}
                mode="date"
                onChange={(_, date) => {
                  setPicking(Platform.OS === 'ios' ? picking : null);
                  if (date) {
                    const next = ymd(date);
                    if (picking === 'start') setStartDate(next);
                    else setEndDate(next);
                  }
                }}
              />
            ) : null}

            <OutlineButton label="Generate dates" onPress={generate} />
            <Text style={styles.meta}>Only Field ops working days are included.</Text>

            {dates.map((date) => (
              <View key={date} style={styles.dayCard}>
                <Text style={styles.name}>{dayLabel(date)}</Text>
                <Text style={styles.label}>Dealers</Text>
                {dealers.map((dealer) => {
                  const checked = (dayDealers[date] ?? []).includes(dealer.id);
                  return (
                    <Pressable
                      key={dealer.id}
                      style={styles.checkRow}
                      onPress={() => toggleDealer(date, dealer.id)}>
                      <View style={[styles.box, checked && styles.boxOn]} />
                      <Text style={styles.checkLabel}>{dealer.name}</Text>
                    </Pressable>
                  );
                })}
                {dates.length > 1 ? (
                  <Pressable onPress={() => copyToAll(date)}>
                    <Text style={styles.copyLink}>Copy to all dates</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}

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
  meta: { color: Colors.muted, fontSize: 12 },
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
    maxHeight: '92%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.heading, marginBottom: 4 },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.heading,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  select: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    backgroundColor: Colors.background,
  },
  selectText: { fontWeight: '700', color: Colors.heading },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  toggleActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  toggleText: { fontWeight: '700', color: Colors.heading, fontSize: 13 },
  toggleTextActive: { color: '#fff' },
  dayCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Colors.background,
    gap: 6,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  boxOn: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  checkLabel: { color: Colors.heading, fontWeight: '600', flex: 1 },
  copyLink: { color: Colors.brand, fontWeight: '700', marginTop: 4 },
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
