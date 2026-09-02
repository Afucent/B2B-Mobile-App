import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { setRequiredPassword } from '@/lib/api/auth';
import { ApiRequestError } from '@/lib/api/client';

interface FirstLoginPasswordModalProps {
  visible: boolean;
  onComplete: () => void;
  onDismiss?: () => void;
}

export function FirstLoginPasswordModal({
  visible,
  onComplete,
  onDismiss,
}: FirstLoginPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit() {
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await setRequiredPassword(newPassword, confirmPassword);
      setNewPassword('');
      setConfirmPassword('');
      onComplete();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Failed to update password. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => onDismiss?.()}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Set your password</Text>
            <Pressable
              onPress={() => onDismiss?.()}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={Colors.muted} />
            </Pressable>
          </View>
          <Text style={styles.copy}>
            You signed in with a one-time code. Create a new password to secure your account.
          </Text>

          <TextField
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 8 characters"
            secureTextEntry
          />
          <TextField
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter password"
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton label="Update password" onPress={() => void onSubmit()} loading={loading} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginRight: -4,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.heading,
  },
  copy: {
    fontSize: 14,
    color: Colors.muted,
    lineHeight: 20,
  },
  error: {
    color: Colors.danger,
    fontSize: 13,
  },
});
