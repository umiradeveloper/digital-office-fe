'use client';
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDownUp, FilePlus2, FileSpreadsheet, FileText, Paperclip, MessageSquare, ClipboardList } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApi, useDebounced } from '@/lib/hooks';
import { download, qs } from '@/lib/api';
import { STATUS, dueState, fmtDate } from '@/lib/format';
import { Avatar, Empty, ErrorAlert, Loading, Pagination, Panel, PriorityBadge, StatusBadge, useAction } from '@/components/ui';

const SCOPES = [
  { k: '', label: 'Semua' }, { k: 'created', label: 'Saya buat' }, { k: 'assigned', label: 'Ditugaskan ke saya' },
];

function RequestsInner() {
  const { can } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const [search, setSearch] = useState(sp.get('search') ?? '');
  const [f, setF] = useState({
    mine: sp.get('mine') ?? '', status: sp.get('status') ?? '', priority: sp.get('priority') ?? '', type: sp.get('type') ?? '',
    dept: sp.get('dept') ?? '', due: sp.get('due') ?? '', from: '', to: '', sort: 'created', order: 'desc', page: 1,
  });
  const ds = useDebounced(search, 350);
  const query = qs({ ...f, search: ds, perPage: 20 });
  const { data, meta, error, loading } = useApi<any[]>(`/requests${query}`);
  const { data: types } = useApi<any[]>('/request-types');
  const { data: depts } = useApi<any[]>('/departments');
  const { busy, run } = useAction();
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v, page: k === 'page' ? v : 1 }));
  const sortBy = (k: string) => setF((x) => ({ ...x, sort: k, order: x.sort === k && x.order === 'desc' ? 'asc' : 'desc', page: 1 }));
  const exportQ = useMemo(() => qs({ ...f, search: ds, page: undefined, sort: undefined, order: undefined }), [f, ds]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Request</h1>
          <p className="lead">Tugas, pengajuan, dan follow-up beserta status approval-nya.</p>
        </div>
        <div className="page-actions">
          {can('EXPORT') && (
            <>
              <button className="btn" disabled={!!busy} onClick={() => run('x', () => download(`/exports/requests.xlsx${exportQ}`), 'File Excel diunduh')}><FileSpreadsheet />Excel</button>
              <button className="btn" disabled={!!busy} onClick={() => run('p', () => download(`/exports/report.pdf${exportQ}`), 'Laporan PDF diunduh')}><FileText />PDF</button>
            </>
          )}
          {can('REQUEST_CREATE') && <Link className="btn primary" href="/requests/new"><FilePlus2 />Buat request</Link>}
        </div>
      </div>

      <Panel flat bodyClass="tight">
        <div className="panel-body stack" style={{ borderBottom: '1px solid var(--line-soft)' }}>
          <div className="row wrap between">
            <div className="seg" role="tablist">
              {SCOPES.map((s) => <button key={s.k} className={f.mine === s.k ? 'on' : ''} onClick={() => set('mine', s.k)}>{s.label}</button>)}
            </div>
            <input className="input" style={{ maxWidth: 320 }} placeholder="Cari judul atau nomor ref…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="row wrap">
            <select className="select" style={{ width: 180 }} value={f.status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
              <option value="">Semua status</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="select" style={{ width: 150 }} value={f.priority} onChange={(e) => set('priority', e.target.value)} aria-label="Prioritas">
              <option value="">Semua prioritas</option>
              <option value="crit">Kritis</option><option value="high">Tinggi</option><option value="med">Sedang</option><option value="low">Rendah</option>
            </select>
            <select className="select" style={{ width: 200 }} value={f.type} onChange={(e) => set('type', e.target.value)} aria-label="Tipe">
              <option value="">Semua tipe</option>
              {types?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="select" style={{ width: 190 }} value={f.dept} onChange={(e) => set('dept', e.target.value)} aria-label="Departemen">
              <option value="">Semua unit</option>
              {depts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select className="select" style={{ width: 170 }} value={f.due} onChange={(e) => set('due', e.target.value)} aria-label="Jatuh tempo">
              <option value="">Semua due date</option><option value="overdue">Lewat jatuh tempo</option><option value="week">7 hari ke depan</option>
            </select>
            <input className="input" type="date" style={{ width: 160 }} value={f.from} onChange={(e) => set('from', e.target.value)} aria-label="Dibuat dari" />
            <span className="muted small">s.d.</span>
            <input className="input" type="date" style={{ width: 160 }} value={f.to} onChange={(e) => set('to', e.target.value)} aria-label="Dibuat sampai" />
          </div>
        </div>
        <ErrorAlert error={error} />
        {loading && !data ? <div className="panel-body"><Loading rows={6} /></div>
          : !data?.length ? (
            <Empty icon={<ClipboardList />} title="Belum ada request yang cocok" action={can('REQUEST_CREATE') ? <Link className="btn primary" href="/requests/new">Buat request</Link> : undefined}>
              Ubah filter di atas, atau buat request baru untuk memulai alur kerja.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => sortBy('title')}>Request <ArrowDownUp size={12} /></th>
                    <th>Status</th>
                    <th className="sortable" onClick={() => sortBy('priority')}>Prioritas</th>
                    <th className="hide-sm">Pengaju</th>
                    <th className="hide-sm">Penanggung jawab</th>
                    <th className="sortable" onClick={() => sortBy('due')}>Due <ArrowDownUp size={12} /></th>
                    <th className="sortable hide-sm" onClick={() => sortBy('created')}>Dibuat</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r) => {
                    const ds = dueState(r.dueDate, ['closed', 'approved', 'rejected'].includes(r.statusCode));
                    const inst = r.instances?.[0];
                    const plan = inst?.planJson as any[] | undefined;
                    return (
                      <tr key={r.id} className="clickable" onClick={() => router.push(`/requests/${r.id}`)}>
                        <td style={{ maxWidth: 380 }}>
                          <div className="row" style={{ gap: 8 }}><span className="ref">{r.refCode}</span><span className="tiny muted">{r.type.name}</span></div>
                          <Link href={`/requests/${r.id}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--ink)', fontWeight: 500 }} className="truncate" title={r.title}>{r.title}</Link>
                          <div className="row tiny muted" style={{ gap: 10 }}>
                            {r._count.attachments > 0 && <span className="row" style={{ gap: 3 }}><Paperclip size={12} />{r._count.attachments}</span>}
                            {r._count.comments > 0 && <span className="row" style={{ gap: 3 }}><MessageSquare size={12} />{r._count.comments}</span>}
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={r.statusCode} />
                          {inst?.status === 'in_progress' && plan && (
                            <div className="tiny muted" style={{ marginTop: 4 }}>Level {plan.findIndex((p) => p.levelOrder === inst.currentLevel) + 1}/{plan.length}</div>
                          )}
                        </td>
                        <td><PriorityBadge priority={r.priority} /></td>
                        <td className="hide-sm"><span className="row small"><Avatar name={r.requester.fullName} src={r.requester.photoUrl} size="sm" />{r.requester.fullName}</span></td>
                        <td className="hide-sm small">{r.assignee?.fullName ?? <span className="muted">—</span>}</td>
                        <td className="small nowrap" style={{ color: ds === 'overdue' ? 'var(--bad)' : ds === 'soon' ? 'var(--warn)' : undefined }}>{fmtDate(r.dueDate)}</td>
                        <td className="small muted nowrap hide-sm">{fmtDate(r.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        <Pagination meta={meta} onPage={(p) => set('page', p)} />
      </Panel>
    </>
  );
}

export default function RequestsPage() { return <Suspense><RequestsInner /></Suspense>; }
