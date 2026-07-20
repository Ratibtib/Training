import { useEffect, useRef, useState } from 'react'
import {
  getSessionForDay, getRealizedForSeance,
  saveRealizedSeries, terminerSeance, marquerSautee, type SerieInput
} from '../data/queries'
import type { SeancePlanifiee, ExoPlanifie } from '../lib/types'
import { useRefDate } from '../context/DateContext'
import { todayISO, labelJour } from '../lib/dates'
import { DateNav } from '../components/DateNav'
import { RestTimer } from '../components/RestTimer'

const NATURE_ICON: Record<string, string> = {
  muscu: '🏋', course: '🏃', velo: '🚴', basket: '🏀', mobilite: '🧘', autre: '•'
}

type Serie = { reps: string; charge: string; duree: string; done: boolean }
type SessionState = Record<string, Serie[]>

const nbSeries = (exo: ExoPlanifie) => {
  const sd = (exo.cible as any)?.series_detail
  if (Array.isArray(sd) && sd.length) return sd.length
  return exo.cible?.series ?? 1
}
const isTemps = (exo: ExoPlanifie) => exo.cible?.duree_s != null || exo.exercices?.unite === 'temps'
const hasCharge = (exo: ExoPlanifie) => exo.cible?.charge != null
const recupSec = (exo: ExoPlanifie) => (exo.cible as any)?.recup_s ?? 90

function prefill(exo: ExoPlanifie, i = 0): Serie {
  const c: any = exo.cible ?? {}
  const sd = Array.isArray(c.series_detail) ? c.series_detail[i] : null
  return {
    reps: sd?.reps != null ? String(sd.reps) : (c.reps != null ? String(c.reps) : ''),
    charge: sd?.charge != null ? String(sd.charge) : (c.charge != null ? String(c.charge) : ''),
    duree: c.duree_s != null ? String(c.duree_s) : '',
    done: false
  }
}

// Prévu par série, affiché à côté de la saisie (index-aware pour pyramides)
function prevuSerie(exo: ExoPlanifie, i = 0): string {
  const c: any = exo.cible
  if (!c) return ''
  const sd = Array.isArray(c.series_detail) ? c.series_detail[i] : null
  if (sd) {
    if (sd.charge != null) return `${sd.reps ?? '?'} × ${sd.charge} kg`
    if (sd.reps != null) return `${sd.reps} reps`
  }
  if (c.objectif) return c.objectif
  if (c.duree_s) return `${c.duree_s}s`
  if (c.charge != null) return `${c.reps ?? '?'} × ${c.charge} kg`
  if (c.reps != null) return `${c.reps} reps`
  return ''
}

// Résumé de l'exo quand il est replié
function resumeExo(exo: ExoPlanifie): string {
  const c: any = exo.cible
  const parts: string[] = []
  const sd = Array.isArray(c?.series_detail) ? c.series_detail : null
  if (sd && sd.length) parts.push(`${sd.length} séries (${sd.map((x: any) => x.reps ?? '?').join('/')})`)
  else if (c?.series) parts.push(`${c.series} séries`)
  const recup = recupSec(exo)
  if (recup) {
    const m = Math.floor(recup / 60), s = recup % 60
    parts.push(`récup ${m}${s ? `'${String(s).padStart(2, '0')}` : "'"}`)
  }
  return parts.join(' · ')
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
  const [open, setOpen] = useState<Record<string, boolean>>({})   // exos dépliés
  const [ressenti, setRessenti] = useState<number | null>(null)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setState({}); setOpen({}); setRessenti(null); setSaving('idle')
    ;(async () => {
      const s = await getSessionForDay(refDate)
      if (cancelled) return
      setSeance(s)
      if (s) {
        const init: SessionState = {}
        for (const exo of s.exos_planifies ?? []) {
          init[exo.id] = Array.from({ length: nbSeries(exo) }, (_, i) => prefill(exo, i))
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
      const nextArr = prev[exoId].map((s, i) => i === idx ? { ...s, ...patch } : s)
      const next = { ...prev, [exoId]: nextArr }
      scheduleSave(next, seance.id)
      // repli auto quand tout l'exo est validé
      if (nextArr.every(s => s.done)) setOpen(o => ({ ...o, [exoId]: false }))
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
            const doneCount = series.filter(s => s.done).length
            const allDone = series.length > 0 && doneCount === series.length
            const isOpen = open[exo.id] ?? false
            
            return (
              <div key={exo.id} className={'exo card' + (allDone ? ' on' : '')}>
                {/* En-tête cliquable (repli/dépli) */}
                <button className="exo-toggle" onClick={() => setOpen(o => ({ ...o, [exo.id]: !o[exo.id] }))}>
                  <div className="exo-left">
                    <div className="exo-name">{exo.exercices?.nom ?? 'Exercice'}</div>
                    <div className="exo-sum">{resumeExo(exo)}</div>
                  </div>
                  <div className="exo-right">
                    {series.length > 0 && (
                      <span className={'exo-badge' + (allDone ? ' ok' : '')}>
                        {allDone ? '✓' : `${doneCount}/${series.length}`}
                      </span>
                    )}
                    <span className={'chev' + (isOpen ? ' up' : '')}>⌄</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="exo-body">
                    {exo.note_coach && <div className="exo-note">{exo.note_coach}</div>}
                    <div className="series">
                      {series.map((s, i) => (
                        <div key={i} className={'serie' + (s.done ? ' on' : '')}>
                          <span className="sidx">S{i + 1}</span>
                          <span className="prevu">{prevuSerie(exo, i)}</span>
                          <div className="saisie">
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
                          </div>
                          <button className="tick" aria-label="série faite"
                            onClick={() => updateSerie(exo.id, i, { done: !s.done })}>
                            {s.done ? '✓' : ''}
                          </button>
                        </div>
                      ))}
                    </div>
                    <RestTimer seconds={recupSec(exo)} />
                  </div>
                )}
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
                const done = collectDone(state)
                await saveRealizedSeries(seance.id, done)
                // total de séries prévues (sur les exos qui ont des séries)
                const prevues = Object.values(state).reduce((n, arr) => n + arr.length, 0)
                const ok = await terminerSeance(seance.id, ressenti, null, prevues, done.length)
                const complet = !(prevues > 0 && done.length < prevues)
                alert(ok
                  ? (complet ? 'Séance enregistrée ✓' : `Séance enregistrée en partiel (${done.length}/${prevues} séries) ✓`)
                  : 'Souci à l’enregistrement — réessaie.')
              }}>
              Terminer la séance
            </button>
            <button className="skip-btn"
              onClick={async () => {
                if (!confirm('Marquer cette séance comme sautée (non faite) ?')) return
                const ok = await marquerSautee(seance.id)
                alert(ok ? 'Séance marquée sautée.' : 'Erreur — réessaie.')
              }}>
              Marquer comme sautée
            </button>
          </div>
        </>
      )}
    </>
  )
}