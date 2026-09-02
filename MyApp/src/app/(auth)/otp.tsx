import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { ApiRequestError } from '@/lib/api/client';
import { isEmail } from '@/lib/format';

export default function OtpLoginScreen() {
  const { status, companyCode: savedCode, sendOtp, loginWithOtp } = useAuth();
  const [companyCode, setCompanyCode] = useState(savedCode);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ company?: string; email?: string; otp?: string; form?: string }>({});

  useEffect(() => {
    if (savedCode) setCompanyCode(savedCode);
  }, [savedCode]);

  if (status === 'signedIn') {
    return <Redirect href="/(app)" />;
  }

  function validateBase() {
    const code = companyCode.trim();
    const next: typeof errors = {};
    if (!/^\d{6}$/.test(code)) {
      next.company = 'Enter a valid 6-digit company code.';
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      next.email = 'Enter your email address.';
    } else if (!isEmail(trimmedEmail)) {
      next.email = 'Enter a valid email.';
    }
    return { code, trimmedEmail, next };
  }

  async function onSend() {
    const { code, trimmedEmail, next } = validateBase();
    if (next.company || next.email) {
      setErrors(next);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      await sendOtp(code, trimmedEmail);
      setSent(true);
    } catch (err) {
      setErrors({
        form: err instanceof Error ? err.message : 'Unable to send verification code.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function onVerify() {
    const { code, trimmedEmail, next } = validateBase();
    if (!/^\d{6}$/.test(otp.trim())) {
      next.otp = 'Enter the 6-digit code from your email.';
    }
    if (next.company || next.email || next.otp) {
      setErrors(next);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      await loginWithOtp(code, trimmedEmail, otp.trim());
      router.replace('/(app)');
    } catch (err) {
      const statusCode = err instanceof ApiRequestError ? err.status : 0;
      if (statusCode === 401) {
        setErrors({ otp: 'Invalid or expired verification code.' });
      } else if (statusCode === 403) {
        setErrors({
          form: err instanceof Error ? err.message : 'You do not have mobile app access.',
        });
      } else {
        setErrors({
          form: err instanceof Error ? err.message : 'Unable to verify code.',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Log in" onBack={() => router.back()} />
      <View style={styles.body}>
        <Text style={styles.title}>Log in with OTP</Text>
        <TextField
          label="Company code"
          value={companyCode}
          onChangeText={(v) => setCompanyCode(v.replace(/\D/g, '').slice(0, 6))}
          placeholder="e.g. 100001"
          keyboardType="numeric"
          error={errors.company}
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
        />
        {sent ? (
          <TextField
            label="One-time password"
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            keyboardType="numeric"
            error={errors.otp}
          />
        ) : null}
        {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}
        <PrimaryButton
          label={sent ? 'Verify OTP' : 'Send code'}
          loading={loading}
          onPress={() => {
            if (sent) {
              void onVerify();
              return;
            }
            void onSend();
          }}
        />
        {sent ? (
          <Pressable onPress={() => void onSend()} disabled={loading}>
            <Text style={styles.link}>Resend code</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.link}>Use password instead</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  body: { paddingHorizontal: 24, gap: 16 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.heading },
  formError: { color: Colors.danger, fontSize: 13 },
  link: { color: Colors.brand, fontWeight: '700', textAlign: 'center' },
});
