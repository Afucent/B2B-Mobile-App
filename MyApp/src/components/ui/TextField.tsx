import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
}: Props) {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));

  return (
    <View style={styles.wrap}>
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
          style={styles.input}
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.heading,
    textTransform: 'uppercase',
  },
  inputWrap: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  inputError: {
    borderColor: Colors.dangerBorder,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.heading,
    paddingVertical: 12,
  },
  error: {
    fontSize: 12,
    color: Colors.danger,
  },
});
