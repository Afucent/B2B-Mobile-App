import { Link, Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { APP_VERSION, Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { ApiRequestError } from '@/lib/api/client';
import { isEmail, isMobileNumber } from '@/lib/format';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { status, login, companyCode: savedCode } = useAuth();
  const [companyCode, setCompanyCode] = useState(savedCode);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    company?: string;
    identifier?: string;
    password?: string;
    form?: string;
  }>({});

  useEffect(() => {
    if (savedCode) setCompanyCode(savedCode);
  }, [savedCode]);

  if (status === 'signedIn') {
    return <Redirect href="/(app)" />;
  }

  async function onSubmit() {
    const code = companyCode.trim();
    const id = identifier.trim();
    const next: typeof errors = {};
    if (!/^\d{6}$/.test(code)) {
      next.company = 'Enter a valid 6-digit company code.';
    }
    if (!id) {
      next.identifier = 'Enter your email or mobile.';
    } else if (id.includes('@')) {
      if (!isEmail(id)) next.identifier = 'Enter a valid email.';
    } else if (!isMobileNumber(id)) {
      next.identifier = 'Enter a valid 10-digit mobile number.';
    }
    if (!password) {
      next.password = 'Password is required.';
    } else if (password.length < 8) {
      next.password = 'Password must be at least 8 characters.';
    }
    if (next.company || next.identifier || next.password) {
      setErrors(next);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      await login(code, identifier.trim(), password);
      router.replace('/(app)');
    } catch (err) {
      const statusCode = err instanceof ApiRequestError ? err.status : 0;
      const message = err instanceof Error ? err.message : 'Unable to log in.';
      const detailRaw =
        err instanceof ApiRequestError
          ? typeof err.detail === 'string'
            ? err.detail
            : JSON.stringify(err.detail ?? '')
          : String(err ?? '');
      const detail = detailRaw.toLowerCase();
      if (statusCode === 422 || detail.includes('company_code')) {
        setErrors({ company: 'Company code not found – check with your admin' });
      } else if (statusCode === 401) {
        // Backend returns the same 401 for wrong password, unknown user, or bad company code.
        const looksLikePassword =
          detail.includes('password') || detail.includes('credential');
        setErrors({
          form: looksLikePassword
            ? 'Invalid email/mobile or password. Check company code and try again.'
            : message || 'Invalid email/mobile or password. Check company code and try again.',
        });
      } else if (statusCode === 403) {
        setErrors({
          form: message || 'You do not have mobile app access.',
        });
      } else {
        setErrors({
          form: message || 'Unable to log in.',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets>
        <View>
          <View style={styles.brandRow}>
            <Text style={styles.logo}>AFBEX</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>v{APP_VERSION}</Text>
            </View>
          </View>
          <Text style={styles.tagline}>Field verification platform</Text>
        </View>

        <Text style={styles.title}>Log in</Text>

        <View style={styles.form}>
          <TextField
            label="Company code"
            value={companyCode}
            onChangeText={(v) => setCompanyCode(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="e.g. 100001"
            keyboardType="numeric"
            error={errors.company}
          />
          <Text style={styles.hint}>Provided by your organization</Text>

          <TextField
            label="Email or mobile"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="you@company.com"
            keyboardType="email-address"
            error={errors.identifier}
          />

          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            error={errors.password}
          />

          <Link href="/(auth)/forgot-password" asChild>
            <Pressable>
              <Text style={styles.forgot}>Forgot password?</Text>
            </Pressable>
          </Link>

          {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

          <PrimaryButton label="Log in" onPress={() => void onSubmit()} loading={loading} />
        </View>

        <Link href="/(auth)/otp" asChild>
          <Pressable style={styles.otpLink}>
            <Text style={styles.otpText}>Log in with OTP instead</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 24, flexGrow: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { fontSize: 28, fontWeight: '800', color: Colors.brand, letterSpacing: 0.4 },
  badge: {
    backgroundColor: Colors.brandSoft,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: Colors.brand, fontSize: 11, fontWeight: '700' },
  tagline: { marginTop: 4, color: Colors.muted, fontSize: 14 },
  title: { marginTop: 36, fontSize: 28, fontWeight: '800', color: Colors.heading },
  form: { marginTop: 24, gap: 14 },
  hint: { marginTop: -8, fontSize: 12, color: Colors.muted },
  forgot: { color: Colors.brand, fontWeight: '600', fontSize: 14 },
  formError: { color: Colors.danger, fontSize: 13 },
  otpLink: { marginTop: 'auto', paddingTop: 32, alignItems: 'center' },
  otpText: { color: Colors.heading, fontSize: 15, fontWeight: '600' },
});
