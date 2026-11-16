'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Fetch data + meta dengan reload manual & polling opsional (status real-time). */
export function useApi<T = any>(path: string | null, opts: { poll?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async (silent = false) => {
    if (!pathRef.current) return;
    if (!silent) setLoading(true);
    try {
      const r = await api<T>(pathRef.current);
      setData(r.data); setMeta(r.meta); setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (path) load(); else { setData(null); setLoading(false); } }, [path, load]);
  useEffect(() => {
    if (!opts.poll || !path) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, opts.poll);
    return () => clearInterval(t);
  }, [opts.poll, path, load]);

  return { data, meta, error, loading, reload: load, setData };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
