import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { getTodayOrNextSession, marquerSeanceFaite } from '../data/queries'
import type { SeancePlanifiee, ExoPlanifie } from '../lib/types'

const NATURE_ICON: Record<string, string> = {
  muscu: '🏋', course: '🏃', velo: '🚴', basket: '🏀', mobilite: '🧘', autre: '•'
}

function cibleLabel(exo: ExoPlanifie): string {
  const c = exo.cible
  if (!c) return ''
  if (c.objectif) return `${c.series ?? ''} × ${c.objectif}`.trim()
  if (c.duree_s) return `${c.series ?? ''} × ${c.duree_s}s`.trim()
  if (c.charge != null) return `${c.series ?? ''} × ${c.reps ?? ''} × ${c.charge} kg`
  if (c.reps != null) return `${c.series ?? ''} × ${c.reps}`
  return ''
}

export function Today() {
  const { signOut } = useAuth()
  const [seance, setSeance] = useState<SeancePlanifiee | null>(null)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState<Record<string, boolean>>({})

  useEffect(() => {
    getTodayOrNextSession().then(s => { setSeance(s); setLoading(false) })
  }, [])

  function toggle(exoId: string) {
    setDone(d => ({ ...d, [exoId]: !d[exoId] }))
  }

  if (loading) return <div className="boot">Chargement de ta séance…</div>

  if (!seance) {
    return (
      <div className="screen">
        <Header onSignOut={signOut} />
        <div className="empty">
          Aucune séance à venir dans ta base.<br />
          <span className="hint">Vérifie que le seed est bien passé.</span>
        </div>
      </div>
    )
  }

  const total = seance.exos_planifies?.length ?? 0
  const doneCount = Object.values(done).filter(Boolean).length
  const isToday = seance.jour === new Date().toISOString().slice(0, 10)

  return (
    <div className="screen">
      <Header onSignOut={signOut} />
      <div className="sess-head">
        <div>
          <div className="t">{NATURE_ICON[seance.nature] ?? '•'} {seance.nom}</div>
          <div className="s">
            {isToday ? "Aujourd'hui" : `Prévu le ${seance.jour}`}
            {seance.duree_min ? ` · ~${seance.duree_min} min` : ''}
            {seance.etiquette === 'fixe' ? ' · fixe' : ' · option'}
          </div>
        </div>
        <div className="prog"><span className="n">{doneCount}</span>/{total}</div>
      </div>

      {seance.exos_planifies?.map(exo => (
        <div key={exo.id} className={'exo' + (done[exo.id] ? ' on' : '')}>
          <div className="exo-main">
            <div className="exo-name">{exo.exercices?.nom ?? 'Exercice'}</div>
            <div className="exo-cible">{cibleLabel(exo)}</div>
            {exo.note_coach && <div className="exo-note">{exo.note_coach}</div>}
          </div>
          <button className="check" aria-label="fait" onClick={() => toggle(exo.id)}>
            {done[exo.id] ? '✓' : ''}
          </button>
        </div>
      ))}

      {total > 0 && (
        <button
          className="primary finish"
          onClick={async () => { await marquerSeanceFaite(seance.id); alert('Séance marquée comme faite.') }}
        >
          Terminer la séance
        </button>
      )}
    </div>
  )
}

function Header({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="appbar">
      <div className="eyebrow">Programme</div>
      <button className="link" onClick={onSignOut}>Déconnexion</button>
    </div>
  )
}
