'use client';
import { useMemo, useState } from 'react';
import { Building2, Plus, Save, Trash2 } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { del, patch, post } from '@/lib/api';
import { ErrorAlert, Field, Loading, Modal, Panel, useAction } from '@/components/ui';
import { UserPicker } from '@/components/user-picker';

const KIND: Record<string, string> = { department: 'Departemen', division: 'Divisi', unit: 'Unit' };

export default function DepartmentsPage() {
  const { data, error, loading, reload } = useApi<any[]>('/departments');
  const [edit, setEdit] = useState<any>(null);
  const { busy, run } = useAction();
  const rows = useMemo(() => {
    const by: Record<string, any[]> = {};
    for (const d of data ?? []) (by[d.parentDeptId ?? 'root'] ??= []).push(d);
    const out: { d: any; depth: number }[] = [];
    const walk = (p: string, depth: number) => (by[p] ?? []).forEach((d) => { out.push({ d, depth }); walk(d.id, depth + 1); });
    walk('root', 0);
    return out;
  }, [data]);

  return (
    <>
      <div className="page-head">
        <div><h1>Struktur organisasi</h1><p className="lead">Departemen, divisi, dan unit beserta kepalanya. Hierarki dipakai untuk mencari approver (naik ke unit induk) dan akses folder.</p></div>
        <div className="page-actions"><button className="btn primary" onClick={() => setEdit({ name: '', code: '', kind: 'department', parentDeptId: '', head: null })}><Plus />Unit baru</button></div>
      </div>
      <ErrorAlert error={error} />
      <Panel flat bodyClass="tight">
        {loading && !data ? <div className="panel-body"><Loading /></div> : (
          <table className="tbl">
            <thead><tr><th>Unit</th><th>Jenis</th><th>Kepala</th><th className="r">Anggota</th><th /></tr></thead>
            <tbody>{rows.map(({ d, depth }) => (
              <tr key={d.id}>
                <td><span className="row" style={{ paddingLeft: depth * 22 }}>{depth > 0 && <span className="muted">└</span>}<Building2 size={16} style={{ color: depth ? 'var(--muted)' : 'var(--ion)' }} /><b>{d.name}</b><span className="ref">{d.code}</span></span></td>
                <td className="small">{KIND[d.kind]}</td>
                <td className="small">{d.head?.fullName ?? <span className="muted">—</span>}</td>
                <td className="r num">{d.memberCount}</td>
                <td className="r nowrap">
                  <button className="btn sm" onClick={() => setEdit({ ...d, parentDeptId: d.parentDeptId ?? '', head: d.head })}>Ubah</button>
                  <button className="btn ghost sm icon" aria-label="Hapus" onClick={async () => { if (await run('d', () => del(`/departments/${d.id}`), 'Unit dihapus')) reload(); }}><Trash2 /></button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Panel>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah unit' : 'Unit baru'}
        footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Batal</button><button className="btn primary" disabled={!edit || edit.name.length < 2 || edit.code.length < 2 || !!busy} onClick={async () => {
          const body = { name: edit.name, code: edit.code, kind: edit.kind, parentDeptId: edit.parentDeptId || null, headUserId: edit.head?.id ?? null };
          if (await run('s', () => (edit.id ? patch(`/departments/${edit.id}`, body) : post('/departments', body)), 'Unit disimpan')) { setEdit(null); reload(); }
        }}><Save />Simpan</button></>}>
        {edit && (
          <div className="form-grid">
            <Field label="Nama" required className="full"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Kode" required><input className="input" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} /></Field>
            <Field label="Jenis"><select className="select" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Induk" className="full"><select className="select" value={edit.parentDeptId} onChange={(e) => setEdit({ ...edit, parentDeptId: e.target.value })}><option value="">— Tingkat teratas —</option>{data?.filter((d) => d.id !== edit.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            <Field label="Kepala unit" className="full"><UserPicker value={edit.head} onChange={(u) => setEdit({ ...edit, head: u })} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
