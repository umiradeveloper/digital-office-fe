'use client';
import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { get, qs } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { Avatar } from './ui';

export interface UserLite { id: string; fullName: string; email?: string; position?: string | null; photoUrl?: string | null; department?: { name: string } | null }

/** Pilih satu pengguna dengan pencarian (assignee, delegasi, share). */
export function UserPicker({ value, onChange, placeholder = 'Cari nama atau email…', exclude = [] }: {
  value: UserLite | null; onChange: (u: UserLite | null) => void; placeholder?: string; exclude?: string[];
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserLite[]>([]);
  const dq = useDebounced(q, 250);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    get<UserLite[]>(`/users${qs({ search: dq, perPage: 12, status: 'active' })}`).then((r) => setItems(r.filter((u) => !exclude.includes(u.id)))).catch(() => setItems([]));
  }, [dq, open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (value) {
    return (
      <div className="input row" style={{ justifyContent: 'space-between' }}>
        <span className="row truncate"><Avatar name={value.fullName} src={value.photoUrl} size="sm" /> <span className="truncate">{value.fullName}</span></span>
        <button type="button" className="btn ghost sm icon" onClick={() => onChange(null)} aria-label="Hapus pilihan"><X /></button>
      </div>
    );
  }
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 12, top: 12, width: 16, color: 'var(--muted)' }} />
        <input className="input" style={{ paddingLeft: 36 }} placeholder={placeholder} value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      </div>
      {open && (
        <div className="popover" style={{ left: 0, right: 'auto', width: '100%', maxHeight: 280, overflowY: 'auto' }}>
          {items.length === 0 && <div className="small muted" style={{ padding: 14 }}>Tidak ada pengguna yang cocok</div>}
          {items.map((u) => (
            <button type="button" key={u.id} className="menu-item" onClick={() => { onChange(u); setOpen(false); setQ(''); }}>
              <Avatar name={u.fullName} src={u.photoUrl} size="sm" />
              <span className="grow truncate"><span style={{ color: 'var(--ink)' }}>{u.fullName}</span><br /><span className="tiny muted">{u.position ?? u.email} · {u.department?.name ?? '—'}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
