import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth as authApi, setActiveOrgId, getActiveOrgId } from './api';

interface Org {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  default_org_id: string | null;
  orgs: Org[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  activeOrgId: string | null;
  activeOrg: Org | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(getActiveOrgId());

  useEffect(() => {
    const apiKey = localStorage.getItem('cloak_api_key');
    if (apiKey) {
      authApi.me()
        .then((u) => {
          const userData: User = {
            id: u.id,
            email: u.email,
            name: u.name,
            plan: u.plan,
            default_org_id: u.default_org_id,
            orgs: u.orgs || [],
          };
          setUser(userData);
          if (!getActiveOrgId() && u.default_org_id) {
            setActiveOrgId(u.default_org_id);
            setOrgId(u.default_org_id);
          }
        })
        .catch(() => {
          localStorage.removeItem('cloak_api_key');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    if (result.api_key) {
      localStorage.setItem('cloak_api_key', result.api_key);
    }
    setUser({
      id: result.user.id,
      email: result.user.email,
      name: null,
      plan: result.user.plan,
      default_org_id: null,
      orgs: [],
    });
  };

  const register = async (email: string, password: string): Promise<string> => {
    const result = await authApi.register(email, password);
    localStorage.setItem('cloak_api_key', result.api_key);
    setUser({
      id: result.user.id,
      email: result.user.email,
      name: null,
      plan: result.user.plan,
      default_org_id: null,
      orgs: [],
    });
    return result.api_key;
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('cloak_api_key');
    setActiveOrgId(null);
    setUser(null);
    setOrgId(null);
  };

  const switchOrg = useCallback((newOrgId: string) => {
    setActiveOrgId(newOrgId);
    setOrgId(newOrgId);
  }, []);

  const activeOrg = user?.orgs.find((o) => o.id === orgId) || null;

  return (
    <AuthContext.Provider value={{ user, loading, activeOrgId: orgId, activeOrg, login, register, logout, switchOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
