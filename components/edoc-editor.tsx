'use client';
import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, FileText, PenLine, Plus, Save, Send, Trash2 } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fetchBlob } from '@/lib/api';
import { fillClient, type PaperData, type SignerView } from '@/lib/edoc';
import { ErrorAlert, Field, Panel } from './ui';
import { UserPicker, type UserLite } from './user-picker';
import { Paper } from './paper';
import { EditableBody, EditorToolbar } from './rich-editor';

export interface EDocForm {
  templateId: string; title: string; subject: string; recipient: string; attachmentNote: string; place: string; docDate: string;
  bodyHtml: string; signers: { user: UserLite; role: 'sign' | 'paraf' }[];
}

export const emptyEDoc = (): EDocForm => ({
  templateId: '', title: '', subject: '', recipient: '', attachmentNote: '', place: 'Jakarta',
  docDate: new Date().toISOString().slice(0, 10), bodyHtml: '<p><br></p>', signers: [],
});

export function edocToForm(d: any): EDocForm {
  return {
    templateId: d.template?.id ?? '', title: d.title, subject: d.subject ?? '', recipient: d.recipient ?? '', attachmentNote: d.attachmentNote ?? '',
    place: d.place ?? 'Jakarta', docDate: d.docDate ? d.docDate.slice(0, 10) : '', bodyHtml: d.bodyHtml,
    signers: d.signers.map((s: SignerView) => ({ user: { id: s.user.id, fullName: s.user.fullName, position: s.user.position, photoUrl: s.user.photoUrl }, role: s.role })),
  };
}

/**
 * Editor naskah dinas: isian kepala surat & penanda tangan (kiri), kertas A4 yang dapat diketik langsung (kanan).
 * `existingId` diisi saat mengubah draft; pratinjau PDF memakai endpoint server.
 */
