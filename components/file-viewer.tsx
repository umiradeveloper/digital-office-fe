'use client';
import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { download, fetchBlob } from '@/lib/api';
import { ErrorAlert, Modal } from './ui';

/** Viewer dokumen (PDF/gambar/teks) + cetak ke PDF via dialog cetak browser (FR-DOC-06). */
export function FileViewer({ file, onClose }: { file: { id: string; originalName: string; mimeType: string }; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewable = file.mimeType === 'application/pdf' || file.mimeType.startsWith('image/') || file.mimeType.startsWith('text/');

  useEffect(() => {
    if (!previewable) return;
    let u: string | null = null;
    fetchBlob(`/files/${file.id}/download?inline=1`)
      .then(async ({ blob }) => {
        if (file.mimeType.startsWith('text/')) setText(await blob.text());
        else { u = URL.createObjectURL(blob); setUrl(u); }
      })
      .catch((e) => setError(e.message));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [file.id]); // eslint-disable-line

  const print = () => {
    if (!url) return;
    const w = window.open(url, '_blank');
    w?.addEventListener('load', () => w.print());
  };

  return (
    <Modal open wide onClose={onClose} title={<span className="truncate" style={{ display: 'block', maxWidth: 560 }}>{file.originalName}</span>}
      footer={<>
        {url && <button className="btn" onClick={print}><Printer />Cetak / simpan PDF</button>}
        <button className="btn primary" onClick={() => download(`/files/${file.id}/download`)}><Download />Unduh</button>
      </>}>
      <ErrorAlert error={error} />
      {!previewable && <p className="ink2">Pratinjau tidak tersedia untuk tipe file ini. Unduh untuk membukanya di aplikasi Anda.</p>}
      {previewable && !url && !text && !error && <div className="row" style={{ justifyContent: 'center', padding: 40 }}><span className="spinner" /></div>}
      {url && file.mimeType === 'application/pdf' && <iframe className="viewer" src={url} title={file.originalName} />}
      {url && file.mimeType.startsWith('image/') && <img className="viewer-img" src={url} alt={file.originalName} />}
      {text !== null && <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 560, overflow: 'auto', background: 'var(--void)', padding: 16, borderRadius: 12 }}>{text}</pre>}
    </Modal>
  );
}
