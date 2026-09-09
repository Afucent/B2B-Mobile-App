import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import TabModuleLinks from '@/components/TabModuleLinks';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { changePassword, updateProfile, type MeResponse } from '@/lib/api/auth';
import { uploadMedia } from '@/lib/api/uploads';
import { isEmail, isMobileNumber, passwordChecks } from '@/lib/format';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { formatRoleName, isFieldTrackingEnabled } from '@/lib/permissions';
import { buildProfileTabSections } from '@/lib/tabNavigation';
import { usePermissions } from '@/hooks/usePermissions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ProfileForm = {
    name: string;
    email: string;
    mobile: string;
    designation: string;
    department: string;
    address: string;
    area: string;
    city: string;
    state: string;
    country: string;
    pinCode: string;
};

const emptyForm: ProfileForm = {
    name: '', email: '', mobile: '', designation: '', department: '', address: '', area: '',
    city: '', state: '', country: 'India', pinCode: '',
};

function formFromUser(user: MeResponse): ProfileForm {
    return {
        name: user.name ?? '', email: user.personal_email ?? '', mobile: user.mobile ?? '',
        designation: user.designation ?? '', department: user.department ?? '', address: user.address ?? '',
        area: user.area ?? '', city: user.city ?? '', state: user.state ?? '', country: user.country ?? 'India',
        pinCode: user.pin_code ?? '',
    };
}

