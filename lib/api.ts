'use client';

export const API_BASE = '/api/v1';

export interface ApiEnvelope<T> { data: T; meta: any; error: { code: string; status: number; message: string | string[] } | null }
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

const ACCESS = 'do.access';
const REFRESH = 'do.refresh';

export const tokens = {
  get access() { try { return localStorage.getItem(ACCESS); } catch { return null; } },
  get refresh() { try { return localStorage.getItem(REFRESH); } catch { return null; } },
  set(a: string, r?: string) { try { localStorage.setItem(ACCESS, a); if (r) localStorage.setItem(REFRESH, r); } catch {} },
  clear() { try { localStorage.removeItem(ACCESS); localStorage.removeItem(REFRESH); } catch {} },
};

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (!tokens.refresh) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: tokens.refresh }),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as ApiEnvelope<{ accessToken: string; refreshToken: string }>;
      tokens.set(json.data.accessToken, json.data.refreshToken);
      return true;
    } catch { return false; } finally { setTimeout(() => (refreshing = null), 0); }
  })();
  return refreshing;
}

function errMessage(json: any, status: number) {
  const m = json?.error?.message;
  if (Array.isArray(m)) return m.join(' · ');
  return m || (status === 0 ? 'Tidak dapat terhubung ke server' : `Permintaan gagal (${status})`);
}

async function raw(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (tokens.access) headers.set('Authorization', `Bearer ${tokens.access}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let res: Response;
  try { res = await fetch(`${API_BASE}${path}`, { ...init, headers }); } catch { throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi Anda.'); }
  if (res.status === 401 && retry && !path.startsWith('/auth/login')) {
    if (await tryRefresh()) return raw(path, init, false);
    tokens.clear();
    if (typeof window !== 'undefined' && !location.pathname.startsWith('/login')) location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
  }
  return res;
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<{ data: T; meta: any }> {
  const { json, ...rest } = init;
  const res = await raw(path, json !== undefined ? { ...rest, body: JSON.stringify(json) } : rest);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errMessage(body, res.status), body?.error?.code);
  return { data: body?.data as T, meta: body?.meta };
}

export const get = <T = any>(p: string) => api<T>(p).then((r) => r.data);
export const post = <T = any>(p: string, json?: unknown) => api<T>(p, { method: 'POST', json: json ?? {} }).then((r) => r.data);
export const patch = <T = any>(p: string, json: unknown) => api<T>(p, { method: 'PATCH', json }).then((r) => r.data);
export const put = <T = any>(p: string, json: unknown) => api<T>(p, { method: 'PUT', json }).then((r) => r.data);
export const del = <T = any>(p: string) => api<T>(p, { method: 'DELETE' }).then((r) => r.data);

export async function upload<T = any>(path: string, form: FormData, onProgress?: (pct: number) => void): Promise<T> {
  // XHR untuk progress upload (target 10MB < 30 dtk)
  const send = () => new Promise<{ status: number; body: any }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`);
    if (tokens.access) xhr.setRequestHeader('Authorization', `Bearer ${tokens.access}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => { let b = null; try { b = JSON.parse(xhr.responseText); } catch {} resolve({ status: xhr.status, body: b }); };
    xhr.onerror = () => reject(new ApiError(0, 'Upload gagal: koneksi terputus'));
    xhr.send(form);
  });
  let r = await send();
  if (r.status === 401 && (await tryRefresh())) r = await send();
  if (r.status >= 400) throw new ApiError(r.status, r.status === 413 ? 'Ukuran file melebihi batas' : errMessage(r.body, r.status));
  return r.body?.data as T;
}

/** Ambil file ter-autentikasi sebagai Blob (unduh / viewer / ekspor) — token tidak pernah masuk URL. */
export async function fetchBlob(path: string) {
  const res = await raw(path);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, errMessage(body, res.status));
  }
  const cd = res.headers.get('Content-Disposition') ?? '';
  const m = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/.exec(cd);
  const filename = m ? decodeURIComponent(m[1] ?? m[2]) : 'download';
  return { blob: await res.blob(), filename };
}

export async function download(path: string) {
  const { blob, filename } = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
}
