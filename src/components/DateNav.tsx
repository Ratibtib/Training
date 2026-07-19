import { useRefDate } from '../context/DateContext'
import { addDays, addWeeks, todayISO } from '../lib/dates'

// Barre de navigation temporelle : ‹  libellé  ›  + bouton Aujourd'hui.
// step = 'day' ou 'week' : décale la date de référence partagée.
export function DateNav({ label, step }: { label: string; step: 'day' | 'week' }) {
  const { refDate, setRefDate, goToday } = useRefDate()
  const back = () => setRefDate(step === 'day' ? addDays(refDate, -1) : addWeeks(refDate, -1))
  const fwd = () => setRefDate(step === 'day' ? addDays(refDate, 1) : addWeeks(refDate, 1))
  const isToday = refDate === todayISO()

  return (
    <div className="datenav">
      <button className="nav-arrow" onClick={back} aria-label="précédent">‹</button>
      <div className="nav-label">{label}</div>
      <button className="nav-arrow" onClick={fwd} aria-label="suivant">›</button>
      {!isToday && <button className="nav-today" onClick={goToday}>Aujourd’hui</button>}
    </div>
  )
}