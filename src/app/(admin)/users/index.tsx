import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { SafeScreen, useContentBottomInset } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill, statusTone } from '@/components/ui/StatusPill';
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
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending_activation', label: 'Pending' },
] as const;

export default function AdminUsersScreen() {
  const bottomInset = useContentBottomInset();
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
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  const activeFilterCount = [roleId, city, area].filter(Boolean).length;

  function clearAdvancedFilters() {
    setRoleId('');
    setCity('');
    setArea('');
  }

  return (
    <RequireModuleAccess module="users" allowCreate>
      <SafeScreen>
        <ScreenHeader
          title="Users"
          onBack={() => router.back()}
          right={
            canCreate('users') ? (
              <Pressable
                onPress={() => router.push('/(admin)/users/new')}
                hitSlop={8}
                style={styles.headerAdd}
                accessibilityRole="button"
                accessibilityLabel="Add user">
                <Ionicons name="add" size={22} color={Colors.brand} />
              </Pressable>
            ) : null
          }
        />
        <View style={styles.body}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: Spacing.sm, paddingBottom: bottomInset + 56 }}
            ListHeaderComponent={
              <View style={styles.headerBlock}>
                <TextField
                  label="Search"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Name or email"
                  autoCapitalize="none"
                />

                <Text style={styles.filterLabel}>Status</Text>
                <View style={styles.chipRow}>
                  {STATUS_OPTIONS.map((opt) => {
                    const active = status === opt.value;
                    return (
                      <Pressable
                        key={opt.value || 'all'}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setStatus(opt.value)}>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={styles.filterToggle}
                  onPress={() => setFiltersOpen((v) => !v)}
                  accessibilityRole="button">
                  <View style={styles.filterToggleLeft}>
                    <Ionicons name="options-outline" size={16} color={Colors.brand} />
                    <Text style={styles.filterToggleText}>
                      More filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
                    </Text>
                  </View>
                  <Ionicons
                    name={filtersOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={Colors.muted}
                  />
                </Pressable>

                {filtersOpen ? (
                  <View style={styles.advancedBox}>
                    <Text style={styles.filterLabel}>Role</Text>
                    <ChipRow
                      options={['', ...filterRoles.map((r) => r.id)]}
                      labels={['All roles', ...filterRoles.map((r) => formatRoleName(r.name))]}
                      value={roleId}
                      onChange={setRoleId}
                    />

                    {cities.length > 0 ? (
                      <>
                        <Text style={styles.filterLabel}>City</Text>
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
                        <Text style={styles.filterLabel}>Area</Text>
                        <ChipRow
                          options={['', ...areas]}
                          labels={['All areas', ...areas]}
                          value={area}
                          onChange={setArea}
                        />
                      </>
                    ) : null}

                    {activeFilterCount > 0 ? (
                      <Pressable onPress={clearAdvancedFilters} hitSlop={8}>
                        <Text style={styles.clearFilters}>Clear filters</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.listMetaRow}>
                  <Text style={styles.meta}>{pageLabel}</Text>
                  {loading ? <Text style={styles.meta}>Loading…</Text> : null}
                </View>
              </View>
            }
            ListEmptyComponent={
              !loading ? (
                <Text style={styles.empty}>No users match these filters.</Text>
              ) : null
            }
            renderItem={({ item }) => {
              const roleName = item.roles?.[0] ? formatRoleName(item.roles[0].name) : null;
              const meta = [roleName, item.city, item.access_surface]
                .filter(Boolean)
                .join(' · ');
              return (
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() =>
                    router.push({ pathname: '/(admin)/users/[id]', params: { id: item.id } })
                  }>
                  <View style={styles.rowTop}>
                    <View style={styles.rowTitleBlock}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {item.personal_email}
                      </Text>
                      {meta ? (
                        <Text style={styles.sub} numberOfLines={1}>
                          {meta}
                        </Text>
                      ) : null}
                    </View>
                    <StatusPill
                      label={item.status.replace(/_/g, ' ')}
                      tone={statusTone(item.status)}
                      style={styles.statusPill}
                    />
                  </View>
                </Pressable>
              );
            }}
          />

          <View style={[styles.pager, { paddingBottom: Math.max(bottomInset, Spacing.sm) }]}>
            <View style={styles.pagerBtn}>
              <OutlineButton
                label="Prev"
                onPress={() => void load(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0 || loading}
              />
            </View>
            <View style={styles.pagerBtn}>
              <OutlineButton
                label="Next"
                onPress={() => void load(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total || loading}
              />
            </View>
          </View>
        </View>
      </SafeScreen>
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
    <View style={styles.chipRow}>
      {options.map((opt, i) => {
        const on = value === opt;
        return (
          <Pressable
            key={`${labels[i]}-${opt || 'all'}`}
            style={[styles.chip, on && styles.chipActive]}
            onPress={() => onChange(opt)}>
            <Text style={[styles.chipText, on && styles.chipTextActive]}>{labels[i]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  headerBlock: { gap: Spacing.sm, marginBottom: Spacing.sm },
  headerAdd: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandSoft,
  },
  filterLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.brandSoft,
    borderColor: Colors.brand,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  chipTextActive: { color: Colors.brand, fontWeight: '700' },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterToggleText: { color: Colors.heading, fontWeight: '700', fontSize: 13 },
  advancedBox: {
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 12,
  },
  clearFilters: {
    color: Colors.brand,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 4,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  meta: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  empty: { color: Colors.muted, fontSize: 13, lineHeight: 20, paddingVertical: Spacing.md },
  error: { color: Colors.danger, marginBottom: Spacing.sm, fontWeight: '600' },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  rowPressed: { backgroundColor: Colors.brandSoft },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitleBlock: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '700', color: Colors.heading },
  sub: { color: Colors.muted, fontSize: 12, lineHeight: 16 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pager: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: 0,
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingTop: Spacing.sm,
  },
  pagerBtn: { flex: 1 },
});
