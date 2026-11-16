'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Copy, GitBranch, Plus } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { patch, post } from '@/lib/api';
import { ruleText } from '@/lib/format';
import { Empty, ErrorAlert, Field, Loading, Modal, Panel, useAction, useToast } from '@/components/ui';

const FS: Record<string, [string, string]> = { active: ['tone-ok', 'Aktif'], draft: ['tone-warn', 'Draft'], archived: ['tone-muted', 'Diarsipkan'] };

export default function FlowsPage() {
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useApi<any[]>(`/approval-flows${status ? `?status=${status}` : ''}`);
  const { data: depts } = useApi<any[]>('/departments');
  const [dup, setDup] = useState<any>(null);
  const [dupForm, setDupForm] = useState({ name: '', code: '', departmentId: '' });
  const { busy, run } = useAction();
  const toast = useToast();

  return (
    <>
      <div className="page-head">
        <div><h1>Alur approval</h1><p className="lead">Modelkan alur bertingkat tanpa ubah kode. Request otomatis masuk ke alur aktif paling spesifik yang cocok dengan tipe, unit, prioritas, dan nilainya.</p></div>
        <div className="page-actions">
          <div className="seg">{[['', 'Semua'], ['active', 'Aktif'], ['draft', 'Draft'], ['archived', 'Arsip']].map(([k, l]) => <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>)}</div>
          <Link href="/admin/approval-flows/new" className="btn primary"><Plus />Alur baru</Link>
        </div>
      </div>
      <ErrorAlert error={error} />
      {loading && !data ? <Loading /> : !data?.length ? <Panel><Empty icon={<GitBranch />} title="Belum ada alur" action={<Link href="/admin/approval-flows/new" className="btn primary">Buat alur pertama</Link>}>Tanpa alur aktif, request langsung berstatus Submitted tanpa approval.</Empty></Panel> : (
        <div className="grid cols-2">
          {data.map((f) => (
            <section key={f.id} className="panel" style={{ padding: 20 }}>
              <div className="row between top">
                <div style={{ minWidth: 0 }}>
                  <div className="row wrap" style={{ gap: 8, marginBottom: 4 }}><span className="ref">{f.code}</span><span className={`badge ${FS[f.status][0]}`}><span className="pip" />{FS[f.status][1]}</span></div>
                  <Link href={`/admin/approval-flows/${f.id}`} style={{ color: 'var(--ink)' }}><h3 style={{ fontSize: 17 }}>{f.name}</h3></Link>
                  <p className="small muted" style={{ marginTop: 4 }}>{f.triggerType?.name ?? 'Semua tipe'} · {f.department?.name ?? 'Global'} · {ruleText(f.thresholdRuleJson)}</p>
                </div>
                <div className="row">
                  <button className="btn ghost sm icon" title="Replikasi ke unit lain" onClick={() => { setDup(f); setDupForm({ name: `${f.name} (salinan)`, code: `${f.code}-COPY`, departmentId: '' }); }}><Copy /></button>
                </div>
              </div>
              <div className="row wrap" style={{ gap: 6, marginTop: 14 }}>
                {f.levels.map((l: any, i: number) => (
                  <span key={l.id} className="row" style={{ gap: 6 }}>
                    {i > 0 && <span className="muted">→</span>}
                    <span className="chip" style={{ cursor: 'default' }} title={l.conditionJson ? `Hanya jika ${ruleText(l.conditionJson)}` : undefined}>
                      <span className="num" style={{ color: 'var(--ion)' }}>{i + 1}</span>{l.name}{l.conditionJson && <span className="tiny" style={{ color: 'var(--warn)' }}>bersyarat</span>}
                    </span>
                  </span>
                ))}
              </div>
              <div className="row between" style={{ marginTop: 16 }}>
                <span className="tiny muted">{f._count.instances} request pernah melalui alur ini</span>
                <div className="row">
                  {f.status !== 'active' && <button className="btn sm ok" disabled={!!busy} onClick={async () => { if (await run(`a${f.id}`, () => patch(`/approval-flows/${f.id}`, { status: 'active' }), 'Alur diaktifkan')) reload(); }}>Aktifkan</button>}
                  {f.status === 'active' && <button className="btn sm" disabled={!!busy} onClick={async () => { if (await run(`r${f.id}`, () => patch(`/approval-flows/${f.id}`, { status: 'archived' }), 'Alur diarsipkan')) reload(); }}>Arsipkan</button>}
                  <Link href={`/admin/approval-flows/${f.id}`} className="btn sm">Ubah</Link>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
      <Modal open={!!dup} onClose={() => setDup(null)} title="Replikasi alur"
        footer={<><button className="btn ghost" onClick={() => setDup(null)}>Batal</button><button className="btn primary" disabled={!!busy || dupForm.name.length < 3 || dupForm.code.length < 2} onClick={async () => {
          const r = await run('dup', () => post(`/approval-flows/${dup.id}/duplicate`, { ...dupForm, departmentId: dupForm.departmentId || null }));
          if (r) { toast.ok('Alur direplikasi sebagai draft'); setDup(null); reload(); }
        }}><Copy />Replikasi</button></>}>
        <div className="stack">
          <p className="small ink2">Salinan dibuat berstatus draft dengan level yang sama, lalu dapat disesuaikan sebelum diaktifkan.</p>
          <Field label="Nama" required><input className="input" value={dupForm.name} onChange={(e) => setDupForm({ ...dupForm, name: e.target.value })} /></Field>
          <Field label="Kode" required><input className="input" value={dupForm.code} onChange={(e) => setDupForm({ ...dupForm, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Untuk unit"><select className="select" value={dupForm.departmentId} onChange={(e) => setDupForm({ ...dupForm, departmentId: e.target.value })}><option value="">Global (semua unit)</option>{depts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        </div>
      </Modal>
    </>
  );
}
