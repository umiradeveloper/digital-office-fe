'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Download, Eye, History, Link2, Printer, Save, Share2, ShieldCheck, Trash2, UploadCloud, Users, X } from 'lucide-react';
import { del, download, fetchBlob, get, patch, post } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fileKind, fmtBytes, fmtDate, fmtDateTime, timeAgo } from '@/lib/format';
import { Avatar, ErrorAlert, Field, Loading, Modal, Panel, useAction, useToast } from '@/components/ui';
import { UserPicker, type UserLite } from '@/components/user-picker';
import { UploadModal } from '@/components/upload-modal';

const ACCESS_LABEL: Record<string, string> = { owner: 'Pemilik', write: 'Tulis', comment: 'Komentar', read: 'Baca' };
const LOG_LABEL: Record<string, string> = { viewed: 'membuka', downloaded: 'mengunduh', shared: 'membagikan', uploaded: 'mengunggah', deleted: 'menghapus' };

export default function DocumentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const { data: f, error, loading, reload } = useApi<any>(`/files/${id}`);
  const { busy, run } = useAction();
  const [preview, setPreview] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [logs, setLogs] = useState<any[] | null>(null);
  const [meta, setMeta] = useState<{ title: string; category: string; description: string; tags: string } | null>(null);

  useEffect(() => {
    if (!f) return;
    setMeta({ title: f.title ?? '', category: f.category ?? '', description: f.description ?? '', tags: f.taggings.map((t: any) => t.tag.name).join(', ') });
    let u: string | null = null;
    if (f.mimeType === 'application/pdf' || f.mimeType.startsWith('image/')) {
      fetchBlob(`/files/${f.id}/download?inline=1`).then(({ blob }) => { u = URL.createObjectURL(blob); setPreview(u); }).catch(() => {});
    }
    if (f.access === 'owner' || can('AUDIT_VIEW')) get<any[]>(`/files/${f.id}/access-logs`).then(setLogs).catch(() => setLogs([]));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [f?.id]); // eslint-disable-line

  if (loading && !f) return <Loading rows={8} />;
  if (error && !f) return <><ErrorAlert error={error} /><Link href="/documents" className="btn" style={{ marginTop: 14 }}>Kembali ke dokumen</Link></>;
  if (!f || !meta) return null;
  const writable = f.access === 'owner' || f.access === 'write';

  return (
    <>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <Link href={`/documents?folder=${f.folder.id}`} className="small row" style={{ gap: 4, marginBottom: 8 }}><ChevronLeft size={15} />{f.folder.name}</Link>
          <div className="row" style={{ gap: 14 }}>
            <span className={`file-kind k-${fileKind(f.mimeType)}`}>{fileKind(f.mimeType)}</span>
            <div style={{ minWidth: 0 }}>
              <h1 className="truncate" style={{ maxWidth: '32ch' }}>{f.title || f.originalName}</h1>
              <div className="row wrap small muted" style={{ gap: 8, marginTop: 4 }}>
                <span className="badge tone-ion">v{f.version}</span><span>{fmtBytes(f.sizeBytes)}</span><span>· akses Anda: <b className="ink2">{ACCESS_LABEL[f.access]}</b></span>
              </div>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => run('dl', () => download(`/files/${f.id}/download`))}><Download />Unduh</button>
          {preview && <button className="btn" onClick={() => { const w = window.open(preview, '_blank'); w?.addEventListener('load', () => w.print()); }}><Printer />Cetak</button>}
          {writable && <button className="btn" onClick={() => setVersionOpen(true)}><UploadCloud />Versi baru</button>}
          {f.canShare && <button className="btn" onClick={() => setShareOpen(true)}><Share2 />Bagikan</button>}
          {f.canDelete && <button className="btn bad icon" onClick={() => setConfirmDel(true)} aria-label="Hapus"><Trash2 /></button>}
        </div>
      </div>

      <div className="grid split">
        <div className="stack lg">
          <Panel title="Pratinjau" actions={<span className="tiny muted">Setiap pembukaan dicatat di log akses</span>}>
            {preview && f.mimeType === 'application/pdf' && <iframe className="viewer" src={preview} title={f.originalName} />}
            {preview && f.mimeType.startsWith('image/') && <img className="viewer-img" src={preview} alt={f.originalName} />}
            {!preview && <div className="empty"><div className="glyph"><Eye /></div><p className="small">Pratinjau tersedia untuk PDF dan gambar. Unduh file untuk membuka tipe lain.</p></div>}
          </Panel>

          <Panel title={<span className="row"><History size={17} style={{ color: 'var(--ion)' }} /><h2>Riwayat versi</h2></span>} sub="Versi lama tidak pernah dihapus saat ada unggahan baru" bodyClass="tight">
            <table className="tbl">
              <thead><tr><th>Versi</th><th>Nama file</th><th className="hide-sm">Pengunggah</th><th className="hide-sm">Tanggal</th><th className="r">Ukuran</th><th /></tr></thead>
              <tbody>
                {f.versions.map((v: any) => (
                  <tr key={v.id}>
                    <td><span className={`badge ${v.isActive ? 'tone-ion' : 'tone-muted'}`}>v{v.version}{v.isActive ? ' · terbaru' : ''}</span></td>
                    <td className="small truncate" style={{ maxWidth: 240 }} title={`SHA-256 ${v.checksumSha256}`}>{v.originalName}</td>
                    <td className="small hide-sm">{v.uploader.fullName}</td>
                    <td className="small muted hide-sm nowrap">{fmtDateTime(v.createdAt)}</td>
                    <td className="r small num">{fmtBytes(v.sizeBytes)}</td>
                    <td className="r"><button className="btn ghost sm icon" onClick={() => run('v', () => download(`/files/${v.id}/download`))} aria-label={`Unduh v${v.version}`}><Download /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {logs && (
            <Panel title={<span className="row"><ShieldCheck size={17} style={{ color: 'var(--ion)' }} /><h2>Log akses</h2></span>} sub="Siapa membuka, mengunduh, atau membagikan dokumen ini" bodyClass="tight">
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {logs.length === 0 && <div className="panel-body small muted">Belum ada akses tercatat.</div>}
                {logs.map((l) => (
                  <div key={l.id} className="row small" style={{ padding: '9px 18px', borderBottom: '1px solid var(--line-soft)' }}>
                    <Avatar name={l.user.fullName} size="sm" />
                    <span className="grow"><b>{l.user.fullName}</b> <span className="ink2">{LOG_LABEL[l.action] ?? l.action}</span> <span className="muted">v{l.file.version}</span></span>
                    <span className="tiny muted hide-sm">{l.ipAddress}</span>
                    <span className="tiny muted nowrap" title={fmtDateTime(l.createdAt)}>{timeAgo(l.createdAt)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="stack lg">
          <Panel title="Metadata">
            <div className="stack">
              <Field label="Judul"><input className="input" value={meta.title} disabled={!writable} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></Field>
              <Field label="Kategori"><input className="input" value={meta.category} disabled={!writable} onChange={(e) => setMeta({ ...meta, category: e.target.value })} /></Field>
              <Field label="Tag" hint="Pisahkan dengan koma"><input className="input" value={meta.tags} disabled={!writable} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} /></Field>
              <Field label="Deskripsi"><textarea className="textarea" value={meta.description} disabled={!writable} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></Field>
              {f.metadataJson && Object.keys(f.metadataJson).length > 0 && (
                <div className="stack sm">{Object.entries(f.metadataJson).map(([k, v]) => <div key={k} className="row between small"><span className="muted">{k}</span><span className="ink2">{String(v)}</span></div>)}</div>
              )}
              <div className="row between small"><span className="muted">Pengunggah</span><span>{f.uploader.fullName}</span></div>
              <div className="row between small"><span className="muted">Diunggah</span><span>{fmtDate(f.createdAt)}</span></div>
              {f.attachments?.length > 0 && <div className="stack sm"><span className="small muted">Dipakai sebagai lampiran</span>{f.attachments.map((a: any) => <Link key={a.request.id} href={`/requests/${a.request.id}`} className="small row" style={{ gap: 6 }}><Link2 size={13} /><span className="ref">{a.request.refCode}</span> {a.request.title}</Link>)}</div>}
              {writable && <button className="btn primary" disabled={busy === 'm'} onClick={async () => { const ok = await run('m', () => patch(`/files/${f.id}`, meta), 'Metadata disimpan'); if (ok) reload(); }}><Save />Simpan metadata</button>}
            </div>
          </Panel>

          <Panel title={<span className="row"><Users size={17} style={{ color: 'var(--ion)' }} /><h2>Dibagikan ke</h2></span>} bodyClass={f.shares.length ? 'tight' : ''}>
            {!f.shares.length ? <span className="small muted">Belum dibagikan. Dokumen dapat dilihat oleh anggota unit pemilik folder.</span> : f.shares.map((s: any) => (
              <div key={s.id} className="row small" style={{ padding: '10px 18px', borderBottom: '1px solid var(--line-soft)' }}>
                {s.toUser ? <Avatar name={s.toUser.fullName} size="sm" /> : <Users size={18} className="muted" />}
                <span className="grow">{s.toUser?.fullName ?? `Unit ${s.toDept?.name}`}<span className="tiny muted" style={{ display: 'block' }}>oleh {s.sharedByMe.fullName}{s.expiresAt ? ` · sampai ${fmtDate(s.expiresAt)}` : ''}</span></span>
                <span className="badge tone-violet">{ACCESS_LABEL[s.accessLevel]}</span>
                {f.canShare && <button className="btn ghost sm icon" aria-label="Cabut akses" onClick={async () => { const ok = await run('us', () => del(`/files/${f.id}/shares/${s.id}`), 'Akses dicabut'); if (ok) reload(); }}><X /></button>}
              </div>
            ))}
          </Panel>
        </div>
      </div>

      <ShareModal open={shareOpen} fileId={f.id} onClose={() => setShareOpen(false)} onDone={() => { setShareOpen(false); toast.ok('Dokumen dibagikan'); reload(); }} />
      <UploadModal open={versionOpen} onClose={() => setVersionOpen(false)} folders={[]} docUid={f.docUid}
        onDone={(_n, nf) => { setVersionOpen(false); toast.ok(`Versi v${nf?.version ?? ''} diunggah`); if (nf?.id) router.replace(`/documents/${nf.id}`); else reload(); }} />
      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="Hapus dokumen?"
        footer={<><button className="btn ghost" onClick={() => setConfirmDel(false)}>Batal</button><button className="btn bad" disabled={!!busy} onClick={async () => { const ok = await run('del', () => del(`/files/${f.id}`), 'Dokumen dihapus'); if (ok) router.push('/documents'); }}><Trash2 />Hapus semua versi</button></>}>
        <p className="ink2">Dokumen dan seluruh versinya dipindah ke arsip terhapus (soft delete). Jejak audit dan log akses tetap tersimpan.</p>
      </Modal>
    </>
  );
}

function ShareModal({ open, fileId, onClose, onDone }: { open: boolean; fileId: string; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'user' | 'dept'>('user');
  const [users, setUsers] = useState<UserLite[]>([]);
  const [dept, setDept] = useState('');
  const [level, setLevel] = useState('read');
  const [expires, setExpires] = useState('');
  const { data: depts } = useApi<any[]>(open ? '/departments' : null);
  const { busy, run } = useAction();
  const valid = mode === 'user' ? users.length > 0 : !!dept;
  return (
    <Modal open={open} onClose={onClose} title="Bagikan dokumen"
      footer={<><button className="btn ghost" onClick={onClose}>Batal</button><button className="btn primary" disabled={!valid || !!busy} onClick={async () => {
        const ok = await run('s', () => post(`/files/${fileId}/share`, { userIds: mode === 'user' ? users.map((u) => u.id) : undefined, deptIds: mode === 'dept' ? [dept] : undefined, accessLevel: level, expiresAt: expires ? new Date(expires + 'T23:59:59').toISOString() : undefined }));
        if (ok) { setUsers([]); setDept(''); onDone(); }
      }}><Share2 />Bagikan</button></>}>
      <div className="stack">
        <div className="seg"><button className={mode === 'user' ? 'on' : ''} onClick={() => setMode('user')}>Ke pengguna</button><button className={mode === 'dept' ? 'on' : ''} onClick={() => setMode('dept')}>Ke unit</button></div>
        {mode === 'user' ? (
          <Field label="Pengguna" required>
            <div className="stack sm">
              {users.map((u) => <div key={u.id} className="row small"><Avatar name={u.fullName} size="sm" /><span className="grow">{u.fullName}</span><button className="btn ghost sm icon" onClick={() => setUsers(users.filter((x) => x.id !== u.id))}><X /></button></div>)}
              <UserPicker value={null} onChange={(u) => u && !users.some((x) => x.id === u.id) && setUsers([...users, u])} placeholder="Tambah pengguna…" />
            </div>
          </Field>
        ) : (
          <Field label="Unit" required><select className="select" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">Pilih unit…</option>{depts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        )}
        <Field label="Level akses" hint={level === 'read' ? 'Dapat melihat & mengunduh, tidak dapat mengubah atau menghapus' : level === 'write' ? 'Dapat mengubah metadata & mengunggah versi baru' : 'Dapat melihat dan berkomentar'}>
          <div className="seg"><button className={level === 'read' ? 'on' : ''} onClick={() => setLevel('read')}>Baca</button><button className={level === 'comment' ? 'on' : ''} onClick={() => setLevel('comment')}>Komentar</button><button className={level === 'write' ? 'on' : ''} onClick={() => setLevel('write')}>Tulis</button></div>
        </Field>
        <Field label="Berlaku sampai" hint="Kosongkan untuk tanpa batas waktu"><input className="input" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
