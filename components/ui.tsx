'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Inbox, X, XCircle } from 'lucide-react';
import { STATUS, PRIORITY, initials, statusKey } from '@/lib/format';

export function Panel({ title, sub, actions, children, className = '', bodyClass = '', flat }: {
  title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; flat?: boolean;
}) {
  return (
    <section className={`panel ${flat ? 'flat' : ''} ${className}`}>
      {(title || actions) && (
        <header className="panel-head">
          <div className="grow">{typeof title === 'string' ? <h2>{title}</h2> : title}{sub && <div className="sub">{sub}</div>}</div>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      <div className={`panel-body ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[statusKey(status)] ?? { label: status, tone: 'muted' };
  return <span className={`badge tone-${s.tone}`}><span className="pip" />{s.label}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITY[priority] ?? { label: priority, tone: 'muted' };
  return <span className={`badge tone-${p.tone}`}>{p.label}</span>;
}

export function Avatar({ name, src, size = '' }: { name?: string | null; src?: string | null; size?: '' | 'sm' | 'lg' | 'xl' }) {
  return <span className={`avatar ${size}`} aria-hidden>{src ? <img src={src} alt="" /> : initials(name)}</span>;
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="glyph">{icon ?? <Inbox />}</div>
      <h3>{title}</h3>
      {children && <p className="small" style={{ maxWidth: '46ch' }}>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', style }: { h?: number; w?: number | string; style?: React.CSSProperties }) {
  return <div className="skel" style={{ height: h, width: w, ...style }} />;
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return <div className="stack">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} h={42} />)}</div>;
}

export function ErrorAlert({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div className="alert bad" role="alert"><XCircle /><span>{error}</span></div>;
}

export function Field({ label, required, hint, error, children, className = '' }: {
  label: string; required?: boolean; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string;
}) {
  return (
    <div className={`field ${className}`}>
      <label className={required ? 'req' : ''}>{label}</label>
      {children}
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head"><h2>{title}</h2><button className="btn ghost icon" onClick={onClose} aria-label="Tutup"><X /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Pagination({ meta, onPage }: { meta?: { page: number; totalPages: number; total: number; perPage: number } | null; onPage: (p: number) => void }) {
  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.perPage + 1;
  const to = Math.min(meta.total, meta.page * meta.perPage);
  return (
    <div className="row between" style={{ padding: '12px 16px' }}>
      <span className="small muted">{from}–{to} dari <span className="num">{meta.total}</span></span>
      <div className="row">
        <button className="btn sm icon" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Sebelumnya"><ChevronLeft /></button>
        <span className="small num">{meta.page} / {meta.totalPages}</span>
        <button className="btn sm icon" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)} aria-label="Berikutnya"><ChevronRight /></button>
      </div>
    </div>
  );
}

// ─────────── Toast ───────────
type Toast = { id: number; tone: 'ok' | 'bad'; text: string };
const ToastCtx = createContext<{ ok(t: string): void; bad(t: string): void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((tone: Toast['tone'], text: string) => {
    const id = ++seq.current;
    setItems((x) => [...x, { id, tone, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), tone === 'bad' ? 6000 : 3500);
  }, []);
  const api = useRef({ ok: (t: string) => push('ok', t), bad: (t: string) => push('bad', t) });
  return (
    <ToastCtx.Provider value={api.current}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>{t.tone === 'ok' ? <CheckCircle2 /> : <AlertTriangle />}<span>{t.text}</span></div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error('useToast di luar ToastProvider');
  return c;
}

/** Tombol aksi async: loading state + toast error otomatis. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(async <T,>(key: string, fn: () => Promise<T>, okMsg?: string): Promise<T | undefined> => {
    setBusy(key);
    try {
      const r = await fn();
      if (okMsg) toast.ok(okMsg);
      return r;
    } catch (e: any) {
      toast.bad(e.message ?? 'Terjadi kesalahan');
      return undefined;
    } finally { setBusy(null); }
  }, [toast]);
  return { busy, run };
}

/** Simbol bintang Umira (tanpa teks). */
export function BrandMark({ className = 'brand-mark' }: { className?: string }) {
  return <img className={className} src="/brand/umira-mark.png" alt="" aria-hidden />;
}

/** Logo lengkap Umira. `white` untuk latar teal (rail, panel gelap), `color` untuk latar terang. */
export function UmiraLogo({ variant = 'color', height = 38, className = '' }: { variant?: 'color' | 'white'; height?: number; className?: string }) {
  return (
    <img
      className={`brand-logo ${className}`}
      src={variant === 'white' ? '/brand/umira-logo-white.png' : '/brand/umira-logo.png'}
      alt="Umira — Construction · Development · Investment"
      style={{ height }}
    />
  );
}
