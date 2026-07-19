import { supabase } from '../lib/supabase'

// ============================================================
//  Export du réalisé entre deux dates (JSON riche + CSV plat)
// ============================================================

export interface ExportData {
  format: 'athlete-export/v1'
  periode: { debut: string; fin: string }
  genere_le: string
  seances: any[]
  poids: { jour: string; valeur: number }[]
  ressentis: { jour: string; fatigue: number | null; forme: number | null }[]
}

// Récupère tout le réalisé de la période.
export async function buildExport(debut: string, fin: string): Promise<ExportData> {
  // séances réalisées de la période (via la date de la séance planifiée)
  const { data: seances } = await supabase
    .from('seances_realisees')
    .select(`
      fait_le, ressenti, note,
      seances_planifiees!inner(cle, nom, nature, jour, etiquette, statut),
      series_realisees(ordre, reps, charge, duree_s, exos_planifies(ordre, exercices(nom, cle)))
    `)
    .gte('seances_planifiees.jour', debut)
    .lte('seances_planifiees.jour', fin)
    .order('fait_le', { ascending: true })

  const { data: poids } = await supabase
    .from('mesures').select('jour, valeur').eq('type', 'poids')
    .gte('jour', debut).lte('jour', fin).order('jour')

  const { data: ressentis } = await supabase
    .from('ressentis').select('jour, fatigue, forme')
    .gte('jour', debut).lte('jour', fin).order('jour')

  // mise en forme lisible des séances
  const seancesOut = (seances ?? []).map((s: any) => {
    const sp = s.seances_planifiees
    const series = (s.series_realisees ?? [])
      .sort((a: any, b: any) => (a.ordre ?? 0) - (b.ordre ?? 0))
      .map((sr: any) => ({
        exercice: sr.exos_planifies?.exercices?.nom ?? '?',
        exo_ref: sr.exos_planifies?.exercices?.cle ?? null,
        reps: sr.reps, charge: sr.charge, duree_s: sr.duree_s
      }))
    return {
      cle: sp?.cle, nom: sp?.nom, nature: sp?.nature, jour: sp?.jour,
      statut: sp?.statut, ressenti: s.ressenti, note: s.note, series
    }
  })

  return {
    format: 'athlete-export/v1',
    periode: { debut, fin },
    genere_le: new Date().toISOString(),
    seances: seancesOut,
    poids: (poids ?? []) as any,
    ressentis: (ressentis ?? []) as any
  }
}

// CSV plat : une ligne par série réalisée
export function toCSV(data: ExportData): string {
  const head = ['date', 'seance', 'nature', 'statut', 'exercice', 'serie', 'reps', 'charge_kg', 'duree_s', 'ressenti']
  const rows: string[][] = [head]
  for (const s of data.seances) {
    if (!s.series.length) {
      rows.push([s.jour, s.nom, s.nature, s.statut, '', '', '', '', '', s.ressenti ?? ''])
    }
    s.series.forEach((se: any, i: number) => {
      rows.push([
        s.jour, s.nom, s.nature, s.statut, se.exercice, String(i + 1),
        se.reps ?? '', se.charge ?? '', se.duree_s ?? '', s.ressenti ?? ''
      ])
    })
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\n')
}

function csvCell(v: any): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// déclenche un téléchargement navigateur
export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}