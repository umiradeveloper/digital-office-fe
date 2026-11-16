'use client';
import { useRef, useState } from 'react';
import { FileText, Plus, Save } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { patch, post } from '@/lib/api';
import { ErrorAlert, Field, Loading, Modal, Panel, useAction } from '@/components/ui';
import { EditableBody, EditorToolbar } from '@/components/rich-editor';

const PREVIEW_NUM = (f: string, code: string) => f.replace('{seq}', '007').replace('{code}', code || 'KODE').replace('{dept}', 'KEU').replace('{month_roman}', 'X').replace('{month}', '10').replace('{year}', String(new Date().getFullYear()));

export default function DocTemplatesPage() {
  const { data, error, loading, reload } = useApi<any[]>('/doc-templates?all=1');
  const [edit, setEdit] = useState<any>(null);
  const [key, setKey] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const { busy, run } = useAction();
  const open = (t: any) => { setEdit(t); setKey((k) => k + 1); };
  const fmtOk = edit && edit.numberFormat.includes('{seq}');

  return (
    <>
      <div className="page-head">
        <div><h1>Template naskah</h1><p className="lead">Isi awal dan format nomor untuk surat, memo, berita acara, dan surat tugas. Gunakan isian seperti {'{{tanggal}}'} agar terisi otomatis.</p></div>
        <div className="page-actions"><button className="btn primary" onClick={() => open({ id: null, name: '', code: '', category: 'Surat', description: '', bodyHtml: '<p><br></p>', numberFormat: '{seq}/{code}/{dept}/{month_roman}/{year}', enabled: true })}><Plus />Template baru</button></div>
      </div>
      <ErrorAlert error={error} />
      <Panel flat bodyClass="tight">
        {loading && !data ? <div className="panel-body"><Loading /></div> : (
          <table className="tbl">
            <thead><tr><th>Template</th><th>Kategori</th><th>Contoh nomor</th><th>Status</th><th /></tr></thead>
            <tbody>{data?.map((t) => (
              <tr key={t.id}>
                <td><span className="row"><FileText size={16} style={{ color: 'var(--ion)' }} /><span><b>{t.name}</b><br /><span className="tiny muted">{t.description}</span></span></span></td>
                <td className="small">{t.category}</td>
                <td className="small num">{PREVIEW_NUM(t.numberFormat, t.code)}</td>
                <td><span className={`badge ${t.enabled ? 'tone-ok' : 'tone-muted'}`}><span className="pip" />{t.enabled ? 'Aktif' : 'Nonaktif'}</span></td>
                <td className="r"><button className="btn sm" onClick={() => open({ ...t })}>Ubah</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Panel>
      <Modal open={!!edit} wide onClose={() => setEdit(null)} title={edit?.id ? `Ubah ${edit.name}` : 'Template baru'}
        footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Batal</button><button className="btn primary" disabled={!edit || edit.name.length < 3 || !/^[A-Z0-9-]{2,30}$/i.test(edit.code) || !fmtOk || !!busy} onClick={async () => {
          const body = { name: edit.name, category: edit.category, description: edit.description, numberFormat: edit.numberFormat, enabled: edit.enabled, bodyHtml: ref.current?.innerHTML ?? edit.bodyHtml };
          if (await run('s', () => (edit.id ? patch(`/doc-templates/${edit.id}`, body) : post('/doc-templates', { ...body, code: edit.code })), 'Template disimpan')) { setEdit(null); reload(); }
        }}><Save />Simpan</button></>}>
        {edit && (
          <div className="stack lg">
            <div className="form-grid">
              <Field label="Nama" required><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Kode" required hint="Dipakai di nomor, tidak dapat diubah"><input className="input" disabled={!!edit.id} value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} /></Field>
              <Field label="Kategori"><input className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></Field>
              <Field label="Status"><label className="check" style={{ height: 40 }}><input type="checkbox" checked={edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} />Dapat dipilih saat menulis naskah</label></Field>
              <Field label="Format nomor" required className="full" error={!fmtOk ? 'Wajib memuat {seq}' : null} hint={<>Variabel: {'{seq} {code} {dept} {month_roman} {month} {year}'} — contoh: <b className="num">{PREVIEW_NUM(edit.numberFormat, edit.code)}</b></>}>
                <input className="input" value={edit.numberFormat} onChange={(e) => setEdit({ ...edit, numberFormat: e.target.value })} />
              </Field>
              <Field label="Deskripsi" className="full"><input className="input" value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            </div>
            <div className="stack">
              <span className="label">Isi awal</span>
              <EditorToolbar targetRef={ref} />
              <div className="paper" style={{ minHeight: 300, width: '100%' }}>
                <EditableBody innerRef={ref} initialHtml={edit.bodyHtml} resetKey={key} onChange={() => {}} />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
