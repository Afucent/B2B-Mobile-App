import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getOrgProfile, updateOrgProfile, type OrgProfile } from '@/lib/api/tenantOrg';
import { uploadMedia } from '@/lib/api/uploads';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OrgProfileScreen() {
  const { canEdit } = usePermissions();
  const { refresh } = useAuth();
  const editable = canEdit('organization');
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('');
  const [domainEmail, setDomainEmail] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoViewerVisible, setLogoViewerVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setError('');
      void getOrgProfile()
        .then((data) => {
          setProfile(data);
          setDescription(data.company_description ?? '');
          setDomain(data.domain_name ?? '');
          setDomainEmail(data.domain_email ?? '');
          setLogo(resolveMediaUrl(data.logo_url));
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
        .finally(() => setLoading(false));
    }, []),
  );

  function startEditing() {
    setError('');
    setMessage('');
    setEditing(true);
  }

  function cancelEditing() {
    if (!profile) return;
    setDescription(profile.company_description ?? '');
    setDomain(profile.domain_name ?? '');
    setDomainEmail(profile.domain_email ?? '');
    setLogo(resolveMediaUrl(profile.logo_url));
    setError('');
    setMessage('');
    setEditing(false);
  }

  async function pickLogo() {
    if (!editable || !editing) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Photo access needed', 'Allow photo access to update the company logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled) return;
    setUploading(true);
    setError('');
    try {
      setLogo(await uploadMedia(result.assets[0].uri, 'company-logo.jpg'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload logo.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!profile || !editable || !editing) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateOrgProfile({
        company_description: description,
        domain_name: domain.trim() || null,
        domain_email: domainEmail.trim() || null,
        logo_url: logo,
      });
      setProfile(updated);
      setDescription(updated.company_description ?? '');
      setDomain(updated.domain_name ?? '');
      setDomainEmail(updated.domain_email ?? '');
      setLogo(resolveMediaUrl(updated.logo_url));
      await refresh();
      setMessage('Changes saved successfully.');
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }
  const insets = useSafeAreaInsets();
  const handleLogoPress = () => {
    if (!editing && logo) setLogoViewerVisible(true);
  };

  return (
    <RequireModuleAccess module="organization">
      <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
        <ScreenHeader title="Organisation profile" onBack={() => router.back()} />
        {loading ? (
          <View style={styles.centered}><ActivityIndicator color={Colors.brand} /></View>
        ) : !profile ? (
          <Text style={styles.error}>{error || 'Profile not found.'}</Text>
        ) : (
          <KeyboardSafeScrollView contentContainerStyle={styles.body}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Organization Profile</Text>
              {editable && !editing ? (
                <Pressable onPress={startEditing} style={styles.editButton}>
                  <Ionicons name="pencil-outline" size={16} color={Colors.heading} />
                  <Text style={styles.editLabel}>Edit</Text>
                </Pressable>
              ) : null}
            </View>

            <Section title="Company Logo">
              <View style={styles.logoRow}>
                <Pressable onPress={handleLogoPress} disabled={editing || !logo} style={styles.logoWrap} accessibilityRole="button" accessibilityLabel="View company logo">
                  {logo ? <Image source={{ uri: logo }} style={styles.logo} contentFit="cover" /> : <Text style={styles.initials}>{initials(profile.name)}</Text>}
                  {editable && editing ? (
                    <Pressable onPress={() => void pickLogo()} style={styles.cameraButton} disabled={uploading}>
                      {uploading ? <ActivityIndicator size="small" color={Colors.heading} /> : <Ionicons name="camera-outline" size={17} color={Colors.heading} />}
                    </Pressable>
                  ) : null}
                </Pressable>
              </View>
            </Section>

            <Section title="Organisation Details">
              <View style={styles.detailGrid}>
                <ReadField label="Company name" value={profile.name} />
                <ReadField label="Company code" value={profile.company_code} mono />
                <ReadField label="Industry" value={profile.industry_label || '—'} />
                <ReadField label="Status" value={profile.status || '—'} badge />
                <ReadField label="Admin name" value={profile.admin?.name || '—'} />
                <ReadField label="Admin email" value={profile.admin?.personal_email || '—'} />
                <ReadField label="Admin phone" value={profile.admin?.mobile ? `+91 ${profile.admin.mobile}` : '—'} />
                <ReadField label="Admin designation" value={profile.admin?.designation || '—'} />
                <ReadField label="Business address" value={profile.registered_address || '—'} full />
              </View>
            </Section>

            <Section title="Company Information">
              <TextField label="Company description" value={description} onChangeText={setDescription} autoCapitalize="sentences" editable={editable && editing} multiline />
            </Section>

            <Section title="Domain Information">
              <TextField label="Domain / Website" value={domain} onChangeText={setDomain} placeholder="acme.com" editable={editable && editing} />
              <TextField label="Domain email" value={domainEmail} onChangeText={setDomainEmail} keyboardType="email-address" placeholder="noreply@acme.com" editable={editable && editing} />
            </Section>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {message ? <Text style={styles.success}>{message}</Text> : null}
            {editable && editing ? (
              <View style={styles.actions}>
                <PrimaryButton label="Save Changes" onPress={() => void save()} loading={saving} />
                <Pressable onPress={cancelEditing} style={styles.cancelButton} disabled={saving}>
                  <Text style={styles.cancelLabel}>Cancel</Text>
                </Pressable>
              </View>
            ) : null}
          </KeyboardSafeScrollView>
        )}
        <Modal visible={logoViewerVisible} transparent animationType="fade" onRequestClose={() => setLogoViewerVisible(false)}>
          <View style={[styles.viewerBackdrop, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.sm }]}>
            <Pressable onPress={() => setLogoViewerVisible(false)} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close company logo" />
            <View style={styles.viewerContent}>
              {logo ? <Image source={{ uri: logo }} style={styles.viewerImage} contentFit="cover" /> : null}
              <Text numberOfLines={1} style={styles.viewerName}>{profile?.name || 'Company logo'}</Text>
            </View>
          </View>
        </Modal>
      </View>
    </RequireModuleAccess>
  );
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.sectionBody}>{children}</View></View>;
}

