'use client';
import { useState } from 'react';
import { ArrowRight, Plus, Repeat2, StopCircle } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { Avatar, Empty, ErrorAlert, Field, Loading, Modal, Panel, useAction } from '@/components/ui';
import { UserPicker, type UserLite } from '@/components/user-picker';

const ST: Record<string, string> = { active: 'tone-ok', ended: 'tone-steel', expired: 'tone-muted' };
const STL: Record<string, string> = { active: 'Aktif', ended: 'Diakhiri', expired: 'Kedaluwarsa' };

export default function DelegationsPage() {
  const { me, can } = useAuth();
  const [all, setAll] = useState(false);
  const { data, error, loading, reload } = useApi<any[]>(`/delegations${all ? '?all=1' : ''}`);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<UserLite | null>(null);
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [until, setUntil] = useState('');
  const [reason, setReason] = useState('');
  const { busy, run } = useAction();
  const now = Date.now();

  return (
    <>
      <div className="page-head">
        <div><h1>Delegasi approval</h1><p className="lead">Serahkan hak approval ke rekan saat Anda cuti atau sibuk. Selama periode aktif, item di inbox Anda juga muncul di inbox penerima, dan keputusannya dicatat atas nama penerima.</p></div>
        <div className="page-actions">
          {can('DELEGATION_MANAGE') && <div className="seg"><button className={!all ? 'on' : ''} onClick={() => setAll(false)}>Milik saya</button><button className={all ? 'on' : ''} onClick={() => setAll(true)}>Semua</button></div>}
          {can('DELEGATION_CREATE', 'DELEGATION_MANAGE') && <button className="btn primary" onClick={() => setOpen(true)}><Plus />Buat delegasi</button>}
        </div>
      </div>
      <ErrorAlert error={error} />
      <Panel flat bodyClass="tight">
        {loading && !data ? <div className="panel-body"><Loading /></div> : !data?.length ? (
          <Empty icon={<Repeat2 />} title="Belum ada delegasi" action={<button className="btn primary" onClick={() => setOpen(true)}><Plus />Buat delegasi</button>}>Atur delegasi sebelum cuti agar approval tidak tertahan.</Empty>
        ) : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Dari</th><th /><th>Kepada</th><th>Periode</th><th className="hide-sm">Alasan</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.map((d) => {
                const live = d.status === 'active' && new Date(d.fromDate).getTime() <= now && new Date(d.toDate).getTime() >= now;
                return (
                  <tr key={d.id}>
                    <td><span className="row small"><Avatar name={d.delegator.fullName} size="sm" />{d.delegator.fullName}</span></td>
                    <td><ArrowRight size={15} className="muted" /></td>
                    <td><span className="row small"><Avatar name={d.delegate.fullName} size="sm" />{d.delegate.fullName}</span></td>
                    <td className="small nowrap">{fmtDate(d.fromDate)} – {fmtDate(d.toDate)}</td>
                    <td className="small muted hide-sm">{d.reason ?? '—'}</td>
                    <td><span className={`badge ${ST[d.status]}`}><span className="pip" />{live ? 'Berlaku sekarang' : STL[d.status]}</span></td>
                    <td className="r">{d.status === 'active' && (d.delegator.id === me?.id || can('DELEGATION_MANAGE')) && <button className="btn sm" disabled={!!busy} onClick={async () => { if (await run('e', () => post(`/delegations/${d.id}/end`), 'Delegasi diakhiri')) reload(); }}><StopCircle />Akhiri</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Panel>
      <Modal open={open} onClose={() => setOpen(false)} title="Buat delegasi"
        footer={<><button className="btn ghost" onClick={() => setOpen(false)}>Batal</button><button className="btn primary" disabled={!to || !until || !!busy} onClick={async () => {
          const ok = await run('c', () => post('/delegations', { delegateUserId: to!.id, fromDate: from, toDate: until, reason: reason || undefined }), 'Delegasi dibuat — penerima diberi tahu lewat e-mail');
          if (ok) { setOpen(false); setTo(null); setUntil(''); setReason(''); reload(); }
        }}><Repeat2 />Simpan delegasi</button></>}>
        <div className="stack">
          <Field label="Delegasikan kepada" required><UserPicker value={to} onChange={setTo} exclude={me ? [me.id] : []} /></Field>
          <div className="form-grid">
            <Field label="Mulai" required><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Sampai" required error={until && until < from ? 'Harus setelah tanggal mulai' : null}><input className="input" type="date" value={until} min={from} onChange={(e) => setUntil(e.target.value)} /></Field>
          </div>
          <Field label="Alasan"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Cuti tahunan, dinas luar kota…" /></Field>
        </div>
      </Modal>
    </>
  );
}
