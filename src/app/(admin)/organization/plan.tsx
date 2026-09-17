import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { SafeScreen, useContentBottomInset } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill, statusTone } from '@/components/ui/StatusPill';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getOrgProfile, requestPlanUpgrade, type OrgProfile } from '@/lib/api/tenantOrg';

export default function OrgPlanScreen() {
  const bottomInset = useContentBottomInset();
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setError('');
      void getOrgProfile()
        .then(setProfile)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
        .finally(() => setLoading(false));
    }, []),
  );

  async function requestUpgrade() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await requestPlanUpgrade();
      setMessage(res.message || 'Upgrade request submitted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequireModuleAccess module="organization">
      <SafeScreen>
        <ScreenHeader title="Organisation plan" onBack={() => router.back()} />
        <View style={[styles.body, { paddingBottom: bottomInset }]}>
          {loading ? <Text style={styles.meta}>Loading plan details…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}

          {!loading && !profile && !error ? (
            <Text style={styles.empty}>Plan details are not available right now.</Text>
          ) : null}

          <View style={styles.card}>
            <Row label="Plan" value={profile?.plan_name ?? '—'} />
            <Row
              label="Duration"
              value={
                profile?.plan_duration_months != null
                  ? `${profile.plan_duration_months} months`
                  : '—'
              }
            />
            <View style={styles.field}>
              <Text style={styles.label}>Status</Text>
              {profile?.status ? (
                <StatusPill label={profile.status} tone={statusTone(profile.status)} />
              ) : (
                <Text style={styles.value}>—</Text>
              )}
            </View>
          </View>

          <OutlineButton
            label="Request plan upgrade"
            onPress={() => void requestUpgrade()}
            disabled={busy || loading}
          />
        </View>
      </SafeScreen>
    </RequireModuleAccess>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.field, !last && styles.fieldBorder]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, gap: Spacing.md },
  meta: { color: Colors.muted, fontSize: 13 },
  empty: { color: Colors.muted, fontSize: 13, lineHeight: 20 },
  error: { color: Colors.danger },
  success: { color: Colors.success, fontWeight: '600' },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  field: { padding: Spacing.md + 2, gap: 6 },
  fieldBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  label: { color: Colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  value: { color: Colors.heading, fontWeight: '600', fontSize: 16 },
});