function ReadField({ label, value, mono, badge, full }: { label: string; value: string; mono?: boolean; badge?: boolean; full?: boolean }) {
  return <View style={[styles.readField, full && styles.fullField]}><Text style={styles.readLabel}>{label}</Text>{badge ? <Text style={styles.badge}>{value}</Text> : <Text style={[styles.readValue, mono && styles.mono]}>{value}</Text>}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  title: { flex: 1, color: Colors.heading, fontSize: 21, fontWeight: '800' },
  editButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 13, backgroundColor: Colors.background },
  editLabel: { color: Colors.heading, fontSize: 14, fontWeight: '700' },
  section: { borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, padding: Spacing.md, gap: Spacing.md },
  sectionTitle: { color: Colors.heading, fontSize: 15, fontWeight: '800' },
  sectionBody: { gap: Spacing.md },
  logoRow: { alignItems: 'flex-start' },
  logoWrap: { width: 96, height: 96, position: 'relative', borderRadius: 48, backgroundColor: Colors.brandSoft },
  logo: { width: 96, height: 96, borderRadius: 48 },
  initials: { width: 96, height: 96, borderRadius: 48, textAlign: 'center', textAlignVertical: 'center', backgroundColor: Colors.brand, color: Colors.background, fontSize: 28, fontWeight: '800', overflow: 'hidden' },
  cameraButton: { position: 'absolute', right: -3, bottom: -3, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, elevation: 2 },
  viewerBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.94)', paddingHorizontal: Spacing.md },
  viewerContent: { width: '100%', alignItems: 'center' },
  viewerImage: { width: '86%', aspectRatio: 1, marginVertical: Spacing.lg, borderRadius: 999, overflow: 'hidden', backgroundColor: Colors.brandSoft },
  viewerName: { color: Colors.background, fontSize: 17, fontWeight: '700' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.md, rowGap: Spacing.md },
  readField: { width: '47%' },
  fullField: { width: '100%' },
  readLabel: { color: Colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
  readValue: { marginTop: 5, color: Colors.heading, fontSize: 14, lineHeight: 20 },
  mono: { fontFamily: 'monospace' },
  badge: { alignSelf: 'flex-start', marginTop: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: Colors.successBg, color: Colors.successText, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  actions: { gap: Spacing.sm },
  cancelButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.background },
  cancelLabel: { color: Colors.heading, fontSize: 16, fontWeight: '700' },
  error: { color: Colors.danger, fontSize: 13, lineHeight: 19 },
  success: { color: Colors.successText, fontSize: 13, lineHeight: 19 },
});
