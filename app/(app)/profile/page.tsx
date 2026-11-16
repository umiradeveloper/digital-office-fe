'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, KeyRound, LogOut, Save } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { patch, post, upload } from '@/lib/api';
import { Avatar, Field, Panel, useAction } from '@/components/ui';

export default function ProfilePage() {
  const { me, reload, logout } = useAuth();
  const [form, setForm] = useState({ fullName: '', phone: '', position: '' });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const { busy, run } = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (me) setForm({ fullName: me.fullName, phone: me.phone ?? '', position: me.position ?? '' }); }, [me]);
  if (!me) return null;
  const pwdErr = pwd.newPassword && pwd.newPassword.length < 8 ? 'Minimal 8 karakter' : pwd.confirm && pwd.confirm !== pwd.newPassword ? 'Konfirmasi tidak sama' : null;

  return (
    <>
      <div className="page-head"><div><h1>Profil saya</h1><p className="lead">Data ini tampil pada request, approval, dan dokumen Anda.</p></div></div>
      <div className="grid cols-2">
        <Panel title="Data diri">
          <div className="stack">
            <div className="row" style={{ gap: 18 }}>
              <Avatar name={me.fullName} src={me.photoUrl} size="xl" />
              <div className="stack sm">
                <button className="btn sm" onClick={() => fileRef.current?.click()} disabled={busy === 'ph'}><Camera />Ganti foto</button>
                <span className="tiny muted">PNG/JPG/WEBP, maks 3 MB</span>
                <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append('file', f);
                  if (await run('ph', () => upload('/users/me/photo', fd), 'Foto diperbarui')) reload();
                }} />
              </div>
            </div>
            <Field label="Nama lengkap" required error={form.fullName.trim().length < 2 ? 'Minimal 2 karakter' : null}><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <Field label="Email" hint="Hubungi admin untuk mengganti email"><input className="input" value={me.email} disabled /></Field>
            <div className="form-grid">
              <Field label="Jabatan"><input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
              <Field label="Telepon"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            </div>
            <div className="row wrap small muted" style={{ gap: 8 }}>Unit: <b className="ink2">{me.department?.name ?? '—'}</b> · Role: {me.roles.map((r) => <span key={r} className="badge tone-ion">{r}</span>)}</div>
            <button className="btn primary" disabled={form.fullName.trim().length < 2 || busy === 's'} onClick={async () => { if (await run('s', () => patch('/users/me', form), 'Profil disimpan')) reload(); }}><Save />Simpan profil</button>
          </div>
        </Panel>
        <Panel title="Keamanan">
          <div className="stack">
            <Field label="Kata sandi saat ini"><input className="input" type="password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} autoComplete="current-password" /></Field>
            <Field label="Kata sandi baru" error={pwd.newPassword && pwd.newPassword.length < 8 ? 'Minimal 8 karakter' : null}><input className="input" type="password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} autoComplete="new-password" /></Field>
            <Field label="Ulangi kata sandi baru" error={pwd.confirm && pwd.confirm !== pwd.newPassword ? 'Konfirmasi tidak sama' : null}><input className="input" type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} autoComplete="new-password" /></Field>
            <button className="btn" disabled={!pwd.currentPassword || !pwd.newPassword || !!pwdErr || busy === 'p'} onClick={async () => {
              if (await run('p', () => post('/auth/change-password', { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword }), 'Kata sandi diganti. Silakan masuk kembali.')) setTimeout(logout, 1200);
            }}><KeyRound />Ganti kata sandi</button>
            <div className="divider" />
            <p className="small muted">Keluar dari semua perangkat akan membatalkan seluruh sesi aktif Anda.</p>
            <button className="btn bad" onClick={logout}><LogOut />Keluar dari semua perangkat</button>
          </div>
        </Panel>
      </div>
    </>
  );
}
