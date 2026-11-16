'use client';
import { use, useEffect, useState } from 'react';
import { Check, Clock, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { UmiraLogo } from '@/components/ui';

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

/** Halaman publik hasil pindai QR tanda tangan — tanpa login. */
export default function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [r, setR] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/verify/${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((j) => (j.error ? setErr(j.error.message) : setR(j.data)))
      .catch(() => setErr('Tidak dapat menghubungi server verifikasi.'));
  }, [token]);

  return (
    <main className="verify">
      <div className="verify-card stack lg">
        <div className="stack sm" style={{ alignItems: 'center' }}><UmiraLogo height={46} /><span className="brand-name" style={{ color: 'var(--ion-deep)' }}>Verifikasi Dokumen</span></div>
        <section className="panel" style={{ padding: 28 }}>
          {!r && !err && <div className="row" style={{ justifyContent: 'center', padding: 30 }}><span className="spinner" /></div>}
          {err && <div className="alert bad"><ShieldAlert /><span>{err}</span></div>}
          {r && (
            <div className="stack lg">
              <div style={{ textAlign: 'center' }}>
                <div className={`verify-seal ${r.valid ? 'ok' : 'bad'}`}>{r.valid ? <ShieldCheck /> : <ShieldAlert />}</div>
                <h1 style={{ fontSize: 24 }}>{r.valid ? 'Tanda tangan sah' : 'Tidak dapat diverifikasi'}</h1>
                <p className="muted" style={{ marginTop: 6 }}>{r.valid ? `Dokumen ini diterbitkan oleh ${r.org} dan isinya tidak berubah sejak ditandatangani.` : r.reason}</p>
              </div>
              {r.document && (
                <>
                  <div className="stack sm">
                    <Row k="Nomor" v={<span className="num">{r.document.number}</span>} />
                    <Row k="Judul" v={r.document.title} />
                    {r.document.subject && <Row k="Perihal" v={r.document.subject} />}
                    <Row k="Unit" v={r.document.department ?? '—'} />
                    <Row k="Selesai ditandatangani" v={fmt(r.document.completedAt)} />
                    <Row k="Sidik isi (SHA-256)" v={<span className="num">{r.document.hashPrefix}…</span>} />
                  </div>
                  <div className="panel flat" style={{ padding: 16, background: 'var(--void)' }}>
                    <div className="small muted">QR ini milik</div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{r.signer.name}</div>
                    <div className="small ink2">{r.signer.position ?? '—'} · {r.signer.role === 'paraf' ? 'Paraf' : 'Tanda tangan'} · {fmt(r.signer.signedAt)}</div>
                    <div className="tiny muted" style={{ marginTop: 4 }}>Telah diverifikasi {r.signer.verifyCount}×</div>
                  </div>
                  <div className="stack sm">
                    <span className="small muted">Seluruh paraf & tanda tangan</span>
                    {r.signers.map((s: any, i: number) => (
                      <div key={i} className="row small" style={{ gap: 10 }}>
                        <span style={{ color: s.status === 'signed' ? 'var(--ok)' : s.status === 'rejected' ? 'var(--bad)' : 'var(--muted)' }}>{s.status === 'signed' ? <Check size={16} /> : s.status === 'rejected' ? <X size={16} /> : <Clock size={16} />}</span>
                        <span className="grow"><b>{s.name}</b> <span className="muted">· {s.role === 'paraf' ? 'Paraf' : 'Tanda tangan'}{s.position ? ` · ${s.position}` : ''}</span></span>
                        <span className="tiny muted">{s.signedAt ? fmt(s.signedAt) : 'Belum'}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
        <p className="tiny muted" style={{ textAlign: 'center', maxWidth: '60ch', margin: '0 auto' }}>
          Pastikan nomor dan judul di atas sama dengan dokumen yang Anda pegang. Halaman ini tidak menampilkan isi dokumen. Tanda tangan elektronik ini adalah tanda tangan internal Digital Office dan bukan sertifikat elektronik dari Penyelenggara Sertifikasi Elektronik.
        </p>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="row top" style={{ gap: 12 }}><span className="small muted" style={{ width: 160, flex: 'none' }}>{k}</span><span className="grow small">{v}</span></div>;
}
