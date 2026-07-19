import { useEffect, useState } from 'react'
import { getHistorique, getActiveProgramme, getBlocs, type HistoItem } from '../data/queries'
import type { Bloc } from '../lib/types'
import { mondayOfISO, isoDate, todayISO, addDays, parseISO } from '../lib/dates'

const NATURE_ICON: Record<string, string> = {
  muscu: '🏋', course: '🏃', velo: '🚴', basket: '🏀', mobilite: '🧘', autre: '•'
}
const MOIS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']
const MOIS_MAJ = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC']

function dateChip(iso: string) {
  const d = parseISO(iso)
  return { d: String(d.getDate()), m: MOIS_MAJ[d.getMonth()] }
}
function shortDate(iso: string) {
  const d = parseISO(iso)
  return `${d.getDate()} ${MOIS[d.getMonth()]}`
}
function daysBetween(a: string, b: string) {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000)
}
function statusBadge(statut: string | undefined) {
  if (statut === 'partielle') return { cls: 'part', txt: 'partiel' }
  if (statut === 'sautee') return { cls: 'skip', txt: 'sauté' }
  return { cls: 'full', txt: 'complet' }
}

export function Historique() {
  const [items, setItems] = useState<HistoItem[]>([])
  const [blocs, setBlocs] = useState<Bloc[]>([])
  const [progNom, setProgNom] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [its, prog] = await Promise.all([getHistorique(), getActiveProgramme()])
      setItems(its)
      if (prog) { setProgNom(prog.nom); setBlocs(await getBlocs(prog.id)) }
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="boot">Chargement…</div>

  // --- en-tête : bloc courant + n° de semaine dans le programme ---
  const today = todayISO()
  const blocFor = (iso: string): Bloc | null =>
    blocs.find(b => (!b.debut || b.debut <= iso) && (!b.fin || iso <= b.fin)) ?? null
  const currentBloc = blocFor(today)
  let weekChip = ''
  const debuts = blocs.map(b => b.debut).filter(Boolean) as string[]
  const fins = blocs.map(b => b.fin).filter(Boolean) as string[]
  if (debuts.length && fins.length) {
    const start = debuts.sort()[0]
    const end = fins.sort()[fins.length - 1]
    const total = Math.max(1, Math.ceil((daysBetween(start, end) + 1) / 7))
    const cur = Math.min(total, Math.max(1, Math.floor(daysBetween(start, today) / 7) + 1))
    weekChip = `Semaine ${cur} / ${total}`
  }

  // --- regroupement par semaine ---
  const thisMon = isoDate(mondayOfISO(today))
  const lastMon = addDays(thisMon, -7)
  const groups: Record<string, HistoItem[]> = {}
  for (const it of items) {
    const ref = it.seance?.jour ?? it.fait_le.slice(0, 10)
    const key = isoDate(mondayOfISO(ref))
    ;(groups[key] ??= []).push(it)
  }
  const weekKeys = Object.keys(groups).sort().reverse()
  const weekLabel = (key: string) =>
    key === thisMon ? 'Cette semaine'
      : key === lastMon ? 'Semaine dernière'
        : `Semaine du ${shortDate(key)}`

  return (
    <div className="screen">
      <div className="appbar">
        <div className="eyebrow">Historique</div>
        {(currentBloc || weekChip) && (
          <div className="phase-chip">
            {currentBloc ? currentBloc.nom : progNom}{weekChip ? ` · ${weekChip}` : ''}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty">Aucune séance enregistrée pour l’instant.<br />
          <span className="hint">Termine une séance pour la voir apparaître ici.</span>
        </div>
      ) : weekKeys.map(key => {
        const bloc = blocFor(key)
        return (
          <div key={key}>
            <div className="wk-sep">
              <span>{weekLabel(key)}</span>
              {bloc && <span className="wk-bloc">{bloc.nom}</span>}
            </div>
            {groups[key].map(it => {
              const ref = it.seance?.jour ?? it.fait_le.slice(0, 10)
              const chip = dateChip(ref)
              const badge = statusBadge(it.seance?.statut)
              return (
                <div key={it.id} className="hist">
                  <div className="hist-date"><b>{chip.d}</b>{chip.m}</div>
                  <div className="hist-body">
                    <div className="hist-nm">
                      {NATURE_ICON[it.seance?.nature ?? 'autre'] ?? '•'} {it.seance?.nom ?? 'Séance'}
                    </div>
                    <div className="hist-mt">
                      {it.nbSeries} série{it.nbSeries > 1 ? 's' : ''}
                      {it.ressenti ? ` · ressenti ${it.ressenti}/5` : ''}
                    </div>
                    {it.note && <div className="hist-note">{it.note}</div>}
                  </div>
                  <div className={'hist-badge ' + badge.cls}>{badge.txt}</div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}