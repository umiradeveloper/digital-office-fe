'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { post, qs } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { Empty, Loading, Pagination, Panel } from '@/components/ui';

const DELIVERY: Record<string, [string, string]> = { sent: ['tone-ok', 'E-mail terkirim'], failed: ['tone-bad', 'E-mail gagal'], pending: ['tone-warn', 'Dalam antrean'] };

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const { data, meta, loading, reload } = useApi<any[]>(`/notifications${qs({ page, unread: unread ? 1 : undefined, perPage: 20 })}`);
  return (
    <>
      <div className="page-head">
        <div><h1>Notifikasi</h1><p className="lead">Salinan setiap e-mail yang dikirim kepada Anda, beserta status pengirimannya.</p></div>
        <div className="page-actions">
          <div className="seg"><button className={!unread ? 'on' : ''} onClick={() => { setUnread(false); setPage(1); }}>Semua</button><button className={unread ? 'on' : ''} onClick={() => { setUnread(true); setPage(1); }}>Belum dibaca</button></div>
          <button className="btn" onClick={async () => { await post('/notifications/mark-all-read'); reload(); }}><CheckCheck />Tandai semua dibaca</button>
        </div>
      </div>
      <Panel flat bodyClass="tight">
        {loading && !data ? <div className="panel-body"><Loading /></div> : !data?.length ? <Empty icon={<Bell />} title="Tidak ada notifikasi" /> : data.map((n) => (
          <div key={n.id} className="row top" style={{ padding: '14px 20px', borderBottom: '1px solid var(--line-soft)', gap: 14, background: n.readAt ? undefined : 'var(--ion-soft)' }}>
            <span style={{ width: 8, height: 8, marginTop: 8, borderRadius: 8, flex: 'none', background: n.readAt ? 'transparent' : 'var(--ion)' }} />
            <div className="grow">
              <div className="row wrap between"><b>{n.subject}</b><span className="tiny muted">{fmtDateTime(n.createdAt)}</span></div>
              <p className="small ink2" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{n.body}</p>
              <div className="row" style={{ marginTop: 8 }}>
                <span className={`badge ${DELIVERY[n.status][0]}`}>{DELIVERY[n.status][1]}</span>
                {n.requestId && <Link href={`/requests/${n.requestId}`} className="btn sm" onClick={() => !n.readAt && post(`/notifications/${n.id}/mark-read`)}>Buka request</Link>}
                {!n.readAt && <button className="btn ghost sm" onClick={async () => { await post(`/notifications/${n.id}/mark-read`); reload(); }}>Tandai dibaca</button>}
              </div>
            </div>
          </div>
        ))}
        <Pagination meta={meta} onPage={setPage} />
      </Panel>
    </>
  );
}
