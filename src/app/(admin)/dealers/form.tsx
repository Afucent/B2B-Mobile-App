import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { SafeScreen } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import {
  createDealer,
  deleteDealer,
  getDealer,
  listDealerTypes,
  updateDealer,
  updateDealerStatus,
  type DealerType,
} from '@/lib/api/dealers';
import {
  listAreas,
  listCities,
  listRegions,
  listStates,
  type GeoItem,
} from '@/lib/api/geography';

const STATUSES = ['active', 'inactive'] as const;

export default function AdminDealerFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { canDelete } = usePermissions();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [dealerTypeId, setDealerTypeId] = useState('');
  const [stateId, setStateId] = useState('');
  const [cityId, setCityId] = useState('');
  const [regionId, setRegionId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('active');
  const [types, setTypes] = useState<DealerType[]>([]);
  const [states, setStates] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [regions, setRegions] = useState<GeoItem[]>([]);
  const [areas, setAreas] = useState<GeoItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      void listDealerTypes()
        .then(setTypes)
        .catch(() => setTypes([]));
      void listStates()
        .then((res) => setStates(res.items))
        .catch(() => setStates([]));
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void getDealer(id)
        .then((d) => {
          setName(d.name);
          setCode(d.code);
          setAddress(d.address ?? '');
          setContact(d.contact ?? '');
          setEmail(d.email ?? '');
          setDealerTypeId(d.dealer_type_id ?? '');
          setStateId(d.state_id ?? '');
          setCityId(d.city_id ?? '');
          setRegionId(d.region_id ?? '');
          setAreaId(d.area_id ?? '');
          setStatus(d.status === 'inactive' ? 'inactive' : 'active');
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dealer'));
    }, [id]),
  );

  useEffect(() => {
    if (!stateId) {
      setCities([]);
      return;
    }
    void listCities(stateId)
      .then((res) => setCities(res.items))
      .catch(() => setCities([]));
  }, [stateId]);

  useEffect(() => {
    if (!cityId) {
      setRegions([]);
      return;
    }
    void listRegions(cityId)
      .then((res) => setRegions(res.items))
      .catch(() => setRegions([]));
  }, [cityId]);

  useEffect(() => {
    if (!regionId) {
      setAreas([]);
      return;
    }
    void listAreas(regionId)
      .then((res) => setAreas(res.items))
      .catch(() => setAreas([]));
  }, [regionId]);

  async function submit() {
    setError('');
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!contact.trim() || !dealerTypeId || !stateId || !cityId || !regionId || !areaId) {
      setError('Contact, dealer type, and state/city/region/area are required.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        address: address.trim() || null,
        contact: contact.trim(),
        email: email.trim() || null,
        dealer_type_id: dealerTypeId,
        state_id: stateId,
        city_id: cityId,
        region_id: regionId,
        area_id: areaId,
        status,
      };
      if (isEdit && id) {
        await updateDealer(id, payload);
        await updateDealerStatus(id, status);
      } else {
        await createDealer({
          ...payload,
          code: code.trim() || undefined,
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

  function confirmDelete() {
    if (!isEdit || !id || !canDelete('dealers')) return;
    Alert.alert('Delete dealer', `Delete ${name || 'this dealer'}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void doDelete(),
      },
    ]);
  }

  async function doDelete() {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      await deleteDealer(id);
      Alert.alert('Deleted', 'Dealer removed.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequireModuleAccess module="dealers" action={isEdit ? 'read' : 'create'} allowCreate>
      <SafeScreen>
        <ScreenHeader title={isEdit ? 'Edit dealer' : 'New dealer'} onBack={() => router.back()} />
        <KeyboardSafeScrollView contentContainerStyle={styles.body}>
          <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
          <TextField label="Code" value={code} onChangeText={setCode} autoCapitalize="characters" />
          <TextField label="Address" value={address} onChangeText={setAddress} autoCapitalize="sentences" />
          <TextField label="Contact" value={contact} onChangeText={setContact} keyboardType="numeric" />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.group}>Dealer type</Text>
          <View style={styles.chips}>
            {types.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.chip, dealerTypeId === t.id && styles.chipOn]}
                onPress={() => setDealerTypeId(t.id)}>
                <Text style={[styles.chipText, dealerTypeId === t.id && styles.chipTextOn]}>
                  {t.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.group}>State</Text>
          <View style={styles.chips}>
            {states.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.chip, stateId === s.id && styles.chipOn]}
                onPress={() => {
                  setStateId(s.id);
                  setCityId('');
                  setRegionId('');
                  setAreaId('');
                }}>
                <Text style={[styles.chipText, stateId === s.id && styles.chipTextOn]}>{s.name}</Text>
              </Pressable>
            ))}
          </View>

          {stateId ? (
            <>
              <Text style={styles.group}>City</Text>
              <View style={styles.chips}>
                {cities.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[styles.chip, cityId === c.id && styles.chipOn]}
                    onPress={() => {
                      setCityId(c.id);
                      setRegionId('');
                      setAreaId('');
                    }}>
                    <Text style={[styles.chipText, cityId === c.id && styles.chipTextOn]}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {cityId ? (
            <>
              <Text style={styles.group}>Region</Text>
              <View style={styles.chips}>
                {regions.map((r) => (
                  <Pressable
                    key={r.id}
                    style={[styles.chip, regionId === r.id && styles.chipOn]}
                    onPress={() => {
                      setRegionId(r.id);
                      setAreaId('');
                    }}>
                    <Text style={[styles.chipText, regionId === r.id && styles.chipTextOn]}>{r.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {regionId ? (
            <>
              <Text style={styles.group}>Area</Text>
              <View style={styles.chips}>
                {areas.map((a) => (
                  <Pressable
                    key={a.id}
                    style={[styles.chip, areaId === a.id && styles.chipOn]}
                    onPress={() => setAreaId(a.id)}>
                    <Text style={[styles.chipText, areaId === a.id && styles.chipTextOn]}>{a.name}</Text>
                  </Pressable>
                ))}
              </View>
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
          {isEdit && canDelete('dealers') ? (
            <OutlineButton label="Delete dealer" onPress={confirmDelete} disabled={busy} />
          ) : null}
        </KeyboardSafeScrollView>
      </SafeScreen>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, gap: Spacing.md },
  group: { color: Colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  chipOn: { backgroundColor: Colors.brandSoft, borderColor: Colors.brandSoft },
  chipText: { color: Colors.heading, fontWeight: '600', fontSize: 13, textTransform: 'capitalize' },
  chipTextOn: { color: Colors.brandDark },
  error: { color: Colors.danger },
});
