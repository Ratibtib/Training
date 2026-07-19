import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import {
  getWeightForDay, getLatestWeight, saveWeight,
  getRessentiForDay, saveRessenti
} from '../data/queries'
import { useRefDate } from '../context/DateContext'
import { todayISO, labelJour } from '../lib/dates'
import { DateNav } from '../components/DateNav'

export function Suivi() {
  const { signOut } = useAuth()
  const { refDate } = useRefDate()
  const [weight, setWeight] = useState(95)
  const [loaded, setLoaded] = useState(false)
  const [wSaved, setWSaved] = useState(false)
  const [fatigue, setFatigue] = useState<number | null>(null)
  const [forme, setForme] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoaded(false); setWSaved(false)
      const w = await getWeightForDay(refDate)
      if (cancelled) return
      if (w != null) setWeight(w)
      else { const last = await getLatestWeight(); if (!cancelled && last != null) setWeight(last) }
      const r = await getRessentiForDay(refDate)
      if (cancelled) return
      setFatigue(r?.fatigue ?? null); setForme(r?.forme ?? null)
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [refDate])

  function step(delta: number) { setWeight(w => Math.round((w + delta) * 10) / 10); setWSaved(false) }
  async function saveW() { const ok = await saveWeight(weight, refDate); setWSaved(ok) }
  async function pickFatigue(n: number) { setFatigue(n); await saveRessenti(n, forme, refDate) }
  async function pickForme(n: number) { setForme(n); await saveRessenti(fatigue, n, refDate) }

  const isToday = refDate === todayISO()

  return (
    <div className="screen">
      <div className="appbar">
        <div className="eyebrow">Suivi</div>
        <button className="link" onClick={signOut}>Déconnexion</button>
      </div>

      <DateNav label={labelJour(refDate)} step="day" />

      {!loaded ? <div className="boot">Chargement…</div> : (
        <>
          <div className="section-label">Poids {isToday ? 'du jour' : 'de ce jour'}</div>
          <div className="weight-card">
            <div className="weight-now">{weight.toFixed(1)} <span>kg</span></div>
            <div className="stepper">
              <button onClick={() => step(-0.5)}>−0.5</button>
              <button onClick={() => step(-0.1)}>−0.1</button>
              <button onClick={() => step(0.1)}>+0.1</button>
              <button onClick={() => step(0.5)}>+0.5</button>
            </div>
            <button className="primary" onClick={saveW}>
              {wSaved ? 'Enregistré ✓' : 'Enregistrer le poids'}
            </button>
          </div>

          <div className="section-label">Ressenti</div>
          <Scale label="Fatigue" left="Frais" right="Cramé" value={fatigue} onPick={pickFatigue} />
          <Scale label="Forme" left="Éteint" right="En feu" value={forme} onPick={pickForme} />
        </>
      )}
    </div>
  )
}

function Scale({ label, left, right, value, onPick }: {
  label: string; left: string; right: string
  value: number | null; onPick: (n: number) => void
}) {
  return (
    <div className="scale-card">
      <div className="scale-q">{label}<em>/5</em></div>
      <div className="scale-dots">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} className={'sdot' + (value === n ? ' on' : '')} onClick={() => onPick(n)}>{n}</button>
        ))}
      </div>
      <div className="scale-hint"><span>{left}</span><span>{right}</span></div>
    </div>
  )
}