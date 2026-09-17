import { useCallback, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useFieldOpsSettings } from '@/context/FieldOpsSettingsContext';
import { useTracking } from '@/context/TrackingContext';

/**
 * Pull-to-refresh helper: reloads auth (/me), attendance/tracking status,
 * and field-ops settings so web changes show up after a pull.
 */
export function useAppRefresh(extra?: () => Promise<void> | void) {
  const { refresh } = useAuth();
  const { refreshStatus } = useTracking();
  const { refreshSettings } = useFieldOpsSettings();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refresh().catch(() => undefined),
        refreshStatus().catch(() => undefined),
        refreshSettings().catch(() => undefined),
        Promise.resolve(extra?.()).catch(() => undefined),
      ]);
      setRefreshKey((k) => k + 1);
    } finally {
      setRefreshing(false);
    }
  }, [extra, refresh, refreshSettings, refreshStatus]);

  return { refreshing, refreshKey, onRefresh };
}
