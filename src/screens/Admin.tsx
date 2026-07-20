import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { importJSON, type ImportReport } from '../data/import'
import { buildExport, toCSV, download } from '../data/export'
import { ManagePane } from './ManagePane'
import { todayISO, addDays } from '../lib/dates'

type Onglet = 'import' | 'export' | 'gerer'

export function Admin() {
  const { signOut } = useAuth()
  const [ong, setOng] = useState<Onglet>('gerer')

  return (
    <div className="screen">
      <div className="appbar">
        <div className="eyebrow">Admin</div>
        <button className="link" onClick={signOut}>Déconnexion</button>
      </div>

      <div className="seg">
        <button className={'seg-btn' + (ong === 'gerer' ? ' on' : '')} onClick={() => setOng('gerer')}>Gérer</button>
        <button className={'seg-btn' + (ong === 'export' ? ' on' : '')} onClick={() => setOng('export')}>Export</button>
        <button className={'seg-btn' + (ong === 'import' ? ' on' : '')} onClick={() => setOng('import')}>Import</button>
      </div>

      {ong === 'import' && <ImportPane />}
      {ong === 'export' && <ExportPane />}
      {ong === 'gerer' && <ManagePane />}
    </div>
  )
}

// ---------- IMPORT ----------
function ImportPane() {
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<ImportReport | null>(null)

  async function run() {
    setBusy(true); setReport(null)
    setReport(await importJSON(raw)); setBusy(false)
  }
  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return; setRaw(await f.text())
  }

  return (
    <>
      <div className="section-label">Coller un JSON (format athlete-import/v1)</div>
      <textarea className="json-box" value={raw} spellCheck={false}
        placeholder='{ "format": "athlete-import/v1", "seances": [ ... ] }'
        onChange={e => setRaw(e.target.value)} />
      <div className="admin-actions">
        <label className="file-btn">Charger un fichier…
          <input type="file" accept="application/json,.json" onChange={pickFile} hidden />
        </label>
        <button className="primary" disabled={busy || !raw.trim()} onClick={run}>
          {busy ? 'Import…' : 'Importer'}
        </button>
      </div>
      {report && <Report r={report} />}
    </>
  )
}

function Report({ r }: { r: ImportReport }) {
  if (!r.ok) return <div className="imp-err">⚠︎ {r.erreurGlobale}</div>
  const line = (label: string, c: { crees: number; majs: number }) =>
    (c.crees || c.majs) ? <li key={label}>{label} : <b>{c.crees}</b> créés · <b>{c.majs}</b> maj</li> : null
  return (
    <div className="imp-report">
      <div className="imp-ok">✓ Import terminé</div>
      <ul>
        {line('Programmes', r.programmes)}{line('Blocs', r.blocs)}
        {line('Exercices', r.exercices)}{line('Cibles', r.cibles)}
        <li>Séances : <b>{r.seances.crees}</b> créées · <b>{r.seances.majs}</b> maj</li>
      </ul>
      {r.seances.ignorees.length > 0 && (
        <div className="imp-block warn"><div className="imp-h">Ignorées (déjà réalisées)</div>
          <ul>{r.seances.ignorees.map(c => <li key={c}>{c}</li>)}</ul></div>
      )}
      {r.seances.rejetees.length > 0 && (
        <div className="imp-block bad"><div className="imp-h">Rejetées (ancrage introuvable)</div>
          <ul>{r.seances.rejetees.map((x, i) => <li key={i}>{x.cle} — {x.raison}</li>)}</ul></div>
      )}
    </div>
  )
}

// ---------- EXPORT ----------
function ExportPane() {
  const [debut, setDebut] = useState(addDays(todayISO(), -30))
  const [fin, setFin] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [resume, setResume] = useState<string | null>(null)

  async function go(fmt: 'json' | 'csv') {
    setBusy(true); setResume(null)
    const data = await buildExport(debut, fin)
    const stamp = `${debut}_${fin}`
    if (fmt === 'json') {
      download(`realise_${stamp}.json`, JSON.stringify(data, null, 2), 'application/json')
    } else {
      download(`realise_${stamp}.csv`, toCSV(data), 'text/csv')
    }
    const nbSeries = data.seances.reduce((n, s) => n + s.series.length, 0)
    setResume(`${data.seances.length} séance(s) · ${nbSeries} série(s) · ${data.poids.length} pesée(s) · ${data.ressentis.length} ressenti(s)`)
    setBusy(false)
  }

  return (
    <>
      <div className="section-label">Période à exporter</div>
      <div className="date-range">
        <label className="dr-field"><span>Du</span>
          <input type="date" value={debut} max={fin} onChange={e => setDebut(e.target.value)} /></label>
        <label className="dr-field"><span>Au</span>
          <input type="date" value={fin} min={debut} max={todayISO()} onChange={e => setFin(e.target.value)} /></label>
      </div>

      <div className="admin-actions">
        <button className="file-btn" disabled={busy} onClick={() => go('csv')}>Exporter CSV</button>
        <button className="primary" disabled={busy} onClick={() => go('json')}>Exporter JSON</button>
      </div>

      {resume && <div className="imp-report"><div className="imp-ok">✓ Fichier généré</div>
        <ul><li>{resume}</li></ul>
        <p className="hint" style={{ marginTop: 6 }}>JSON = ré-analyse par un agent · CSV = ouverture tableur.</p>
      </div>}
    </>
  )
}