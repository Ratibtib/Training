import { useEffect, useState } from 'react'
import { getCibles, getLatestWeight, type Cible } from '../data/queries'

// Position actuelle connue seulement pour le poids (via mesures).
// Les autres cibles sont définies par le programmateur : on les affiche
// comme repères, avec jauge uniquement si une position est disponible.

function fmtVal(v: number, unite: string | null): string {
  const u = unite ?? ''
  if (u === 's') { const m = Math.floor(v / 60), s = v % 60; return m ? `${m}'${String(s).padStart(2, '0')}` : `${s}s` }
  return `${v}${u ? ' ' + u : ''}`
}

export function Objectifs() {
  const [cibles, setCibles] = useState<Cible[]>([])
  const [poids, setPoids] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [cs, w] = await Promise.all([getCibles(), getLatestWeight()])
      setCibles(cs); setPoids(w); setLoading(false)
    })()
  }, [])

  if (loading) return <div className="boot">Chargement…</div>

  const phase = cibles.filter(c => c.type === 'phase')
  const horizon = cibles.filter(c => c.type === 'horizon')

  return (
    <div className="screen">
      <div className="appbar"><div className="eyebrow">Objectifs</div></div>

      {phase.length > 0 && <div className="section-label">Cibles de phase</div>}
      {phase.map(c => <Lane key={c.id} cible={c} pos={c.indicateur === 'poids' ? poids : null} />)}

      {horizon.length > 0 && <div className="section-label">Horizon — records</div>}
      {horizon.map(c => <Lane key={c.id} cible={c} pos={null} />)}

      {cibles.length === 0 && <div className="empty">Aucun objectif défini pour le moment.</div>}
    </div>
  )
}

function Lane({ cible, pos }: { cible: Cible; pos: number | null }) {
  const cibleTxt = fmtVal(cible.valeur, cible.unite)

  // Jauge seulement si on connaît la position actuelle
  let pct: number | null = null
  let reste: string | null = null
  if (pos != null) {
    if (cible.sens === 'baisse') {
      // ex. poids : on part de plus haut, on descend vers la cible
      const start = Math.max(pos, cible.valeur) * 1.06
      pct = Math.min(100, Math.max(0, ((start - pos) / (start - cible.valeur)) * 100))
      const diff = pos - cible.valeur
      reste = diff > 0 ? `reste ${fmtVal(Math.round(diff * 10) / 10, cible.unite)}` : 'atteint ✓'
    } else {
      pct = Math.min(100, Math.max(0, (pos / cible.valeur) * 100))
      const diff = cible.valeur - pos
      reste = diff > 0 ? `reste ${fmtVal(diff, cible.unite)}` : 'atteint ✓'
    }
  }

  const atteint = reste === 'atteint ✓'

  return (
    <div className={'lane-card' + (cible.type === 'horizon' ? ' horizon' : '')}>
      <div className="lane-head">
        <div className="lane-title">{cible.indicateur}</div>
        {reste
          ? <div className={'lane-reste' + (atteint ? ' ok' : '')}>{reste}</div>
          : <div className="lane-reste lock">cible {cibleTxt}</div>}
      </div>
      <div className="lane-sub">
        {pos != null ? `${fmtVal(pos, cible.unite)} → ${cibleTxt}` : `objectif ${cibleTxt}`}
        {cible.echeance ? ` · ${cible.echeance}` : ''}
      </div>

      <div className="lane">
        {pct != null && <div className="lane-fill" style={{ width: `${pct}%` }} />}
        <div className="finish" style={{ left: pct != null ? '92%' : '82%' }}>
          <span className="flag">{cibleTxt}</span>
        </div>
        {pct != null && (
          <div className={'you' + (atteint ? ' done' : '')} style={{ left: `${pct}%` }}>
            <div className="pin">{fmtVal(pos!, cible.unite)}</div><div className="stem" />
          </div>
        )}
        {cible.type === 'horizon' && <div className="horizon-tag">★ record</div>}
      </div>
    </div>
  )
}