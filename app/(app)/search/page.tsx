'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ClipboardList, FolderOpen } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { qs } from '@/lib/api';
import { fileKind, fmtDate } from '@/lib/format';
import { Empty, Loading, Panel, PriorityBadge, StatusBadge } from '@/components/ui';

function SearchInner() {
  const q = useSearchParams().get('q') ?? '';
  const { data: reqs, meta: rm, loading: l1 } = useApi<any[]>(q ? `/requests${qs({ search: q, perPage: 10 })}` : null);
  const { data: files, meta: fm, loading: l2 } = useApi<any[]>(q ? `/files${qs({ search: q, perPage: 10 })}` : null);
  return (
    <>
      <div className="page-head"><div><h1>Hasil untuk “{q}”</h1><p className="lead">{(rm?.total ?? 0) + (fm?.total ?? 0)} hasil di request dan dokumen.</p></div></div>
      <div className="grid cols-2">
        <Panel title={<span className="row"><ClipboardList size={17} /><h2>Request</h2></span>} sub={`${rm?.total ?? 0} hasil`} actions={<Link href={`/requests?search=${encodeURIComponent(q)}`} className="btn sm">Lihat semua</Link>} bodyClass="tight">
          {l1 ? <div className="panel-body"><Loading /></div> : !reqs?.length ? <Empty title="Tidak ada request yang cocok" /> : reqs.map((r) => (
            <Link key={r.id} href={`/requests/${r.id}`} className="menu-item" style={{ borderBottom: '1px solid var(--line-soft)', padding: '12px 18px' }}>
              <span className="grow"><span className="ref">{r.refCode}</span><span style={{ display: 'block', color: 'var(--ink)' }}>{r.title}</span></span>
              <StatusBadge status={r.statusCode} /><PriorityBadge priority={r.priority} />
            </Link>
          ))}
        </Panel>
        <Panel title={<span className="row"><FolderOpen size={17} /><h2>Dokumen</h2></span>} sub={`${fm?.total ?? 0} hasil`} bodyClass="tight">
          {l2 ? <div className="panel-body"><Loading /></div> : !files?.length ? <Empty title="Tidak ada dokumen yang cocok" /> : files.map((f) => (
            <Link key={f.id} href={`/documents/${f.id}`} className="menu-item" style={{ borderBottom: '1px solid var(--line-soft)', padding: '12px 18px' }}>
              <span className={`file-kind k-${fileKind(f.mimeType)}`} style={{ width: 28, height: 34, fontSize: 9, paddingBottom: 4 }}>{fileKind(f.mimeType)}</span>
              <span className="grow truncate"><span style={{ display: 'block', color: 'var(--ink)' }} className="truncate">{f.title || f.originalName}</span><span className="tiny muted">{f.folder.name} · {fmtDate(f.updatedAt)}</span></span>
              <span className="badge tone-ion">v{f.version}</span>
            </Link>
          ))}
        </Panel>
      </div>
    </>
  );
}
export default function SearchPage() { return <Suspense><SearchInner /></Suspense>; }
