import type { AuthResponse, AuthUser, InventoryView, PackResult } from '../shared/types';

const API_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'networks-tcg-token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? 'Request failed');
  }
  return data as T;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function register(username: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function getMe(token: string): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>('/auth/me', {
    headers: authHeaders(token),
  });
}

export function logout(token: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
    headers: authHeaders(token),
  });
}

export function getInventory(token: string): Promise<InventoryView> {
  return request<InventoryView>('/inventory', {
    headers: authHeaders(token),
  });
}

export function openPack(token: string): Promise<PackResult> {
  return request<PackResult>('/inventory/pack', {
    method: 'POST',
    headers: authHeaders(token),
  });
}

export function claimDailyBytes(token: string): Promise<{ bytes: number; granted: number }> {
  return request<{ bytes: number; granted: number }>('/byte-shop/daily-claim', {
    method: 'POST',
    headers: authHeaders(token),
  });
}

export function checkoutByteBundle(
  token: string,
  bundleId: string,
  discountCode: string,
): Promise<{ bytes: number; granted: number }> {
  return request<{ bytes: number; granted: number }>('/byte-shop/checkout', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ bundleId, discountCode }),
  });
}
