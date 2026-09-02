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
      <Pressable onPress={() => setOpen(true)} style={styles.box}>
        <Text style={styles.value}>{displayYmd(value)}</Text>
      </Pressable>
      {open && Platform.OS === 'ios' ? (
        <View>
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
    fontSize: 13,
    fontWeight: '600',
    color: Colors.heading,
  },
  box: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  value: { fontSize: 16, color: Colors.heading, fontWeight: '600' },
  done: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  doneText: { color: Colors.brand, fontWeight: '700' },
});
