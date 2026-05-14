const TOKEN_KEY = 'skillstamp_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export type ApiUser = { id: string; name: string; email: string; role: 'candidate' | 'employer' };

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { token?: string | null; skipAuth?: boolean } = {}
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const token = init.skipAuth ? null : init.token !== undefined ? init.token : getToken();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const base = import.meta.env.VITE_API_URL ?? '';
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const json = (await res.json()) as { success: true; data: T } | { success: false; error: string };
  return json;
}
