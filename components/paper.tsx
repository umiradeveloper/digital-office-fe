'use client';
import type { ReactNode } from 'react';
import { longDate, type PaperData } from '@/lib/edoc';

const fmtDT = (d?: string | null) => (d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

/**
 * Kertas A4 naskah dinas — tata letak sama dengan PDF yang dihasilkan server:
 * kop resmi (header & footer gambar), kepala surat (Nomor/Lampiran/Perihal/Kepada) atau judul, isi, blok tanda tangan QR, footer verifikasi.
 */
export function Paper({ d, body, draft }: { d: PaperData; body: ReactNode; draft?: boolean }) {
  const letter = !!d.recipient?.trim();
  const signs = d.signers.filter((s) => s.role === 'sign');
  const parafs = d.signers.filter((s) => s.role === 'paraf');
  return (
    <div className="paper-wrap">
      <article className="paper" aria-label="Pratinjau naskah">
        {draft && <div className="wm" aria-hidden>DRAF</div>}
        {/* Kop surat resmi (template "Kop Surat USG") — posisi & ukuran sama dengan PDF server */}
        <img className="kop-l" src="/brand/kop/header-left.png" alt="Umira" />
        <img className="kop-r" src="/brand/kop/header-right.png" alt="Integrated Management System — ISO" />
        <img className="kop-f" src="/brand/kop/footer.png" alt={d.org?.name ?? 'PT Umira Sinergi Global'} />
        {d.department && <div className="kop-dept">{d.department.name}</div>}

        {letter ? (
          <>
            <div className="hdr">
              <table><tbody>
                <tr><td>Nomor</td><td>:</td><td>{d.number ?? <i style={{ color: '#6b7280' }}>terbit saat dikirim</i>}</td></tr>
                <tr><td>Lampiran</td><td>:</td><td>{d.attachmentNote || '-'}</td></tr>
                <tr><td>Perihal</td><td>:</td><td><b>{d.subject || d.title}</b></td></tr>
              </tbody></table>
              <div style={{ textAlign: 'right' }}>{d.place || 'Jakarta'}, {longDate(d.docDate)}</div>
            </div>
            <div className="to">Kepada Yth.{'\n'}{d.recipient}</div>
          </>
        ) : (
          <div className="ttl">
            <b>{d.title || 'Judul naskah'}</b>
            <div>Nomor: {d.number ?? <i style={{ color: '#6b7280' }}>terbit saat dikirim</i>}</div>
            {d.subject && <div>Perihal: {d.subject}</div>}
          </div>
        )}

        {body}

        {signs.length > 0 && (
          <div className="signs">
            {signs.map((s, i) => {
              const now = s.status === 'pending';
              return (
                <div key={s.order} className="sig">
                  {!letter && i === signs.length - 1 && <div>{d.place || 'Jakarta'}, {longDate(d.docDate)}</div>}
                  <div className="pos">{s.positionTitle || s.user.position || 'Penanda tangan'}</div>
                  {s.qrDataUrl
                    ? <div className="qr"><img src={s.qrDataUrl} alt={`QR tanda tangan ${s.user.fullName}`} /></div>
                    : <div className={`qr empty ${now ? 'next' : ''}`}>{s.status === 'rejected' ? 'Dikembalikan' : now ? 'Menunggu tanda tangan' : 'Belum ditandatangani'}</div>}
                  <div className="nm">{s.user.fullName}</div>
                  {s.signedAt && <div className="ts">Ditandatangani elektronik {fmtDT(s.signedAt)}</div>}
                </div>
              );
            })}
          </div>
        )}
        {parafs.length > 0 && (
          <div className="parafs">
            <b style={{ width: '100%' }}>Paraf</b>
            {parafs.map((s) => (
              <div key={s.order} className="pf">
                {s.qrDataUrl ? <img src={s.qrDataUrl} alt={`QR paraf ${s.user.fullName}`} /> : <span className="box" />}
                <span>{s.user.fullName}<br /><span style={{ color: '#6b7280' }}>{s.positionTitle || s.user.position}{s.signedAt ? ` · ${fmtDT(s.signedAt)}` : ''}</span></span>
              </div>
            ))}
          </div>
        )}
        <footer className="foot">
          {draft ? 'DRAF — naskah belum ditandatangani lengkap dan belum berlaku.' : 'Dokumen ini ditandatangani secara elektronik. Pindai QR code untuk memeriksa keasliannya.'}
          {' '}Nomor: {d.number ?? '-'}{d.contentHash ? ` · Hash: ${d.contentHash.slice(0, 16)}` : ''}
        </footer>
      </article>
    </div>
  );
}
