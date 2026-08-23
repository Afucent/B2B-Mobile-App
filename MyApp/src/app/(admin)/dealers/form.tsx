import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  createDealer,
  getDealer,
  updateDealer,
  updateDealerStatus,
} from '@/lib/api/dealers';

const STATUSES = ['active', 'inactive'] as const;

export default function AdminDealerFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
  const [dealerTypeId, setDealerTypeId] = useState('');
  const [stateId, setStateId] = useState('');
  const [cityId, setCityId] = useState('');
  const [regionId, setRegionId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void getDealer(id)
        .then((d) => {
          setName(d.name);
          setCode(d.code);
          setAddress(d.address ?? '');
          setContact(d.contact ?? '');
          setStatus(d.status === 'inactive' ? 'inactive' : 'active');
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dealer'));
    }, [id]),
  );

  async function submit() {
    setError('');
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setBusy(true);
    try {
      if (isEdit && id) {
        await updateDealer(id, {
          name: name.trim(),
          address: address.trim() || null,
          contact: contact.trim() || undefined,
          status,
        });
        await updateDealerStatus(id, status);
      } else {
        if (!contact.trim() || !dealerTypeId || !stateId || !cityId || !regionId || !areaId) {
          setError('Create needs contact, dealer type id, and state/city/region/area ids.');
          setBusy(false);
          return;
        }
        await createDealer({
          name: name.trim(),
          code: code.trim() || undefined,
          address: address.trim() || null,
          contact: contact.trim(),
          dealer_type_id: dealerTypeId.trim(),
          state_id: stateId.trim(),
          city_id: cityId.trim(),
          region_id: regionId.trim(),
          area_id: areaId.trim(),
          status,
        });
      }
      Alert.alert('Saved', isEdit ? 'Dealer updated.' : 'Dealer created.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequireModuleAccess module="dealers" action={isEdit ? 'read' : 'create'} allowCreate>
      <View style={styles.flex}>
      <ScreenHeader title={isEdit ? 'Edit dealer' : 'New dealer'} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <TextField label="Code" value={code} onChangeText={setCode} autoCapitalize="characters" />
        <TextField label="Address" value={address} onChangeText={setAddress} autoCapitalize="sentences" />
        <TextField label="Contact" value={contact} onChangeText={setContact} keyboardType="numeric" />

        {!isEdit ? (
          <>
            <Text style={styles.hint}>Backend also requires type + geography UUIDs on create.</Text>
            <TextField label="Dealer type id" value={dealerTypeId} onChangeText={setDealerTypeId} />
            <TextField label="State id" value={stateId} onChangeText={setStateId} />
            <TextField label="City id" value={cityId} onChangeText={setCityId} />
            <TextField label="Region id" value={regionId} onChangeText={setRegionId} />
            <TextField label="Area id" value={areaId} onChangeText={setAreaId} />
          </>
        ) : null}

        <Text style={styles.group}>Status</Text>
        <View style={styles.chips}>
          {STATUSES.map((s) => (
            <Pressable
              key={s}
              style={[styles.chip, status === s && styles.chipOn]}
              onPress={() => setStatus(s)}>
              <Text style={[styles.chipText, status === s && styles.chipTextOn]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Save" onPress={() => void submit()} loading={busy} />
      </ScrollView>
    </View>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  hint: { color: Colors.muted, fontSize: 12 },
  group: { color: Colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  chips: { flexDirection: 'row', gap: Spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  chipOn: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipText: { color: Colors.heading, fontWeight: '600', fontSize: 13, textTransform: 'capitalize' },
  chipTextOn: { color: '#fff' },
  error: { color: Colors.danger },
});
