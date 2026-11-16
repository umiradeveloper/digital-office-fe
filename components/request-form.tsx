'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch, Paperclip, Send, Save, Trash2, UploadCloud } from 'lucide-react';
import { post, upload } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi, useDebounced } from '@/lib/hooks';
import { fmtBytes, fmtMoney } from '@/lib/format';
import { ErrorAlert, Field, Panel } from './ui';
import { UserPicker, type UserLite } from './user-picker';

interface CustomField { key: string; label: string; type: string; required?: boolean; options?: string[] }
interface Attach { id: string; originalName: string; sizeBytes: string | number; progress?: number }

export interface RequestFormValue {
  title: string; description: string; typeId: string; priority: string; dueDate: string;
  assignee: UserLite | null; amount: string; customValues: Record<string, any>; attachments: Attach[];
}

export function emptyRequest(): RequestFormValue {
  return { title: '', description: '', typeId: '', priority: 'med', dueDate: '', assignee: null, amount: '', customValues: {}, attachments: [] };
}

/** Form request dengan validasi real-time & preview alur approval (FR-WF-01/02, NFR-07, R-02). */
export function RequestForm({ initial, onSubmit, submitLabel = 'Kirim request', allowDraft = true, lockType = false }: {
  initial?: RequestFormValue; onSubmit: (payload: any, submit: boolean) => Promise<void>; submitLabel?: string; allowDraft?: boolean; lockType?: boolean;
}) {
  const { me } = useAuth();
  const [v, setV] = useState<RequestFormValue>(initial ?? emptyRequest());
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<'draft' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: allTypes } = useApi<any[]>('/request-types');
  // naskah dinas dibuat dari menu Naskah dinas (tipe kategori "naskah" tidak dipilih di sini)
  const types = allTypes?.filter((t) => t.category !== 'naskah' || t.id === initial?.typeId);

  const type = types?.find((t) => t.id === v.typeId);
  const fields: CustomField[] = type?.customFieldsJson ?? [];
  const currencyField = fields.find((f) => f.type === 'currency');
  const set = (k: keyof RequestFormValue, val: any) => setV((x) => ({ ...x, [k]: val }));
  const setCustom = (k: string, val: any) => setV((x) => ({ ...x, customValues: { ...x.customValues, [k]: val } }));
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  useEffect(() => { if (!v.typeId && types?.length && !initial) set('typeId', types[0].id); }, [types]); // eslint-disable-line

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (v.title.trim().length < 3) e.title = 'Judul minimal 3 karakter';
    if (!v.typeId) e.typeId = 'Pilih tipe request';
    if (v.dueDate && new Date(v.dueDate) < new Date(new Date().toDateString())) e.dueDate = 'Due date tidak boleh di masa lalu';
    for (const f of fields) {
      const val = v.customValues[f.key];
      const empty = val === undefined || val === null || val === '';
      if (f.required && empty) e[`cf_${f.key}`] = `${f.label} wajib diisi`;
      else if (!empty && (f.type === 'number' || f.type === 'currency') && isNaN(Number(val))) e[`cf_${f.key}`] = 'Harus berupa angka';
    }
    return e;
  }, [v, fields]);
  const showErr = (k: string) => (touched[k] || touched.__all ? errors[k] : null);

  // preview routing approval
  const amount = currencyField ? Number(v.customValues[currencyField.key] || 0) : Number(v.amount || 0);
  const previewKey = useDebounced(`${v.typeId}|${v.priority}|${amount}`, 400);
  const [preview, setPreview] = useState<any>(null);
  useEffect(() => {
    if (!v.typeId) return;
    post('/approval-flows/preview', { typeId: v.typeId, departmentId: me?.departmentId ?? undefined, priority: v.priority, amount: amount || undefined, requesterUserId: me?.id })
      .then(setPreview).catch(() => setPreview(null));
  }, [previewKey]); // eslint-disable-line

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const tmp: Attach = { id: `tmp-${Math.random()}`, originalName: file.name, sizeBytes: file.size, progress: 0 };
      setV((x) => ({ ...x, attachments: [...x.attachments, tmp] }));
      const fd = new FormData();
      fd.append('file', file); fd.append('purpose', 'attachment'); fd.append('category', 'Lampiran');
      try {
        const res = await upload<any>('/files', fd, (p) => setV((x) => ({ ...x, attachments: x.attachments.map((a) => (a.id === tmp.id ? { ...a, progress: p } : a)) })));
        setV((x) => ({ ...x, attachments: x.attachments.map((a) => (a.id === tmp.id ? { id: res.id, originalName: res.originalName, sizeBytes: res.sizeBytes } : a)) }));
      } catch (e: any) {
        setError(`${file.name}: ${e.message}`);
        setV((x) => ({ ...x, attachments: x.attachments.filter((a) => a.id !== tmp.id) }));
      }
    }
  };

  const submit = async (send: boolean) => {
    setTouched({ __all: true });
    if (Object.keys(errors).length) { setError('Periksa kembali kolom yang ditandai.'); return; }
    if (v.attachments.some((a) => a.id.startsWith('tmp-'))) { setError('Tunggu hingga semua lampiran selesai diunggah.'); return; }
    setBusy(send ? 'send' : 'draft'); setError(null);
    try {
      await onSubmit({
        title: v.title.trim(), description: v.description, typeId: v.typeId, priority: v.priority,
        dueDate: v.dueDate ? new Date(v.dueDate + 'T17:00:00').toISOString() : undefined,
        assigneeUserId: v.assignee?.id, amount: !currencyField && v.amount ? Number(v.amount) : undefined,
        customValues: v.customValues, attachmentFileIds: v.attachments.map((a) => a.id),
      }, send);
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="grid split">
      <div className="stack lg">
        <Panel title="Detail request">
          <div className="form-grid">
            <Field label="Tipe request" required error={showErr('typeId')}>
              <select className="select" value={v.typeId} disabled={lockType} onChange={(e) => { set('typeId', e.target.value); set('customValues', {}); }}>
                {!types && <option>Memuat…</option>}
                {types?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Prioritas" required hint="Prioritas tinggi dapat menambah level approval">
              <div className="seg" style={{ width: '100%' }}>
                {[['low', 'Rendah'], ['med', 'Sedang'], ['high', 'Tinggi'], ['crit', 'Kritis']].map(([k, l]) => (
                  <button type="button" key={k} className={v.priority === k ? 'on' : ''} style={{ flex: 1 }} onClick={() => set('priority', k)}>{l}</button>
                ))}
              </div>
            </Field>
            <Field label="Judul" required error={showErr('title')} className="full">
              <input className={`input ${showErr('title') ? 'invalid' : ''}`} value={v.title} maxLength={200} onBlur={() => touch('title')} onChange={(e) => set('title', e.target.value)} placeholder="Contoh: Pembelian 5 monitor untuk tim desain" />
            </Field>
            <Field label="Deskripsi" className="full" hint={`${v.description.length}/5000`}>
              <textarea className="textarea" value={v.description} maxLength={5000} onChange={(e) => set('description', e.target.value)} placeholder="Latar belakang, kebutuhan, dan informasi pendukung" />
            </Field>
            <Field label="Due date" error={showErr('dueDate')}>
              <input className={`input ${showErr('dueDate') ? 'invalid' : ''}`} type="date" value={v.dueDate} onBlur={() => touch('dueDate')} onChange={(e) => { set('dueDate', e.target.value); touch('dueDate'); }} />
            </Field>
            <Field label="Penanggung jawab" hint="Opsional — orang yang mengerjakan setelah disetujui">
              <UserPicker value={v.assignee} onChange={(u) => set('assignee', u)} exclude={me ? [me.id] : []} />
            </Field>
            {!currencyField && type?.category === 'pengajuan' && (
              <Field label="Nilai (Rp)" hint={v.amount ? fmtMoney(v.amount) : 'Dipakai untuk aturan threshold approval'}>
                <input className="input" inputMode="numeric" value={v.amount} onChange={(e) => set('amount', e.target.value.replace(/[^\d]/g, ''))} />
              </Field>
            )}
          </div>
        </Panel>

        {fields.length > 0 && (
          <Panel title={`Informasi ${type?.name}`} sub="Kolom tambahan yang diatur admin untuk tipe ini">
            <div className="form-grid">
              {fields.map((f) => {
                const err = showErr(`cf_${f.key}`);
                const val = v.customValues[f.key] ?? '';
                const common = { className: `${f.type === 'select' ? 'select' : f.type === 'textarea' ? 'textarea' : 'input'} ${err ? 'invalid' : ''}`, onBlur: () => touch(`cf_${f.key}`) };
                return (
                  <Field key={f.key} label={f.label} required={f.required} error={err} hint={f.type === 'currency' && val ? fmtMoney(val) : undefined} className={f.type === 'textarea' ? 'full' : ''}>
                    {f.type === 'select' ? (
                      <select {...common} value={val} onChange={(e) => setCustom(f.key, e.target.value)}>
                        <option value="">Pilih…</option>{f.options?.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea {...common} value={val} onChange={(e) => setCustom(f.key, e.target.value)} />
                    ) : (
                      <input {...common} type={f.type === 'date' ? 'date' : 'text'} inputMode={f.type === 'number' || f.type === 'currency' ? 'numeric' : undefined}
                        value={val} onChange={(e) => setCustom(f.key, f.type === 'currency' ? e.target.value.replace(/[^\d]/g, '') : e.target.value)} />
                    )}
                  </Field>
                );
              })}
            </div>
          </Panel>
        )}

        <Panel title="Lampiran" sub={`Maks 25 MB per file · ${v.attachments.length} file`}>
          <div
            className={`dropzone ${drag ? 'on' : ''}`} onClick={() => fileRef.current?.click()} role="button" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          >
            <UploadCloud style={{ width: 26, height: 26, color: 'var(--ion)' }} />
            <div style={{ marginTop: 6 }}>Tarik file ke sini atau <span style={{ color: 'var(--ion)' }}>pilih dari perangkat</span></div>
            <div className="tiny">PDF, gambar, dokumen Office, dan lainnya</div>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </div>
          {v.attachments.length > 0 && (
            <div className="stack sm" style={{ marginTop: 12 }}>
              {v.attachments.map((a) => (
                <div key={a.id} className="row" style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line-soft)' }}>
                  <Paperclip size={15} className="muted" />
                  <span className="grow truncate small">{a.originalName}</span>
                  {a.progress !== undefined ? <span className="tiny num" style={{ color: 'var(--ion)' }}>{a.progress}%</span> : <span className="tiny muted">{fmtBytes(a.sizeBytes)}</span>}
                  <button type="button" className="btn ghost sm icon" onClick={() => set('attachments', v.attachments.filter((x) => x.id !== a.id))} aria-label="Hapus lampiran"><Trash2 /></button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="stack lg">
        <Panel title={<span className="row"><GitBranch size={17} style={{ color: 'var(--ion)' }} /><h2>Alur approval</h2></span>} sub="Dipilih otomatis dari tipe, unit, prioritas, dan nilai">
          {!preview ? <span className="small muted">Pilih tipe request untuk melihat alur.</span>
            : !preview.flow ? <div className="alert info"><span>Tidak ada alur approval untuk kombinasi ini — request langsung berstatus Submitted dan diteruskan ke penanggung jawab.</span></div>
            : (
              <div className="stack">
                <div><div style={{ fontWeight: 600 }}>{preview.flow.name}</div><div className="tiny muted">{preview.levels.length} level, diproses berurutan</div></div>
                <div className="timeline">
                  {preview.levels.map((l: any, i: number) => (
                    <div key={l.levelOrder} className="tl-item" style={{ paddingBottom: 12 }}>
                      <div className="tl-dot ion"><span className="num tiny">{i + 1}</span></div>
                      <div className="tl-body">
                        <div style={{ fontWeight: 500 }}>{l.name}</div>
                        <div className="small muted">{l.approvers.map((a: any) => a.fullName).join(', ') || 'Approver akan ditentukan'} · SLA {l.slaHours} jam</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </Panel>
        <ErrorAlert error={error} />
        <div className="stack sm">
          <button className="btn primary lg block" disabled={!!busy} onClick={() => submit(true)}>{busy === 'send' ? <span className="spinner" /> : <Send />}{submitLabel}</button>
          {allowDraft && <button className="btn block" disabled={!!busy} onClick={() => submit(false)}>{busy === 'draft' ? <span className="spinner" /> : <Save />}Simpan sebagai draft</button>}
        </div>
      </div>
    </div>
  );
}

/** Ubah detail request dari API menjadi nilai form (untuk revisi). */
export function requestToForm(r: any): RequestFormValue {
  return {
    title: r.title, description: r.description ?? '', typeId: r.typeId ?? r.type.id, priority: r.priority,
    dueDate: r.dueDate ? r.dueDate.slice(0, 10) : '',
    assignee: r.assignee ? { id: r.assignee.id, fullName: r.assignee.fullName, photoUrl: r.assignee.photoUrl } : null,
    amount: r.amount ? String(r.amount) : '', customValues: r.customValuesJson ?? {},
    attachments: r.attachments.filter((a: any) => !a.file.deletedAt).map((a: any) => ({ id: a.file.id, originalName: a.file.originalName, sizeBytes: a.file.sizeBytes })),
  };
}
