'use client';
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Download, Eye, Folder, FolderOpen, FolderPlus, Globe2, Inbox, Search, Share2, UploadCloud, User } from 'lucide-react';
import { useApi, useDebounced } from '@/lib/hooks';
import { download, post, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fileKind, fmtBytes, fmtDate } from '@/lib/format';
import { Empty, ErrorAlert, Field, Loading, Modal, Pagination, Panel, useAction, useToast } from '@/components/ui';
import { FileViewer } from '@/components/file-viewer';
import { UploadModal, type FolderT } from '@/components/upload-modal';


function buildTree(folders: FolderT[]) {
  const by: Record<string, FolderT[]> = {};
  for (const f of folders) (by[f.parentFolderId ?? 'root'] ??= []).push(f);
  return by;
}

function DocumentsInner() {
  const { can } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const [view, setView] = useState<{ folder: string | null; scope: '' | 'mine' | 'shared' }>({ folder: sp.get('folder'), scope: '' });
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string[]>([]);
  const [type, setType] = useState('');
  const [sort, setSort] = useState('date');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [viewFile, setViewFile] = useState<any>(null);
  const ds = useDebounced(search, 300);
  const { run } = useAction();

  const { data: folders, reload: reloadFolders } = useApi<FolderT[]>('/folders');
  const { data: tags } = useApi<any[]>('/tags');
  const filesQ = qs({
    folder: view.folder ?? undefined, recursive: view.folder && !ds ? undefined : view.folder ? 1 : undefined,
    mine: view.scope === 'mine' ? 1 : undefined, shared: view.scope === 'shared' ? 1 : undefined,
    search: ds, tag: tag.join(','), type, sort, order: sort === 'name' ? 'asc' : 'desc', page, perPage: 25,
  });
  const { data: files, meta, error, loading, reload } = useApi<any[]>(`/files${filesQ}`);
  const tree = useMemo(() => buildTree((folders ?? []).filter((f) => !f.isSystem)), [folders]);
  const current = folders?.find((f) => f.id === view.folder) ?? null;
  const crumbs = useMemo(() => {
    const out: FolderT[] = []; let c = current;
    while (c) { out.unshift(c); c = folders?.find((f) => f.id === c!.parentFolderId) ?? null; }
    return out;
  }, [current, folders]);

  const go = (folder: string | null, scope: '' | 'mine' | 'shared' = '') => { setView({ folder, scope }); setPage(1); };

  const renderTree = (parent: string, depth = 0): React.ReactNode =>
    (tree[parent] ?? []).map((f) => {
      const kids = tree[f.id]?.length;
      const isOpen = open[f.id] ?? depth === 0;
      return (
        <div key={f.id}>
          <div className={`tree-item ${view.folder === f.id ? 'on' : ''}`} style={{ paddingLeft: 8 + depth * 14 }} onClick={() => go(f.id)}>
            <ChevronRight className={`caret ${isOpen ? 'open' : ''}`} style={{ visibility: kids ? 'visible' : 'hidden' }} onClick={(e) => { e.stopPropagation(); setOpen((o) => ({ ...o, [f.id]: !isOpen })); }} />
            {view.folder === f.id ? <FolderOpen style={{ color: 'var(--ion)' }} /> : <Folder />}
            <span className="truncate">{f.name}</span>
            <span className="cnt">{f.fileCount || ''}</span>
          </div>
          {kids && isOpen ? renderTree(f.id, depth + 1) : null}
        </div>
      );
    });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dokumen</h1>
          <p className="lead">Repositori terpusat dengan folder, tag, versi, dan kontrol akses. Setiap pembukaan dan unduhan tercatat.</p>
        </div>
        <div className="page-actions">
          {can('DOC_UPLOAD', 'DOC_MANAGE') && <button className="btn" onClick={() => setFolderOpen(true)}><FolderPlus />Folder baru</button>}
          {can('DOC_UPLOAD', 'DOC_MANAGE') && <button className="btn primary" onClick={() => setUploadOpen(true)}><UploadCloud />Unggah dokumen</button>}
        </div>
      </div>

      <div className="doc-layout">
        <Panel flat bodyClass="tight">
          <div className="tree">
            <div className={`tree-item ${!view.folder && !view.scope ? 'on' : ''}`} onClick={() => go(null)}><Globe2 />Semua dokumen</div>
            <div className={`tree-item ${view.scope === 'mine' ? 'on' : ''}`} onClick={() => go(null, 'mine')}><User />Milik saya</div>
            <div className={`tree-item ${view.scope === 'shared' ? 'on' : ''}`} onClick={() => go(null, 'shared')}><Share2 />Dibagikan ke saya</div>
            <div className="divider" style={{ margin: '8px 0' }} />
            {!folders ? <Loading rows={5} /> : renderTree('root')}
          </div>
        </Panel>

        <div className="stack">
          <Panel flat bodyClass="tight">
            <div className="panel-body stack" style={{ borderBottom: '1px solid var(--line-soft)' }}>
              <div className="row wrap between">
                <div className="row small" style={{ gap: 4, flexWrap: 'wrap' }}>
                  <button className="btn ghost sm" onClick={() => go(null)}>Dokumen</button>
                  {crumbs.map((c) => <span key={c.id} className="row" style={{ gap: 4 }}><ChevronRight size={13} className="muted" /><button className="btn ghost sm" onClick={() => go(c.id)}>{c.name}</button></span>)}
                  {view.scope && <span className="row" style={{ gap: 4 }}><ChevronRight size={13} className="muted" /><span className="ink2">{view.scope === 'mine' ? 'Milik saya' : 'Dibagikan ke saya'}</span></span>}
                </div>
                <div className="row" style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--muted)' }} />
                  <input className="input" style={{ width: 300, paddingLeft: 36 }} placeholder="Cari nama, isi metadata, tag…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
              </div>
              <div className="row wrap">
                <select className="select" style={{ width: 150 }} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Tipe file">
                  <option value="">Semua tipe</option><option value="pdf">PDF</option><option value="image">Gambar</option><option value="office">Office</option><option value="other">Lainnya</option>
                </select>
                <select className="select" style={{ width: 170 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Urutkan">
                  <option value="date">Terbaru diubah</option><option value="name">Nama A–Z</option><option value="size">Ukuran terbesar</option>
                </select>
                {tags?.slice(0, 10).map((t) => (
                  <button key={t.id} className={`chip ${tag.includes(t.id) ? 'on' : ''}`} onClick={() => { setTag((x) => (x.includes(t.id) ? x.filter((y) => y !== t.id) : [...x, t.id])); setPage(1); }}>
                    <span className="sw" style={{ background: t.color }} />{t.name}
                  </button>
                ))}
              </div>
            </div>
            <ErrorAlert error={error} />
            {loading && !files ? <div className="panel-body"><Loading rows={6} /></div>
              : !files?.length ? (
                <Empty icon={<Inbox />} title={ds || tag.length ? 'Tidak ada dokumen yang cocok' : 'Folder ini masih kosong'}
                  action={can('DOC_UPLOAD') && !ds ? <button className="btn primary" onClick={() => setUploadOpen(true)}><UploadCloud />Unggah dokumen</button> : undefined}>
                  {ds || tag.length ? 'Coba kata kunci lain atau lepaskan filter tag.' : 'Unggah dokumen pertama ke folder ini.'}
                </Empty>
              ) : (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead><tr><th>Nama</th><th className="hide-sm">Folder</th><th className="hide-sm">Tag</th><th>Versi</th><th className="r hide-sm">Ukuran</th><th className="hide-sm">Diubah</th><th /></tr></thead>
                    <tbody>
                      {files.map((f) => (
                        <tr key={f.id} className="clickable" onClick={() => router.push(`/documents/${f.id}`)}>
                          <td style={{ maxWidth: 380 }}>
                            <div className="row" style={{ gap: 12 }}>
                              <span className={`file-kind k-${fileKind(f.mimeType)}`} style={{ width: 30, height: 36, fontSize: 9, paddingBottom: 4 }}>{fileKind(f.mimeType)}</span>
                              <span className="grow" style={{ minWidth: 0 }}>
                                <Link href={`/documents/${f.id}`} onClick={(e) => e.stopPropagation()} className="truncate" style={{ display: 'block', color: 'var(--ink)', fontWeight: 500 }}>{f.title || f.originalName}</Link>
                                <span className="tiny muted truncate" style={{ display: 'block' }}>{f.originalName} · {f.uploader.fullName}</span>
                              </span>
                            </div>
                          </td>
                          <td className="small hide-sm">{f.folder.name}</td>
                          <td className="hide-sm"><div className="row wrap" style={{ gap: 4 }}>{f.taggings.slice(0, 3).map((t: any) => <span key={t.tag.id} className="badge" style={{ ['--c' as any]: t.tag.color, height: 20, fontSize: 11 }}>{t.tag.name}</span>)}</div></td>
                          <td><span className="badge tone-ion">v{f.version}</span></td>
                          <td className="r small num hide-sm">{fmtBytes(f.sizeBytes)}</td>
                          <td className="small muted nowrap hide-sm">{fmtDate(f.updatedAt)}</td>
                          <td className="r nowrap" onClick={(e) => e.stopPropagation()}>
                            <button className="btn ghost sm icon" onClick={() => setViewFile(f)} aria-label="Lihat"><Eye /></button>
                            <button className="btn ghost sm icon" onClick={() => run('dl', () => download(`/files/${f.id}/download`))} aria-label="Unduh"><Download /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            <Pagination meta={meta} onPage={setPage} />
          </Panel>
        </div>
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} folders={(folders ?? []).filter((f) => !f.isSystem)} defaultFolder={view.folder}
        onDone={(n) => { setUploadOpen(false); toast.ok(`${n} dokumen diunggah`); reload(); reloadFolders(); }} />
      <FolderModal open={folderOpen} onClose={() => setFolderOpen(false)} folders={(folders ?? []).filter((f) => !f.isSystem)} parent={view.folder}
        onDone={(f) => { setFolderOpen(false); toast.ok(`Folder “${f.name}” dibuat`); reloadFolders(); go(f.id); }} />
      {viewFile && <FileViewer file={viewFile} onClose={() => setViewFile(null)} />}
    </>
  );
}

function FolderModal({ open, onClose, folders, parent, onDone }: { open: boolean; onClose: () => void; folders: FolderT[]; parent: string | null; onDone: (f: any) => void }) {
  const { me, can } = useAuth();
  const [name, setName] = useState('');
  const [p, setP] = useState(parent ?? '');
  const [dept, setDept] = useState('');
  const { data: depts } = useApi<any[]>(open ? '/departments' : null);
  const { busy, run } = useAction();
  const topLevel = !p;
  return (
    <Modal open={open} onClose={onClose} title="Folder baru"
      footer={<><button className="btn ghost" onClick={onClose}>Batal</button><button className="btn primary" disabled={!name.trim() || !!busy} onClick={async () => { const f = await run('f', () => post('/folders', { name, parentFolderId: p || undefined, departmentId: topLevel ? dept || undefined : undefined })); if (f) { setName(''); onDone(f); } }}><FolderPlus />Buat folder</button></>}>
      <div className="stack">
        <Field label="Nama folder" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={150} /></Field>
        <Field label="Di dalam folder"><select className="select" value={p} onChange={(e) => setP(e.target.value)}><option value="">— Tingkat atas —</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
        {topLevel && (
          <Field label="Unit pemilik" hint={can('DOC_MANAGE') ? 'Kosongkan untuk folder umum yang dapat dibaca semua pegawai' : 'Hanya admin yang dapat membuat folder tingkat atas'}>
            <select className="select" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">Umum (semua unit)</option>
              {depts?.filter((d) => me?.isSuperAdmin || d.id === me?.departmentId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}
      </div>
    </Modal>
  );
}

export default function DocumentsPage() { return <Suspense><DocumentsInner /></Suspense>; }
