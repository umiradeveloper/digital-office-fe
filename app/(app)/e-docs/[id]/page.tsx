'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ClipboardList, Download, ExternalLink, FileClock, FolderOpen, Forward, GitBranch, KeyRound, PenLine, QrCode, ShieldAlert, ShieldCheck, Trash2, Undo2, X, XCircle } from 'lucide-react';
import { del, download, patch, post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { EDOC_STATUS, paperSigners } from '@/lib/edoc';
import { fmtDateTime } from '@/lib/format';
import { ErrorAlert, Field, Loading, Modal, Panel, PriorityBadge, StatusBadge, useAction, useToast } from '@/components/ui';
import { Paper } from '@/components/paper';
import { ApprovalTrack } from '@/components/approval-track';
import { DecideModal, type DecisionKind } from '@/components/decide-modal';
import { EDocEditor, edocToForm } from '@/components/edoc-editor';

const LOG: Record<string, string> = {
  created: 'membuat draft', updated: 'memperbarui draft', submitted: 'mengirim untuk approval', resubmitted: 'mengirim ulang setelah revisi',
  paraf: 'menyetujui & memaraf', signed: 'menyetujui & menandatangani', rejected: 'menolak / mengembalikan', withdrawn: 'menarik kembali',
  finalized: 'PDF final diterbitkan', submit_failed: 'gagal mengirim',
};

/** Alasan penolakan terakhir: dari keputusan approval (naskah via request) atau penanda tangan (naskah lama). */
function rejection(d: any): { name: string; comment: string } | null {
  const dec = d.approval?.levels.flatMap((l: any) => l.decisions).filter((x: any) => x.decision === 'reject').pop();
  if (dec) return { name: dec.approver.fullName, comment: dec.comment };
  const s = d.signers.find((x: any) => x.status === 'rejected');
  return s ? { name: s.user.fullName, comment: s.comment } : null;
}

export default function EDocDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { data: d, error, loading, reload } = useApi<any>(`/e-documents/${id}`, { poll: 20000 });
  const { busy, run } = useAction();
  const { me } = useAuth();
  const [decide, setDecide] = useState<DecisionKind | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [signError, setSignError] = useState<string | null>(null);

  if (loading && !d) return <Loading rows={8} />;
  if (error && !d) return <><ErrorAlert error={error} /><Link href="/e-docs" className="btn" style={{ marginTop: 14 }}>Kembali</Link></>;
  if (!d) return null;
  const p = d.permissions;
  const st = EDOC_STATUS[d.status];
  const rejected = d.status === 'rejected' ? rejection(d) : null;
  const roleWord = p.myRole === 'paraf' ? 'Paraf' : 'Tanda tangani';
  const approveWord = p.myRole === 'sign' ? 'Setujui & tanda tangani' : 'Setujui & paraf';
  const paperData = { ...d, signers: d.legacy ? d.signers : paperSigners(d.signers, d.plannedSigners, d.status === 'signing') };

  if (p.canEdit) {
    return (
      <>
        <div className="page-head"><div>
          <Link href="/e-docs" className="small row" style={{ gap: 4, marginBottom: 8 }}><ChevronLeft size={15} />Naskah dinas</Link>
          <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}><span className="ref">{d.number ?? 'Belum bernomor'}</span><span className={`badge tone-${st.tone}`}><span className="pip" />{st.label}</span></div>
          <h1>{d.status === 'rejected' ? 'Revisi naskah' : 'Ubah draft'}</h1>
        </div>
        <div className="page-actions">{p.canDelete && <button className="btn bad" disabled={!!busy} onClick={async () => { if (await run('del', () => del(`/e-documents/${id}`), 'Draft dihapus')) router.push('/e-docs'); }}><Trash2 />Hapus draft</button>}</div>
        </div>
        {rejected && <div className="alert bad" style={{ marginBottom: 18 }}><XCircle /><span>Ditolak oleh <b>{rejected.name}</b>: “{rejected.comment}”. Perbaiki lalu kirim ulang — approval (beserta paraf & tanda tangan) dimulai lagi dari level pertama{d.request ? <> pada request <span className="num">{d.request.refCode}</span></> : ''}.</span></div>}
        <EDocEditor key={d.updatedAt} existingId={id} number={d.number} initial={edocToForm(d)} onSave={async (payload, submit, opts) => {
          const { templateId, ...rest } = payload;
          await patch(`/e-documents/${id}`, rest);
          if (submit) { await post(`/e-documents/${id}/submit`, opts); toast.ok('Naskah dikirim untuk approval'); }
          else toast.ok('Draft disimpan');
          reload();
        }} />
      </>
    );
  }

  const sign = async () => {
    setSignError(null);
    try {
      await post(`/e-documents/${id}/sign`, { password, comment: note || undefined });
      setSignOpen(false); setPassword(''); setNote('');
      toast.ok(p.myRole === 'paraf' ? 'Paraf tersimpan' : 'Naskah ditandatangani — QR code diterbitkan');
      reload();
    } catch (e: any) { setSignError(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <Link href="/e-docs" className="small row" style={{ gap: 4, marginBottom: 8 }}><ChevronLeft size={15} />Naskah dinas</Link>
          <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
            <span className="ref" style={{ fontSize: 14 }}>{d.number ?? 'Belum bernomor'}</span>
            <span className={`badge tone-${st.tone}`}><span className="pip" />{st.label}</span>
            {d.template && <span className="badge tone-muted">{d.template.name}</span>}
            {d.request && <PriorityBadge priority={d.request.priority} />}
          </div>
          <h1 style={{ maxWidth: '30ch' }}>{d.title}</h1>
        </div>
        <div className="page-actions">
          {p.canDecide && <button className="btn ok" onClick={() => setDecide('approve')}><KeyRound />{approveWord}</button>}
          {p.canDecide && <button className="btn bad" onClick={() => setDecide('reject')}><X />Tolak</button>}
          {p.canDelegate && <button className="btn" onClick={() => setDecide('delegate')}><Forward />Delegasikan</button>}
          {d.request && <Link className="btn" href={`/requests/${d.request.id}`}><ClipboardList />{d.request.refCode}</Link>}
          {p.canSign && <button className="btn ok" onClick={() => setSignOpen(true)}><PenLine />{roleWord}</button>}
          {p.canSign && <button className="btn bad" onClick={() => setRejectOpen(true)}><X />Kembalikan</button>}
          {p.canCancel && <button className="btn" disabled={!!busy} onClick={async () => { if (await run('c', () => post(`/e-documents/${id}/cancel`), 'Naskah ditarik menjadi draft')) reload(); }}><Undo2 />Tarik kembali</button>}
          <button className="btn" disabled={!!busy} onClick={() => run('pdf', () => download(`/e-documents/${id}/pdf`))}><Download />{d.status === 'signed' ? 'Unduh PDF' : 'PDF draf'}</button>
          {d.file && <Link className="btn" href={`/documents/${d.file.id}`}><FolderOpen />Di Dokumen</Link>}
        </div>
      </div>

      {p.canDecide && <div className="alert info" style={{ marginBottom: 18 }}><KeyRound /><span>Naskah ini menunggu persetujuan Anda di level <b>{p.myLevelName}</b>. Periksa isinya, lalu klik <b>{approveWord}</b> dan konfirmasi dengan kata sandi — QR {p.myRole === 'sign' ? 'tanda tangan' : 'paraf'} Anda langsung terbit di naskah.</span></div>}
      {p.canSign && <div className="alert info" style={{ marginBottom: 18 }}><PenLine /><span>Naskah ini menunggu {p.myRole === 'paraf' ? 'paraf' : 'tanda tangan'} Anda. Periksa isinya, lalu klik <b>{roleWord}</b> dan konfirmasi dengan kata sandi.</span></div>}
      {rejected && <div className="alert bad" style={{ marginBottom: 18 }}><XCircle /><span>Ditolak oleh <b>{rejected.name}</b>: “{rejected.comment}”</span></div>}

      <div className="grid split">
        <div style={{ minWidth: 0 }}>
          <Paper d={paperData} draft={d.status !== 'signed'} body={<div className="body" dangerouslySetInnerHTML={{ __html: d.renderedHtml }} />} />
        </div>
        <div className="stack lg">
          {!d.legacy && d.approval && (
            <Panel title={<span className="row"><GitBranch size={17} style={{ color: 'var(--ion)' }} /><h2>Alur persetujuan</h2></span>}
              sub={<>Request <Link href={`/requests/${d.request.id}`} className="num">{d.request.refCode}</Link> · alur {d.approval.flow.name}</>}
              actions={d.request && <StatusBadge status={d.request.statusCode} />}>
              <ApprovalTrack levels={d.approval.levels} />
            </Panel>
          )}
          {!d.legacy && (
            <Panel title={<span className="row"><QrCode size={17} style={{ color: 'var(--ion)' }} /><h2>QR paraf & tanda tangan</h2></span>} sub="Terbit otomatis saat tiap level menyetujui">
              {!d.signers.length && !d.plannedSigners.length ? <p className="small muted">Belum ada.</p> : (
                <div className="sign-steps">
                  {d.signers.map((s: any) => (
                    <div key={`s${s.order}`} className="sign-step done">
                      <span className="dot"><Check /></span>
                      <div className="small">
                        <b>{s.user.fullName}</b> <span className="muted">· {s.role === 'paraf' ? 'Paraf' : 'Tanda tangan'}</span>
                        <div className="tiny muted">{s.levelName ?? s.positionTitle ?? '—'}{s.onBehalfOf ? ` · a.n. ${s.onBehalfOf}` : ''}</div>
                        <div className="tiny" style={{ color: 'var(--ok)' }}>Disetujui {fmtDateTime(s.signedAt)}</div>
                        {s.comment && <div className="tiny ink2">“{s.comment}”</div>}
                        {s.verifyUrl && <a className="tiny row" style={{ gap: 4 }} href={s.verifyUrl} target="_blank" rel="noreferrer"><ExternalLink size={11} />Halaman verifikasi</a>}
                      </div>
                    </div>
                  ))}
                  {d.plannedSigners.map((s: any, i: number) => (
                    <div key={`p${s.order}`} className={`sign-step ${d.status === 'signing' && i === 0 ? 'now' : ''}`}>
                      <span className="dot">{s.order}</span>
                      <div className="small">
                        <b>{s.levelName}</b> <span className="muted">· {s.role === 'paraf' ? 'Paraf' : 'Tanda tangan'}</span>
                        <div className="tiny muted">{s.approverName ?? '—'}</div>
                        <div className="tiny" style={{ color: d.status === 'signing' && i === 0 ? 'var(--ion)' : 'var(--muted)' }}>{d.status === 'signing' ? (i === 0 ? 'Menunggu persetujuan' : 'Menunggu level sebelumnya') : 'Setelah dikirim'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}
          {d.legacy && <Panel title={<span className="row"><QrCode size={17} style={{ color: 'var(--ion)' }} /><h2>Paraf & tanda tangan</h2></span>} sub="Berurutan; setiap tanda tangan menerbitkan QR verifikasi">
            <div className="sign-steps">
              {d.signers.map((s: any) => (
                <div key={s.order} className={`sign-step ${s.status === 'signed' ? 'done' : s.status === 'pending' ? 'now' : s.status === 'rejected' ? 'rej' : ''}`}>
                  <span className="dot">{s.status === 'signed' ? <Check /> : s.status === 'rejected' ? <X /> : s.order}</span>
                  <div className="small">
                    <b>{s.user.fullName}</b> <span className="muted">· {s.role === 'paraf' ? 'Paraf' : 'Tanda tangan'}</span>
                    <div className="tiny muted">{s.positionTitle ?? '—'}</div>
                    <div className="tiny" style={{ color: s.status === 'signed' ? 'var(--ok)' : s.status === 'pending' ? 'var(--ion)' : s.status === 'rejected' ? 'var(--bad)' : 'var(--muted)' }}>
                      {s.status === 'signed' ? `Selesai ${fmtDateTime(s.signedAt)}` : s.status === 'pending' ? 'Giliran saat ini' : s.status === 'rejected' ? 'Mengembalikan naskah' : 'Menunggu giliran'}
                    </div>
                    {s.comment && <div className="tiny ink2">“{s.comment}”</div>}
                    {s.verifyUrl && <a className="tiny row" style={{ gap: 4 }} href={s.verifyUrl} target="_blank" rel="noreferrer"><ExternalLink size={11} />Halaman verifikasi</a>}
                  </div>
                </div>
              ))}
            </div>
          </Panel>}

          {d.status === 'signed' && (
            <div className={`alert ${d.intact ? 'ok' : 'bad'}`}>
              {d.intact ? <ShieldCheck /> : <ShieldAlert />}
              <span>{d.intact ? <>Isi naskah utuh sejak ditandatangani. Hash <span className="num">{d.contentHash?.slice(0, 16)}</span>.</> : 'Isi naskah tidak cocok dengan hash saat ditandatangani.'}</span>
            </div>
          )}

          <Panel title={<span className="row"><FileClock size={17} style={{ color: 'var(--ion)' }} /><h2>Riwayat</h2></span>}>
            <div className="timeline">
              {d.logs.map((l: any) => (
                <div key={l.id} className="tl-item">
                  <div className={`tl-dot ${['signed', 'paraf', 'finalized'].includes(l.action) ? 'ok' : l.action === 'rejected' ? 'bad' : ''}`}>{['signed', 'paraf', 'finalized'].includes(l.action) ? <Check /> : <PenLine />}</div>
                  <div className="tl-body"><b>{l.actor?.fullName ?? 'Sistem'}</b> <span className="ink2">{LOG[l.action] ?? l.action}</span><div className="tiny muted">{fmtDateTime(l.createdAt)}</div>{l.comment && <div className="note">{l.comment}</div>}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {p.instanceId && (
        <DecideModal instanceId={p.instanceId} kind={decide} refCode={d.request?.refCode ?? d.number} title={d.title}
          excludeIds={[me!.id, d.creator.id]} naskah={{ role: p.myRole, number: d.number }}
          onClose={() => setDecide(null)}
          onDone={(k) => { setDecide(null); toast.ok(k === 'approve' ? (p.myRole === 'sign' ? 'Disetujui — QR tanda tangan diterbitkan' : 'Disetujui — QR paraf diterbitkan') : k === 'reject' ? 'Ditolak, pembuat diberi tahu' : 'Didelegasikan'); reload(); }} />
      )}
      <Modal open={signOpen} onClose={() => setSignOpen(false)} title={`${roleWord} naskah`}
        footer={<><button className="btn ghost" onClick={() => setSignOpen(false)}>Batal</button><button className="btn ok" disabled={!password} onClick={sign}><KeyRound />{roleWord}</button></>}>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); if (password) sign(); }}>
          <div><span className="ref">{d.number}</span><div style={{ fontWeight: 500 }}>{d.title}</div></div>
          <p className="small ink2">Dengan {p.myRole === 'paraf' ? 'memaraf' : 'menandatangani'}, Anda menyetujui isi naskah ini. Sistem menerbitkan QR code unik yang terikat pada isi naskah — jika isi berubah, QR akan dinyatakan tidak valid.</p>
          <ErrorAlert error={signError} />
          <Field label="Konfirmasi kata sandi" required><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /></Field>
          <Field label="Catatan"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsional" /></Field>
        </form>
      </Modal>
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Kembalikan naskah"
        footer={<><button className="btn ghost" onClick={() => setRejectOpen(false)}>Batal</button><button className="btn bad" disabled={reason.trim().length < 5 || !!busy} onClick={async () => { if (await run('r', () => post(`/e-documents/${id}/reject`, { reason }), 'Naskah dikembalikan ke pembuat')) { setRejectOpen(false); setReason(''); reload(); } }}><X />Kembalikan</button></>}>
        <Field label="Alasan" required hint="Dikirim ke pembuat agar dapat merevisi" error={reason && reason.trim().length < 5 ? 'Minimal 5 karakter' : null}>
          <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
      </Modal>
    </>
  );
}
