export const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'muted' },
  submitted: { label: 'Submitted', tone: 'info' },
  'in-progress': { label: 'In-Progress', tone: 'violet' },
  'pending-approval': { label: 'Pending Approval', tone: 'warn' },
  approved: { label: 'Approved', tone: 'ok' },
  rejected: { label: 'Rejected', tone: 'bad' },
  closed: { label: 'Closed', tone: 'steel' },
};
export const statusKey = (s: string) => s.replace('_', '-');

export const PRIORITY: Record<string, { label: string; tone: string; rank: number }> = {
  low: { label: 'Rendah', tone: 'muted', rank: 1 },
  med: { label: 'Sedang', tone: 'info', rank: 2 },
  high: { label: 'Tinggi', tone: 'warn', rank: 3 },
  crit: { label: 'Kritis', tone: 'bad', rank: 4 },
};

export const ACTION_LABEL: Record<string, string> = {
  created: 'membuat request', submitted: 'mengirim request', resubmitted: 'mengirim ulang setelah revisi',
  approval_started: 'memulai alur approval', approved_level: 'menyetujui level', approved: 'menyetujui (final)',
  rejected: 'menolak', delegated: 'mendelegasikan', commented: 'berkomentar', updated: 'memperbarui',
  status_changed: 'mengubah status', closed: 'menutup request', reminded: 'mengirim pengingat', attachments_updated: 'memperbarui lampiran',
};

const dtf = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const dttf = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fmtDate = (d?: string | null) => (d ? dtf.format(new Date(d)) : '—');
export const fmtDateTime = (d?: string | null) => (d ? dttf.format(new Date(d)) : '—');

export function timeAgo(d?: string | null) {
  if (!d) return '—';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  const abs = Math.abs(s); const fut = s < 0;
  const f = (n: number, u: string) => (fut ? `${Math.round(n)} ${u} lagi` : `${Math.round(n)} ${u} lalu`);
  if (abs < 60) return fut ? 'sebentar lagi' : 'baru saja';
  if (abs < 3600) return f(abs / 60, 'mnt');
  if (abs < 86400) return f(abs / 3600, 'jam');
  if (abs < 86400 * 30) return f(abs / 86400, 'hari');
  return fmtDate(d);
}

export function duration(ms?: number | null) {
  if (ms == null) return '—';
  const h = ms / 3600000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))} mnt`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)} jam`;
  return `${(h / 24).toFixed(1)} hari`;
}

export const fmtBytes = (b?: number | string | null) => {
  const n = Number(b ?? 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};

export const fmtMoney = (n?: number | string | null) =>
  n == null || n === '' ? '—' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n));

export const initials = (name?: string | null) =>
  (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');

export function dueState(due?: string | null, done = false) {
  if (!due || done) return null;
  const diff = new Date(due).getTime() - Date.now();
  if (diff < 0) return 'overdue';
  if (diff < 86400000) return 'soon';
  return null;
}

export function fileKind(mime: string) {
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'IMG';
  if (/sheet|excel/.test(mime)) return 'XLS';
  if (/word|document/.test(mime)) return 'DOC';
  if (/presentation|powerpoint/.test(mime)) return 'PPT';
  if (mime.startsWith('text/')) return 'TXT';
  return 'FILE';
}

export function ruleText(rule?: { min_priority?: string; threshold_value?: number } | null) {
  if (!rule) return 'Semua request';
  const parts: string[] = [];
  if (rule.min_priority) parts.push(`prioritas ≥ ${PRIORITY[rule.min_priority]?.label ?? rule.min_priority}`);
  if (rule.threshold_value != null) parts.push(`nilai ≥ ${fmtMoney(rule.threshold_value)}`);
  return parts.join(' dan ') || 'Semua request';
}
