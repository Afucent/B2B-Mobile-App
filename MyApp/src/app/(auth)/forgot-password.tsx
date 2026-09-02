import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { orgForgotPassword } from '@/lib/api/auth';
import { isEmail } from '@/lib/format';

export default function ForgotPasswordScreen() {
  const { companyCode: savedCode } = useAuth();
  const [companyCode, setCompanyCode] = useState(savedCode);
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSend() {
    setError('');
    if (!/^\d{6}$/.test(companyCode.trim())) {
      setError('Enter a valid 6-digit company code.');
      return;
    }
    if (!isEmail(identifier)) {
      setError('Enter the email linked to your account.');
      return;
    }
    setLoading(true);
    try {
      await orgForgotPassword(identifier.trim(), companyCode.trim());
      router.push({
        pathname: '/(auth)/reset-password',
        params: { email: identifier.trim(), companyCode: companyCode.trim() },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Reset password" onBack={() => router.back()} />
      <KeyboardSafeScrollView contentContainerStyle={styles.body}>
        <Text style={styles.copy}>
          Enter the email or mobile linked to your account.{'\n'}We’ll send a verification code.
        </Text>
        <TextField
          label="Company code"
          value={companyCode}
          onChangeText={setCompanyCode}
          placeholder="e.g. 100001"
          autoCapitalize="characters"
        />
        <TextField
          label="Email or mobile"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="you@company.com"
          keyboardType="email-address"
          error={error}
        />
        <PrimaryButton label="Send code" onPress={() => void onSend()} loading={loading} />
      </KeyboardSafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  body: { paddingHorizontal: 24, paddingTop: 8, gap: 20 },
  copy: { fontSize: 16, lineHeight: 24, color: Colors.text },
});
