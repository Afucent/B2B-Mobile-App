import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  listAssignableDealers,
  type AssignableDealer,
} from '@/lib/api/users';

type Props = {
  disabled?: boolean;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabledReason?: string;
  forUserId?: string;
};

export default function AssignDealersPicker({
  disabled = false,
  selectedIds,
  onChange,
  disabledReason,
  forUserId,
}: Props) {
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [dealers, setDealers] = useState<AssignableDealer[]>([]);
  const [stateFilter, setStateFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (disabled) {
      setDealers([]);
      setStates([]);
      setCities([]);
      setAreas([]);
      return;
    }
    setLoading(true);
    try {
      const data = await listAssignableDealers({
        state: stateFilter || undefined,
        city: cityFilter || undefined,
        area: areaFilter || undefined,
        for_user_id: forUserId,
      });
      setDealers(data.items);
      setStates(data.states);
      setCities(data.cities);
      setAreas(data.areas);
    } catch {
      setDealers([]);
      setStates([]);
      setCities([]);
      setAreas([]);
    } finally {
      setLoading(false);
    }
  }, [disabled, stateFilter, cityFilter, areaFilter, forUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedLabels = useMemo(() => {
    const byId = new Map(dealers.map((d) => [d.id, d.name]));
    return selectedIds.map((id) => byId.get(id) ?? id.slice(0, 8));
  }, [dealers, selectedIds]);

  function toggle(id: string) {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  if (disabled) {
    return (
      <View style={styles.warn}>
        <Text style={styles.warnText}>
          {disabledReason ??
            'Dealer role selected — you cannot assign dealers to a dealer user.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        Only unassigned Dealer-role users appear here. Filter by location, then multi-select.
      </Text>

      <Text style={styles.filterLabel}>State</Text>
      <ChipRow
        options={['', ...states]}
        labels={['All states', ...states]}
        value={stateFilter}
        onChange={(v) => {
          setStateFilter(v);
          setCityFilter('');
          setAreaFilter('');
        }}
      />

      <Text style={styles.filterLabel}>City</Text>
      <ChipRow
        options={['', ...cities]}
        labels={['All cities', ...cities]}
        value={cityFilter}
        onChange={(v) => {
          setCityFilter(v);
          setAreaFilter('');
        }}
        disabled={!stateFilter}
      />

      <Text style={styles.filterLabel}>Area</Text>
      <ChipRow
        options={['', ...areas]}
        labels={['All areas', ...areas]}
        value={areaFilter}
        onChange={setAreaFilter}
        disabled={!cityFilter}
      />

      <View style={styles.list}>
        {loading ? (
          <Text style={styles.meta}>Loading dealers…</Text>
        ) : dealers.length === 0 ? (
          <Text style={styles.meta}>
            No dealer-role users for this location. Create a user with the Dealer role first.
          </Text>
        ) : (
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            {dealers.map((d) => {
              const on = selectedIds.includes(d.id);
              return (
                <Pressable key={d.id} style={styles.row} onPress={() => toggle(d.id)}>
                  <View style={[styles.box, on && styles.boxOn]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{d.name}</Text>
                    <Text style={styles.sub}>{d.personal_email}</Text>
                    <Text style={styles.sub}>
                      {[d.area, d.city, d.state].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <Text style={styles.meta}>
        Selected: {selectedIds.length}
        {selectedLabels.length > 0 ? ` — ${selectedLabels.join(', ')}` : ''}
      </Text>
    </View>
  );
}

function ChipRow({
  options,
  labels,
  value,
  onChange,
  disabled,
}: {
  options: string[];
  labels: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.chips, disabled && { opacity: 0.45 }]}>
      {options.map((opt, i) => {
        const on = value === opt;
        return (
          <Pressable
            key={`${labels[i]}-${opt || 'all'}`}
            style={[styles.chip, on && styles.chipOn]}
            disabled={disabled}
            onPress={() => onChange(opt)}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{labels[i]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  hint: { color: Colors.muted, fontSize: 12 },
  filterLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 4,
  },
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
  list: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  box: {
    width: 20,
    height: 20,
    marginTop: 2,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  boxOn: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  name: { fontWeight: '700', color: Colors.heading },
  sub: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  meta: { color: Colors.muted, fontSize: 12, padding: Spacing.sm },
  warn: {
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  warnText: { color: '#92400E', fontSize: 13 },
});
