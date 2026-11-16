'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, FilePlus2, FileSignature, X } from 'lucide-react';
import { useApi, useDebounced } from '@/lib/hooks';
import { qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { EDOC_STATUS } from '@/lib/edoc';
import { fmtDate } from '@/lib/format';
import { Avatar, Empty, ErrorAlert, Loading, Pagination, Panel } from '@/components/ui';

const SCOPES = [{ k: 'tosign', label: 'Perlu tanda tangan saya' }, { k: 'mine', label: 'Buatan saya' }, { k: 'signed-by-me', label: 'Sudah saya tanda tangani' }, { k: '', label: 'Semua' }];

export default function EDocsPage() {
  const { can } = useAuth();
  const router = useRouter();
  const [scope, setScope] = useState('tosign');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const ds = useDebounced(search);
  const { data, meta, error, loading } = useApi<any[]>(`/e-documents${qs({ scope, status, search: ds, page, perPage: 20 })}`);

  return (
    <>
      <div className="page-head">
        <div><h1>Naskah dinas</h1><p className="lead">Tulis surat, memo, dan berita acara langsung di aplikasi. Naskah yang dikirim masuk alur approval: setiap approver yang menyetujui langsung membubuhkan QR paraf, level terakhir QR tanda tangan.</p></div>
        <div className="page-actions">{can('EDOC_CREATE') && <Link href="/e-docs/new" className="btn primary"><FilePlus2 />Tulis naskah</Link>}</div>
      </div>
      <Panel flat bodyClass="tight">
        <div className="panel-body row wrap between" style={{ borderBottom: '1px solid var(--line-soft)' }}>
          <div className="seg">{SCOPES.map((s) => <button key={s.k} className={scope === s.k ? 'on' : ''} onClick={() => { setScope(s.k); setPage(1); }}>{s.label}</button>)}</div>
          <div className="row">
            <select className="select" style={{ width: 190 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status"><option value="">Semua status</option>{Object.entries(EDOC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            <input className="input" style={{ width: 240 }} placeholder="Cari judul atau nomor…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <ErrorAlert error={error} />
        {loading && !data ? <div className="panel-body"><Loading /></div> : !data?.length ? (
          <Empty icon={<FileSignature />} title={scope === 'tosign' ? 'Tidak ada naskah yang menunggu Anda' : 'Belum ada naskah'} action={can('EDOC_CREATE') && scope !== 'tosign' ? <Link href="/e-docs/new" className="btn primary">Tulis naskah</Link> : undefined}>
            {scope === 'tosign' ? 'Naskah yang menunggu persetujuan Anda (paraf atau tanda tangan) muncul di sini dan di Inbox approval.' : 'Pilih template, ketik isinya, lalu kirim untuk approval.'}
          </Empty>
        ) : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Naskah</th><th>Status</th><th>QR paraf & tanda tangan</th><th className="hide-sm">Pembuat</th><th className="hide-sm">Diperbarui</th></tr></thead>
            <tbody>{data.map((d) => {
              const st = EDOC_STATUS[d.status];
              return (
                <tr key={d.id} className="clickable" onClick={() => router.push(`/e-docs/${d.id}`)}>
                  <td style={{ maxWidth: 380 }}>
                    <div className="row" style={{ gap: 8 }}><span className="ref">{d.number ?? 'Belum bernomor'}</span>{d.template && <span className="tiny muted">{d.template.name}</span>}</div>
                    <Link href={`/e-docs/${d.id}`} onClick={(e) => e.stopPropagation()} className="truncate" style={{ display: 'block', color: 'var(--ink)', fontWeight: 500 }}>{d.title}</Link>
                    {d.subject && <span className="tiny muted truncate" style={{ display: 'block' }}>{d.subject}</span>}
                  </td>
                  <td><span className={`badge tone-${st.tone}`}><span className="pip" />{st.label}</span></td>
                  <td>
                    <div className="row wrap" style={{ gap: 4 }}>
                      {(d.request && d.status === 'rejected' ? [] : d.signers).map((s: any) => (
                        <span key={s.order} className={`badge ${s.status === 'signed' ? 'tone-ok' : s.status === 'pending' ? 'tone-ion' : s.status === 'rejected' ? 'tone-bad' : 'tone-muted'}`} style={{ height: 22, fontSize: 11 }} title={`${s.role === 'paraf' ? 'Paraf' : 'Tanda tangan'} — ${s.user.fullName}`}>
                          {s.status === 'signed' ? <Check size={11} /> : s.status === 'rejected' ? <X size={11} /> : <span className="num">{s.order}</span>}
                          {s.user.fullName.split(' ')[0]}{s.role === 'paraf' ? ' (paraf)' : ''}
                        </span>
                      ))}
                      {d.status === 'signing' && d.request && <span className="badge tone-ion" style={{ height: 22, fontSize: 11 }}>Dalam approval</span>}
                    </div>
                    {d.request && <span className="tiny muted num">{d.request.refCode}</span>}
                  </td>
                  <td className="hide-sm"><span className="row small"><Avatar name={d.creator.fullName} src={d.creator.photoUrl} size="sm" />{d.creator.fullName}</span></td>
                  <td className="small muted nowrap hide-sm">{fmtDate(d.updatedAt)}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        <Pagination meta={meta} onPage={setPage} />
      </Panel>
    </>
  );
}
