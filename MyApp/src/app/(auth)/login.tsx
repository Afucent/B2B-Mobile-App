import { Link, Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { APP_VERSION, Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { ApiRequestError } from '@/lib/api/client';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { status, login, companyCode: savedCode } = useAuth();
  const [companyCode, setCompanyCode] = useState(savedCode);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ company?: string; password?: string; form?: string }>({});

  useEffect(() => {
    if (savedCode) setCompanyCode(savedCode);
  }, [savedCode]);

  if (status === 'signedIn') {
    return <Redirect href="/(app)" />;
  }

  async function onSubmit() {
    const code = companyCode.trim();
    const next: typeof errors = {};
    if (!/^\d{6}$/.test(code)) {
      next.company = 'Company code not found – check with your admin';
    }
    if (!identifier.trim()) next.form = 'Enter your email or mobile.';
    if (!password) next.password = 'Incorrect password';
    if (next.company || next.form || next.password) {
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
      const detail =
        err instanceof ApiRequestError
          ? JSON.stringify(err.detail ?? '')
          : String(err ?? '');
      if (statusCode === 422 || detail.includes('company_code')) {
        setErrors({ company: 'Company code not found – check with your admin' });
      } else if (statusCode === 401) {
        setErrors({ password: 'Incorrect password' });
      } else if (statusCode === 403) {
        setErrors({
          form: err instanceof Error ? err.message : 'This app is for organization employees only.',
        });
      } else {
        setErrors({
          form: err instanceof Error ? err.message : 'Unable to log in.',
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
        keyboardShouldPersistTaps="handled">
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
            onChangeText={setCompanyCode}
            placeholder="e.g. 100001"
            autoCapitalize="characters"
            error={errors.company}
          />
          <Text style={styles.hint}>Provided by your organization</Text>

          <TextField
            label="Email or mobile"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="you@company.com"
            keyboardType="email-address"
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
