import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DateField } from '@/components/ui/DateField';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { applyLeave, getLeaveTypes, type LeaveType } from '@/lib/api/leave';
import { inclusiveDays, parseYmd, ymd } from '@/lib/leaveUi';

export default function ApplyLeaveScreen() {
  const today = ymd(new Date());
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [typeId, setTypeId] = useState('');
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void getLeaveTypes()
      .then((items) => {
        const active = items.filter((item) => item.is_active);
        setTypes(active);
        if (active[0]) setTypeId(active[0].id);
      })
      .catch(() => setTypes([]));
  }, []);

  const selected = types.find((item) => item.id === typeId);
  const days = useMemo(() => inclusiveDays(fromDate, toDate), [fromDate, toDate]);

  function setFrom(value: string) {
    setFromDate(value);
    if (parseYmd(value) > parseYmd(toDate)) setToDate(value);
  }

  async function onSubmit() {
    if (!typeId) {
      Alert.alert('Leave', 'No leave types are configured for your organization.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Leave', 'Enter a brief reason for leave.');
      return;
    }
    setLoading(true);
    try {
      const created = await applyLeave({
        leave_type_id: typeId,
        from_date: fromDate,
        to_date: toDate,
        reason: reason.trim(),
      });
      router.replace({
        pathname: '/leave-applied',
        params: {
          id: created.id,
          type: created.leave_type_name,
          from: created.from_date,
          to: created.to_date,
          days: String(created.number_of_days),
          status: created.status,
          createdAt: created.created_at,
        },
      });
    } catch (err) {
      Alert.alert('Leave', err instanceof Error ? err.message : 'Could not apply.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Apply Leave" onBack={() => router.back()} />
      <KeyboardSafeScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>Leave Type</Text>
        <Pressable style={styles.select} onPress={() => setOpen((v) => !v)}>
          <Text style={styles.selectText}>{selected?.name || 'Select leave type'}</Text>
          <Ionicons name="chevron-down" size={18} color={Colors.muted} />
        </Pressable>
        {open
          ? types.map((item) => (
              <Pressable
                key={item.id}
                style={styles.option}
                onPress={() => {
                  setTypeId(item.id);
                  setOpen(false);
                }}>
                <Text style={styles.optionText}>{item.name}</Text>
              </Pressable>
            ))
          : null}

        <DateField label="From Date" value={fromDate} onChange={setFrom} />
        <DateField
          label="To Date"
          value={toDate}
          onChange={setToDate}
          minimumDate={parseYmd(fromDate)}
        />

        <View style={styles.duration}>
          <Text style={styles.label}>Duration</Text>
          <Text style={styles.days}>
            {days} day{days === 1 ? '' : 's'}
          </Text>
        </View>

        <Text style={styles.label}>Reason</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Brief reason for leave..."
          placeholderTextColor={Colors.muted}
          multiline
          style={styles.area}
        />

        <View style={styles.info}>
          <Ionicons name="information-circle" size={18} color={Colors.infoText} />
          <Text style={styles.infoText}>Your manager will be notified once submitted.</Text>
        </View>

        <PrimaryButton label="Apply Leave" loading={loading} onPress={() => void onSubmit()} />
        <OutlineButton label="Cancel" onPress={() => router.back()} />
      </KeyboardSafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.heading },
  select: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { fontSize: 16, fontWeight: '600', color: Colors.heading },
  option: { paddingVertical: 12, paddingHorizontal: 8 },
  optionText: { fontWeight: '600', color: Colors.heading },
  duration: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  days: { fontWeight: '800', color: Colors.heading },
  area: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    textAlignVertical: 'top',
    backgroundColor: Colors.background,
    color: Colors.heading,
  },
  info: {
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: { flex: 1, color: Colors.infoText, fontSize: 13 },
});
