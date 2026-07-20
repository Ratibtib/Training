import { useEffect, useState } from 'react'
import {
  getExosDeSeance, getBibliotheque, updateExo, deleteExo, swapExosOrdre,
  addExoToSeance, createExercice, type ExoLigne, type ExerciceBib
} from '../data/manage'

export function ExoEditor({ seanceId }: { seanceId: string }) {
  const [exos, setExos] = useState<ExoLigne[]>([])
  const [bib, setBib] = useState<ExerciceBib[]>([])
  const [loading, setLoading] = useState(true)
  const [addSel, setAddSel] = useState('')
  const [creating, setCreating] = useState(false)
  const [newNom, setNewNom] = useState('')
  const [newUnite, setNewUnite] = useState('reps_charge')

  async function reload() {
    const [e, b] = await Promise.all([getExosDeSeance(seanceId), getBibliotheque()])
    setExos(e); setBib(b); setLoading(false)
  }
  useEffect(() => { reload() }, [seanceId])

  async function addFromBib() {
    if (!addSel) return
    const ordre = (exos[exos.length - 1]?.ordre ?? 0) + 1
    await addExoToSeance(seanceId, addSel, ordre); setAddSel(''); reload()
  }
  async function createAndAdd() {
    if (!newNom.trim()) return
    const id = await createExercice(newNom.trim(), newUnite)
    if (id) { const ordre = (exos[exos.length - 1]?.ordre ?? 0) + 1; await addExoToSeance(seanceId, id, ordre) }
    setNewNom(''); setCreating(false); reload()
  }

  if (loading) return <div className="exo-ed-load">Chargement des exos…</div>

  return (
    <div className="exo-ed">
      {exos.length === 0 && <div className="exo-ed-empty">Aucun exo. Ajoute-en un ci-dessous.</div>}
      {exos.map((exo, i) => (
        <ExoCard key={exo.id} exo={exo} first={i === 0} last={i === exos.length - 1}
          onUp={async () => { await swapExosOrdre(exo, exos[i - 1]); reload() }}
          onDown={async () => { await swapExosOrdre(exo, exos[i + 1]); reload() }}
          onDelete={async () => { if (confirm(`Retirer "${exo.exercice_nom}" ?`)) { await deleteExo(exo.id); reload() } }}
          onSaved={reload} />
      ))}
      <div className="exo-add">
        <div className="exo-add-row">
          <select className="m-in" value={addSel} onChange={e => setAddSel(e.target.value)}>
            <option value="">Ajouter depuis la bibliothèque…</option>
            {bib.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
          </select>
          <button className="m-save" onClick={addFromBib} disabled={!addSel}>+ Ajouter</button>
        </div>
        {!creating ? (
          <button className="exo-new-link" onClick={() => setCreating(true)}>+ Créer un nouvel exercice</button>
        ) : (
          <div className="exo-new">
            <input className="m-in" value={newNom} onChange={e => setNewNom(e.target.value)} placeholder="Nom de l'exercice" />
            <div className="m-line">
              <select className="m-in" value={newUnite} onChange={e => setNewUnite(e.target.value)}>
                <option value="reps_charge">reps + charge</option>
                <option value="temps">temps (gainage…)</option>
                <option value="distance">distance</option>
              </select>
              <button className="m-save" onClick={createAndAdd}>Créer + ajouter</button>
              <button className="m-cancel" onClick={() => setCreating(false)}>Annuler</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface SD { reps: string; charge: string }

function ExoCard({ exo, first, last, onUp, onDown, onDelete, onSaved }: {
  exo: ExoLigne; first: boolean; last: boolean
  onUp: () => void; onDown: () => void; onDelete: () => void; onSaved: () => void
}) {
  const c = exo.cible ?? {}
  const temps = exo.unite === 'temps' || c.duree_s != null

  // mode : global (par défaut) ou détaillé par série
  const [detail, setDetail] = useState<boolean>(Array.isArray(c.series_detail) && c.series_detail.length > 0)

  // valeurs globales
  const [series, setSeries] = useState(c.series ?? '')
  const [reps, setReps] = useState(c.reps ?? '')
  const [charge, setCharge] = useState(c.charge ?? '')
  const [duree, setDuree] = useState(c.duree_s ?? '')
  const [recup, setRecup] = useState(c.recup_s ?? '')
  const [objectif, setObjectif] = useState(c.objectif ?? '')
  const [note, setNote] = useState(exo.note_coach ?? '')
  const [saved, setSaved] = useState(false)

  // lignes détaillées
  const initLignes: SD[] = Array.isArray(c.series_detail) && c.series_detail.length
    ? c.series_detail.map((s: any) => ({ reps: s.reps ?? '', charge: s.charge ?? '' }))
    : Array.from({ length: Number(c.series) || 4 }, () => ({ reps: c.reps ?? '', charge: c.charge ?? '' }))
  const [lignes, setLignes] = useState<SD[]>(initLignes)

  const N = (v: any) => v === '' || v == null ? undefined : Number(v)

  function setLigne(i: number, patch: Partial<SD>) {
    setLignes(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l))
  }
  const addLigne = () => setLignes(prev => [...prev, { reps: '', charge: '' }])
  const removeLigne = (i: number) => setLignes(prev => prev.filter((_, j) => j !== i))

  async function save() {
    const cible: any = {}
    if (N(recup) != null) cible.recup_s = N(recup)
    if (objectif.trim()) cible.objectif = objectif.trim()

    if (temps) {
      if (N(series) != null) cible.series = N(series)
      if (N(duree) != null) cible.duree_s = N(duree)
    } else if (detail) {
      const sd = lignes
        .map(l => ({ reps: N(l.reps), charge: N(l.charge) }))
        .filter(l => l.reps != null || l.charge != null)
      cible.series = sd.length
      cible.series_detail = sd
    } else {
      if (N(series) != null) cible.series = N(series)
      if (N(reps) != null) cible.reps = N(reps)
      if (N(charge) != null) cible.charge = N(charge)
    }
    await updateExo(exo.id, { cible, note_coach: note || null })
    setSaved(true); setTimeout(() => setSaved(false), 1500); onSaved()
  }

  return (
    <div className="exo-card-ed">
      <div className="exo-card-top">
        <span className="exo-card-nm">{exo.exercice_nom}</span>
        <div className="exo-card-btns">
          <button className="ord-btn" disabled={first} onClick={onUp}>↑</button>
          <button className="ord-btn" disabled={last} onClick={onDown}>↓</button>
          <button className="m-del" onClick={onDelete}>✕</button>
        </div>
      </div>

      {temps ? (
        <div className="cible-grid">
          <Field label="Séries" v={series} set={setSeries} />
          <Field label="Durée (s)" v={duree} set={setDuree} />
          <Field label="Récup (s)" v={recup} set={setRecup} />
        </div>
      ) : (
        <>
          {!detail ? (
            <>
              <div className="cible-grid">
                <Field label="Séries" v={series} set={setSeries} />
                <Field label="Reps" v={reps} set={setReps} />
                <Field label="Charge" v={charge} set={setCharge} />
                <Field label="Récup" v={recup} set={setRecup} />
              </div>
              <button className="detail-toggle" onClick={() => setDetail(true)}>
                Détailler par série (pyramide…)
              </button>
            </>
          ) : (
            <>
              <div className="sd-head">
                <span>Détail par série</span>
                <button className="detail-toggle small" onClick={() => setDetail(false)}>Revenir au simple</button>
              </div>
              {lignes.map((l, i) => (
                <div key={i} className="sd-row">
                  <span className="sd-idx">S{i + 1}</span>
                  <label className="fld"><input inputMode="numeric" value={l.reps}
                    onChange={e => setLigne(i, { reps: e.target.value })} placeholder="reps" /><span>reps</span></label>
                  <label className="fld"><input inputMode="decimal" value={l.charge}
                    onChange={e => setLigne(i, { charge: e.target.value })} placeholder="kg" /><span>kg</span></label>
                  <button className="sd-del" onClick={() => removeLigne(i)}>✕</button>
                </div>
              ))}
              <button className="sd-add" onClick={addLigne}>+ Ajouter une série</button>
              <div className="cible-grid" style={{ marginTop: 8 }}>
                <Field label="Récup (s)" v={recup} set={setRecup} />
              </div>
            </>
          )}
        </>
      )}

      <input className="m-in" value={objectif} onChange={e => setObjectif(e.target.value)}
        placeholder="Objectif libre (ex. max strict) — optionnel" />
      <input className="m-in" value={note} onChange={e => setNote(e.target.value)}
        placeholder="Note coach — optionnel" />
      <button className="m-save" onClick={save}>{saved ? 'Enregistré ✓' : 'Enregistrer l’exo'}</button>
    </div>
  )
}

function Field({ label, v, set }: { label: string; v: any; set: (x: string) => void }) {
  return (
    <label className="cible-field">
      <span>{label}</span>
      <input className="m-in" inputMode="numeric" value={v} onChange={e => set(e.target.value)} />
    </label>
  )
}