import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { listDealers, type Dealer } from '@/lib/api/dealers';
import { assignVisit } from '@/lib/api/visits';
import { listUsers, type AdminUser } from '@/lib/api/users';
import { formatDate } from '@/lib/format';

export default function VisitAssignScreen() {
  return (
    <RequireModuleAccess module="visit_assign" allowCreate>
      <VisitAssignContent />
    </RequireModuleAccess>
  );
}

function VisitAssignContent() {
  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [dealerId, setDealerId] = useState('');
  const [when, setWhen] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([listUsers(0, 100), listDealers()])
      .then(([users, dealerRes]) => {
        setEmployees(users.items);
        setDealers(dealerRes.items);
      })
      .catch(() => {});
  }, []);

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
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assign failed');
    } finally {
      setLoading(false);
    }
  }

  const employee = employees.find((e) => e.id === employeeId);
  const dealer = dealers.find((d) => d.id === dealerId);

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Visit assign" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sub}>Schedule a dealer visit for a field employee.</Text>

        <Text style={styles.label}>Employee *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {employees.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.chip, employeeId === item.id && styles.chipActive]}
              onPress={() => setEmployeeId(item.id)}>
              <Text style={[styles.chipText, employeeId === item.id && styles.chipTextActive]}>{item.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Dealer *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {dealers.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.chip, dealerId === item.id && styles.chipActive]}
              onPress={() => setDealerId(item.id)}>
              <Text style={[styles.chipText, dealerId === item.id && styles.chipTextActive]}>{item.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Date *</Text>
        <Pressable style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateText}>{formatDate(when)}</Text>
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
        <Pressable style={styles.dateBtn} onPress={() => setShowTimePicker(true)}>
          <Text style={styles.dateText}>
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

        {employee && dealer ? (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {employee.name} → {dealer.name}
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Assign visit" loading={loading} onPress={() => void submit()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  sub: { color: Colors.muted, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '800', color: Colors.heading, marginTop: 8, textTransform: 'uppercase' },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipText: { fontWeight: '600', color: Colors.muted, fontSize: 13 },
  chipTextActive: { color: '#fff' },
  dateBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    backgroundColor: Colors.background,
  },
  dateText: { fontWeight: '700', color: Colors.heading },
  summary: { backgroundColor: Colors.brandSoft, borderRadius: Radius.md, padding: 12, marginTop: 8 },
  summaryText: { fontWeight: '700', color: Colors.brand },
  error: { color: Colors.danger },
});
