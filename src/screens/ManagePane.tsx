import { useState } from 'react'
import {
  getManagedSeances, updateSeanceMeta, deleteSeance, deleteSeancesRange,
  getBlocsManage, updateBloc, deleteBloc, type ManagedSeance
} from '../data/manage'
import type { Bloc } from '../lib/types'
import { todayISO, addDays } from '../lib/dates'
import { ExoEditor } from './ExoEditor'
import { NouvelleSeanceForm } from './NouvelleSeanceForm'

const NATURE_ICON: Record<string, string> = {
  muscu: '🏋', course: '🏃', velo: '🚴', basket: '🏀', mobilite: '🧘', autre: '•'
}

export function ManagePane() {
  const [debut, setDebut] = useState(todayISO())
  const [fin, setFin] = useState(addDays(todayISO(), 30))
  const [seances, setSeances] = useState<ManagedSeance[] | null>(null)
  const [blocs, setBlocs] = useState<Bloc[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  async function charger() {
    setMsg(null)
    setSeances(await getManagedSeances(debut, fin))
    setBlocs(await getBlocsManage())
  }

  async function purge() {
    if (!confirm(`Supprimer toutes les séances NON réalisées entre ${debut} et ${fin} ?`)) return
    const n = await deleteSeancesRange(debut, fin)
    setMsg(`${n} séance(s) supprimée(s).`)
    await charger()
  }

  return (
    <>
      <div className="section-label">Période à gérer</div>
      <div className="date-range">
        <label className="dr-field"><span>Du</span>
          <input type="date" value={debut} max={fin} onChange={e => setDebut(e.target.value)} /></label>
        <label className="dr-field"><span>Au</span>
          <input type="date" value={fin} min={debut} onChange={e => setFin(e.target.value)} /></label>
      </div>
      <div className="admin-actions">
        <button className="primary" onClick={charger}>Charger la période</button>
      </div>

      {msg && <div className="imp-report"><div className="imp-ok">✓ {msg}</div></div>}

      {seances && (
        <>
          <NouvelleSeanceForm onCreated={charger} />
          <div className="section-label">Séances ({seances.length})</div>
          {seances.length === 0 && <div className="empty">Aucune séance sur la période.</div>}
          {seances.map(s => <SeanceRow key={s.id} s={s} onChange={charger} />)}

          {seances.some(s => !s.hasRealise) && (
            <button className="danger-btn" onClick={purge}>
              Supprimer les séances non réalisées de la période
            </button>
          )}

          <div className="section-label">Blocs</div>
          {blocs.map(b => <BlocRow key={b.id} b={b} onChange={charger} />)}
        </>
      )}
    </>
  )
}

function SeanceRow({ s, onChange }: { s: ManagedSeance; onChange: () => void }) {
  const [edit, setEdit] = useState(false)
  const [showExos, setShowExos] = useState(false)
  const [nom, setNom] = useState(s.nom)
  const [jour, setJour] = useState(s.jour)
  const [etiq, setEtiq] = useState(s.etiquette)

  async function save() {
    await updateSeanceMeta(s.id, { nom, jour, etiquette: etiq })
    setEdit(false); onChange()
  }
  async function del() {
    const avert = s.hasRealise
      ? `⚠️ La séance "${s.nom}" du ${s.jour} contient des DONNÉES RÉALISÉES (séries saisies, ressenti) qui seront DÉFINITIVEMENT perdues.\n\nSupprimer quand même ?`
      : `Supprimer la séance "${s.nom}" du ${s.jour} ?`
    if (!confirm(avert)) return
    const ok = await deleteSeance(s.id)
    if (!ok) alert('Erreur à la suppression — réessaie.')
    onChange()
  }

  if (edit) {
    return (
      <div className="mrow editing">
        <input className="m-in" value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom" />
        <div className="m-line">
          <input className="m-in" type="date" value={jour} onChange={e => setJour(e.target.value)} />
          <select className="m-in" value={etiq} onChange={e => setEtiq(e.target.value)}>
            <option value="fixe">fixe</option><option value="option">option</option>
          </select>
        </div>
        <div className="m-actions">
          <button className="m-save" onClick={save}>Enregistrer</button>
          <button className="m-cancel" onClick={() => setEdit(false)}>Annuler</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mrow">
        <div className="mrow-main">
          <div className="mrow-nm">{NATURE_ICON[s.nature] ?? '•'} {s.nom}</div>
          <div className="mrow-mt">{s.jour} · {s.etiquette}{s.hasRealise ? ' · réalisée' : ''}</div>
        </div>
        {s.hasRealise && <span className="mrow-real">●</span>}
        <button className={'m-edit' + (showExos ? ' on' : '')} onClick={() => setShowExos(v => !v)}>Exos</button>
        <button className="m-edit" onClick={() => setEdit(true)}>Éditer</button>
        <button className="m-del" onClick={del}>✕</button>
      </div>
      {showExos && <ExoEditor seanceId={s.id} />}
    </>
  )
}

function BlocRow({ b, onChange }: { b: Bloc; onChange: () => void }) {
  const [nom, setNom] = useState(b.nom)
  const [intention, setIntention] = useState(b.intention ?? '')
  const [debut, setDebut] = useState(b.debut ?? '')
  const [fin, setFin] = useState(b.fin ?? '')

  async function save() {
    await updateBloc(b.id, { nom, intention: intention || null, debut: debut || null, fin: fin || null })
    onChange()
  }
  async function del() {
    if (!confirm(`Supprimer le bloc "${b.nom}" ? (ses séances liées ne sont pas supprimées)`)) return
    await deleteBloc(b.id); onChange()
  }

  return (
    <div className="mrow bloc-edit">
      <input className="m-in" value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom du bloc" />
      <textarea className="m-in" value={intention} onChange={e => setIntention(e.target.value)}
        placeholder="Intention" rows={2} />
      <div className="m-line">
        <input className="m-in" type="date" value={debut} onChange={e => setDebut(e.target.value)} />
        <input className="m-in" type="date" value={fin} onChange={e => setFin(e.target.value)} />
      </div>
      <div className="m-actions">
        <button className="m-save" onClick={save}>Enregistrer</button>
        <button className="m-del-txt" onClick={del}>Supprimer le bloc</button>
      </div>
    </div>
  )
}