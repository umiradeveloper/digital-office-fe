'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, FileText, GitBranch, PenLine, QrCode, Save, Send } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fetchBlob, post } from '@/lib/api';
import { PRIORITY } from '@/lib/format';
import { fillClient, paperSigners, type PaperData, type PlannedSigner } from '@/lib/edoc';
import { ErrorAlert, Field, Panel } from './ui';
import { Paper } from './paper';
import { EditableBody, EditorToolbar } from './rich-editor';

export interface EDocForm {
  templateId: string; title: string; subject: string; recipient: string; attachmentNote: string; place: string; docDate: string;
  bodyHtml: string;
  /** dipakai untuk request approval "Naskah Dinas" */
  priority: 'low' | 'med' | 'high' | 'crit'; dueDate: string;
}

/** Opsi pengiriman ke approval (request tipe Naskah Dinas). */
export interface SubmitOpts { priority: EDocForm['priority']; dueDate: string | null }

export const emptyEDoc = (): EDocForm => ({
  templateId: '', title: '', subject: '', recipient: '', attachmentNote: '', place: 'Jakarta',
  docDate: new Date().toISOString().slice(0, 10), bodyHtml: '<p><br></p>', priority: 'med', dueDate: '',
});

export function edocToForm(d: any): EDocForm {
  return {
    templateId: d.template?.id ?? '', title: d.title, subject: d.subject ?? '', recipient: d.recipient ?? '', attachmentNote: d.attachmentNote ?? '',
    place: d.place ?? 'Jakarta', docDate: d.docDate ? d.docDate.slice(0, 10) : '', bodyHtml: d.bodyHtml,
    priority: d.request?.priority ?? 'med', dueDate: d.request?.dueDate ? d.request.dueDate.slice(0, 10) : '',
  };
}

/**
 * Editor naskah dinas: isian kepala surat & alur persetujuan (kiri), kertas A4 yang dapat diketik langsung (kanan).
 * Paraf & tanda tangan mengikuti alur approval request "Naskah Dinas": level awal = QR paraf, level terakhir = QR tanda tangan.
 * `existingId` diisi saat mengubah draft; pratinjau PDF memakai endpoint server.
 */
export function EDocEditor({ initial, existingId, number, onSave, error: extError }: {
  initial?: EDocForm; existingId?: string; number?: string | null;
  onSave: (payload: any, submit: boolean, opts: SubmitOpts) => Promise<void>; error?: string | null;
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
  const { data: types } = useApi<any[]>('/request-types');
  const nskType = types?.find((t) => t.code === 'NSK');

  // pratinjau alur approval yang akan dipakai (berubah menurut prioritas)
  const [flow, setFlow] = useState<{ name: string | null; levels: { name: string; approvers: { fullName: string }[] }[] } | null>(null);
  useEffect(() => {
    if (!nskType) return;
    let alive = true;
    post<any>('/approval-flows/preview', { typeId: nskType.id, departmentId: me?.departmentId ?? undefined, priority: f.priority, requesterUserId: me?.id })
      .then((p) => alive && setFlow({ name: p.flow?.name ?? null, levels: p.levels ?? [] }))
      .catch(() => alive && setFlow({ name: null, levels: [] }));
    return () => { alive = false; };
  }, [nskType?.id, f.priority, me?.id]); // eslint-disable-line
  const planned: PlannedSigner[] = (flow?.levels ?? []).map((l, i, all) => ({
    order: i + 1, role: i === all.length - 1 ? 'sign' : 'paraf', levelName: l.name, approverName: l.approvers[0]?.fullName ?? null,
  }));
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
    if (flow && !flow.levels.length) e.push('Belum ada alur approval Naskah Dinas — hubungi admin');
    if (!(bodyRef.current?.innerText ?? f.bodyHtml.replace(/<[^>]+>/g, '')).trim()) e.push('Isi naskah masih kosong');
    return e;
  }, [f, flow]);

  const payload = () => ({
    templateId: f.templateId || undefined, title: f.title.trim(), subject: f.subject, recipient: f.recipient, attachmentNote: f.attachmentNote,
    place: f.place, docDate: f.docDate ? new Date(f.docDate + 'T08:00:00').toISOString() : undefined,
    bodyHtml: bodyRef.current?.innerHTML ?? f.bodyHtml,
  });
  const opts = (): SubmitOpts => ({ priority: f.priority, dueDate: f.dueDate ? new Date(f.dueDate + 'T17:00:00').toISOString() : null });

  const save = async (submit: boolean) => {
    if (submit && issues.length) { setError(issues[0]); return; }
    if (!submit && f.title.trim().length < 3) { setError('Judul minimal 3 karakter'); return; }
    setBusy(submit ? 'send' : 'save'); setError(null);
    try { await onSave(payload(), submit, opts()); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const openPdf = async () => {
    if (!existingId) { setError('Simpan draft terlebih dahulu untuk melihat PDF.'); return; }
    setBusy('pdf');
    try {
      await onSave(payload(), false, opts());
      const { blob } = await fetchBlob(`/e-documents/${existingId}/pdf?inline=1`);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const paperData: PaperData = {
    number: number ?? null, title: f.title, subject: f.subject, recipient: f.recipient, attachmentNote: f.attachmentNote, place: f.place,
    docDate: f.docDate || null, department: me?.department ?? null, org: org ?? null,
    signers: paperSigners([], planned),
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

        <Panel title={<span className="row"><GitBranch size={17} style={{ color: 'var(--ion)' }} /><h2>Alur persetujuan</h2></span>}
          sub={flow?.name ? <>Alur <b className="ink2">{flow.name}</b> — diatur admin</> : 'Mengikuti alur approval Naskah Dinas'}>
          <div className="stack">
            <div className="form-grid">
              <Field label="Prioritas">
                <select className="select" value={f.priority} onChange={(e) => set('priority', e.target.value as EDocForm['priority'])}>
                  {(['low', 'med', 'high', 'crit'] as const).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
                </select>
              </Field>
              <Field label="Batas waktu"><input className="input" type="date" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></Field>
            </div>
            {!flow ? <span className="small muted">Memuat alur…</span>
              : !flow.levels.length ? <div className="alert warn"><span>Belum ada alur approval aktif untuk Naskah Dinas. Minta admin mengaturnya di <b>Administrasi → Alur approval</b>.</span></div>
              : (
                <div className="sign-steps">
                  {planned.map((p) => (
                    <div key={p.order} className="sign-step">
                      <span className="dot">{p.order}</span>
                      <div className="small">
                        <b>{p.levelName}</b> <span className={`badge ${p.role === 'sign' ? 'tone-ion' : 'tone-muted'}`} style={{ marginLeft: 4 }}>{p.role === 'sign' ? 'QR tanda tangan' : 'QR paraf'}</span>
                        <div className="tiny muted">{p.approverName ?? 'Approver ditentukan saat dikirim'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            <p className="tiny muted row top" style={{ gap: 6, margin: 0 }}>
              <QrCode size={14} style={{ flex: 'none', marginTop: 1 }} />
              <span>Saat dikirim, naskah diberi nomor dan masuk inbox approval sebagai request. Setiap approver yang menyetujui (dengan kata sandi) langsung membubuhkan QR — level terakhir sebagai tanda tangan. PDF final tersimpan otomatis di Dokumen.</span>
            </p>
          </div>
        </Panel>

        <ErrorAlert error={error ?? extError} />
        <div className="stack sm">
          <button className="btn primary lg block" disabled={!!busy} onClick={() => save(true)}>{busy === 'send' ? <span className="spinner" /> : <Send />}Simpan & kirim untuk approval</button>
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
