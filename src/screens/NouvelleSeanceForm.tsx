import { useEffect, useState } from 'react'
import { createSeance, getBlocsManage } from '../data/manage'
import type { Bloc } from '../lib/types'
import { todayISO } from '../lib/dates'

const NATURES = ['muscu', 'course', 'velo', 'basket', 'mobilite', 'autre']

// Formulaire de création de séance à la volée (déplié dans Gérer)
export function NouvelleSeanceForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [blocs, setBlocs] = useState<Bloc[]>([])
  const [nom, setNom] = useState('')
  const [nature, setNature] = useState('muscu')
  const [jour, setJour] = useState(todayISO())
  const [etiquette, setEtiquette] = useState('fixe')
  const [duree, setDuree] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) getBlocsManage().then(setBlocs) }, [open])

  async function create() {
    if (!nom.trim()) return
    setBusy(true)
    await createSeance({
      nom: nom.trim(), nature, jour, etiquette,
      duree_min: duree ? Number(duree) : null
    })
    setBusy(false); setNom(''); setDuree(''); setOpen(false)
    onCreated()
  }

  if (!open) {
    return <button className="add-seance-btn" onClick={() => setOpen(true)}>+ Nouvelle séance</button>
  }

  return (
    <div className="new-seance">
      <div className="ns-title">Nouvelle séance</div>
      <input className="m-in" value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom (ex. Basket, Muscu A…)" />
      <div className="m-line">
        <select className="m-in" value={nature} onChange={e => setNature(e.target.value)}>
          {NATURES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select className="m-in" value={etiquette} onChange={e => setEtiquette(e.target.value)}>
          <option value="fixe">fixe</option><option value="option">option</option>
        </select>
      </div>
      <div className="m-line">
        <input className="m-in" type="date" value={jour} onChange={e => setJour(e.target.value)} />
        <input className="m-in" inputMode="numeric" value={duree} onChange={e => setDuree(e.target.value)} placeholder="Durée (min)" />
      </div>
      {blocs.length > 0 && (
        <div className="ns-hint">
          Rattachement au bloc : automatique selon la date ({blocs.length} bloc{blocs.length > 1 ? 's' : ''} défini{blocs.length > 1 ? 's' : ''}).
        </div>
      )}
      <div className="m-actions">
        <button className="m-save" disabled={busy || !nom.trim()} onClick={create}>
          {busy ? 'Création…' : 'Créer la séance'}
        </button>
        <button className="m-cancel" onClick={() => setOpen(false)}>Annuler</button>
      </div>
      <div className="ns-note">Tu pourras ajouter ses exercices via le bouton « Exos » une fois créée.</div>
    </div>
  )
}