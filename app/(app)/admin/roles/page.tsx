'use client';
import { Fragment, useEffect, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { post, put } from '@/lib/api';
import { ErrorAlert, Field, Loading, Modal, Panel, useAction } from '@/components/ui';

const MODULE_LABEL: Record<string, string> = { account: 'Akun & organisasi', workflow: 'Workflow', document: 'Dokumen', approval: 'Approval', export: 'Ekspor', notification: 'Notifikasi', audit: 'Audit' };

/** Matriks RBAC: role × permission (FR-ACC-04). */
export default function RolesPage() {
  const { data: roles, error, loading, reload } = useApi<any[]>('/roles');
  const { data: perms } = useApi<any[]>('/permissions');
  const [matrix, setMatrix] = useState<Record<string, Set<string>>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);
  const [nr, setNr] = useState({ name: '', description: '' });
  const { busy, run } = useAction();

  useEffect(() => { if (roles) { setMatrix(Object.fromEntries(roles.map((r) => [r.id, new Set<string>(r.permissionCodes)]))); setDirty(new Set()); } }, [roles]);
  const toggle = (rid: string, code: string) => {
    setMatrix((m) => { const s = new Set(m[rid]); s.has(code) ? s.delete(code) : s.add(code); return { ...m, [rid]: s }; });
    setDirty((d) => new Set(d).add(rid));
  };
  const saveAll = async () => {
    const ok = await run('s', async () => { for (const rid of dirty) await put(`/roles/${rid}/permissions`, { permissionCodes: [...matrix[rid]] }); return true; }, 'Matriks izin disimpan');
    if (ok) reload();
  };
  const grouped = (perms ?? []).reduce<Record<string, any[]>>((a, p) => ({ ...a, [p.module]: [...(a[p.module] ?? []), p] }), {});

  return (
    <>
      <div className="page-head">
        <div><h1>Role & izin</h1><p className="lead">Centang izin per role. Perubahan berlaku pada request berikutnya dari pengguna tersebut.</p></div>
        <div className="page-actions">
          <button className="btn" onClick={() => setNewOpen(true)}><Plus />Role baru</button>
          <button className="btn primary" disabled={!dirty.size || !!busy} onClick={saveAll}><Save />Simpan {dirty.size ? `(${dirty.size} role)` : ''}</button>
        </div>
      </div>
      <ErrorAlert error={error} />
      <Panel flat bodyClass="tight">
        {loading && !roles ? <div className="panel-body"><Loading /></div> : (
          <div className="table-wrap">
            <table className="tbl matrix">
              <thead><tr><th>Izin</th>{roles?.map((r) => <th key={r.id} title={r.description}>{r.name}<div className="tiny muted">{r.userCount} pengguna</div></th>)}</tr></thead>
              <tbody>
                {Object.entries(grouped).map(([mod, list]) => (
                  <Fragment key={mod}>
                    <tr><td colSpan={(roles?.length ?? 0) + 1} style={{ background: 'var(--ion-soft)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>{MODULE_LABEL[mod] ?? mod}</td></tr>
                    {list.map((p) => (
                      <tr key={p.code}>
                        <td><span className="small">{p.description}</span><div className="tiny muted">{p.code}</div></td>
                        {roles?.map((r) => (
                          <td key={r.id}><input type="checkbox" style={{ accentColor: 'var(--ion)', width: 17, height: 17 }} checked={matrix[r.id]?.has(p.code) ?? false} onChange={() => toggle(r.id, p.code)} aria-label={`${r.name}: ${p.code}`} /></td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Role baru"
        footer={<><button className="btn ghost" onClick={() => setNewOpen(false)}>Batal</button><button className="btn primary" disabled={nr.name.length < 2 || !!busy} onClick={async () => { if (await run('n', () => post('/roles', nr), 'Role dibuat')) { setNewOpen(false); setNr({ name: '', description: '' }); reload(); } }}><Plus />Buat role</button></>}>
        <div className="stack">
          <Field label="Nama role" required><input className="input" value={nr.name} onChange={(e) => setNr({ ...nr, name: e.target.value })} placeholder="Contoh: Kepala Seksi" /></Field>
          <Field label="Deskripsi"><input className="input" value={nr.description} onChange={(e) => setNr({ ...nr, description: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  );
}
