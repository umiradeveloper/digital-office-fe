'use client';
import { useState } from 'react';
import { ListChecks, Plus, Save, Trash2 } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { patch, post } from '@/lib/api';
import { ErrorAlert, Field, Loading, Modal, Panel, useAction } from '@/components/ui';

const FT = [['text', 'Teks'], ['textarea', 'Paragraf'], ['number', 'Angka'], ['currency', 'Nominal (Rp)'], ['date', 'Tanggal'], ['select', 'Pilihan']];
const CAT: Record<string, string> = { tugas: 'Tugas', pengajuan: 'Pengajuan', 'follow-up': 'Follow-up' };
type CF = { key: string; label: string; type: string; required?: boolean; options?: string[] };

export default function RequestTypesPage() {
  const { data, error, loading, reload } = useApi<any[]>('/request-types?all=1');
  const [edit, setEdit] = useState<any>(null);
  const { busy, run } = useAction();
  const blank = { id: null, name: '', code: '', description: '', category: 'pengajuan', enabled: true, customFields: [] as CF[] };
  const fields: CF[] = edit?.customFields ?? [];
  const setField = (i: number, p: Partial<CF>) => setEdit({ ...edit, customFields: fields.map((f, k) => (k === i ? { ...f, ...p } : f)) });
  const keyOk = (k: string) => /^[a-z][a-z0-9_]*$/.test(k);
  const invalid = !edit || edit.name.length < 2 || !/^[A-Z0-9_]{2,40}$/i.test(edit.code) || fields.some((f) => !keyOk(f.key) || !f.label || (f.type === 'select' && !f.options?.length));

  return (
    <>
      <div className="page-head">
        <div><h1>Tipe request</h1><p className="lead">Atur katalog tipe request dan kolom tambahan per tipe. Kolom bertipe nominal dipakai sebagai nilai threshold approval.</p></div>
        <div className="page-actions"><button className="btn primary" onClick={() => setEdit(blank)}><Plus />Tipe baru</button></div>
      </div>
      <ErrorAlert error={error} />
      <Panel flat bodyClass="tight">
        {loading && !data ? <div className="panel-body"><Loading /></div> : (
          <table className="tbl">
            <thead><tr><th>Tipe</th><th>Kategori</th><th>Kolom tambahan</th><th>Status</th><th /></tr></thead>
            <tbody>{data?.map((t) => (
              <tr key={t.id}>
                <td><span className="ref">{t.code}</span><div style={{ fontWeight: 500 }}>{t.name}</div><div className="tiny muted">{t.description}</div></td>
                <td><span className="badge tone-info">{CAT[t.category] ?? t.category}</span></td>
                <td className="small">{(t.customFieldsJson ?? []).map((f: CF) => f.label).join(', ') || <span className="muted">—</span>}</td>
                <td><span className={`badge ${t.enabled ? 'tone-ok' : 'tone-muted'}`}><span className="pip" />{t.enabled ? 'Aktif' : 'Nonaktif'}</span></td>
                <td className="r"><button className="btn sm" onClick={() => setEdit({ ...t, customFields: t.customFieldsJson ?? [] })}>Ubah</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Panel>
      <Modal open={!!edit} wide onClose={() => setEdit(null)} title={edit?.id ? `Ubah ${edit.name}` : 'Tipe request baru'}
        footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Batal</button><button className="btn primary" disabled={invalid || !!busy} onClick={async () => {
          const body = { name: edit.name, description: edit.description, category: edit.category, enabled: edit.enabled, customFields: fields };
          const ok = await run('s', () => (edit.id ? patch(`/request-types/${edit.id}`, body) : post('/request-types', { ...body, code: edit.code })), 'Tipe request disimpan');
          if (ok) { setEdit(null); reload(); }
        }}><Save />Simpan</button></>}>
        {edit && (
          <div className="stack lg">
            <div className="form-grid">
              <Field label="Nama" required><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Kode" required hint="Dipakai sebagai prefix nomor ref"><input className="input" disabled={!!edit.id} value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} /></Field>
              <Field label="Kategori"><select className="select" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Status"><label className="check" style={{ height: 40 }}><input type="checkbox" checked={edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} />Dapat dipilih saat membuat request</label></Field>
              <Field label="Deskripsi" className="full"><input className="input" value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            </div>
            <div className="stack">
              <div className="row between"><h3 className="row"><ListChecks size={16} />Kolom tambahan</h3><button className="btn sm" onClick={() => setEdit({ ...edit, customFields: [...fields, { key: `kolom_${fields.length + 1}`, label: '', type: 'text', required: false }] })}><Plus />Tambah kolom</button></div>
              {!fields.length && <p className="small muted">Belum ada kolom tambahan.</p>}
              {fields.map((f, i) => (
                <div key={i} className="row wrap top" style={{ gap: 10, padding: 12, borderRadius: 12, border: '1px solid var(--line-soft)' }}>
                  <Field label="Label" className="grow"><input className="input" value={f.label} onChange={(e) => setField(i, { label: e.target.value })} /></Field>
                  <Field label="Key" error={!keyOk(f.key) ? 'huruf kecil & _' : null}><input className="input" style={{ width: 150 }} value={f.key} onChange={(e) => setField(i, { key: e.target.value })} /></Field>
                  <Field label="Tipe"><select className="select" style={{ width: 150 }} value={f.type} onChange={(e) => setField(i, { type: e.target.value })}>{FT.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                  {f.type === 'select' && <Field label="Opsi (koma)" className="grow" error={!f.options?.length ? 'Wajib' : null}><input className="input" value={(f.options ?? []).join(', ')} onChange={(e) => setField(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>}
                  <label className="check" style={{ marginTop: 30 }}><input type="checkbox" checked={!!f.required} onChange={(e) => setField(i, { required: e.target.checked })} />Wajib</label>
                  <button className="btn ghost sm icon" style={{ marginTop: 28 }} onClick={() => setEdit({ ...edit, customFields: fields.filter((_, k) => k !== i) })} aria-label="Hapus kolom"><Trash2 /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
