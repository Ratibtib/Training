// Mini graphe en ligne, SVG pur, sans dépendance.
export interface Pt { jour: string; valeur: number }

export function LineChart({ points, unite }: { points: Pt[]; unite?: string }) {
  if (points.length === 0) return <div className="chart-empty">Pas encore de donnée.</div>

  const W = 320, H = 120, pad = 8, padL = 30, padB = 16
  const xs = points.map((_, i) => i)
  const ys = points.map(p => p.valeur)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const spanY = maxY - minY || 1
  const spanX = Math.max(1, xs.length - 1)

  const X = (i: number) => padL + (i / spanX) * (W - padL - pad)
  const Y = (v: number) => pad + (1 - (v - minY) / spanY) * (H - pad - padB)

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(p.valeur).toFixed(1)}`).join(' ')
  const area = `${d} L${X(points.length - 1).toFixed(1)},${(H - padB).toFixed(1)} L${X(0).toFixed(1)},${(H - padB).toFixed(1)} Z`

  const first = points[0].valeur, last = points[points.length - 1].valeur
  const fmt = (v: number) => unite === 's'
    ? `${Math.floor(v / 60)}'${String(Math.round(v % 60)).padStart(2, '0')}`
    : `${Math.round(v * 10) / 10}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" preserveAspectRatio="xMidYMid meet">
      <line x1={padL} y1={H - padB} x2={W - pad} y2={H - padB} stroke="var(--line)" strokeWidth="1" />
      <text x="2" y={Y(maxY) + 4} className="chart-ax">{fmt(maxY)}</text>
      <text x="2" y={Y(minY) + 4} className="chart-ax">{fmt(minY)}</text>
      <path d={area} fill="rgba(240,62,47,.10)" />
      <path d={d} fill="none" stroke="var(--track)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={X(i)} cy={Y(p.valeur)} r={i === points.length - 1 ? 3.5 : 2}
          fill={i === points.length - 1 ? 'var(--track)' : '#fff'} stroke="var(--track)" strokeWidth="1.5" />
      ))}
      <text x={X(0)} y={H - 4} className="chart-ax" textAnchor="start">{points[0].jour.slice(5)}</text>
      <text x={W - pad} y={H - 4} className="chart-ax" textAnchor="end">{points[points.length - 1].jour.slice(5)}</text>
      {points.length > 1 && (
        <text x={W - pad} y={12} className={'chart-delta ' + (last >= first ? 'up' : 'down')} textAnchor="end">
          {last >= first ? '▲' : '▼'} {fmt(Math.abs(last - first))}
        </text>
      )}
    </svg>
  )
}