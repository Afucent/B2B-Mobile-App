import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { Colors, Radius } from '@/constants/theme';
import { displayYmd, parseYmd, ymd } from '@/lib/leaveUi';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimumDate?: Date;
}

export function DateField({ label, value, onChange, minimumDate }: Props) {
  const [open, setOpen] = useState(false);

  function onPick(_event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS !== 'ios') setOpen(false);
    if (date) onChange(ymd(date));
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.box, pressed && styles.boxPressed]}
        accessibilityRole="button"
        accessibilityLabel={label}>
        <Text style={styles.value}>{displayYmd(value)}</Text>
        <Ionicons name="calendar-outline" size={18} color={Colors.muted} />
      </Pressable>
      {open && Platform.OS === 'ios' ? (
        <View style={styles.iosPicker}>
          <DateTimePicker
            value={parseYmd(value)}
            mode="date"
            display="spinner"
            minimumDate={minimumDate}
            onChange={onPick}
          />
          <Pressable onPress={() => setOpen(false)} style={styles.done}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      ) : null}
      {open && Platform.OS !== 'ios' ? (
        <DateTimePicker
          value={parseYmd(value)}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={onPick}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: Colors.muted,
    textTransform: 'uppercase',
  },
  box: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
  },
  boxPressed: {
    backgroundColor: Colors.brandSoft,
    borderColor: Colors.brand,
  },
  value: { fontSize: 16, color: Colors.heading, fontWeight: '600' },
  iosPicker: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  done: { alignSelf: 'flex-end', paddingVertical: 10, paddingHorizontal: 14 },
  doneText: { color: Colors.brand, fontWeight: '700' },
});
