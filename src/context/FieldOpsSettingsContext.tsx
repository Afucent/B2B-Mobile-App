import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  getFieldOperationsSettings,
  updateFieldOperationsSettings,
  type FieldOperationsSettings,
} from '@/lib/api/org';

type FieldOpsSettingsContextValue = {
  settings: FieldOperationsSettings | null;
  loading: boolean;
  error: string;
  refreshSettings: () => Promise<FieldOperationsSettings | null>;
  saveSettings: (data: Partial<FieldOperationsSettings>) => Promise<FieldOperationsSettings>;
};

const FieldOpsSettingsContext = createContext<FieldOpsSettingsContextValue | null>(null);

export function FieldOpsSettingsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [settings, setSettings] = useState<FieldOperationsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshSettings = useCallback(async () => {
    if (status !== 'signedIn') {
      setSettings(null);
      setLoading(false);
      setError('');
      return null;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getFieldOperationsSettings();
      setSettings(data);
      return data;
    } catch (err) {
      setSettings(null);
      setError(err instanceof Error ? err.message : 'Failed to load field ops settings');
      return null;
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  const saveSettings = useCallback(async (data: Partial<FieldOperationsSettings>) => {
    const saved = await updateFieldOperationsSettings(data);
    setSettings(saved);
    setError('');
    return saved;
  }, []);

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
      refreshSettings,
      saveSettings,
    }),
    [error, loading, refreshSettings, saveSettings, settings],
  );

  return (
    <FieldOpsSettingsContext.Provider value={value}>{children}</FieldOpsSettingsContext.Provider>
  );
}

export function useFieldOpsSettings() {
  const ctx = useContext(FieldOpsSettingsContext);
  if (!ctx) {
    throw new Error('useFieldOpsSettings must be used within FieldOpsSettingsProvider');
  }
  return ctx;
}
