import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function OtpLoginScreen() {
  const { companyCode: savedCode, setRememberedCompany } = useAuth();
  const [companyCode, setCompanyCode] = useState(savedCode);
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);

  async function onSend() {
    await setRememberedCompany(companyCode.trim());
    setSent(true);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Log in" onBack={() => router.back()} />
      <View style={styles.body}>
        <Text style={styles.title}>Log in with OTP</Text>
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
        />
        {sent ? (
          <TextField
            label="One-time password"
            value={otp}
            onChangeText={setOtp}
            placeholder="6-digit code"
            keyboardType="numeric"
          />
        ) : null}
        <PrimaryButton
          label={sent ? 'Verify OTP' : 'Send code'}
          onPress={() => {
            if (!sent) {
              void onSend();
              return;
            }
          }}
        />
        <Text style={styles.note}>
          OTP login is shown here to match the field app. Use password login — the backend currently authenticates
          with company code, email or mobile, and password.
        </Text>
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
  note: { fontSize: 13, color: Colors.muted, lineHeight: 18 },
  link: { color: Colors.brand, fontWeight: '700', textAlign: 'center' },
});
