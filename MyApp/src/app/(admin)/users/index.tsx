import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getUserFilterOptions,
  listAssignableRoles,
  listUsers,
  type AdminUser,
  type RoleOption,
} from '@/lib/api/users';
import { formatRoleName } from '@/lib/permissions';
const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending_activation', label: 'Pending' },
] as const;

export default function AdminUsersScreen() {
  const { canCreate } = usePermissions();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [roleId, setRoleId] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadFilters = useCallback(async () => {
    try {
      const [roleRes, filterRes] = await Promise.all([
        listAssignableRoles().catch(() => [] as RoleOption[]),
        getUserFilterOptions().catch(() => ({ cities: [] as string[], areas: [] as string[] })),
      ]);
      setRoles(roleRes.filter((r) => normalizeForFilter(r.name)));
      setCities(filterRes.cities);
      setAreas(filterRes.areas);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(
    async (pageOffset = 0) => {
      setError('');
      setLoading(true);
      try {
        const res = await listUsers(pageOffset, PAGE_SIZE, {
          search: search || undefined,
          status: status || undefined,
          role_id: roleId || undefined,
          city: city || undefined,
          area: area || undefined,
        });
        setItems(res.items);
        setTotal(res.total);
        setOffset(pageOffset);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    },
    [search, status, roleId, city, area],
  );

  useFocusEffect(
    useCallback(() => {
      void loadFilters();
      const t = setTimeout(() => void load(0), 300);
      return () => clearTimeout(t);
    }, [load, loadFilters]),
  );

  const pageLabel = useMemo(() => {
    if (total === 0) return '0 users';
    const from = offset + 1;
    const to = Math.min(offset + PAGE_SIZE, total);
    return `${from}–${to} of ${total}`;
  }, [offset, total]);

  const filterRoles = useMemo(
    () =>
      roles.filter((r) => {
        const key = r.name.trim().toLowerCase().replace(/\s+/g, '_');
        return key !== 'tenant_member' && key !== 'platform_super_admin';
      }),
    [roles],
  );

  return (
    <RequireModuleAccess module="users" allowCreate>
      <View style={styles.flex}>
        <ScreenHeader title="Users" onBack={() => router.back()} />
        <View style={styles.body}>
          <TextField
            label="Search"
            value={search}
            onChangeText={setSearch}
            placeholder="Name or email"
            autoCapitalize="none"
          />

          <Text style={styles.group}>Status</Text>
          <ChipRow
            options={STATUS_OPTIONS.map((o) => o.value)}
            labels={STATUS_OPTIONS.map((o) => o.label)}
            value={status}
            onChange={setStatus}
          />

          <Text style={styles.group}>Role</Text>
          <ChipRow
            options={['', ...filterRoles.map((r) => r.id)]}
            labels={['All roles', ...filterRoles.map((r) => formatRoleName(r.name))]}
            value={roleId}
            onChange={setRoleId}
          />

          {cities.length > 0 ? (
            <>
              <Text style={styles.group}>City</Text>
              <ChipRow
                options={['', ...cities]}
                labels={['All cities', ...cities]}
                value={city}
                onChange={(v) => {
                  setCity(v);
                  setArea('');
                }}
              />
            </>
          ) : null}

          {areas.length > 0 ? (
            <>
              <Text style={styles.group}>Area</Text>
              <ChipRow
                options={['', ...areas]}
                labels={['All areas', ...areas]}
                value={area}
                onChange={setArea}
              />
            </>
          ) : null}

          {canCreate('users') ? (
            <OutlineButton label="Add user" onPress={() => router.push('/(admin)/users/new')} />
          ) : null}

          <Text style={styles.meta}>{pageLabel}</Text>
          {loading ? <Text style={styles.meta}>Loading…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xl }}
            ListEmptyComponent={!loading ? <Text style={styles.meta}>No users found.</Text> : null}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push({ pathname: '/(admin)/users/[id]', params: { id: item.id } })
                }>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.sub}>{item.personal_email}</Text>
                  <Text style={styles.sub}>
                    {[item.roles?.[0] ? formatRoleName(item.roles[0].name) : null, item.city]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                    {item.access_surface ? ` · ${item.access_surface}` : ''}
                  </Text>
                </View>
                <Text style={styles.status}>{item.status.replace(/_/g, ' ')}</Text>
              </Pressable>
            )}
          />

          <View style={styles.pager}>
            <OutlineButton
              label="Prev"
              onPress={() => void load(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || loading}
            />
            <OutlineButton
              label="Next"
              onPress={() => void load(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total || loading}
            />
          </View>
        </View>
      </View>
    </RequireModuleAccess>
  );
}

function normalizeForFilter(name: string) {
  const key = name.trim().toLowerCase().replace(/\s+/g, '_');
  return key !== 'tenant_member' && key !== 'platform_super_admin';
}

function ChipRow({
  options,
  labels,
  value,
  onChange,
}: {
  options: string[];
  labels: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((opt, i) => {
        const on = value === opt;
        return (
          <Pressable
            key={`${labels[i]}-${opt || 'all'}`}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => onChange(opt)}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{labels[i]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { flex: 1, padding: Spacing.md, gap: Spacing.sm },
  group: { color: Colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  chipOn: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipText: { color: Colors.heading, fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: { fontWeight: '700', color: Colors.heading },
  sub: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  status: {
    color: Colors.brand,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'capitalize',
    maxWidth: 90,
    textAlign: 'right',
  },
  pager: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.md },
});
