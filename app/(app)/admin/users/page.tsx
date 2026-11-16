'use client';
import { useState } from 'react';
import { Database, KeyRound, Plus, Power, RefreshCw, Save, Trash2, UserPlus } from 'lucide-react';
import { useApi, useDebounced } from '@/lib/hooks';
import { del, patch, post, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { Avatar, ErrorAlert, Field, Loading, Modal, Pagination, Panel, useAction } from '@/components/ui';

export default function UsersPage() {
  const { me } = useAuth();
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const ds = useDebounced(search);
  const { data, meta, error, loading, reload } = useApi<any[]>(`/users${qs({ search: ds, dept, status, page, perPage: 20 })}`);
  const { data: depts } = useApi<any[]>('/departments');
  const { data: roles } = useApi<any[]>('/roles');
  const [edit, setEdit] = useState<any>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<any>(null);
  const { busy, run } = useAction();
  const emailOk = edit && /^\S+@\S+\.\S+$/.test(edit.email ?? '');

  const save = async () => {
    const body = { fullName: edit.fullName, email: edit.email, position: edit.position || undefined, phone: edit.phone || undefined, departmentId: edit.departmentId || (edit.id ? null : undefined), roleIds: edit.roleIds, isSuperAdmin: edit.isSuperAdmin };
    const r: any = await run('s', () => (edit.id ? patch(`/users/${edit.id}`, body) : post('/users', { ...body, password: edit.password || undefined })), 'Pengguna disimpan');
    if (r) { setEdit(null); if (r.tempPassword) setSecret(r.tempPassword); reload(); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Pengguna</h1><p className="lead">Kelola akun, unit, jabatan, dan role. Pengguna yang dihapus diarsipkan (soft delete) agar jejak audit tetap utuh.</p></div>
        <div className="page-actions"><button className="btn primary" onClick={() => setEdit({ fullName: '', email: '', position: '', phone: '', departmentId: '', roleIds: [], isSuperAdmin: false, password: '' })}><UserPlus />Tambah pengguna</button></div>
      </div>
      <SuperappsBar onSynced={reload} />
      <Panel flat bodyClass="tight">
        <div className="panel-body row wrap" style={{ borderBottom: '1px solid var(--line-soft)' }}>
          <input className="input" style={{ maxWidth: 300 }} placeholder="Cari nama, email, username, jabatan…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className="select" style={{ width: 200 }} value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }}><option value="">Semua unit</option>{depts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <select className="select" style={{ width: 150 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Semua status</option><option value="active">Aktif</option><option value="disabled">Nonaktif</option></select>
        </div>
        <ErrorAlert error={error} />
        {loading && !data ? <div className="panel-body"><Loading /></div> : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Pengguna</th><th className="hide-sm">Unit & jabatan</th><th>Role</th><th>Status</th><th className="hide-sm">Login terakhir</th><th /></tr></thead>
            <tbody>{data?.map((u) => (
              <tr key={u.id}>
                <td><span className="row"><Avatar name={u.fullName} src={u.photoUrl} /><span><b>{u.fullName}</b>{u.isSuperAdmin && <span className="badge tone-violet" style={{ marginLeft: 6, height: 20 }}>Super Admin</span>}<br /><span className="tiny muted">{u.email}{u.username ? ` · @${u.username}` : ''}</span>{u.externalSource === 'superapps' && <span className="badge tone-steel" style={{ marginLeft: 6, height: 18 }}>SuperApps</span>}</span></span></td>
                <td className="small hide-sm">{u.department?.name ?? '—'}<br /><span className="tiny muted">{u.position}</span></td>
                <td><div className="row wrap" style={{ gap: 4 }}>{u.userRoles.map((r: any) => <span key={r.role.id} className="badge tone-ion" style={{ height: 20, fontSize: 11 }}>{r.role.name}</span>)}</div></td>
                <td><span className={`badge ${u.status === 'active' ? 'tone-ok' : 'tone-muted'}`}><span className="pip" />{u.status === 'active' ? 'Aktif' : 'Nonaktif'}</span></td>
                <td className="small muted hide-sm">{timeAgo(u.lastLoginAt)}</td>
                <td className="r nowrap">
                  <button className="btn sm" onClick={() => setEdit({ ...u, departmentId: u.departmentId ?? '', roleIds: u.userRoles.map((r: any) => r.role.id) })}>Ubah</button>
                  {u.id !== me?.id && <>
                    <button className="btn ghost sm icon" title="Reset kata sandi" onClick={async () => { const r: any = await run('rp', () => post(`/users/${u.id}/reset-password`, {})); if (r?.tempPassword) setSecret(r.tempPassword); }}><KeyRound /></button>
                    <button className="btn ghost sm icon" title={u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'} onClick={async () => { if (await run('st', () => post(`/users/${u.id}/${u.status === 'active' ? 'disable' : 'enable'}`), u.status === 'active' ? 'Akun dinonaktifkan' : 'Akun diaktifkan')) reload(); }}><Power /></button>
                    <button className="btn ghost sm icon" title="Hapus" onClick={() => setConfirm(u)}><Trash2 /></button>
                  </>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pagination meta={meta} onPage={setPage} />
      </Panel>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah pengguna' : 'Tambah pengguna'}
        footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Batal</button><button className="btn primary" disabled={!edit || edit.fullName.trim().length < 2 || !emailOk || (edit.password && edit.password.length < 8) || !!busy} onClick={save}><Save />Simpan</button></>}>
        {edit && (
          <div className="form-grid">
            <Field label="Nama lengkap" required className="full"><input className="input" value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} /></Field>
            <Field label="Email" required error={edit.email && !emailOk ? 'Format email belum benar' : null} className="full"><input className="input" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Unit"><select className="select" value={edit.departmentId} onChange={(e) => setEdit({ ...edit, departmentId: e.target.value })}><option value="">—</option>{depts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            <Field label="Jabatan"><input className="input" value={edit.position ?? ''} onChange={(e) => setEdit({ ...edit, position: e.target.value })} /></Field>
            <Field label="Telepon"><input className="input" value={edit.phone ?? ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            {!edit.id && <Field label="Kata sandi awal" hint="Kosongkan untuk dibuatkan otomatis" error={edit.password && edit.password.length < 8 ? 'Minimal 8 karakter' : null}><input className="input" type="password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>}
            <Field label="Role" className="full">
              <div className="row wrap">{roles?.map((r) => (
                <button type="button" key={r.id} className={`chip ${edit.roleIds.includes(r.id) ? 'on' : ''}`} onClick={() => setEdit({ ...edit, roleIds: edit.roleIds.includes(r.id) ? edit.roleIds.filter((x: string) => x !== r.id) : [...edit.roleIds, r.id] })}>{r.name}</button>
              ))}</div>
            </Field>
            {me?.isSuperAdmin && <label className="check full"><input type="checkbox" checked={!!edit.isSuperAdmin} onChange={(e) => setEdit({ ...edit, isSuperAdmin: e.target.checked })} />Super Admin (akses penuh ke seluruh modul)</label>}
          </div>
        )}
      </Modal>
      <Modal open={!!secret} onClose={() => setSecret(null)} title="Kata sandi sementara" footer={<button className="btn primary" onClick={() => { navigator.clipboard?.writeText(secret!); setSecret(null); }}>Salin & tutup</button>}>
        <div className="stack"><p className="ink2">Berikan kata sandi ini secara aman kepada pengguna. Kata sandi hanya ditampilkan sekali.</p><div className="input num" style={{ display: 'flex', alignItems: 'center', fontSize: 18, letterSpacing: '.05em' }}>{secret}</div></div>
      </Modal>
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Hapus pengguna?"
        footer={<><button className="btn ghost" onClick={() => setConfirm(null)}>Batal</button><button className="btn bad" onClick={async () => { if (await run('d', () => del(`/users/${confirm.id}`), 'Pengguna dihapus')) { setConfirm(null); reload(); } }}><Trash2 />Hapus</button></>}>
        <p className="ink2">{confirm?.fullName} tidak lagi dapat masuk. Riwayat request, approval, dan audit tetap tersimpan.</p>
      </Modal>
    </>
  );
}

/** Status koneksi database SuperApps + tombol sinkron manual (tampil hanya bila koneksi diatur). */
function SuperappsBar({ onSynced }: { onSynced: () => void }) {
  const { data: st, reload } = useApi<any>('/admin/superapps');
  const { busy, run } = useAction();
  if (!st?.enabled) return null;
  const sync = async () => {
    const r: any = await run('sync', () => post('/admin/superapps/sync', {}), 'Sinkronisasi SuperApps selesai');
    if (r) { reload(); onSynced(); }
  };
  return (
    <div className={`alert ${st.reachable ? 'info' : 'warn'}`} style={{ marginBottom: 14, alignItems: 'center' }}>
      <Database />
      <span className="grow">
        <b>SuperApps</b>{' '}
        {st.reachable ? `terhubung · ${st.sourceUsers} user di sumber` : `tidak dapat dihubungi${st.error ? ` (${st.error})` : ''}`}
        {' · '}{st.localActive}/{st.localUsers} aktif di Digital Office
        {st.last && <> · sinkron terakhir {timeAgo(st.last.at)}{st.last.ok ? `: ${st.last.message}` : ` gagal: ${st.last.message}`}</>}
        {st.syncMinutes > 0 && <span className="muted"> · otomatis tiap {st.syncMinutes} menit</span>}
      </span>
      <button className="btn sm" disabled={busy === 'sync' || st.running || !st.reachable} onClick={sync}><RefreshCw />{busy === 'sync' || st.running ? 'Menyinkron…' : 'Sinkron sekarang'}</button>
    </div>
  );
}
