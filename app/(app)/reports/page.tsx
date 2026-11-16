'use client';
import { useState } from 'react';
import { FileSpreadsheet, FileText, History } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { download, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { STATUS, fmtDateTime } from '@/lib/format';
import { Field, Panel, useAction } from '@/components/ui';

const PRESETS = [
  { label: '7 hari', days: 7 }, { label: '30 hari', days: 30 }, { label: 'Kuartal ini', days: 90 }, { label: 'Semua', days: 0 },
];

export default function ReportsPage() {
  const { can } = useAuth();
  const { data: depts } = useApi<any[]>('/departments');
  const { data: types } = useApi<any[]>('/request-types');
  const { data: history, reload } = useApi<any[]>('/exports/history');
  const [f, setF] = useState({ from: '', to: '', dept: '', status: '', type: '', docType: '' });
  const [sections, setSections] = useState(['requests', 'approvals', 'documents', 'activity']);
  const { busy, run } = useAction();
  const q = qs(f);
  const preset = (days: number) => {
    if (!days) return setF({ ...f, from: '', to: '' });
    const to = new Date(); const from = new Date(Date.now() - days * 86400000);
    setF({ ...f, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
  };
  const go = (key: string, path: string, msg: string) => run(key, () => download(path), msg).then(() => reload());

  const exports = [
    { key: 'req', icon: FileSpreadsheet, title: 'Daftar request', desc: 'Seluruh kolom request sesuai filter: status, prioritas, pengaju, alur, tanggal.', fmt: 'Excel', path: `/exports/requests.xlsx${q}` },
    { key: 'apr', icon: FileSpreadsheet, title: 'Riwayat approval', desc: 'Setiap keputusan per level: siapa, kapan, catatan, dan delegasi.', fmt: 'Excel', path: `/exports/approvals.xlsx${q}` },
    { key: 'doc', icon: FileSpreadsheet, title: 'Akses dokumen', desc: 'Log membuka, mengunduh, mengunggah, dan membagikan dokumen.', fmt: 'Excel', path: `/exports/document-access.xlsx${q}` },
    ...(can('AUDIT_VIEW') ? [{ key: 'aud', icon: FileSpreadsheet, title: 'Audit trail', desc: 'Jejak audit global (immutable) untuk keperluan kepatuhan.', fmt: 'Excel', path: `/audit-logs.xlsx${qs({ from: f.from, to: f.to })}` }] : []),
  ];

  return (
    <>
      <div className="page-head"><div><h1>Laporan & ekspor</h1><p className="lead">Pilih filter sekali, lalu unduh laporan Excel atau PDF ringkas untuk management review. Setiap ekspor tercatat di audit trail.</p></div></div>
      <div className="grid split">
        <div className="stack lg">
          <Panel title="Filter laporan">
            <div className="stack">
              <div className="row wrap">{PRESETS.map((p) => <button key={p.label} className="chip" onClick={() => preset(p.days)}>{p.label}</button>)}</div>
              <div className="form-grid">
                <Field label="Dari tanggal"><input className="input" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
                <Field label="Sampai tanggal"><input className="input" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
                <Field label="Departemen"><select className="select" value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })}><option value="">Semua</option>{depts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
                <Field label="Status request"><select className="select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Semua</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
                <Field label="Tipe request"><select className="select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">Semua</option>{types?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
                <Field label="Tipe dokumen"><select className="select" value={f.docType} onChange={(e) => setF({ ...f, docType: e.target.value })}><option value="">Semua</option><option value="pdf">PDF</option><option value="image">Gambar</option><option value="office">Office</option></select></Field>
              </div>
            </div>
          </Panel>
          <Panel title="Excel (.xlsx)" bodyClass="tight">
            {exports.map((e) => (
              <div key={e.key} className="row" style={{ padding: '14px 20px', borderBottom: '1px solid var(--line-soft)', gap: 14 }}>
                <e.icon style={{ color: 'var(--ok)', flex: 'none' }} />
                <div className="grow"><div style={{ fontWeight: 500 }}>{e.title}</div><div className="small muted">{e.desc}</div></div>
                <button className="btn" disabled={!!busy} onClick={() => go(e.key, e.path, `${e.title} diunduh`)}>{busy === e.key ? <span className="spinner" /> : <FileSpreadsheet />}Unduh</button>
              </div>
            ))}
          </Panel>
        </div>
        <div className="stack lg">
          <Panel title="Laporan PDF ringkas" sub="Berisi timestamp pembuatan & filter yang dipakai">
            <div className="stack">
              {[['requests', 'Ringkasan request'], ['approvals', 'Statistik approval'], ['documents', 'Statistik dokumen'], ['activity', 'Aktivitas per modul']].map(([k, l]) => (
                <label key={k} className="check"><input type="checkbox" checked={sections.includes(k)} onChange={(e) => setSections(e.target.checked ? [...sections, k] : sections.filter((s) => s !== k))} />{l}</label>
              ))}
              <button className="btn primary block" disabled={!!busy || !sections.length} onClick={() => go('pdf', `/exports/report.pdf${qs({ ...f, sections: sections.join(',') })}`, 'Laporan PDF diunduh')}>{busy === 'pdf' ? <span className="spinner" /> : <FileText />}Buat laporan PDF</button>
            </div>
          </Panel>
          <Panel title={<span className="row"><History size={17} style={{ color: 'var(--ion)' }} /><h2>Ekspor terakhir saya</h2></span>} bodyClass="tight">
            {!history?.length ? <div className="panel-body small muted">Belum ada ekspor.</div> : history.slice(0, 10).map((h) => (
              <div key={h.id} className="row small" style={{ padding: '9px 18px', borderBottom: '1px solid var(--line-soft)' }}>
                <span className={`badge ${h.format === 'pdf' ? 'tone-bad' : 'tone-ok'}`}>{h.format.toUpperCase()}</span>
                <span className="grow">{h.module}<span className="tiny muted" style={{ display: 'block' }}>{h.rowCount} baris</span></span>
                <span className="tiny muted nowrap">{fmtDateTime(h.createdAt)}</span>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </>
  );
}
