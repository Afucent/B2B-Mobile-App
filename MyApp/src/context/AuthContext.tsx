import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getMe, orgLogin, sendLoginOtp, verifyLoginOtp, type MeResponse } from '@/lib/api/auth';
import { ApiRequestError } from '@/lib/api/client';
import { clearToken, getCompanyCode, getToken, setCompanyCode, setToken } from '@/lib/storage';

const MOBILE_ACCESS_MESSAGE =
  'You do not have mobile app access. Ask your organisation admin to enable App access for your role.';

function assertMobileAccess(me: MeResponse) {
  if (me.mobile_eligible === false || !me.organization || me.access_surface === 'platform') {
    throw new ApiRequestError(MOBILE_ACCESS_MESSAGE, 403);
  }
}

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: MeResponse | null;
  companyCode: string;
  login: (companyCode: string, identifier: string, password: string) => Promise<void>;
  loginWithOtp: (companyCode: string, email: string, otp: string) => Promise<void>;
  sendOtp: (companyCode: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setRememberedCompany: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<MeResponse | null>(null);
  const [companyCode, setCompany] = useState('');

  const bootstrap = useCallback(async () => {
    const savedCode = (await getCompanyCode()) ?? '';
    setCompany(savedCode);
    const token = await getToken();
    if (!token) {
      setUser(null);
      setStatus('signedOut');
      return;
    }
    try {
      const me = await getMe();
      assertMobileAccess(me);
      setUser(me);
      setStatus('signedIn');
    } catch {
      await clearToken();
      setUser(null);
      setStatus('signedOut');
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (code: string, identifier: string, password: string) => {
    try {
      const tokens = await orgLogin(code, identifier, password);
      await setToken(tokens.access_token);
      await setCompanyCode(code);
      setCompany(code);
      const me = await getMe();
      assertMobileAccess(me);
      setUser(me);
      setStatus('signedIn');
    } catch (err) {
      await clearToken();
      setUser(null);
      setStatus('signedOut');
      throw err;
    }
  }, []);

  const loginWithOtp = useCallback(async (code: string, email: string, otp: string) => {
    try {
      const tokens = await verifyLoginOtp(code, email, otp);
      await setToken(tokens.access_token);
      await setCompanyCode(code);
      setCompany(code);
      const me = await getMe();
      assertMobileAccess(me);
      setUser(me);
      setStatus('signedIn');
    } catch (err) {
      await clearToken();
      setUser(null);
      setStatus('signedOut');
      throw err;
    }
  }, []);

  const sendOtp = useCallback(async (code: string, email: string) => {
    await sendLoginOtp(code, email);
    await setCompanyCode(code);
    setCompany(code);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        await logout();
      }
    }
  }, [logout]);

  const setRememberedCompany = useCallback(async (code: string) => {
    await setCompanyCode(code);
    setCompany(code);
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      companyCode,
      login,
      loginWithOtp,
      sendOtp,
      logout,
      refresh,
      setRememberedCompany,
    }),
    [status, user, companyCode, login, loginWithOtp, sendOtp, logout, refresh, setRememberedCompany],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