export default function ProfileScreen() {
    const { user, refresh } = useAuth();
    const [form, setForm] = useState<ProfileForm>(emptyForm);
    const [avatar, setAvatar] = useState<string | null>(null);
    const [avatarViewerVisible, setAvatarViewerVisible] = useState(false);
    const [editing, setEditing] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [profileMessage, setProfileMessage] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const passwordRequirements = useMemo(() => passwordChecks(newPassword), [newPassword]);
      const { canView, canCreate, canManage } = usePermissions();
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (!user) return;
        setForm(formFromUser(user));
        setAvatar(resolveMediaUrl(user.avatar_url));
    }, [user]);

    function patch<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
        setForm((previous) => ({ ...previous, [key]: value }));
    }

    function startEditing() {
        setProfileError(''); setProfileMessage(''); setFieldErrors({}); setEditing(true);
    }

    function cancelEditing() {
        if (user) { setForm(formFromUser(user)); setAvatar(resolveMediaUrl(user.avatar_url)); }
        setProfileError(''); setProfileMessage(''); setFieldErrors({}); setEditing(false);
    }
    const sections = buildProfileTabSections({
        canView,
        canCreate,
        canManage,
        fieldTrackingEnabled: isFieldTrackingEnabled    (user?.organization?.enabled_modules),
    });
    async function pickAvatar() {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
            Alert.alert('Photo access needed', 'Allow photo access to update your profile picture.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        if (result.canceled) return;
        setUploadingAvatar(true); setProfileError('');
        try {
            const url = await uploadMedia(result.assets[0].uri, 'avatar.jpg');
            await updateProfile({ avatar_url: url });
            setAvatar(resolveMediaUrl(url));
            await refresh();
            setProfileMessage('Profile photo updated.');
        } catch (error) {
            setProfileError(error instanceof Error ? error.message : 'Failed to update photo.');
        } finally { setUploadingAvatar(false); }
    }

    async function saveProfile() {
        const errors: Record<string, string> = {};
        if (!form.name.trim()) errors.name = 'Name is required.';
        if (!isEmail(form.email)) errors.email = 'Enter a valid email address.';
        if (form.mobile && !isMobileNumber(form.mobile)) errors.mobile = 'Enter a valid 10-digit mobile number.';
        setFieldErrors(errors); setProfileError(''); setProfileMessage('');
        if (Object.keys(errors).length) return;
        setSavingProfile(true);
        try {
            await updateProfile({
                name: form.name.trim(), personal_email: form.email.trim(), mobile: form.mobile.trim() || null,
                designation: form.designation.trim() || null, department: form.department.trim() || null,
                address: form.address.trim() || null, area: form.area.trim() || null, city: form.city.trim() || null,
                state: form.state.trim() || null, country: form.country.trim() || null, pin_code: form.pinCode.trim() || null,
            });
            await refresh(); setProfileMessage('Profile updated successfully.'); setEditing(false);
        } catch (error) {
            setProfileError(error instanceof Error ? error.message : 'Failed to update profile.');
        } finally { setSavingProfile(false); }
    }

    async function savePassword() {
        setPasswordError(''); setPasswordMessage('');
        if (!currentPassword || !newPassword || !confirmPassword) { setPasswordError('Complete all password fields.'); return; }
        if (newPassword === currentPassword) { setPasswordError('New password must be different from your current password.'); return; }
        if (newPassword.length < 8 || !passwordRequirements.number || !passwordRequirements.uppercase) { setPasswordError('Password does not meet the requirements.'); return; }
        if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return; }
        setSavingPassword(true);
        try {
            await changePassword({ current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword });
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordMessage('Password updated successfully.');
        } catch (error) {
            setPasswordError(error instanceof Error ? error.message : 'Failed to change password.');
        } finally { setSavingPassword(false); }
    }

    const role = user?.roles?.map((item) => formatRoleName(item.name)).join(', ') || 'Team member';
    const handleAvatarPress = () => {
        if (editing) {
            void pickAvatar();
            return;
        }
        if (avatar) setAvatarViewerVisible(true);
    };

    return (
        <View style={styles.flex}>
            <ScreenHeader title="My Profile" onBack={() => router.back()} right={
                <Pressable onPress={() => router.push('/settings')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Settings">
                    <Ionicons name="settings-outline" size={21} color={Colors.heading} />
                </Pressable>
            } />
            <KeyboardSafeScrollView contentContainerStyle={styles.content}>
                <View style={styles.hero}>
                    <Pressable onPress={handleAvatarPress} disabled={uploadingAvatar} style={styles.avatarButton} accessibilityRole="button" accessibilityLabel={editing ? 'Change profile photo' : 'View profile photo'}>
                        {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" /> :
                            <View style={styles.avatarFallback}><Text style={styles.avatarText}>{(user?.name ?? 'A').slice(0, 1).toUpperCase()}</Text></View>}
                        {editing ? <View style={styles.cameraBadge}><Ionicons name="camera" size={15} color={Colors.background} /></View> : null}
                    </Pressable>
                    <Text style={styles.name}>{user?.name || 'Team member'}</Text>
                    <Text style={styles.role}>{role}</Text>
                    {uploadingAvatar ? <Text style={styles.helper}>Uploading photo...</Text> : null}
                </View>

                <Section title="Profile information" action={
                    <Pressable onPress={editing ? cancelEditing : startEditing} style={styles.editButton}>
                        <Ionicons name="pencil-outline" size={16} color={Colors.heading} />
                        <Text style={styles.editLabel}>{editing ? 'Cancel' : 'Edit'}</Text>
                    </Pressable>
                }>
                    <TextField label="Name" value={form.name} onChangeText={(value) => patch('name', value)} editable={editing} error={fieldErrors.name} autoCapitalize="words" />
                    <TextField label="Email" value={form.email} onChangeText={(value) => patch('email', value)} editable={editing} error={fieldErrors.email} keyboardType="email-address" />
                    <TextField label="Mobile" value={form.mobile} onChangeText={(value) => patch('mobile', value.replace(/\D/g, '').slice(0, 10))} editable={editing} error={fieldErrors.mobile} keyboardType="numeric" />
                    <TextField label="Designation" value={form.designation} onChangeText={(value) => patch('designation', value)} editable={editing} autoCapitalize="words" />
                    <TextField label="Department" value={form.department} onChangeText={(value) => patch('department', value)} editable={editing} autoCapitalize="words" />
                    <TextField label="Address" value={form.address} onChangeText={(value) => patch('address', value)} editable={editing} autoCapitalize="sentences" />
                    <View style={styles.twoColumns}>
                        <View style={styles.column}><TextField label="Area" value={form.area} onChangeText={(value) => patch('area', value)} editable={editing} autoCapitalize="words" /></View>
                        <View style={styles.column}><TextField label="City" value={form.city} onChangeText={(value) => patch('city', value)} editable={editing} autoCapitalize="words" /></View>
                    </View>
                    <View style={styles.twoColumns}>
                        <View style={styles.column}><TextField label="State" value={form.state} onChangeText={(value) => patch('state', value)} editable={editing} autoCapitalize="words" /></View>
                        <View style={styles.column}><TextField label="Pin code" value={form.pinCode} onChangeText={(value) => patch('pinCode', value.replace(/\D/g, '').slice(0, 10))} editable={editing} keyboardType="numeric" /></View>
                    </View>
                    <TextField label="Country" value={form.country} onChangeText={(value) => patch('country', value)} editable={editing} autoCapitalize="words" />
                    {editing ? <PrimaryButton label="Save profile" onPress={() => void saveProfile()} loading={savingProfile} /> : null}
                    {profileError ? <Text style={styles.error}>{profileError}</Text> : null}
                    {profileMessage ? <Text style={styles.success}>{profileMessage}</Text> : null}
                </Section>

                <Section title="Account details">
                    <InfoRow label="Role" value={role} />
                    <InfoRow label="Company code" value={user?.organization?.company_code ?? '—'} />
                    <InfoRow label="Status" value={user?.status ?? '—'} last />
                </Section>

                <Section title="Change password">
                    <TextField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
                    <TextField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
                    <TextField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
                    <View style={styles.requirements}>
                        <Text style={styles.requirementsTitle}>Password requirements</Text>
                        <Requirement ok={passwordRequirements.length} label="8+ characters" />
                        <Requirement ok={passwordRequirements.number} label="At least one number" />
                        <Requirement ok={passwordRequirements.uppercase} label="At least one uppercase letter" />
                    </View>
                    {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
                    {passwordMessage ? <Text style={styles.success}>{passwordMessage}</Text> : null}
                    <PrimaryButton label="Update password" onPress={() => void savePassword()} loading={savingPassword} />
                </Section>
                <TabModuleLinks sections={sections} />
            </KeyboardSafeScrollView>
            <Modal visible={avatarViewerVisible} transparent animationType="fade" onRequestClose={() => setAvatarViewerVisible(false)}>
                <View style={[styles.viewerBackdrop, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.sm }]}>
                    <Pressable onPress={() => setAvatarViewerVisible(false)} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close profile photo" />
                    <View style={styles.viewerContent}>
                        {avatar ? <Image source={{ uri: avatar }} style={styles.viewerImage} contentFit="cover" /> : null}
                        <Text numberOfLines={1} style={styles.viewerName}>{user?.name || 'Team member'}</Text>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
    return <View style={styles.section}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action}</View><View style={styles.card}>{children}</View></View>;
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
    return <View style={[styles.infoRow, !last && styles.rowBorder]}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function Requirement({ ok, label }: { ok: boolean; label: string }) {
    return <View style={styles.requirementRow}><Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={ok ? Colors.success : Colors.muted} /><Text style={[styles.requirementText, ok && styles.requirementTextOk]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: Colors.surface },
    content: { paddingHorizontal: Spacing.md, paddingBottom: 40, gap: Spacing.lg },
    hero: { alignItems: 'center', paddingTop: 8, gap: 6 },
    avatarButton: { position: 'relative', marginBottom: 4 },
    avatar: { width: 96, height: 96, borderRadius: 48 },
    avatarFallback: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: Colors.brand, fontSize: 34, fontWeight: '800' },
    cameraBadge: { position: 'absolute', right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.surface },
    viewerBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.94)', paddingHorizontal: Spacing.md },
    viewerContent: { width: '100%', alignItems: 'center' },
    viewerImage: { width: '86%', aspectRatio: 1, marginVertical: Spacing.lg, borderRadius: 999, overflow: 'hidden', backgroundColor: Colors.brandSoft },
    viewerName: { color: Colors.background, fontSize: 17, fontWeight: '700' },
    name: { color: Colors.heading, fontSize: 23, fontWeight: '800' },
    role: { color: Colors.muted, fontSize: 14 },
    helper: { color: Colors.muted, fontSize: 12 },
    section: { gap: 8 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { color: Colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
    editButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    editLabel: { color: Colors.heading, fontSize: 12, fontWeight: '800' },
    card: { backgroundColor: Colors.background, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md },
    twoColumns: { flexDirection: 'row', gap: Spacing.md },
    column: { flex: 1 },
    infoRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
    infoLabel: { color: Colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
    infoValue: { color: Colors.heading, fontSize: 15, fontWeight: '700', flex: 1.2, textAlign: 'right' },
    requirements: { gap: 6 },
    requirementsTitle: { color: Colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 },
    requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    requirementText: { color: Colors.muted, fontSize: 13 },
    requirementTextOk: { color: Colors.successText },
    error: { color: Colors.danger, fontSize: 13 },
    success: { color: Colors.successText, fontSize: 13 },
});