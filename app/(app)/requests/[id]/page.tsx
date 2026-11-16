'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BellRing, Check, ChevronLeft, CircleDot, Download, Eye, FileClock, Forward, GitBranch, Lock, MessageSquare, Paperclip, PenLine,
  Play, Send, Trash2, X, XCircle,
} from 'lucide-react';
import { del, download, patch, post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { ACTION_LABEL, STATUS, dueState, fmtBytes, fmtDate, fmtDateTime, fmtMoney, statusKey, timeAgo } from '@/lib/format';
import { Avatar, Empty, ErrorAlert, Loading, Modal, Panel, PriorityBadge, StatusBadge, useAction, useToast } from '@/components/ui';
import { ApprovalTrack } from '@/components/approval-track';
import { DecideModal, type DecisionKind } from '@/components/decide-modal';
import { RequestForm, requestToForm } from '@/components/request-form';
import { FileViewer } from '@/components/file-viewer';

const LOG_ICON: Record<string, [any, string]> = {
  approved: [Check, 'ok'], approved_level: [Check, 'ok'], rejected: [X, 'bad'], delegated: [Forward, 'warn'], commented: [MessageSquare, ''],
  submitted: [Send, 'ion'], resubmitted: [Send, 'ion'], approval_started: [GitBranch, 'ion'], closed: [Lock, ''], reminded: [BellRing, 'warn'],
};

export default function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { data: r, error, loading, reload } = useApi<any>(`/requests/${id}`, { poll: 15000 });
  const { busy, run } = useAction();
  const [decide, setDecide] = useState<DecisionKind | null>(null);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [viewFile, setViewFile] = useState<any>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeNote, setCloseNote] = useState('');

  if (loading && !r) return <Loading rows={8} />;
  if (error && !r) return <><ErrorAlert error={error} /><Link href="/requests" className="btn" style={{ marginTop: 14 }}>Kembali</Link></>;
  if (!r) return null;

  const p = r.permissions;
  const approval = r.approval;
  const currentLevel = approval?.levels.find((l: any) => l.state === 'current');
  const ds = dueState(r.dueDate, ['closed', 'approved', 'rejected'].includes(r.statusCode));
  const customFields: any[] = r.type.customFieldsJson ?? [];

  if (editing) {
    return (
      <>
        <div className="page-head"><div>
          <button className="btn ghost sm" onClick={() => setEditing(false)}><ChevronLeft />Batal revisi</button>
          <h1 style={{ marginTop: 8 }}>{r.statusCode === 'rejected' ? 'Revisi request' : 'Ubah draft'}</h1>
          <p className="lead"><span className="ref">{r.refCode}</span> — setelah dikirim ulang, approval dimulai lagi dari level pertama.</p>
        </div></div>
        <RequestForm
          initial={requestToForm(r)} lockType submitLabel={r.statusCode === 'rejected' ? 'Simpan & kirim ulang' : 'Simpan & kirim'}
          onSubmit={async (payload, submit) => {
            const { typeId, ...rest } = payload;
            await patch(`/requests/${id}`, rest);
            if (submit) await post(`/requests/${id}/submit`);
            toast.ok(submit ? 'Request dikirim ulang' : 'Perubahan disimpan');
            setEditing(false); reload();
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <Link href="/requests" className="small row" style={{ gap: 4, marginBottom: 8 }}><ChevronLeft size={15} />Request</Link>
          <div className="row wrap" style={{ gap: 10, marginBottom: 6 }}>
            <span className="ref" style={{ fontSize: 14 }}>{r.refCode}</span><StatusBadge status={r.statusCode} /><PriorityBadge priority={r.priority} />
            <span className="badge tone-muted">{r.type.name}</span>
          </div>
          <h1 style={{ maxWidth: '30ch' }}>{r.title}</h1>
        </div>
        <div className="page-actions">
          {p.canDecide && approval && (
            <>
              <button className="btn ok" onClick={() => setDecide('approve')}><Check />Setujui</button>
              <button className="btn bad" onClick={() => setDecide('reject')}><X />Tolak</button>
              {currentLevel?.delegateOn && <button className="btn" onClick={() => setDecide('delegate')}><Forward />Delegasikan</button>}
            </>
          )}
          {p.canEdit && <button className="btn" onClick={() => setEditing(true)}><PenLine />{r.statusCode === 'rejected' ? 'Revisi' : 'Ubah'}</button>}
          {p.canSubmit && r.statusCode === 'draft' && <button className="btn primary" disabled={!!busy} onClick={() => run('s', () => post(`/requests/${id}/submit`), 'Request dikirim').then(() => reload())}><Send />Kirim</button>}
          {p.canChangeStatus.includes('in_progress') && <button className="btn" disabled={!!busy} onClick={() => run('ip', () => patch(`/requests/${id}`, { status: 'in-progress' }), 'Status: In-Progress').then(() => reload())}><Play />Mulai kerjakan</button>}
          {p.canRemind && <button className="btn" disabled={!!busy} onClick={() => run('rm', () => post(`/requests/${id}/remind`, {}), 'Pengingat dikirim').then(() => reload())}><BellRing />Tagih</button>}
          {p.canClose && <button className="btn" onClick={() => setCloseOpen(true)}><Lock />Tutup</button>}
          {p.canDelete && <button className="btn bad" disabled={!!busy} onClick={() => run('d', () => del(`/requests/${id}`), 'Draft dihapus').then((x) => x && router.push('/requests'))}><Trash2 /></button>}
        </div>
      </div>

      {r.statusCode === 'rejected' && (
        <div className="alert bad" style={{ marginBottom: 18 }}><XCircle />
          <span>Request ditolak dan dikembalikan untuk revisi. {(() => {
            const d = approval?.levels.flatMap((l: any) => l.decisions).find((d: any) => d.decision === 'reject');
            return d ? <>Alasan dari <b>{d.approver.fullName}</b>: “{d.comment}”</> : null;
          })()}</span>
        </div>
      )}

      <div className="grid split">
        <div className="stack lg">
          {approval && (
            <Panel
              title="Status approval" sub={<>Alur <b className="ink2">{approval.flow.name}</b> · diperbarui otomatis</>}
              actions={<span className={`badge tone-${approval.status === 'approved' ? 'ok' : approval.status === 'rejected' ? 'bad' : 'warn'}`}><span className="pip" />{approval.status === 'in_progress' ? `Di ${currentLevel?.name ?? '—'}` : approval.status === 'approved' ? 'Selesai disetujui' : 'Ditolak'}</span>}
            >
              <ApprovalTrack levels={approval.levels} />
              {approval.levels.some((l: any) => l.decisions.length) && (
                <>
                  <div className="divider" />
                  <div className="stack sm">
                    <span className="small muted">Riwayat keputusan</span>
                    {approval.levels.flatMap((l: any) => l.decisions.map((d: any) => ({ ...d, level: l.name }))).map((d: any) => (
                      <div key={d.id} className="row top small" style={{ gap: 10 }}>
                        <Avatar name={d.approver.fullName} src={d.approver.photoUrl} size="sm" />
                        <div className="grow">
                          <b>{d.approver.fullName}</b>{d.onBehalfOf && <span className="muted"> (delegat a.n. {d.onBehalfOf.fullName})</span>}{' '}
                          <span className={d.decision === 'approve' ? '' : d.decision === 'reject' ? '' : ''} style={{ color: d.decision === 'approve' ? 'var(--ok)' : d.decision === 'reject' ? 'var(--bad)' : 'var(--warn)' }}>
                            {d.decision === 'approve' ? 'menyetujui' : d.decision === 'reject' ? 'menolak' : `mendelegasikan ke ${d.delegatedToUser?.fullName}`}
                          </span>{' '}<span className="muted">{d.level}</span>
                          {d.comment && <div className="ink2">“{d.comment}”</div>}
                        </div>
                        <span className="tiny muted nowrap">{fmtDateTime(d.decidedAt)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          )}

          <Panel title="Deskripsi">
            <p style={{ whiteSpace: 'pre-wrap' }} className="ink2">{r.description || <span className="muted">Tidak ada deskripsi.</span>}</p>
            {(customFields.length > 0 || r.amount) && (
              <>
                <div className="divider" />
                <dl className="form-grid" style={{ margin: 0 }}>
                  {r.amount != null && <div><dt className="small muted">Nilai</dt><dd style={{ margin: 0 }} className="num">{fmtMoney(r.amount)}</dd></div>}
                  {customFields.map((f) => {
                    const v = r.customValuesJson?.[f.key];
                    if (f.type === 'currency' && r.amount != null) return null;
                    return <div key={f.key}><dt className="small muted">{f.label}</dt><dd style={{ margin: 0 }}>{v == null || v === '' ? '—' : f.type === 'currency' ? fmtMoney(v) : f.type === 'date' ? fmtDate(v) : String(v)}</dd></div>;
                  })}
                </dl>
              </>
            )}
          </Panel>

          <Panel title="Lampiran" sub={`${r.attachments.length} file`} bodyClass={r.attachments.length ? 'tight' : ''}>
            {!r.attachments.length ? <span className="small muted">Tidak ada lampiran.</span> : r.attachments.map((a: any) => (
              <div key={a.id} className="row" style={{ padding: '10px 18px', borderBottom: '1px solid var(--line-soft)' }}>
                <Paperclip size={15} className="muted" />
                <span className="grow truncate">{a.file.originalName}{a.file.deletedAt && <span className="badge tone-bad" style={{ marginLeft: 8 }}>dihapus</span>}</span>
                <span className="tiny muted hide-sm">v{a.file.version} · {fmtBytes(a.file.sizeBytes)}</span>
                {!a.file.deletedAt && <>
                  <button className="btn ghost sm icon" onClick={() => setViewFile(a.file)} aria-label="Lihat"><Eye /></button>
                  <button className="btn ghost sm icon" onClick={() => run('dl', () => download(`/files/${a.file.id}/download`))} aria-label="Unduh"><Download /></button>
                </>}
              </div>
            ))}
          </Panel>

          <Panel title="Komentar" sub={`${r.comments.length} komentar`}>
            <div className="stack">
              {r.comments.length === 0 && <Empty icon={<MessageSquare />} title="Belum ada diskusi">Gunakan komentar untuk klarifikasi dengan pengaju, approver, atau penanggung jawab.</Empty>}
              {r.comments.map((c: any) => (
                <div key={c.id} className="row top" style={{ gap: 12 }}>
                  <Avatar name={c.user.fullName} src={c.user.photoUrl} />
                  <div className="grow">
                    <div className="small"><b>{c.user.fullName}</b> <span className="muted">· {timeAgo(c.createdAt)}</span></div>
                    <div className="ink2" style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
                  </div>
                </div>
              ))}
              {p.canComment && (
                <form className="stack sm" onSubmit={async (e) => { e.preventDefault(); if (!comment.trim()) return; const ok = await run('c', () => post(`/requests/${id}/comments`, { body: comment })); if (ok) { setComment(''); reload(); } }}>
                  <textarea className="textarea" style={{ minHeight: 70 }} placeholder="Tulis komentar…" value={comment} onChange={(e) => setComment(e.target.value)} />
                  <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm primary" disabled={!comment.trim() || busy === 'c'}><MessageSquare />Kirim komentar</button></div>
                </form>
              )}
            </div>
          </Panel>
        </div>

        <div className="stack lg">
          <Panel title="Ringkasan">
            <div className="stack">
              <Meta label="Pengaju"><span className="row"><Avatar name={r.requester.fullName} src={r.requester.photoUrl} size="sm" /><span>{r.requester.fullName}<br /><span className="tiny muted">{r.requester.position ?? ''} · {r.requester.department?.name ?? ''}</span></span></span></Meta>
              <Meta label="Penanggung jawab">{r.assignee ? <span className="row"><Avatar name={r.assignee.fullName} src={r.assignee.photoUrl} size="sm" />{r.assignee.fullName}</span> : <span className="muted">Belum ditentukan</span>}</Meta>
              <Meta label="Due date"><span style={{ color: ds === 'overdue' ? 'var(--bad)' : ds === 'soon' ? 'var(--warn)' : undefined }}>{fmtDate(r.dueDate)}{ds === 'overdue' && ' · lewat jatuh tempo'}</span></Meta>
              <Meta label="Dibuat">{fmtDateTime(r.createdAt)}</Meta>
              <Meta label="Dikirim">{fmtDateTime(r.submittedAt)}</Meta>
              {r.closedAt && <Meta label="Ditutup">{fmtDateTime(r.closedAt)}</Meta>}
            </div>
          </Panel>

          <Panel title={<span className="row"><FileClock size={17} style={{ color: 'var(--ion)' }} /><h2>Timeline</h2></span>} sub="Siapa melakukan apa, kapan">
            <div className="timeline">
              {r.logs.map((l: any) => {
                const [Icon, tone] = LOG_ICON[l.action] ?? [CircleDot, ''];
                return (
                  <div key={l.id} className="tl-item">
                    <div className={`tl-dot ${tone}`}><Icon /></div>
                    <div className="tl-body">
                      <b>{l.actor?.fullName ?? 'Sistem'}</b> <span className="ink2">{ACTION_LABEL[l.action] ?? l.action}</span>
                      {l.toStatus && l.fromStatus !== l.toStatus && <span className="muted"> → {STATUS[statusKey(l.toStatus)]?.label ?? l.toStatus}</span>}
                      <div className="tiny muted">{fmtDateTime(l.createdAt)}</div>
                      {l.comment && l.action !== 'commented' && <div className="note">{l.comment}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
          {!p.canComment && <div className="alert info"><Lock /><span>Mode baca saja — peran Anda tidak dapat mengubah request ini.</span></div>}
        </div>
      </div>

      {approval && (
        <DecideModal instanceId={approval.id} kind={decide} refCode={r.refCode} title={r.title} excludeIds={[me!.id, r.requester.id]}
          onClose={() => setDecide(null)}
          onDone={(k) => { setDecide(null); toast.ok(k === 'approve' ? 'Disetujui' : k === 'reject' ? 'Ditolak, pengaju telah diberi tahu' : 'Didelegasikan'); reload(); }} />
      )}
      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="Tutup request"
        footer={<><button className="btn ghost" onClick={() => setCloseOpen(false)}>Batal</button><button className="btn primary" disabled={busy === 'cl'} onClick={async () => { const ok = await run('cl', () => post(`/requests/${id}/close`, { comment: closeNote || undefined }), 'Request ditutup'); if (ok) { setCloseOpen(false); reload(); } }}><Lock />Tutup request</button></>}>
        <div className="stack"><p className="ink2">Request yang ditutup tidak dapat diubah lagi. Tambahkan catatan penutupan bila perlu.</p>
          <textarea className="textarea" value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="Catatan (opsional)" /></div>
      </Modal>
      {viewFile && <FileViewer file={viewFile} onClose={() => setViewFile(null)} />}
    </>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="row top" style={{ gap: 12 }}><span className="small muted" style={{ width: 118, flex: 'none' }}>{label}</span><span className="grow small">{children}</span></div>;
}
