'use client';
import Link from 'next/link';
import { AlertTriangle, ClipboardList, FilePlus2, FolderOpen, Stamp, Timer } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { ACTION_LABEL, PRIORITY, STATUS, fmtDate, timeAgo } from '@/lib/format';
import { Avatar, Empty, ErrorAlert, Panel, PriorityBadge, Skeleton } from '@/components/ui';
import { ColumnChart, Ring } from '@/components/charts';

const STATUS_COLORS: Record<string, string> = {
  'pending-approval': '#D18A2E', submitted: '#2F6EA3', 'in-progress': '#075F78', approved: '#1D8A5A', rejected: '#C53030', closed: '#9D521F', draft: '#A9BCC3',
};

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
}

export default function Dashboard() {
  const { me, can } = useAuth();
  const { data: s, error, loading } = useApi<any>('/admin/stats', { poll: 60000 });
  const first = me?.fullName.split(' ')[0];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting()}, {first}</h1>
          <p className="lead">
            {loading ? 'Memuat ringkasan…'
              : s?.pendingApprovals ? `${s.pendingApprovals} request menunggu keputusan Anda${s.overdue ? `, ${s.overdue} lewat jatuh tempo` : ''}.`
              : 'Tidak ada approval yang menunggu Anda.'}
          </p>
        </div>
        <div className="page-actions">
          {can('REQUEST_CREATE') && <Link className="btn primary" href="/requests/new"><FilePlus2 />Buat request</Link>}
          {can('APPROVAL_DECIDE') && <Link className="btn" href="/approvals"><Stamp />Buka inbox</Link>}
        </div>
      </div>
      <ErrorAlert error={error} />

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Stat icon={<Stamp />} label="Menunggu approval saya" value={s?.pendingApprovals} href="/approvals" tone="var(--warn)" sub={s ? `${s.decisionsLast7Days} keputusan 7 hari terakhir` : ''} loading={loading} />
        <Stat icon={<ClipboardList />} label="Request yang saya buat" value={s?.mine.created} href="/requests?mine=created" sub={s ? `${s.mine.byStatus['pending-approval'] ?? 0} sedang di-approve · ${s.mine.byStatus.rejected ?? 0} perlu revisi` : ''} loading={loading} />
        <Stat icon={<Timer />} label="Lewat jatuh tempo" value={s?.overdue} href="/requests?due=overdue" tone={s?.overdue ? 'var(--bad)' : undefined} sub={s ? `${s.mine.assignedOpen} tugas aktif untuk saya` : ''} loading={loading} />
        <Stat icon={<FolderOpen />} label="Dokumen dapat diakses" value={s?.documents} href="/documents" sub="Semua versi aktif" loading={loading} />
      </div>

      <div className="grid split-wide" style={{ marginBottom: 18 }}>
        <Panel title="Menunggu keputusan Anda" sub="Diurutkan menurut prioritas, lalu jatuh tempo" actions={can('APPROVAL_DECIDE') && <Link href="/approvals" className="btn sm">Semua</Link>} bodyClass="tight">
          {loading ? <div className="panel-body"><Skeleton h={160} /></div>
            : !s?.inboxPreview?.length ? <Empty icon={<Stamp />} title="Inbox bersih">Request baru yang perlu Anda setujui akan muncul di sini.</Empty>
            : s.inboxPreview.map((i: any) => (
              <Link key={i.instanceId} href={`/approvals?focus=${i.instanceId}`} className="inbox-card" style={{ color: 'inherit', textDecoration: 'none', display: 'grid' }}>
                <div className="row top" style={{ gap: 14 }}>
                  <span className="prio-bar" style={{ ['--c' as any]: `var(--${PRIORITY[i.request.priority].tone === 'muted' ? 'muted' : PRIORITY[i.request.priority].tone})` }} />
                  <div className="grow">
                    <div className="row wrap" style={{ gap: 8 }}><span className="ref">{i.request.refCode}</span><PriorityBadge priority={i.request.priority} />{i.slaBreached && <span className="badge tone-bad">SLA terlewati</span>}</div>
                    <div style={{ fontWeight: 500, marginTop: 4 }} className="truncate">{i.request.title}</div>
                    <div className="small muted">{i.request.requester.fullName} · {i.level.name} ({i.level.index}/{i.level.total}){i.onBehalfOf ? ` · a.n. ${i.onBehalfOf.fullName}` : ''}</div>
                  </div>
                </div>
                <div className="small muted nowrap" style={{ textAlign: 'right' }}>Due {fmtDate(i.request.dueDate)}<br />{timeAgo(i.levelStartedAt)}</div>
              </Link>
            ))}
        </Panel>

        <Panel title="Komposisi request" sub="Semua request yang dapat Anda lihat">
          {loading ? <Skeleton h={150} /> : (
            <Ring label="request" parts={Object.keys(STATUS_COLORS).map((k) => ({ label: STATUS[k].label, value: s?.requestsByStatus?.[k] ?? 0, color: STATUS_COLORS[k] }))} />
          )}
          {s && Object.keys(s.openByPriority ?? {}).length > 0 && (
            <>
              <div className="divider" />
              <div className="stack sm">
                <span className="small muted">Request terbuka per prioritas</span>
                {['crit', 'high', 'med', 'low'].map((p) => {
                  const v = s.openByPriority[p] ?? 0;
                  const max = Math.max(1, ...Object.values<number>(s.openByPriority));
                  return (
                    <div key={p} className="row small" style={{ gap: 12 }}>
                      <span style={{ width: 58 }} className="ink2">{PRIORITY[p].label}</span>
                      <div className="bar grow"><span style={{ width: `${(v / max) * 100}%`, ['--c' as any]: `var(--${PRIORITY[p].tone === 'muted' ? 'steel' : PRIORITY[p].tone})` }} /></div>
                      <span className="num" style={{ width: 24, textAlign: 'right' }}>{v}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>
      </div>

      <div className="grid split-wide">
        <Panel title="Tren 6 bulan" sub="Request dibuat vs selesai disetujui/ditutup">
          {loading ? <Skeleton h={180} /> : <ColumnChart data={s?.trend ?? []} series={[{ key: 'created', label: 'Dibuat', color: '#075F78' }, { key: 'approved', label: 'Selesai', color: '#9D521F' }]} />}
        </Panel>
        <Panel title="Aktivitas terbaru" bodyClass="tight">
          {loading ? <div className="panel-body"><Skeleton h={180} /></div> : !s?.recentActivity?.length ? <Empty title="Belum ada aktivitas" /> : (
            <div style={{ padding: '6px 0' }}>
              {s.recentActivity.map((l: any) => (
                <Link key={l.id} href={`/requests/${l.request.id}`} className="menu-item" style={{ alignItems: 'flex-start' }}>
                  <Avatar name={l.actor?.fullName} src={l.actor?.photoUrl} size="sm" />
                  <span className="grow small">
                    <span style={{ color: 'var(--ink)' }}>{l.actor?.fullName ?? 'Sistem'}</span> {ACTION_LABEL[l.action] ?? l.action}{' '}
                    <span className="ref">{l.request.refCode}</span>
                    <span className="tiny muted" style={{ display: 'block' }}>{timeAgo(l.createdAt)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>
      {s?.overdue > 0 && (
        <div className="alert warn" style={{ marginTop: 18 }}><AlertTriangle /><span>{s.overdue} request telah melewati jatuh tempo. Pengingat e-mail dikirim otomatis setiap pagi ke pengaju dan approver.</span></div>
      )}
    </>
  );
}

function Stat({ icon, label, value, sub, href, tone, loading }: { icon: React.ReactNode; label: string; value?: number; sub?: string; href: string; tone?: string; loading?: boolean }) {
  return (
    <div className="panel stat">
      <span className="k" style={{ color: tone }}>{icon}{label}</span>
      {loading ? <Skeleton h={36} w={70} /> : <Link href={href} className="v" style={{ color: tone }}>{value ?? 0}</Link>}
      <span className="d">{sub}</span>
    </div>
  );
}
