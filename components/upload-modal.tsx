'use client';
import { useEffect, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { upload } from '@/lib/api';
import { fmtBytes } from '@/lib/format';
import { ErrorAlert, Field, Modal } from './ui';

export type FolderT = { id: string; name: string; parentFolderId: string | null; departmentId: string | null; department: { name: string } | null; fileCount: number; isSystem: boolean };

/** Unggah dokumen baru ke folder, atau versi baru dari dokumen yang ada (docUid). */
export function UploadModal({ open, onClose, folders, defaultFolder, onDone, docUid }: {
  open: boolean; onClose: () => void; folders: FolderT[]; defaultFolder?: string | null; onDone: (n: number, last?: any) => void; docUid?: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [folder, setFolder] = useState(defaultFolder ?? '');
  const [meta, setMeta] = useState({ title: '', category: '', tags: '', description: '' });
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const isVersion = !!docUid;
  useEffect(() => { if (open) { setFolder(defaultFolder ?? ''); setError(null); } }, [open, defaultFolder]);

  const submit = async () => {
    if (!files.length || (!isVersion && !folder)) return;
    setError(null);
    try {
      let last: any;
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append('file', files[i]);
        if (isVersion) fd.append('docUid', docUid!); else fd.append('folderId', folder);
        if (meta.title && files.length === 1) fd.append('title', meta.title);
        if (meta.category) fd.append('category', meta.category);
        if (meta.description) fd.append('description', meta.description);
        if (meta.tags || !isVersion) fd.append('tags', meta.tags);
        last = await upload('/files', fd, (p) => setProgress(Math.round(((i + p / 100) / files.length) * 100)));
      }
      setFiles([]); setMeta({ title: '', category: '', tags: '', description: '' });
      onDone(files.length, last);
    } catch (e: any) { setError(e.message); } finally { setProgress(null); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isVersion ? 'Unggah versi baru' : 'Unggah dokumen'}
      footer={<><button className="btn ghost" onClick={onClose}>Batal</button><button className="btn primary" disabled={!files.length || (!isVersion && !folder) || progress !== null} onClick={submit}>{progress !== null ? <><span className="spinner" />{progress}%</> : <><UploadCloud />Unggah</>}</button></>}>
      <div className="stack">
        <ErrorAlert error={error} />
        {isVersion && <div className="alert info"><span>File baru menjadi versi berikutnya. Versi lama tetap tersimpan dan dapat diunduh.</span></div>}
        <div className={`dropzone ${drag ? 'on' : ''}`} onClick={() => ref.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); setFiles(Array.from(e.dataTransfer.files).slice(0, isVersion ? 1 : 20)); }}>
          <UploadCloud style={{ width: 26, height: 26, color: 'var(--ion)' }} />
          <div>{files.length ? files.map((f) => f.name).join(', ') : 'Tarik file ke sini atau klik untuk memilih'}</div>
          {files.length > 0 && <div className="tiny">{fmtBytes(files.reduce((a, b) => a + b.size, 0))}</div>}
          <input ref={ref} hidden type="file" multiple={!isVersion} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </div>
        {!isVersion && (
          <Field label="Folder tujuan" required>
            <select className="select" value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="">Pilih folder…</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}{f.department ? ` — ${f.department.name}` : ' — Umum'}</option>)}
            </select>
          </Field>
        )}
        <div className="form-grid">
          {files.length <= 1 && <Field label="Judul" className="full"><input className="input" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="Opsional — default nama file" /></Field>}
          <Field label="Kategori"><input className="input" value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })} placeholder="Laporan, Kontrak, SOP…" /></Field>
          <Field label="Tag" hint="Pisahkan dengan koma"><input className="input" value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} placeholder="Final, 2026" /></Field>
          <Field label="Deskripsi" className="full"><textarea className="textarea" style={{ minHeight: 70 }} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></Field>
        </div>
      </div>
    </Modal>
  );
}
