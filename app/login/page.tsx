'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ErrorAlert, Field, UmiraLogo } from '@/components/ui';

// Tombol akun demo hanya untuk lingkungan uji (NEXT_PUBLIC_SHOW_DEMO=true); disembunyikan di produksi.
const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO === 'true';
const DEMO = [
  { email: 'staff.keu@digital-office.local', name: 'Rina — Staff', note: 'Buat request & dokumen' },
  { email: 'lead.keu@digital-office.local', name: 'Budi — Team Lead', note: 'Approver L1' },
  { email: 'manajer.keu@digital-office.local', name: 'Sari — Manajer', note: 'Approver L2' },
  { email: 'direktur@digital-office.local', name: 'Hendra — Direktur', note: 'Approver L3' },
  { email: 'admin@digital-office.local', name: 'Arya — Super Admin', note: 'Konfigurasi sistem' },
  { email: 'auditor@digital-office.local', name: 'Wulan — Auditor', note: 'Read-only & ekspor' },
];

function LoginInner() {
  const { login } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // boleh email atau username SuperApps → validasi format email hanya bila mengandung '@'
  const emailInvalid = email.includes('@') && !/^\S+@\S+\.\S+$/.test(email.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInvalid || !password) return;
    setBusy(true); setError(null);
    try {
      await login(email, password);
      router.replace(sp.get('next') || '/');
    } catch (err: any) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <div className="auth-art">
        <img className="auth-ornament" src="/brand/umira-mark.png" alt="" aria-hidden />
        <div className="stack sm" style={{ position: 'relative' }}>
          <UmiraLogo variant="white" height={52} />
          <div style={{ color: '#cfe3e9', fontSize: 13, letterSpacing: '.02em' }}>Digital Office — sistem kerja kantor terpadu</div>
        </div>
        <div>
          <h1>Setiap persetujuan punya jejak.</h1>
          <p className="lead">Ajukan request, simpan dokumen dengan versi, dan lacak approval bertingkat dari pengaju sampai direksi — tanpa kertas, tanpa rantai e-mail.</p>
        </div>
        <LoginTrack />
      </div>

      <form className="auth-form" onSubmit={submit} noValidate>
        <UmiraLogo height={44} className="hide-lg" />
        <div>
          <h2 style={{ fontSize: 24 }}>Masuk ke ruang kerja</h2>
          <p className="muted" style={{ marginTop: 6 }}>Gunakan akun kantor Anda.</p>
        </div>
        <ErrorAlert error={error} />
        <Field label="Email atau username" error={emailInvalid ? 'Format email belum benar' : null}>
          <input className={`input ${emailInvalid ? 'invalid' : ''}`} type="text" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@kantor.co.id atau username" autoFocus />
        </Field>
        <Field label="Kata sandi">
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button className="btn primary lg block" disabled={busy || !email || !password || emailInvalid}>
          {busy ? <span className="spinner" /> : <LogIn />} Masuk
        </button>
        {SHOW_DEMO && <div className="stack sm">
          <span className="small muted">Akun demo (kata sandi <span className="num ink2">Password123!</span>)</span>
          <div className="demo-accounts">
            {DEMO.map((d) => (
              <button type="button" key={d.email} onClick={() => { setEmail(d.email); setPassword('Password123!'); }}>
                <b>{d.name}</b>{d.note}
              </button>
            ))}
          </div>
        </div>}
      </form>
    </div>
  );
}

/** Ilustrasi jalur approval di halaman login — menggunakan elemen track yang sama dengan aplikasi. */
function LoginTrack() {
  const lv = (name: string, state: any, who: string, when: string) => ({ name, state, who, when });
  const items = [lv('Team Lead', 'approved', 'Budi S.', '2 jam'), lv('Manajer', 'approved', 'Sari L.', '5 jam'), lv('Direktur', 'current', 'Hendra W.', 'berjalan')];
  return (
    <div className="panel" style={{ padding: '22px 18px', maxWidth: 560 }}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <span className="ref">PBL-202610-0001</span><span className="badge tone-warn"><span className="pip" />Pending Approval</span>
      </div>
      <div className="track" style={{ ['--n' as any]: 3 }}>
        <div className="beam" style={{ width: 'calc((100% - 100% / 3) * 1)' }} />
        {items.map((i, k) => (
          <div key={k} className={`node ${i.state}`}>
            <div className="orb">{i.state === 'approved' ? '✓' : k + 1}</div>
            <div className="lv">{i.name}</div><div className="who">{i.who}</div><div className="when">{i.when}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
