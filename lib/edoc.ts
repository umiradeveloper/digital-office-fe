export const EDOC_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'muted' },
  signing: { label: 'Proses tanda tangan', tone: 'warn' },
  signed: { label: 'Ditandatangani', tone: 'ok' },
  rejected: { label: 'Dikembalikan', tone: 'bad' },
  cancelled: { label: 'Dibatalkan', tone: 'steel' },
};

export const PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'nomor', label: 'Nomor naskah' }, { key: 'tanggal', label: 'Tanggal' }, { key: 'tempat', label: 'Tempat' },
  { key: 'perihal', label: 'Perihal' }, { key: 'kepada', label: 'Kepada' }, { key: 'lampiran', label: 'Lampiran' },
  { key: 'pembuat', label: 'Nama pembuat' }, { key: 'jabatan_pembuat', label: 'Jabatan pembuat' }, { key: 'unit', label: 'Unit' },
  { key: 'organisasi', label: 'Nama organisasi' },
];

export interface SignerView {
  id?: string; order: number; role: 'sign' | 'paraf'; status: string; positionTitle?: string | null; signedAt?: string | null;
  comment?: string | null; qrDataUrl?: string | null; verifyUrl?: string | null; levelName?: string | null; onBehalfOf?: string | null;
  user: { id: string; fullName: string; position?: string | null; photoUrl?: string | null };
}

export interface PaperData {
  number?: string | null; title: string; subject?: string | null; recipient?: string | null; attachmentNote?: string | null;
  place?: string | null; docDate?: string | null; department?: { name: string } | null;
  org?: { name: string; address?: string; contact?: string } | null; signers: SignerView[]; contentHash?: string | null; status?: string;
}

export const longDate = (d?: string | null) =>
  new Date(d || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Isi placeholder di sisi klien untuk pratinjau (server tetap menjadi sumber kebenaran). */
export function fillClient(html: string, d: PaperData & { creatorName?: string; creatorPosition?: string | null }) {
  const vars: Record<string, string> = {
    nomor: d.number ?? '(nomor terbit saat dikirim)', tanggal: longDate(d.docDate), tempat: d.place || 'Jakarta',
    perihal: d.subject || d.title, judul: d.title, kepada: d.recipient ?? '', lampiran: d.attachmentNote || '-',
    pembuat: d.creatorName ?? '', jabatan_pembuat: d.creatorPosition ?? '', unit: d.department?.name ?? '', organisasi: d.org?.name ?? '',
  };
  return html.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k: string) => (k in vars ? esc(vars[k]) : m));
}

/** Tandai placeholder agar terlihat di editor. */
export const highlightPlaceholders = (html: string) => html.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, '<span class="ph">{{$1}}</span>');

/** Level approval yang belum menyetujui (dari server: plannedSigners, atau dari pratinjau alur). */
export interface PlannedSigner { order: number; role: 'sign' | 'paraf'; levelName: string; approverName: string | null }

/**
 * Gabungkan QR yang sudah terbit dengan kotak level yang belum menyetujui, untuk ditampilkan di kertas.
 * Kotak pertama yang belum terisi ditandai "pending" saat naskah sedang dalam approval.
 */
export function paperSigners(signed: SignerView[], planned: PlannedSigner[] = [], inApproval = false): SignerView[] {
  const done = signed.map((s) => ({ ...s, positionTitle: s.onBehalfOf ? `a.n. ${s.onBehalfOf}` : s.positionTitle }));
  const rest = planned.map((p, i) => ({
    order: p.order, role: p.role, status: inApproval && i === 0 ? 'pending' : 'waiting', positionTitle: p.levelName,
    user: { id: `plan-${p.order}`, fullName: p.approverName ?? `(${p.levelName})` },
  }));
  return [...done, ...rest].sort((a, b) => a.order - b.order);
}
