'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronLeft, FlaskConical, Plus, Save, Trash2 } from 'lucide-react';
import { get, patch, post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { PRIORITY, fmtMoney, ruleText } from '@/lib/format';
import { ErrorAlert, Field, Loading, Panel, useToast } from '@/components/ui';
import { UserPicker, type UserLite } from '@/components/user-picker';

interface LevelForm {
  name: string; approverType: 'role' | 'user' | 'dept_head'; approverRoleId: string; approverUser: UserLite | null;
  sameDeptOnly: boolean; delegateOn: boolean; slaHours: number; condMinPriority: string; condThreshold: string;
}
const newLevel = (n: number): LevelForm => ({ name: `Level ${n}`, approverType: 'role', approverRoleId: '', approverUser: null, sameDeptOnly: true, delegateOn: true, slaHours: 24, condMinPriority: '', condThreshold: '' });

export default function FlowEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === 'new';
  const router = useRouter();
  const toast = useToast();
  const { me } = useAuth();
  const { data: roles } = useApi<any[]>('/roles');
  const { data: depts } = useApi<any[]>('/departments');
  const { data: types } = useApi<any[]>('/request-types?all=1');
  const [f, setF] = useState({ name: '', code: '', description: '', departmentId: '', triggerTypeId: '', minPriority: '', threshold: '', rejectAction: 'revise', status: 'draft' });
  const [levels, setLevels] = useState<LevelForm[]>([newLevel(1)]);
  const [loaded, setLoaded] = useState(isNew);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sim, setSim] = useState({ priority: 'med', amount: '', departmentId: '' });
  const [simResult, setSimResult] = useState<any>(null);

  useEffect(() => {
    if (isNew) return;
    get<any>(`/approval-flows/${id}`).then((x) => {
      const rule = x.thresholdRuleJson ?? {};
      setF({ name: x.name, code: x.code, description: x.description ?? '', departmentId: x.departmentId ?? '', triggerTypeId: x.triggerTypeId ?? '', minPriority: rule.min_priority ?? '', threshold: rule.threshold_value != null ? String(rule.threshold_value) : '', rejectAction: x.rejectAction, status: x.status });
      setLevels(x.levels.map((l: any) => ({
        name: l.name, approverType: l.approverType, approverRoleId: l.approverRoleId ?? '', approverUser: l.approverUser ? { id: l.approverUser.id, fullName: l.approverUser.fullName } : null,
        sameDeptOnly: l.sameDeptOnly, delegateOn: l.delegateOn, slaHours: l.slaHours, condMinPriority: l.conditionJson?.min_priority ?? '', condThreshold: l.conditionJson?.threshold_value != null ? String(l.conditionJson.threshold_value) : '',
      })));
      setLoaded(true);
    }).catch((e) => setError(e.message));
  }, [id, isNew]);

  const setL = (i: number, patchL: Partial<LevelForm>) => setLevels((ls) => ls.map((l, k) => (k === i ? { ...l, ...patchL } : l)));
  const move = (i: number, d: number) => setLevels((ls) => { const c = [...ls]; const [x] = c.splice(i, 1); c.splice(i + d, 0, x); return c; });

  const issues: string[] = [];
  if (f.name.trim().length < 3) issues.push('Nama alur minimal 3 karakter');
  if (!/^[A-Z0-9_-]{2,60}$/.test(f.code)) issues.push('Kode 2–60 karakter: huruf besar, angka, - atau _');
  levels.forEach((l, i) => {
    if (!l.name.trim()) issues.push(`Level ${i + 1}: nama wajib diisi`);
    if (l.approverType === 'role' && !l.approverRoleId) issues.push(`Level ${i + 1}: pilih role approver`);
    if (l.approverType === 'user' && !l.approverUser) issues.push(`Level ${i + 1}: pilih pengguna approver`);
  });
  if (levels.length && levels.every((l) => l.condMinPriority || l.condThreshold)) issues.push('Minimal satu level tanpa syarat agar alur selalu punya approver');

  const rule = (mp: string, th: string) => (mp || th ? { ...(mp ? { min_priority: mp } : {}), ...(th ? { threshold_value: Number(th) } : {}) } : null);

  const save = async () => {
    if (issues.length) { setError(issues[0]); return; }
    setSaving(true); setError(null);
    const payload = {
      name: f.name.trim(), code: f.code, description: f.description || undefined, departmentId: f.departmentId || null, triggerTypeId: f.triggerTypeId || null,
      thresholdRule: rule(f.minPriority, f.threshold), rejectAction: f.rejectAction, status: f.status,
      levels: levels.map((l) => ({
        name: l.name.trim(), approverType: l.approverType, approverRoleId: l.approverType === 'role' ? l.approverRoleId : null,
        approverUserId: l.approverType === 'user' ? l.approverUser?.id : null, sameDeptOnly: l.sameDeptOnly, delegateOn: l.delegateOn,
        slaHours: Number(l.slaHours) || 24, condition: rule(l.condMinPriority, l.condThreshold),
      })),
    };
    try {
      const r = isNew ? await post<any>('/approval-flows', payload) : await patch<any>(`/approval-flows/${id}`, payload);
      toast.ok(isNew ? 'Alur dibuat' : 'Perubahan disimpan');
      if (isNew) router.replace(`/admin/approval-flows/${r.id}`);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const simulate = async () => {
    if (!f.triggerTypeId) { setSimResult({ note: 'Pilih tipe request pemicu untuk simulasi.' }); return; }
    try {
      const r = await post('/approval-flows/preview', { typeId: f.triggerTypeId, priority: sim.priority, amount: sim.amount ? Number(sim.amount) : undefined, departmentId: sim.departmentId || me?.departmentId || undefined });
      setSimResult(r);
    } catch (e: any) { setSimResult({ note: e.message }); }
  };

  if (!loaded) return error ? <ErrorAlert error={error} /> : <Loading rows={6} />;
  const roleName = (rid: string) => roles?.find((r) => r.id === rid)?.name;

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/admin/approval-flows" className="small row" style={{ gap: 4, marginBottom: 8 }}><ChevronLeft size={15} />Alur approval</Link>
          <h1>{isNew ? 'Alur approval baru' : f.name}</h1>
          <p className="lead">Level diproses berurutan. Level bersyarat hanya dilalui jika request memenuhi syaratnya.</p>
        </div>
        <div className="page-actions"><button className="btn primary" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : <Save />}Simpan alur</button></div>
      </div>
      <ErrorAlert error={error} />
      <div className="grid split" style={{ marginTop: error ? 14 : 0 }}>
        <div className="stack lg">
          <Panel title="Identitas & pemicu" sub="Kapan alur ini dipakai">
            <div className="form-grid">
              <Field label="Nama alur" required><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Pembelian — Prioritas Tinggi" /></Field>
              <Field label="Kode" required hint="Unik, huruf besar"><input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '-') })} placeholder="PBL-HIGH" /></Field>
              <Field label="Deskripsi" className="full"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
              <Field label="Tipe request pemicu"><select className="select" value={f.triggerTypeId} onChange={(e) => setF({ ...f, triggerTypeId: e.target.value })}><option value="">Semua tipe</option>{types?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
              <Field label="Berlaku untuk unit" hint={me?.isSuperAdmin ? 'Global berlaku untuk semua unit' : 'Admin departemen hanya untuk unitnya'}>
                <select className="select" value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}><option value="">Global</option>{depts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
              </Field>
              <Field label="Syarat prioritas minimum"><select className="select" value={f.minPriority} onChange={(e) => setF({ ...f, minPriority: e.target.value })}><option value="">Tanpa syarat</option>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>≥ {v.label}</option>)}</select></Field>
              <Field label="Syarat nilai minimum (Rp)" hint={f.threshold ? fmtMoney(f.threshold) : 'Kosongkan bila tidak dipakai'}><input className="input" inputMode="numeric" value={f.threshold} onChange={(e) => setF({ ...f, threshold: e.target.value.replace(/\D/g, '') })} /></Field>
              <Field label="Jika ditolak"><select className="select" value={f.rejectAction} onChange={(e) => setF({ ...f, rejectAction: e.target.value })}><option value="revise">Kembalikan ke pengaju untuk revisi</option><option value="close">Tutup request</option></select></Field>
              <Field label="Status"><select className="select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="draft">Draft</option><option value="active">Aktif</option><option value="archived">Diarsipkan</option></select></Field>
            </div>
          </Panel>

          <Panel title="Level approval" sub={`${levels.length} level`} actions={<button className="btn sm" onClick={() => setLevels([...levels, newLevel(levels.length + 1)])}><Plus />Tambah level</button>}>
            <div className="stack lg">
              {levels.map((l, i) => (
                <div key={i} className="panel flat" style={{ padding: 16, background: 'var(--void)' }}>
                  <div className="row between" style={{ marginBottom: 12 }}>
                    <span className="row"><span className="num" style={{ width: 28, height: 28, borderRadius: 14, display: 'grid', placeItems: 'center', border: '1.5px solid var(--ion)', color: 'var(--ion)' }}>{i + 1}</span><b>{l.name || `Level ${i + 1}`}</b></span>
                    <span className="row">
                      <button className="btn ghost sm icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Naikkan"><ArrowUp /></button>
                      <button className="btn ghost sm icon" disabled={i === levels.length - 1} onClick={() => move(i, 1)} aria-label="Turunkan"><ArrowDown /></button>
                      <button className="btn ghost sm icon" disabled={levels.length === 1} onClick={() => setLevels(levels.filter((_, k) => k !== i))} aria-label="Hapus level"><Trash2 /></button>
                    </span>
                  </div>
                  <div className="form-grid">
                    <Field label="Nama level" required><input className="input" value={l.name} onChange={(e) => setL(i, { name: e.target.value })} /></Field>
                    <Field label="Approver">
                      <div className="seg" style={{ width: '100%' }}>
                        {[['role', 'Role'], ['dept_head', 'Kepala unit'], ['user', 'Orang tertentu']].map(([k, lb]) => <button key={k} style={{ flex: 1 }} className={l.approverType === k ? 'on' : ''} onClick={() => setL(i, { approverType: k as any })}>{lb}</button>)}
                      </div>
                    </Field>
                    {l.approverType === 'role' && <Field label="Role approver" required><select className={`select ${!l.approverRoleId ? 'invalid' : ''}`} value={l.approverRoleId} onChange={(e) => setL(i, { approverRoleId: e.target.value })}><option value="">Pilih role…</option>{roles?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>}
                    {l.approverType === 'user' && <Field label="Pengguna approver" required><UserPicker value={l.approverUser} onChange={(u) => setL(i, { approverUser: u })} /></Field>}
                    <Field label="SLA (jam)"><input className="input" type="number" min={1} max={720} value={l.slaHours} onChange={(e) => setL(i, { slaHours: Number(e.target.value) })} /></Field>
                    <Field label="Hanya jika prioritas ≥"><select className="select" value={l.condMinPriority} onChange={(e) => setL(i, { condMinPriority: e.target.value })}><option value="">Selalu dilalui</option>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
                    <Field label="Hanya jika nilai ≥ (Rp)"><input className="input" inputMode="numeric" value={l.condThreshold} onChange={(e) => setL(i, { condThreshold: e.target.value.replace(/\D/g, '') })} placeholder="—" /></Field>
                    <div className="full row wrap" style={{ gap: 20 }}>
                      {l.approverType !== 'user' && <label className="check"><input type="checkbox" checked={l.sameDeptOnly} onChange={(e) => setL(i, { sameDeptOnly: e.target.checked })} />Cari approver di unit pengaju (naik ke unit induk bila tidak ada)</label>}
                      <label className="check"><input type="checkbox" checked={l.delegateOn} onChange={(e) => setL(i, { delegateOn: e.target.checked })} />Izinkan delegasi</label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="stack lg">
          <Panel title="Pratinjau alur">
            <div className="timeline">
              <div className="tl-item"><div className="tl-dot"><span className="tiny">▶</span></div><div className="tl-body"><b>Request masuk</b><div className="small muted">{types?.find((t) => t.id === f.triggerTypeId)?.name ?? 'Semua tipe'} · {depts?.find((d) => d.id === f.departmentId)?.name ?? 'semua unit'} · {ruleText(rule(f.minPriority, f.threshold))}</div></div></div>
              {levels.map((l, i) => (
                <div key={i} className="tl-item">
                  <div className={`tl-dot ${l.condMinPriority || l.condThreshold ? 'warn' : 'ion'}`}><span className="num tiny">{i + 1}</span></div>
                  <div className="tl-body">
                    <b>{l.name || `Level ${i + 1}`}</b>
                    <div className="small muted">{l.approverType === 'role' ? `Role ${roleName(l.approverRoleId) ?? '—'}${l.sameDeptOnly ? ' di unit pengaju' : ''}` : l.approverType === 'dept_head' ? 'Kepala unit pengaju' : l.approverUser?.fullName ?? 'Pengguna —'} · SLA {l.slaHours} jam</div>
                    {(l.condMinPriority || l.condThreshold) && <div className="tiny" style={{ color: 'var(--warn)' }}>Hanya jika {ruleText(rule(l.condMinPriority, l.condThreshold))}</div>}
                  </div>
                </div>
              ))}
              <div className="tl-item"><div className="tl-dot ok"><span className="tiny">✓</span></div><div className="tl-body"><b>Approved</b><div className="small muted">Ditolak di level mana pun → {f.rejectAction === 'revise' ? 'kembali ke pengaju' : 'request ditutup'}</div></div></div>
            </div>
            {issues.length > 0 && <div className="alert warn" style={{ marginTop: 10 }}><span>{issues.length} hal perlu dilengkapi: {issues[0]}</span></div>}
          </Panel>

          <Panel title={<span className="row"><FlaskConical size={17} style={{ color: 'var(--ion)' }} /><h2>Simulasi routing</h2></span>} sub="Uji request contoh terhadap seluruh alur aktif yang tersimpan">
            <div className="stack">
              <div className="form-grid">
                <Field label="Prioritas"><select className="select" value={sim.priority} onChange={(e) => setSim({ ...sim, priority: e.target.value })}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
                <Field label="Nilai (Rp)"><input className="input" inputMode="numeric" value={sim.amount} onChange={(e) => setSim({ ...sim, amount: e.target.value.replace(/\D/g, '') })} /></Field>
                <Field label="Unit pengaju" className="full"><select className="select" value={sim.departmentId} onChange={(e) => setSim({ ...sim, departmentId: e.target.value })}><option value="">Unit saya</option>{depts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
              </div>
              <button className="btn" onClick={simulate}><FlaskConical />Jalankan simulasi</button>
              {simResult?.note && <div className="small muted">{simResult.note}</div>}
              {simResult && !simResult.note && (!simResult.flow ? <div className="alert info"><span>Tidak ada alur aktif yang cocok — request langsung Submitted.</span></div> : (
                <div className="stack sm">
                  <div className="small">Masuk ke <b>{simResult.flow.name}</b>{simResult.flow.id === id ? ' (alur ini)' : ''}</div>
                  {simResult.levels.map((l: any, i: number) => <div key={i} className="small row"><span className="num" style={{ color: 'var(--ion)' }}>{i + 1}</span><span className="grow">{l.name}</span><span className="muted">{l.approvers.map((a: any) => a.fullName).join(', ') || '—'}</span></div>)}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
