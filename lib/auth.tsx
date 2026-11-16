'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, get, post, tokens } from './api';

export interface Me {
  id: string; fullName: string; email: string; photoUrl: string | null; phone: string | null; position: string | null;
  isSuperAdmin: boolean; departmentId: string | null; department: { id: string; name: string; code: string } | null;
  roles: string[]; permissions: string[];
}

interface AuthCtx {
  me: Me | null; loading: boolean;
  login(identifier: string, password: string): Promise<void>;
  logout(): void;
  reload(): Promise<void>;
  can(...perms: string[]): boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!tokens.access) { setMe(null); setLoading(false); return; }
    try { setMe(await get<Me>('/users/me')); } catch { setMe(null); } finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const login = async (identifier: string, password: string) => {
    const { data } = await api<{ accessToken: string; refreshToken: string }>('/auth/login', { method: 'POST', json: { identifier: identifier.trim(), password } });
    tokens.set(data.accessToken, data.refreshToken);
    await reload();
  };
  const logout = () => {
    post('/auth/logout-all').catch(() => {});
    tokens.clear(); setMe(null); location.href = '/login';
  };
  const can = (...perms: string[]) => !!me && (me.isSuperAdmin || perms.some((p) => me.permissions.includes(p)));

  return <Ctx.Provider value={{ me, loading, login, logout, reload, can }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth di luar AuthProvider');
  return c;
}
