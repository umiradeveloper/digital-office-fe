'use client';

/** Grafik kolom ganda sederhana (SVG murni, tanpa dependensi). */
export function ColumnChart({ data, series }: { data: Record<string, any>[]; series: { key: string; label: string; color: string }[] }) {
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key] ?? 0))));
  const H = 150; const groupW = 100 / data.length;
  return (
    <div>
      <svg viewBox={`0 0 100 ${H / 2 + 14}`} preserveAspectRatio="none" style={{ width: '100%', height: H + 28, overflow: 'visible' }} role="img" aria-label="Tren request">
        {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1="0" x2="100" y1={(H / 2) * (1 - g)} y2={(H / 2) * (1 - g)} stroke="#E2EBEE" strokeWidth="0.2" />)}
        {data.map((d, i) => series.map((s, j) => {
          const v = Number(d[s.key] ?? 0); const h = (v / max) * (H / 2);
          const bw = (groupW * 0.62) / series.length; const x = i * groupW + groupW * 0.19 + j * bw;
          return (
            <g key={`${i}-${s.key}`}>
              <rect x={x} y={H / 2 - h} width={bw * 0.86} height={Math.max(h, 0.3)} rx="0.8" fill={s.color} opacity={j ? 0.75 : 1}><title>{`${d.label}: ${s.label} ${v}`}</title></rect>
            </g>
          );
        }))}
        {data.map((d, i) => <text key={i} x={i * groupW + groupW / 2} y={H / 2 + 9} textAnchor="middle" fontSize="4" fill="#6A8590" style={{ fontFamily: 'var(--font-display)' }}>{d.label}</text>)}
      </svg>
      <div className="legend">{series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>
    </div>
  );
}

/** Cincin komposisi status. */
export function Ring({ parts, size = 150, label }: { parts: { label: string; value: number; color: string }[]; size?: number; label?: string }) {
  const total = parts.reduce((a, b) => a + b.value, 0);
  const r = 42; const c = 2 * Math.PI * r; let off = 0;
  return (
    <div className="row" style={{ gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#E2EBEE" strokeWidth="9" />
        {total > 0 && parts.filter((p) => p.value > 0).map((p) => {
          const len = (p.value / total) * c; const el = (
            <circle key={p.label} cx="50" cy="50" r={r} fill="none" stroke={p.color} strokeWidth="9" strokeDasharray={`${Math.max(len - 1.2, 0.1)} ${c}`} strokeDashoffset={-off} transform="rotate(-90 50 50)" strokeLinecap="butt"><title>{`${p.label}: ${p.value}`}</title></circle>
          ); off += len; return el;
        })}
        <text x="50" y="49" textAnchor="middle" fontSize="18" fontWeight="600" fill="#024558" style={{ fontFamily: 'var(--font-display)' }}>{total}</text>
        <text x="50" y="62" textAnchor="middle" fontSize="7" fill="#6A8590">{label}</text>
      </svg>
      <div className="stack sm" style={{ minWidth: 150 }}>
        {parts.map((p) => (
          <div key={p.label} className="row between small"><span className="row"><i style={{ width: 9, height: 9, borderRadius: 3, background: p.color, display: 'inline-block' }} />{p.label}</span><span className="num ink2">{p.value}</span></div>
        ))}
      </div>
    </div>
  );
}
