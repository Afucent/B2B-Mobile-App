import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useKeyboardScroll } from '@/components/ui/KeyboardSafeScrollView';
import { Colors, Radius } from '@/constants/theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  keyboardType?: 'default' | 'email-address' | 'numeric';
  secureTextEntry?: boolean;
  autoCorrect?: boolean;
  editable?: boolean;
  multiline?: boolean;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  autoCapitalize = 'none',
  keyboardType = 'default',
  secureTextEntry,
  autoCorrect = false,
  editable = true,
  multiline = false,
}: Props) {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  const wrapRef = useRef<View>(null);
  const keyboardScroll = useKeyboardScroll();

  const measureAndScroll = useCallback(() => {
    if (!keyboardScroll) return;
    wrapRef.current?.measureInWindow((_x, y, _w, h) => {
      keyboardScroll.scrollField(y, h);
    });
  }, [keyboardScroll]);

  const handleFocus = useCallback(() => {
    if (!keyboardScroll) return;
    keyboardScroll.registerField(measureAndScroll);
    measureAndScroll();
  }, [keyboardScroll, measureAndScroll]);

  return (
    <View style={styles.wrap} ref={wrapRef} collapsable={false}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputError : null]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.muted}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          keyboardType={keyboardType}
          secureTextEntry={hidden}
          editable={editable}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          onFocus={handleFocus}
          style={[styles.input, multiline && styles.multilineInput]}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={8}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: Colors.muted,
    textTransform: 'uppercase',
  },
  inputWrap: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  inputError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerBg,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.heading,
    paddingVertical: 12,
  },
  multilineInput: {
    minHeight: 104,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '600',
  },
});
