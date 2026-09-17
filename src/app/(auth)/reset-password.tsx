import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors } from '@/constants/theme';
import { orgResetPassword } from '@/lib/api/auth';
import { passwordChecks } from '@/lib/format';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const checks = useMemo(() => passwordChecks(password), [password]);
  const otpReady = /^\d{6}$/.test(code.trim());

  async function onReset() {
    setError('');
    if (!otpReady) {
      setError('Enter the 6-digit verification code from your email.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8 || !checks.number || !checks.uppercase) {
      setError('Password does not meet the requirements.');
      return;
    }
    setLoading(true);
    try {
      await orgResetPassword(code.trim(), password, confirm);
      Alert.alert(
        'Password successfully reset',
        'Your password has been updated. You can now sign in with your new password.',
        [
          {
            text: 'Continue to Sign In',
            onPress: () => router.replace('/(auth)/login'),
          },
        ],
        { cancelable: false },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Reset password" onBack={() => router.back()} />
      <KeyboardSafeScrollView contentContainerStyle={styles.body}>
        <Text style={styles.copy}>
          Enter the 6-digit code sent to {params.email ?? 'your email'}, then create a new password.
        </Text>

        <TextField
          label="Verification code"
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          placeholder="6-digit code"
          keyboardType="numeric"
        />
        <TextField
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextField
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />

        <View>
          <Text style={styles.reqTitle}>Password requirements</Text>
          <Requirement ok={password.length >= 8} label="8+ characters" />
          <Requirement ok={checks.number} label="At least one number" />
          <Requirement ok={checks.uppercase} label="At least one uppercase letter" />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label="Reset password"
          onPress={() => void onReset()}
          loading={loading}
          disabled={!otpReady}
        />
      </KeyboardSafeScrollView>
    </View>
  );
}

function Requirement({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.reqRow}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={ok ? Colors.success : Colors.muted}
      />
      <Text style={[styles.reqLabel, ok && styles.reqOk]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  body: { paddingHorizontal: 24, paddingBottom: 32, gap: 16 },
  copy: { fontSize: 15, color: Colors.text, lineHeight: 22 },
  reqTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: Colors.muted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  reqLabel: { color: Colors.muted, fontSize: 14 },
  reqOk: { color: Colors.successText },
  error: { color: Colors.danger, fontSize: 13 },
});
