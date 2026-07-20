import { useEffect, useState } from 'react'
import { getWeightSeries, getExoProgressions, getSommeilSeries, type ExoProgress } from '../data/queries'
import type { Mesure } from '../lib/types'
import { LineChart } from '../components/LineChart'

function fmtH(h: number): string {
  const e = Math.floor(h), m = Math.round((h - e) * 60)
  return m ? `${e}h${String(m).padStart(2, '0')}` : `${e}h`
}

export function Evolution() {
  const [poids, setPoids] = useState<Mesure[]>([])
  const [sommeil, setSommeil] = useState<{ jour: string; valeur: number }[]>([])
  const [exos, setExos] = useState<ExoProgress[]>([])
  const [sel, setSel] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [w, e] = await Promise.all([getWeightSeries(), getExoProgressions()])
      setPoids(w); setExos(e)
      setSommeil(await getSommeilSeries())
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="boot">Chargement…</div>

  const poidsPts = poids.map(m => ({ jour: m.jour, valeur: m.valeur }))
  const tendance = (() => {
    if (poids.length < 2) return null
    const first = poids[0], last = poids[poids.length - 1]
    const jours = (new Date(last.jour).getTime() - new Date(first.jour).getTime()) / 86400000
    if (jours <= 0) return null
    const parSem = ((last.valeur - first.valeur) / jours) * 7
    return Math.round(parSem * 100) / 100
  })()

  const top = exos.slice(0, 4)
  const selExo = exos.find(e => e.exercice_id === sel)
  const autres = exos.filter(e => !top.some(t => t.exercice_id === e.exercice_id))

  return (
    <>
      <div className="section-label">Poids</div>
      <div className="evo-card">
        {poidsPts.length === 0 ? (
          <div className="chart-empty">Aucune pesée enregistrée.</div>
        ) : (
          <>
            <div className="evo-head">
              <div className="evo-now">{poids[poids.length - 1].valeur.toFixed(1)} <span>kg</span></div>
              {tendance != null && (
                <div className={'evo-trend ' + (tendance <= 0 ? 'ok' : 'up')}>
                  {tendance <= 0 ? '' : '+'}{tendance} kg/sem
                </div>
              )}
            </div>
            <LineChart points={poidsPts} unite="kg" />
          </>
        )}
      </div>

      <div className="section-label">Sommeil</div>
      <div className="evo-card">
        {sommeil.length === 0 ? (
          <div className="chart-empty">Aucune nuit enregistrée.</div>
        ) : (
          <>
            <div className="evo-head">
              <div className="evo-now">{fmtH(sommeil[sommeil.length - 1].valeur)} <span>dernière nuit</span></div>
              {sommeil.length >= 2 && (
                <div className="evo-trend ok">
                  moy. {fmtH(sommeil.reduce((s, p) => s + p.valeur, 0) / sommeil.length)}
                </div>
              )}
            </div>
            <LineChart points={sommeil} unite="h" />
          </>
        )}
      </div>

      <div className="section-label">Exercices les plus travaillés</div>
      {top.length === 0 ? (
        <div className="empty">Aucune séance saisie pour l’instant.<br />
          <span className="hint">Les courbes se remplissent au fil de tes séances.</span>
        </div>
      ) : top.map(e => (
        <div key={e.exercice_id} className="evo-card">
          <div className="evo-exo-head">
            <span className="evo-exo-nom">{e.nom}</span>
            <span className="evo-exo-meta">{e.nbSeances} séance{e.nbSeances > 1 ? 's' : ''}</span>
          </div>
          <LineChart points={e.points} unite={e.unite === 'temps' ? 's' : undefined} />
        </div>
      ))}

      {autres.length > 0 && (
        <>
          <div className="section-label">Autre exercice</div>
          <select className="evo-select" value={sel} onChange={e => setSel(e.target.value)}>
            <option value="">Choisir un exercice…</option>
            {autres.map(e => <option key={e.exercice_id} value={e.exercice_id}>{e.nom}</option>)}
          </select>
          {selExo && (
            <div className="evo-card" style={{ marginTop: 10 }}>
              <div className="evo-exo-head">
                <span className="evo-exo-nom">{selExo.nom}</span>
                <span className="evo-exo-meta">{selExo.nbSeances} séance{selExo.nbSeances > 1 ? 's' : ''}</span>
              </div>
              <LineChart points={selExo.points} unite={selExo.unite === 'temps' ? 's' : undefined} />
            </div>
          )}
        </>
      )}
    </>
  )
}