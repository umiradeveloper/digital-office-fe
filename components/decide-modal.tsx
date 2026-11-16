'use client';
import { useState } from 'react';
import { Check, Forward, X } from 'lucide-react';
import { post } from '@/lib/api';
import { ErrorAlert, Field, Modal } from './ui';
import { UserPicker, type UserLite } from './user-picker';

export type DecisionKind = 'approve' | 'reject' | 'delegate';

/** Approve / Reject (wajib alasan) / Delegate (pilih pengganti) — FR-APR-04. */
export function DecideModal({ instanceId, kind, refCode, title, onClose, onDone, excludeIds = [] }: {
  instanceId: string; kind: DecisionKind | null; refCode: string; title: string; onClose: () => void; onDone: (k: DecisionKind) => void; excludeIds?: string[];
}) {
  const [comment, setComment] = useState('');
  const [to, setTo] = useState<UserLite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!kind) return null;
  const meta = {
    approve: { label: 'Setujui', cls: 'ok', icon: <Check />, heading: 'Setujui request' },
    reject: { label: 'Tolak & kembalikan', cls: 'bad', icon: <X />, heading: 'Tolak request' },
    delegate: { label: 'Delegasikan', cls: 'primary', icon: <Forward />, heading: 'Delegasikan approval' },
  }[kind];
  const invalid = (kind === 'reject' && comment.trim().length < 5) || (kind === 'delegate' && !to);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await post(`/approvals/${instanceId}/decide`, { decision: kind, comment: comment.trim() || undefined, toUserId: to?.id });
      onDone(kind); setComment(''); setTo(null);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={meta.heading}
      footer={<><button className="btn ghost" onClick={onClose}>Batal</button><button className={`btn ${meta.cls}`} disabled={busy || invalid} onClick={submit}>{busy ? <span className="spinner" /> : meta.icon}{meta.label}</button></>}>
      <div className="stack">
        <div><span className="ref">{refCode}</span><div style={{ fontWeight: 500 }}>{title}</div></div>
        <ErrorAlert error={error} />
        {kind === 'delegate' && (
          <Field label="Delegasikan ke" required hint="Penerima akan melihat item ini di inbox-nya; keputusannya dicatat atas namanya.">
            <UserPicker value={to} onChange={setTo} exclude={excludeIds} />
          </Field>
        )}
        <Field
          label={kind === 'reject' ? 'Alasan penolakan' : 'Catatan'} required={kind === 'reject'}
          error={kind === 'reject' && comment.length > 0 && comment.trim().length < 5 ? 'Tulis alasan minimal 5 karakter' : null}
          hint={kind === 'reject' ? 'Dikirim ke pengaju agar dapat merevisi.' : 'Opsional, tampil di riwayat keputusan.'}
        >
          <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} autoFocus={kind !== 'delegate'} maxLength={2000} />
        </Field>
      </div>
    </Modal>
  );
}