export function EDocEditor({ initial, existingId, number, onSave, error: extError }: {
  initial?: EDocForm; existingId?: string; number?: string | null;
  onSave: (payload: any, submit: boolean) => Promise<void>; error?: string | null;
}) {
  const { me } = useAuth();
  const [f, setF] = useState<EDocForm>(initial ?? emptyEDoc());
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState<'save' | 'send' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { data: templates } = useApi<any[]>('/doc-templates');
  const { data: org } = useApi<any>('/e-documents/meta/org');

  const set = <K extends keyof EDocForm>(k: K, v: EDocForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const applyTemplate = (id: string) => {
    const t = templates?.find((x) => x.id === id);
    const bodyEmpty = !bodyRef.current?.innerText.trim();
    if (t && !bodyEmpty && !confirm('Ganti isi dengan template? Isi yang sudah diketik akan diganti.')) return;
    setF((x) => ({ ...x, templateId: id, bodyHtml: t?.bodyHtml ?? x.bodyHtml, title: x.title || t?.name || '' }));
    setResetKey((k) => k + 1);
  };

  const issues = useMemo(() => {
    const e: string[] = [];
    if (f.title.trim().length < 3) e.push('Judul minimal 3 karakter');
    if (!f.signers.some((s) => s.role === 'sign')) e.push('Tambahkan minimal satu penanda tangan');
    if (!(bodyRef.current?.innerText ?? f.bodyHtml.replace(/<[^>]+>/g, '')).trim()) e.push('Isi naskah masih kosong');
    return e;
  }, [f]);

  const payload = () => ({
    templateId: f.templateId || undefined, title: f.title.trim(), subject: f.subject, recipient: f.recipient, attachmentNote: f.attachmentNote,
    place: f.place, docDate: f.docDate ? new Date(f.docDate + 'T08:00:00').toISOString() : undefined,
    bodyHtml: bodyRef.current?.innerHTML ?? f.bodyHtml, signers: f.signers.map((s) => ({ userId: s.user.id, role: s.role })),
  });

  const save = async (submit: boolean) => {
    if (submit && issues.length) { setError(issues[0]); return; }
    if (!submit && f.title.trim().length < 3) { setError('Judul minimal 3 karakter'); return; }
    setBusy(submit ? 'send' : 'save'); setError(null);
    try { await onSave(payload(), submit); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const openPdf = async () => {
    if (!existingId) { setError('Simpan draft terlebih dahulu untuk melihat PDF.'); return; }
    setBusy('pdf');
    try {
      await onSave(payload(), false);
      const { blob } = await fetchBlob(`/e-documents/${existingId}/pdf?inline=1`);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const moveSigner = (i: number, d: number) => setF((x) => { const s = [...x.signers]; const [it] = s.splice(i, 1); s.splice(i + d, 0, it); return { ...x, signers: s }; });

  const paperData: PaperData = {
    number: number ?? null, title: f.title, subject: f.subject, recipient: f.recipient, attachmentNote: f.attachmentNote, place: f.place,
    docDate: f.docDate || null, department: me?.department ?? null, org: org ?? null,
    signers: f.signers.map((s, i) => ({ order: i + 1, role: s.role, status: 'waiting', user: { id: s.user.id, fullName: s.user.fullName, position: s.user.position } })),
  };

  return (
    <div className="grid edoc-grid">
      <div className="stack lg">
        <Panel title="Kepala naskah">
          <div className="stack">
            <Field label="Template" hint="Mengisi isi awal & format nomor">
              <select className="select" value={f.templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Tanpa template</option>
                {templates?.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.category}</option>)}
              </select>
            </Field>
            <Field label="Judul" required error={f.title && f.title.trim().length < 3 ? 'Minimal 3 karakter' : null}>
              <input className="input" value={f.title} maxLength={200} onChange={(e) => set('title', e.target.value)} placeholder="Undangan Rapat Koordinasi" />
            </Field>
            <Field label="Perihal"><input className="input" value={f.subject} maxLength={255} onChange={(e) => set('subject', e.target.value)} /></Field>
            <Field label="Kepada" hint="Isi untuk format surat (dengan Nomor/Lampiran/Perihal). Kosongkan untuk memo/berita acara.">
              <textarea className="textarea" style={{ minHeight: 70 }} value={f.recipient} onChange={(e) => set('recipient', e.target.value)} placeholder={'Bapak/Ibu Kepala Unit\nDi tempat'} />
            </Field>
            <div className="form-grid">
              <Field label="Lampiran"><input className="input" value={f.attachmentNote} onChange={(e) => set('attachmentNote', e.target.value)} placeholder="-" /></Field>
              <Field label="Tempat"><input className="input" value={f.place} onChange={(e) => set('place', e.target.value)} /></Field>
              <Field label="Tanggal naskah" className="full"><input className="input" type="date" value={f.docDate} onChange={(e) => set('docDate', e.target.value)} /></Field>
            </div>
            <div className="small muted">Nomor: <b className="ink2">{number ?? 'terbit otomatis saat dikirim'}</b></div>
          </div>
        </Panel>

        <Panel title={<span className="row"><PenLine size={17} style={{ color: 'var(--ion)' }} /><h2>Paraf & tanda tangan</h2></span>} sub="Diproses berurutan dari atas ke bawah">
          <div className="stack">
            {f.signers.length === 0 && <p className="small muted">Belum ada. Tambahkan pemeriksa (paraf) lalu penanda tangan.</p>}
            {f.signers.map((s, i) => (
              <div key={s.user.id} className="signer-row">
                <span className="ord">{i + 1}</span>
                <span className="truncate small"><b>{s.user.fullName}</b><br /><span className="tiny muted">{s.user.position ?? '—'}</span></span>
                <select className="select" style={{ height: 34, fontSize: 13 }} value={s.role} onChange={(e) => setF((x) => ({ ...x, signers: x.signers.map((y, k) => (k === i ? { ...y, role: e.target.value as any } : y)) }))} aria-label="Peran">
                  <option value="paraf">Paraf</option><option value="sign">Tanda tangan</option>
                </select>
                <span className="row" style={{ gap: 0 }}>
                  <button type="button" className="btn ghost sm icon" disabled={i === 0} onClick={() => moveSigner(i, -1)} aria-label="Naikkan"><ArrowUp /></button>
                  <button type="button" className="btn ghost sm icon" disabled={i === f.signers.length - 1} onClick={() => moveSigner(i, 1)} aria-label="Turunkan"><ArrowDown /></button>
                  <button type="button" className="btn ghost sm icon" onClick={() => set('signers', f.signers.filter((_, k) => k !== i))} aria-label="Hapus"><Trash2 /></button>
                </span>
              </div>
            ))}
            {f.signers.length < 10 && (
              <div className="stack sm">
                <span className="small muted row" style={{ gap: 6 }}><Plus size={14} />Tambah orang</span>
                <UserPicker value={null} exclude={f.signers.map((s) => s.user.id)} onChange={(u) => u && set('signers', [...f.signers, { user: u, role: 'sign' }])} placeholder="Cari nama penanda tangan…" />
              </div>
            )}
          </div>
        </Panel>

        <ErrorAlert error={error ?? extError} />
        <div className="stack sm">
          <button className="btn primary lg block" disabled={!!busy} onClick={() => save(true)}>{busy === 'send' ? <span className="spinner" /> : <Send />}Simpan & kirim untuk ditandatangani</button>
          <div className="row">
            <button className="btn grow" disabled={!!busy} onClick={() => save(false)}>{busy === 'save' ? <span className="spinner" /> : <Save />}Simpan draft</button>
            <button className="btn grow" disabled={!!busy || !existingId} onClick={openPdf} title={existingId ? '' : 'Simpan draft dahulu'}>{busy === 'pdf' ? <span className="spinner" /> : <FileText />}PDF</button>
          </div>
          {issues.length > 0 && <span className="tiny muted">Sebelum dikirim: {issues.join(' · ')}</span>}
        </div>
      </div>

      <div className="stack" style={{ minWidth: 0 }}>
        <div className="row between wrap">
          <div className="seg"><button className={!preview ? 'on' : ''} onClick={() => setPreview(false)}><PenLine size={14} /> Tulis</button><button className={preview ? 'on' : ''} onClick={() => { set('bodyHtml', bodyRef.current?.innerHTML ?? f.bodyHtml); setPreview(true); }}><Eye size={14} /> Pratinjau</button></div>
          <span className="tiny muted">Ketik langsung di kertas. Isian seperti {'{{nomor}}'} terisi otomatis.</span>
        </div>
        {!preview && <EditorToolbar targetRef={bodyRef} />}
        <div style={{ display: preview ? 'none' : 'block' }}>
          <Paper d={paperData} draft body={<EditableBody innerRef={bodyRef} initialHtml={f.bodyHtml} resetKey={resetKey} onChange={(html) => set('bodyHtml', html)} />} />
        </div>
        {preview && (
          <Paper d={paperData} draft body={<div className="body" dangerouslySetInnerHTML={{ __html: fillClient(f.bodyHtml, { ...paperData, creatorName: me?.fullName, creatorPosition: me?.position }) }} />} />
        )}
      </div>
    </div>
  );
}
