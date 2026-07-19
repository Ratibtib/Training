import { useEffect, useState } from 'react'
import { getProgrammes, getBlocs } from '../data/queries'
import type { Programme, Bloc } from '../lib/types'
import { useRefDate } from '../context/DateContext'

export function BlocView() {
  const { refDate } = useRefDate()
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [idx, setIdx] = useState(0)
  const [blocs, setBlocs] = useState<Bloc[]>([])
  const [loading, setLoading] = useState(true)

  // Charge la liste des programmes une fois
  useEffect(() => {
    getProgrammes().then(ps => { setProgrammes(ps); setLoading(false) })
  }, [])

  // Charge les blocs du programme courant
  useEffect(() => {
    const prog = programmes[idx]
    if (prog) getBlocs(prog.id).then(setBlocs)
    else setBlocs([])
  }, [programmes, idx])

  if (loading) return <div className="boot">Chargement…</div>
  if (programmes.length === 0) return <div className="empty">Aucun programme.</div>

  const prog = programmes[idx]
  const phaseState = (b: Bloc): 'past' | 'current' | 'future' => {
    if (b.fin && b.fin < refDate) return 'past'
    if (b.debut && b.debut > refDate) return 'future'
    return 'current'
  }

  return (
    <>
      <div className="datenav">
        <button className="nav-arrow" onClick={() => setIdx(i => Math.max(0, i - 1))}
          disabled={idx === 0} aria-label="programme précédent">‹</button>
        <div className="nav-label">{prog.nom}</div>
        <button className="nav-arrow" onClick={() => setIdx(i => Math.min(programmes.length - 1, i + 1))}
          disabled={idx === programmes.length - 1} aria-label="programme suivant">›</button>
      </div>

      {prog.objectif && <div className="prog-obj">{prog.objectif}</div>}

      {blocs.length === 0 ? (
        <div className="empty">Programme à venir — pas encore de blocs définis.</div>
      ) : blocs.map(b => {
        const st = phaseState(b)
        return (
          <div key={b.id} className={'phase ' + st}>
            <div className="ph-top">
              <div className="ph-name">{b.nom}</div>
              {st === 'current' && <div className="ph-badge">Contient la date</div>}
            </div>
            {b.intention && <div className="ph-desc">{b.intention}</div>}
            {(b.debut || b.fin) && <div className="ph-dates">{b.debut ?? '?'} → {b.fin ?? '?'}</div>}
          </div>
        )
      })}
    </>
  )
}