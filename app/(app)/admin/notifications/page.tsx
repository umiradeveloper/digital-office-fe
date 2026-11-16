'use client';
import { useState } from 'react';
import { Mail, RotateCcw, Save } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { patch, post, qs } from '@/lib/api';
import { PRIORITY, fmtDateTime } from '@/lib/format';
import { ErrorAlert, Field, Loading, Modal, Pagination, Panel, useAction } from '@/components/ui';

const VARS = ['nama', 'ref', 'judul', 'status', 'prioritas', 'level', 'aktor', 'pengaju', 'alasan', 'due', 'link', 'delegator', 'periode'];
const DS: Record<string, [string, string]> = { sent: ['tone-ok', 'Terkirim'], failed: ['tone-bad', 'Gagal'], pending: ['tone-warn', 'Antre'] };

export default function NotifAdminPage() {
  const [tab, setTab] = useState<'tpl' | 'log'>('tpl');
  const { data: tpls, error, loading, reload } = useApi<any[]>('/notifications/admin/templates');
  const [st, setSt] = useState('');
  const [page, setPage] = useState(1);
  const { data: logs, meta, reload: reloadLogs } = useApi<any[]>(tab === 'log' ? `/notifications/admin/logs${qs({ status: st, page, perPage: 25 })}` : null, { poll: tab === 'log' ? 10000 : undefined });
  const [edit, setEdit] = useState<any>(null);
  const { busy, run } = useAction();

  return (
    <>
      <div className="page-head">
        <div><h1>Notifikasi e-mail</h1><p className="lead">Atur template dan threshold prioritas per event, dan pantau status pengiriman untuk troubleshooting.</p></div>
        <div className="seg"><button className={tab === 'tpl' ? 'on' : ''} onClick={() => setTab('tpl')}>Template</button><button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>Log pengiriman</button></div>
      </div>
      <ErrorAlert error={error} />
      {tab === 'tpl' ? (
        <Panel flat bodyClass="tight">
          {loading && !tpls ? <div className="panel-body"><Loading /></div> : (
            <table className="tbl">
              <thead><tr><th>Event</th><th>Subjek</th><th>Threshold</th><th>Status</th><th /></tr></thead>
              <tbody>{tpls?.map((t) => (
                <tr key={t.id}>
                  <td><b>{t.name}</b><div className="tiny muted">{t.eventType}</div></td>
                  <td className="small truncate" style={{ maxWidth: 340 }}>{t.subject}</td>
                  <td className="small">{t.minPriority === 'low' ? 'Semua prioritas' : `≥ ${PRIORITY[t.minPriority].label}`}</td>
                  <td><span className={`badge ${t.enabled ? 'tone-ok' : 'tone-muted'}`}><span className="pip" />{t.enabled ? 'Aktif' : 'Nonaktif'}</span></td>
                  <td className="r"><button className="btn sm" onClick={() => setEdit({ ...t })}>Ubah</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Panel>
      ) : (
        <Panel flat bodyClass="tight">
          <div className="panel-body row" style={{ borderBottom: '1px solid var(--line-soft)' }}>
            {[['', 'Semua'], ['sent', 'Terkirim'], ['pending', 'Antre'], ['failed', 'Gagal']].map(([k, l]) => <button key={k} className={`chip ${st === k ? 'on' : ''}`} onClick={() => { setSt(k); setPage(1); }}>{l}</button>)}
          </div>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Waktu</th><th>Penerima</th><th>Event</th><th>Subjek</th><th>Status</th><th /></tr></thead>
            <tbody>{logs?.map((n) => (
              <tr key={n.id}>
                <td className="small nowrap">{fmtDateTime(n.createdAt)}</td>
                <td className="small">{n.user.fullName}<div className="tiny muted">{n.user.email}</div></td>
                <td className="small">{n.eventType}</td>
                <td className="small truncate" style={{ maxWidth: 300 }} title={n.error ?? ''}>{n.subject}{n.error && <div className="tiny" style={{ color: 'var(--bad)' }}>{n.error.slice(0, 90)}</div>}</td>
                <td><span className={`badge ${DS[n.status][0]}`}>{DS[n.status][1]}</span><div className="tiny muted">{n.attempts}× · {n.sentAt ? fmtDateTime(n.sentAt) : '—'}</div></td>
                <td className="r">{n.status === 'failed' && <button className="btn sm" onClick={async () => { if (await run('r', () => post(`/notifications/admin/${n.id}/retry`), 'Dijadwalkan ulang')) reloadLogs(); }}><RotateCcw />Kirim ulang</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <Pagination meta={meta} onPage={setPage} />
        </Panel>
      )}
      <Modal open={!!edit} wide onClose={() => setEdit(null)} title={edit?.name}
        footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Batal</button><button className="btn primary" disabled={!!busy} onClick={async () => { if (await run('s', () => patch(`/notifications/admin/templates/${edit.eventType}`, { subject: edit.subject, body: edit.body, enabled: edit.enabled, minPriority: edit.minPriority }), 'Template disimpan')) { setEdit(null); reload(); } }}><Save />Simpan template</button></>}>
        {edit && (
          <div className="stack">
            <div className="form-grid">
              <Field label="Kirim untuk prioritas"><select className="select" value={edit.minPriority} onChange={(e) => setEdit({ ...edit, minPriority: e.target.value })}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{k === 'low' ? 'Semua prioritas' : `≥ ${v.label}`}</option>)}</select></Field>
              <Field label="Status"><label className="check" style={{ height: 40 }}><input type="checkbox" checked={edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} />Kirim e-mail untuk event ini</label></Field>
            </div>
            <Field label="Subjek"><input className="input" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></Field>
            <Field label="Isi" hint={<>Variabel: {VARS.map((v) => <code key={v} style={{ marginRight: 6, color: 'var(--ion)' }}>{`{{${v}}}`}</code>)}</>}><textarea className="textarea" style={{ minHeight: 180, fontFamily: 'ui-monospace, monospace', fontSize: 13 }} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
            <div className="panel flat" style={{ padding: 16, background: 'var(--void)' }}>
              <div className="row small muted" style={{ marginBottom: 8 }}><Mail size={14} />Contoh tampilan</div>
              <b>{render(edit.subject)}</b>
              <p className="small ink2" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{render(edit.body)}</p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

const SAMPLE: Record<string, string> = { nama: 'Rina Anggraini', ref: 'PBL-202610-0007', judul: 'Pembelian 10 unit laptop', status: 'Pending Approval', prioritas: 'Tinggi', level: 'L2 · Manajer', aktor: 'Budi Santoso', pengaju: 'Rina Anggraini', alasan: 'Lampirkan perbandingan 3 vendor', due: '24 Okt 2026', link: 'https://office.local/requests/7', delegator: 'Sari Lestari', periode: '21–25 Okt 2026' };
const render = (s: string) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => SAMPLE[k] ?? '');
