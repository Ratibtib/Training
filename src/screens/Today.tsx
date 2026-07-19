import { useEffect, useRef, useState } from 'react'
import {
  getSessionForDay, getRealizedForSeance,
  saveRealizedSeries, terminerSeance, type SerieInput
} from '../data/queries'
import type { SeancePlanifiee, ExoPlanifie } from '../lib/types'
import { useRefDate } from '../context/DateContext'
import { todayISO, labelJour } from '../lib/dates'
import { DateNav } from '../components/DateNav'

const NATURE_ICON: Record<string, string> = {
  muscu: '🏋', course: '🏃', velo: '🚴', basket: '🏀', mobilite: '🧘', autre: '•'
}

type Serie = { reps: string; charge: string; duree: string; done: boolean }
type SessionState = Record<string, Serie[]>

const nbSeries = (exo: ExoPlanifie) => exo.cible?.series ?? 1
const isTemps = (exo: ExoPlanifie) => exo.cible?.duree_s != null || exo.exercices?.unite === 'temps'
const hasCharge = (exo: ExoPlanifie) => exo.cible?.charge != null
function prefill(exo: ExoPlanifie): Serie {
  const c = exo.cible
  return {
    reps: c?.reps != null ? String(c.reps) : '',
    charge: c?.charge != null ? String(c.charge) : '',
    duree: c?.duree_s != null ? String(c.duree_s) : '',
    done: false
  }
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
const num = (s: string): number | null => {
  const v = parseFloat(s.replace(',', '.'))
  return Number.isFinite(v) ? v : null
}

export function Today() {
  const { refDate } = useRefDate()
  const [seance, setSeance] = useState<SeancePlanifiee | null>(null)
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<SessionState>({})
  const [ressenti, setRessenti] = useState<number | null>(null)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Recharge dès que la date de référence change
  useEffect(() => {
    let cancelled = false
    setLoading(true); setState({}); setRessenti(null); setSaving('idle')
    ;(async () => {
      const s = await getSessionForDay(refDate)
      if (cancelled) return
      setSeance(s)
      if (s) {
        const init: SessionState = {}
        for (const exo of s.exos_planifies ?? []) {
          init[exo.id] = Array.from({ length: nbSeries(exo) }, () => prefill(exo))
        }
        const realized = await getRealizedForSeance(s.id)
        if (cancelled) return
        if (realized) {
          if (realized.ressenti != null) setRessenti(realized.ressenti)
          for (const sr of realized.series_realisees ?? []) {
            const arr = init[sr.exo_planifie_id]
            if (arr && arr[sr.ordre]) {
              arr[sr.ordre] = {
                reps: sr.reps != null ? String(sr.reps) : '',
                charge: sr.charge != null ? String(sr.charge) : '',
                duree: sr.duree_s != null ? String(sr.duree_s) : '',
                done: true
              }
            }
          }
        }
        setState(init)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [refDate])

  function collectDone(current: SessionState): SerieInput[] {
    const out: SerieInput[] = []
    for (const exoId of Object.keys(current)) {
      current[exoId].forEach((s, ordre) => {
        if (!s.done) return
        out.push({
          exoPlanifieId: exoId, ordre,
          reps: s.reps ? num(s.reps) : null,
          charge: s.charge ? num(s.charge) : null,
          duree_s: s.duree ? num(s.duree) : null
        })
      })
    }
    return out
  }

  function scheduleSave(next: SessionState, sId: string) {
    setSaving('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const ok = await saveRealizedSeries(sId, collectDone(next))
      setSaving(ok ? 'saved' : 'idle')
    }, 700)
  }

  function updateSerie(exoId: string, idx: number, patch: Partial<Serie>) {
    if (!seance) return
    setState(prev => {
      const next = { ...prev, [exoId]: prev[exoId].map((s, i) => i === idx ? { ...s, ...patch } : s) }
      scheduleSave(next, seance.id)
      return next
    })
  }

  const isToday = refDate === todayISO()

  return (
    <>
      <DateNav label={labelJour(refDate)} step="day" />

      {loading ? (
        <div className="boot">Chargement…</div>
      ) : !seance ? (
        <div className="empty">
          {isToday ? "Rien de prévu aujourd'hui." : 'Repos — aucune séance ce jour.'}
        </div>
      ) : (
        <>
          <div className="sess-head">
            <div>
              <div className="t">{NATURE_ICON[seance.nature] ?? '•'} {seance.nom}</div>
              <div className="s">
                {seance.duree_min ? `~${seance.duree_min} min` : ''}
                {seance.etiquette === 'fixe' ? ' · fixe' : ' · option'}
                {seance.statut === 'faite' ? ' · fait ✓' : ''}
                {saving === 'saving' && ' · sauvegarde…'}
                {saving === 'saved' && ' · enregistré ✓'}
              </div>
            </div>
            {(() => {
              const exos = seance.exos_planifies ?? []
              const done = exos.filter(e => (state[e.id] ?? []).length > 0 && state[e.id].every(s => s.done)).length
              return exos.length > 0 ? <div className="prog"><span className="n">{done}</span>/{exos.length}</div> : null
            })()}
          </div>

          {(seance.exos_planifies ?? []).map(exo => {
            const series = state[exo.id] ?? []
            const temps = isTemps(exo)
            const charge = hasCharge(exo)
            return (
              <div key={exo.id} className={'exo' + (series.length > 0 && series.every(s => s.done) ? ' on' : '')}>
                <div className="exo-head">
                  <div className="exo-name">{exo.exercices?.nom ?? 'Exercice'}</div>
                  <div className="exo-cible">{cibleLabel(exo)}</div>
                </div>
                {exo.note_coach && <div className="exo-note">{exo.note_coach}</div>}
                <div className="series">
                  {series.map((s, i) => (
                    <div key={i} className={'serie' + (s.done ? ' on' : '')}>
                      <span className="sidx">S{i + 1}</span>
                      {temps ? (
                        <label className="fld">
                          <input inputMode="numeric" value={s.duree}
                            onChange={e => updateSerie(exo.id, i, { duree: e.target.value })} />
                          <span>s</span>
                        </label>
                      ) : (
                        <>
                          <label className="fld">
                            <input inputMode="numeric" value={s.reps}
                              onChange={e => updateSerie(exo.id, i, { reps: e.target.value })} />
                            <span>reps</span>
                          </label>
                          {charge && (
                            <label className="fld">
                              <input inputMode="decimal" value={s.charge}
                                onChange={e => updateSerie(exo.id, i, { charge: e.target.value })} />
                              <span>kg</span>
                            </label>
                          )}
                        </>
                      )}
                      <button className="tick" aria-label="série faite"
                        onClick={() => updateSerie(exo.id, i, { done: !s.done })}>
                        {s.done ? '✓' : ''}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <div className="finish-card">
            <div className="ressenti">
              <span className="lbl">Ressenti</span>
              <div className="dots">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} className={'dot' + (ressenti === n ? ' on' : '')}
                    onClick={() => setRessenti(n)}>{n}</button>
                ))}
              </div>
            </div>
            <button className="primary"
              onClick={async () => {
                if (saveTimer.current) clearTimeout(saveTimer.current)
                await saveRealizedSeries(seance.id, collectDone(state))
                const ok = await terminerSeance(seance.id, ressenti, null)
                alert(ok ? 'Séance enregistrée ✓' : 'Souci à l’enregistrement — réessaie.')
              }}>
              Terminer la séance
            </button>
          </div>
        </>
      )}
    </>
  )
}