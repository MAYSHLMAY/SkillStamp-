import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getToken, setToken, type ApiUser } from '../lib/api';

type AuthContextValue = {
  user: ApiUser | null;
  token: string | null;
  bootstrapped: boolean;
  setSession: (token: string, user: ApiUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() => getToken());

  const userQuery = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const t = getToken();
      if (!t) return null;
      const res = await apiFetch<ApiUser>('/api/auth/me', { token: t });
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!token,
    staleTime: Infinity,
    retry: false,
  });

  const bootstrapped = !token || (!userQuery.isPending && !userQuery.isFetching);

  const user = token ? userQuery.data ?? null : null;

  useEffect(() => {
    if (userQuery.isError && token) {
      setToken(null);
      setTokenState(null);
      queryClient.removeQueries({ queryKey: ['auth', 'user'] });
    }
  }, [userQuery.isError, token, queryClient]);

  const setSession = useCallback(
    (nextToken: string, nextUser: ApiUser) => {
      setToken(nextToken);
      setTokenState(nextToken);
      queryClient.setQueryData(['auth', 'user'], nextUser);
    },
    [queryClient]
  );

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    queryClient.removeQueries({ queryKey: ['auth', 'user'] });
  }, [queryClient]);

  const value = useMemo(
    () => ({
      user,
      token,
      bootstrapped,
      setSession,
      logout,
    }),
    [user, token, bootstrapped, setSession, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
