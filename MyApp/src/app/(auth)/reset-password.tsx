import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
  const verified = code.trim().length >= 6;

  async function onReset() {
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!checks.length || !checks.number || !checks.uppercase) {
      setError('Password does not meet the requirements.');
      return;
    }
    setLoading(true);
    try {
      await orgResetPassword(code.trim(), password, confirm);
      router.replace('/(auth)/login');
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
        {verified ? (
          <View style={styles.verified}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.verifiedText}>Code verified</Text>
          </View>
        ) : (
          <Text style={styles.copy}>
            Paste the reset code sent to {params.email ?? 'your email'}.
          </Text>
        )}

        <TextField
          label="Verification code"
          value={code}
          onChangeText={setCode}
          placeholder="Enter code from email"
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
          <Requirement ok={checks.length} label="8+ characters" />
          <Requirement ok={checks.number} label="At least one number" />
          <Requirement ok={checks.uppercase} label="At least one uppercase letter" />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Reset password" onPress={() => void onReset()} loading={loading} disabled={!verified} />
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
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  verifiedText: { color: Colors.successText, fontWeight: '700' },
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
