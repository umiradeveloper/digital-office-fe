'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, Eye, FileSignature, Forward, KeyRound, Paperclip, Stamp, X, Repeat2 } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { get } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PRIORITY, fmtDate, fmtMoney, timeAgo } from '@/lib/format';
import { Avatar, Empty, ErrorAlert, Loading, Panel, PriorityBadge, useToast } from '@/components/ui';
import { ApprovalTrack } from '@/components/approval-track';
import { DecideModal, type DecisionKind } from '@/components/decide-modal';

function InboxInner() {
  const sp = useSearchParams();
  const focus = sp.get('focus');
  const { me } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<any[]>('/approvals/inbox', { poll: 20000 });
  const [prio, setPrio] = useState('');
  const [active, setActive] = useState<{ item: any; kind: DecisionKind } | null>(null);
  const [tracks, setTracks] = useState<Record<string, any>>({});

  // muat tracker untuk tiap item (posisi level & waktu per level)
  useEffect(() => {
    data?.forEach((i) => { if (!tracks[i.instanceId]) get(`/approvals/${i.instanceId}`).then((t) => setTracks((x) => ({ ...x, [i.instanceId]: t }))).catch(() => {}); });
  }, [data]); // eslint-disable-line

  useEffect(() => { if (focus) document.getElementById(`ap-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [focus, data]);

  const items = (data ?? []).filter((i) => !prio || i.request.priority === prio);
  const counts = (data ?? []).reduce<Record<string, number>>((a, i) => ({ ...a, [i.request.priority]: (a[i.request.priority] ?? 0) + 1 }), {});

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inbox approval</h1>
          <p className="lead">Request yang menunggu keputusan Anda, termasuk yang didelegasikan kepada Anda. Diurutkan dari prioritas tertinggi dan jatuh tempo terdekat.</p>
        </div>
        <div className="page-actions"><Link href="/delegations" className="btn"><Repeat2 />Atur delegasi</Link></div>
      </div>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <button className={`chip ${!prio ? 'on' : ''}`} onClick={() => setPrio('')}>Semua <span className="num">{data?.length ?? 0}</span></button>
        {['crit', 'high', 'med', 'low'].map((p) => (
          <button key={p} className={`chip ${prio === p ? 'on' : ''}`} onClick={() => setPrio(p)}>{PRIORITY[p].label} <span className="num">{counts[p] ?? 0}</span></button>
        ))}
      </div>
      <ErrorAlert error={error} />
      <Panel flat bodyClass="tight">
        {loading && !data ? <div className="panel-body"><Loading rows={4} /></div>
          : !items.length ? <Empty icon={<Stamp />} title="Tidak ada yang menunggu Anda">Saat request masuk ke level yang Anda tangani, item akan muncul di sini dan Anda menerima e-mail.</Empty>
          : items.map((i) => (
            <div key={i.instanceId} id={`ap-${i.instanceId}`} className={`inbox-card ${focus === i.instanceId ? 'focus' : ''}`}>
              <div className="stack" style={{ gap: 10 }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <Link href={`/requests/${i.request.id}`} className="ref">{i.request.refCode}</Link>
                  <PriorityBadge priority={i.request.priority} />
                  <span className="badge tone-muted">{i.request.type.name}</span>
                  {i.eDocument && <span className="badge tone-ion"><FileSignature size={12} />Naskah · {i.eDocument.role === 'sign' ? 'tanda tangan' : 'paraf'}</span>}
                  {i.onBehalfOf && <span className="badge tone-violet">Delegasi dari {i.onBehalfOf.fullName}</span>}
                  {i.slaBreached && <span className="badge tone-bad">SLA {i.level.slaHours} jam terlewati</span>}
                </div>
                <Link href={`/requests/${i.request.id}`} style={{ color: 'var(--ink)', fontSize: 16, fontWeight: 500 }}>{i.request.title}</Link>
                <div className="row wrap small muted" style={{ gap: 14 }}>
                  <span className="row" style={{ gap: 6 }}><Avatar name={i.request.requester.fullName} src={i.request.requester.photoUrl} size="sm" />{i.request.requester.fullName}</span>
                  <span>Due <b className="ink2">{fmtDate(i.request.dueDate)}</b></span>
                  {i.request.amount != null && <span className="num ink2">{fmtMoney(i.request.amount)}</span>}
                  {i.request.attachmentCount > 0 && <span className="row" style={{ gap: 4 }}><Paperclip size={13} />{i.request.attachmentCount}</span>}
                  <span>Menunggu sejak {timeAgo(i.levelStartedAt)}</span>
                </div>
                {tracks[i.instanceId] && <div style={{ maxWidth: 520 }}><ApprovalTrack compact levels={tracks[i.instanceId].levels} /></div>}
              </div>
              <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
                {i.eDocument && <Link className="btn" href={`/e-docs/${i.eDocument.id}`}><Eye />Baca naskah</Link>}
                <button className="btn ok" onClick={() => setActive({ item: i, kind: 'approve' })}>{i.requiresPassword ? <KeyRound /> : <Check />}{i.eDocument ? (i.eDocument.role === 'sign' ? 'Setujui & tanda tangani' : 'Setujui & paraf') : 'Setujui'}</button>
                <button className="btn bad" onClick={() => setActive({ item: i, kind: 'reject' })}><X />Tolak</button>
                {i.canDelegate && <button className="btn" onClick={() => setActive({ item: i, kind: 'delegate' })}><Forward />Delegasikan</button>}
              </div>
            </div>
          ))}
      </Panel>
      {active && (
        <DecideModal instanceId={active.item.instanceId} kind={active.kind} refCode={active.item.request.refCode} title={active.item.request.title}
          excludeIds={[me!.id, active.item.request.requester.id]} onClose={() => setActive(null)} naskah={active.item.eDocument}
          onDone={(k) => { setActive(null); setTracks({}); toast.ok(k === 'approve' ? 'Disetujui — diteruskan ke level berikutnya bila ada' : k === 'reject' ? 'Ditolak, pengaju diberi tahu' : 'Didelegasikan'); reload(); }} />
      )}
    </>
  );
}

export default function ApprovalsPage() { return <Suspense><InboxInner /></Suspense>; }
