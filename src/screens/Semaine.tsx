import { useEffect, useState } from 'react'
import { getWeekSessions } from '../data/queries'
import type { SeancePlanifiee } from '../lib/types'
import { useRefDate } from '../context/DateContext'
import { mondayOfISO, isoDate, todayISO, labelSemaine } from '../lib/dates'
import { DateNav } from '../components/DateNav'

const NATURE_ICON: Record<string, string> = {
  muscu: '🏋', course: '🏃', velo: '🚴', basket: '🏀', mobilite: '🧘', autre: '•'
}
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function Semaine({ onOpenDay }: { onOpenDay: () => void }) {
  const { refDate, setRefDate } = useRefDate()
  const [sessions, setSessions] = useState<SeancePlanifiee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getWeekSessions(refDate).then(s => { setSessions(s); setLoading(false) })
  }, [refDate])

  const monday = mondayOfISO(refDate)
  const today = todayISO()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    const jour = isoDate(d)
    return { jour, label: JOURS[i], num: d.getDate(), sessions: sessions.filter(s => s.jour === jour) }
  })

  const fixesTenus = sessions.filter(s => s.etiquette === 'fixe' && s.statut === 'faite').length
  const fixesTotal = sessions.filter(s => s.etiquette === 'fixe').length

  return (
    <>
      <DateNav label={labelSemaine(refDate)} step="week" />

      <div className="wk-top">
        <span className="section-label" style={{ margin: 0 }}>Semaine</span>
        <span className="wk-count">Fixes tenus {fixesTenus}/{fixesTotal}</span>
      </div>

      {loading ? <div className="boot">Chargement…</div> : days.map(d => (
        <div key={d.jour}
          className={'day' + (d.jour === today ? ' now' : '')}
          onClick={() => { setRefDate(d.jour); onOpenDay() }}>
          <div className="day-col"><span className="dd">{d.label}</span><span className="dn">{d.num}</span></div>
          <div className="day-slots">
            {d.sessions.length === 0 ? (
              <div className="slot">Repos</div>
            ) : d.sessions.map(s => (
              <div key={s.id} className="slot">
                <div>
                  <div className="slot-nm">{NATURE_ICON[s.nature] ?? '•'} {s.nom}</div>
                  <div className="slot-mt">
                    {s.duree_min ? `~${s.duree_min} min` : ''}{s.etiquette === 'option' ? ' · option' : ''}
                  </div>
                </div>
                <div className={'pill ' + (s.statut === 'faite' ? 'ok' : s.etiquette === 'fixe' ? 'fix' : 'opt')}>
                  {s.statut === 'faite' ? 'Fait' : s.etiquette === 'fixe' ? 'Fixe' : 'Option'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="foot-note">Touche un jour pour l’ouvrir. 3 fixes tenus = semaine réussie.</p>
    </>
  )
}
