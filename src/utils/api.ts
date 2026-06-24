import { getToken } from './auth';

// Detecta automáticamente host/IP donde corre el front.
// Asume que el backend corre en el mismo host y puerto (8000).
const defaultHost = (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1');
export const BACKEND_BASE = `http://${defaultHost}:8000`;


export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.message || `Request failed: ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

