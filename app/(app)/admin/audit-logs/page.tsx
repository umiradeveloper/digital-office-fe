'use client';
import { useState } from 'react';
import { FileSpreadsheet, Lock, ShieldCheck } from 'lucide-react';
import { useApi, useDebounced } from '@/lib/hooks';
import { download, qs } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { Avatar, Empty, ErrorAlert, Loading, Modal, Pagination, Panel, useAction } from '@/components/ui';

export default function AuditPage() {
  const [f, setF] = useState({ module: '', action: '', entity: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const da = useDebounced(f.action);
  const q = qs({ ...f, action: da });
  const { data, meta, error, loading } = useApi<any[]>(`/audit-logs${q}${q ? '&' : '?'}page=${page}&perPage=30`);
  const { data: modules } = useApi<any[]>('/audit-logs/modules');
  const [detail, setDetail] = useState<any>(null);
  const { busy, run } = useAction();
  const set = (k: string, v: string) => { setF({ ...f, [k]: v }); setPage(1); };

  return (
    <>
      <div className="page-head">
        <div><h1>Audit trail</h1><p className="lead">Jejak seluruh aksi kritis. Log bersifat immutable: tidak dapat diubah atau dihapus melalui aplikasi, hanya dapat diekspor.</p></div>
        <div className="page-actions"><button className="btn primary" disabled={!!busy} onClick={() => run('x', () => download(`/audit-logs.xlsx${q}`), 'Audit trail diekspor')}><FileSpreadsheet />Ekspor Excel</button></div>
      </div>
      <Panel flat bodyClass="tight">
        <div className="panel-body row wrap" style={{ borderBottom: '1px solid var(--line-soft)' }}>
          <select className="select" style={{ width: 190 }} value={f.module} onChange={(e) => set('module', e.target.value)}><option value="">Semua modul</option>{modules?.map((m) => <option key={m.module} value={m.module}>{m.module} ({m.count})</option>)}</select>
          <input className="input" style={{ width: 200 }} placeholder="Aksi, mis. decision_" value={f.action} onChange={(e) => set('action', e.target.value)} />
          <input className="input" style={{ width: 160 }} placeholder="Entitas, mis. request" value={f.entity} onChange={(e) => set('entity', e.target.value)} />
          <input className="input" type="date" style={{ width: 160 }} value={f.from} onChange={(e) => set('from', e.target.value)} aria-label="Dari" />
          <input className="input" type="date" style={{ width: 160 }} value={f.to} onChange={(e) => set('to', e.target.value)} aria-label="Sampai" />
          <span className="badge tone-steel" style={{ marginLeft: 'auto' }}><Lock size={12} />Read-only</span>
        </div>
        <ErrorAlert error={error} />
        {loading && !data ? <div className="panel-body"><Loading rows={8} /></div> : !data?.length ? <Empty icon={<ShieldCheck />} title="Tidak ada log untuk filter ini" /> : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Waktu</th><th>Aktor</th><th>Modul</th><th>Aksi</th><th>Entitas</th><th className="hide-sm">IP</th></tr></thead>
            <tbody>{data.map((a) => (
              <tr key={a.id} className="clickable" onClick={() => setDetail(a)}>
                <td className="small nowrap num">{fmtDateTime(a.createdAt)}</td>
                <td className="small"><span className="row"><Avatar name={a.actor?.fullName ?? 'S'} size="sm" />{a.actor?.fullName ?? 'Sistem'}</span></td>
                <td><span className="badge tone-info">{a.module}</span></td>
                <td className="small" style={{ color: a.action.includes('denied') || a.action.includes('failed') ? 'var(--bad)' : undefined }}>{a.action}</td>
                <td className="small muted">{a.entityType ? `${a.entityType} #${a.entityId}` : '—'}</td>
                <td className="small muted hide-sm">{a.ipAddress ?? '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pagination meta={meta} onPage={setPage} />
      </Panel>
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.action}>
        {detail && <div className="stack small">
          <div className="row between"><span className="muted">Waktu</span><span>{fmtDateTime(detail.createdAt)}</span></div>
          <div className="row between"><span className="muted">Aktor</span><span>{detail.actor?.fullName ?? 'Sistem'} {detail.actor?.email && <span className="muted">({detail.actor.email})</span>}</span></div>
          <div className="row between"><span className="muted">Entitas</span><span>{detail.entityType ?? '—'} #{detail.entityId ?? '—'}</span></div>
          <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--void)', padding: 14, borderRadius: 12, maxHeight: 360, overflow: 'auto', fontSize: 12 }}>{JSON.stringify(detail.payloadJson, null, 2) ?? '—'}</pre>
        </div>}
      </Modal>
    </>
  );
}
