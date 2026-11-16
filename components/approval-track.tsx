'use client';
import { Check, Forward, X } from 'lucide-react';
import { duration, fmtDateTime } from '@/lib/format';

export interface TrackLevel {
  levelOrder: number; name: string; state: 'approved' | 'rejected' | 'current' | 'waiting';
  startedAt: string | null; endedAt: string | null; durationMs: number | null; slaHours: number; slaBreached: boolean;
  decisions: { id: string; decision: string; comment: string | null; decidedAt: string; approver: { fullName: string }; onBehalfOf: { fullName: string } | null; delegatedToUser: { fullName: string } | null }[];
  currentApprovers: { id?: string; fullName?: string; viaDelegationFrom?: string | null }[];
}

/**
 * Elemen khas Digital Office: jalur approval bertingkat.
 * Berkas cahaya (beam) mengalir dari level yang sudah disetujui ke level aktif yang berdenyut.
 */
export function ApprovalTrack({ levels, compact = false }: { levels: TrackLevel[]; compact?: boolean }) {
  const n = levels.length;
  if (!n) return null;
  const lastDone = levels.reduce((acc, l, i) => (l.state === 'approved' || l.state === 'rejected' || l.state === 'current' ? i : acc), -1);
  const rejected = levels.some((l) => l.state === 'rejected');
  const pct = n > 1 && lastDone > 0 ? (lastDone / (n - 1)) * 100 : 0;

  return (
    <div className={`track ${compact ? 'compact' : ''}`} style={{ ['--n' as any]: n }} role="list" aria-label="Progres approval">
      <div className={`beam ${rejected ? 'rejected' : ''}`} style={{ width: `calc((100% - 100% / ${n}) * ${pct / 100})` }} />
      {levels.map((l, i) => {
        const final = [...l.decisions].reverse().find((d) => d.decision !== 'delegate');
        const delegated = l.decisions.filter((d) => d.decision === 'delegate').at(-1);
        return (
          <div key={l.levelOrder} className={`node ${l.state}`} role="listitem" aria-label={`${l.name}: ${l.state}`}>
            <div className="orb">
              {l.state === 'approved' ? <Check /> : l.state === 'rejected' ? <X /> : delegated && l.state === 'current' ? <Forward /> : i + 1}
            </div>
            <div className="lv">{l.name}</div>
            {!compact && (
              <>
                <div className="who">
                  {final
                    ? <>{final.approver.fullName}{final.onBehalfOf && <span className="muted"> a.n. {final.onBehalfOf.fullName}</span>}</>
                    : l.state === 'current'
                      ? l.currentApprovers.map((a) => a.fullName).filter(Boolean).join(', ') || 'Menunggu approver'
                      : 'Menunggu'}
                </div>
                <div className={`when ${l.slaBreached ? 'sla-bad' : ''}`}>
                  {l.state === 'waiting' ? `SLA ${l.slaHours} jam`
                    : l.state === 'current' ? `Berjalan ${duration(l.durationMs)} · SLA ${l.slaHours} jam`
                    : `${fmtDateTime(l.endedAt)} · ${duration(l.durationMs)}`}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
