import { supabase } from '../lib/supabase'
import type { SeancePlanifiee, Mesure, SeanceRealisee, Programme, Bloc } from '../lib/types'
import { weekBoundsISO } from '../lib/dates'

// ================= SÉANCES =================

// Séance planifiée d'un JOUR précis (pour la navigation Jour).
export async function getSessionForDay(jour: string): Promise<SeancePlanifiee | null> {
  const { data, error } = await supabase
    .from('seances_planifiees')
    .select('*, exos_planifies(*, exercices(nom, unite, consignes))')
    .eq('jour', jour)
    .order('jour', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) { console.error(error); return null }
  if (!data) return null
  data.exos_planifies?.sort((a: any, b: any) => a.ordre - b.ordre)
  return data as SeancePlanifiee
}

// Séances d'une semaine donnée (contenant `iso`).
export async function getWeekSessions(iso: string): Promise<SeancePlanifiee[]> {
  const { monday, sunday } = weekBoundsISO(iso)
  const { data, error } = await supabase
    .from('seances_planifiees')
    .select('*')
    .gte('jour', monday).lte('jour', sunday)
    .order('jour', { ascending: true })
  if (error) { console.error(error); return [] }
  return (data ?? []) as SeancePlanifiee[]
}

// ================= PROGRAMMES / BLOCS =================

export async function getProgrammes(): Promise<Programme[]> {
  const { data, error } = await supabase
    .from('programmes').select('id, nom, objectif')
    .order('ordre', { ascending: true })
  if (error) { console.error(error); return [] }
  return (data ?? []) as Programme[]
}

export async function getBlocs(programmeId: string): Promise<Bloc[]> {
  const { data, error } = await supabase
    .from('blocs').select('id, nom, intention, debut, fin, ordre')
    .eq('programme_id', programmeId).order('ordre', { ascending: true })
  if (error) { console.error(error); return [] }
  return (data ?? []) as Bloc[]
}

// ================= RÉALISÉ SÉANCE =================

export async function getRealizedForSeance(planifieeId: string): Promise<SeanceRealisee | null> {
  const { data, error } = await supabase
    .from('seances_realisees').select('*, series_realisees(*)')
    .eq('planifiee_id', planifieeId).maybeSingle()
  if (error) { console.error(error); return null }
  return (data as SeanceRealisee) ?? null
}

async function ensureSeanceRealisee(planifieeId: string): Promise<string | null> {
  const found = await supabase
    .from('seances_realisees').select('id').eq('planifiee_id', planifieeId).maybeSingle()
  if (found.data?.id) return found.data.id
  const ins = await supabase
    .from('seances_realisees').insert({ planifiee_id: planifieeId }).select('id').single()
  if (ins.error) { console.error(ins.error); return null }
  return ins.data.id
}

export interface SerieInput {
  exoPlanifieId: string
  ordre: number
  reps: number | null
  charge: number | null
  duree_s: number | null
}

export async function saveRealizedSeries(planifieeId: string, series: SerieInput[]): Promise<boolean> {
  const seanceRealId = await ensureSeanceRealisee(planifieeId)
  if (!seanceRealId) return false
  const del = await supabase.from('series_realisees').delete().eq('seance_real_id', seanceRealId)
  if (del.error) { console.error(del.error); return false }
  if (series.length === 0) return true
  const rows = series.map(s => ({
    seance_real_id: seanceRealId, exo_planifie_id: s.exoPlanifieId,
    ordre: s.ordre, reps: s.reps, charge: s.charge, duree_s: s.duree_s
  }))
  const ins = await supabase.from('series_realisees').insert(rows)
  if (ins.error) { console.error(ins.error); return false }
  return true
}

// Termine une séance. Le statut est déduit automatiquement :
// - toutes les séries prévues cochées  -> 'faite'
// - au moins une cochée, mais pas toutes -> 'partielle'
// - aucune cochée -> 'partielle' aussi (séance ouverte mais vide ; on ne met jamais
//   'faite' à tort). Passe seriesPrevues=0 pour forcer 'faite' (séances sans séries).
export async function terminerSeance(
  planifieeId: string, ressenti: number | null, note: string | null,
  seriesPrevues = 0, seriesFaites = 0
): Promise<boolean> {
  const seanceRealId = await ensureSeanceRealisee(planifieeId)
  if (!seanceRealId) return false
  const statut = (seriesPrevues > 0 && seriesFaites < seriesPrevues) ? 'partielle' : 'faite'
  const u1 = await supabase.from('seances_realisees')
    .update({ ressenti, note, fait_le: new Date().toISOString() }).eq('id', seanceRealId)
  const u2 = await supabase.from('seances_planifiees')
    .update({ statut }).eq('id', planifieeId)
  if (u1.error) console.error(u1.error)
  if (u2.error) console.error(u2.error)
  return !u1.error && !u2.error
}

// Marque une séance planifiée comme "sautée" (non faite). Réversible.
export async function marquerSautee(planifieeId: string): Promise<boolean> {
  const { error } = await supabase.from('seances_planifiees')
    .update({ statut: 'sautee' }).eq('id', planifieeId)
  if (error) console.error(error)
  return !error
}

// Réinitialise une séance sautée en "à venir".
export async function reactiverSeance(planifieeId: string): Promise<boolean> {
  const { error } = await supabase.from('seances_planifiees')
    .update({ statut: 'a_venir' }).eq('id', planifieeId)
  if (error) console.error(error)
  return !error
}

// ================= DÉPLACER / COPIER UNE SÉANCE =================

// Y a-t-il déjà une séance à ce jour ? (pour l'avertissement)
export async function jourOccupe(jour: string, saufId?: string): Promise<boolean> {
  let q = supabase.from('seances_planifiees').select('id').eq('jour', jour)
  if (saufId) q = q.neq('id', saufId)
  const { data } = await q.limit(1)
  return (data?.length ?? 0) > 0
}

// Déplace une séance vers un nouveau jour. GARDE la clé (lien import préservé).
export async function deplacerSeance(planifieeId: string, nouveauJour: string): Promise<boolean> {
  const { error } = await supabase.from('seances_planifiees')
    .update({ jour: nouveauJour }).eq('id', planifieeId)
  if (error) console.error(error)
  return !error
}

// Génère une clé de copie unique, dérivée de la nouvelle date.
async function cleCopieUnique(base: string): Promise<string> {
  // base ex. "sea-2026-07-28-muscu-a" ; si prise, suffixe -2, -3...
  const exists = async (c: string) => {
    const { data } = await supabase.from('seances_planifiees').select('id').eq('cle', c).limit(1)
    return (data?.length ?? 0) > 0
  }
  if (!(await exists(base))) return base
  let n = 2
  while (await exists(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// slug simple pour reconstruire une clé lisible
function slug(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Copie une séance VIERGE (exos + cibles, sans réalisé) vers un nouveau jour.
// L'originale reste intacte. Nouvelle clé dérivée de la date.
export async function copierSeanceVierge(planifieeId: string, nouveauJour: string): Promise<boolean> {
  // 1) charger l'originale + ses exos
  const { data: orig, error: e1 } = await supabase
    .from('seances_planifiees')
    .select('nom, nature, etiquette, duree_min, distance_km, denivele_m, exos_planifies(exercice_id, ordre, cible, note_coach)')
    .eq('id', planifieeId).single()
  if (e1 || !orig) { console.error(e1); return false }

  // 2) nouvelle clé lisible et unique
  const base = `sea-${nouveauJour}-${slug(orig.nom)}`
  const cle = await cleCopieUnique(base)

  // 3) créer la nouvelle séance (statut à venir, pas de réalisé)
  const { data: nouv, error: e2 } = await supabase.from('seances_planifiees').insert({
    cle, modele_id: null, nom: orig.nom, nature: orig.nature, jour: nouveauJour,
    etiquette: orig.etiquette ?? 'fixe', statut: 'a_venir',
    duree_min: orig.duree_min ?? null, distance_km: orig.distance_km ?? null, denivele_m: orig.denivele_m ?? null
  }).select('id').single()
  if (e2 || !nouv) { console.error(e2); return false }

  // 4) copier les exos (avec cibles), nouvelles clés dérivées
  const exos = (orig.exos_planifies ?? []) as any[]
  if (exos.length) {
    const rows = exos.map((ex, i) => ({
      cle: `${cle}-${ex.ordre ?? i + 1}`,
      seance_id: nouv.id, exercice_id: ex.exercice_id,
      ordre: ex.ordre ?? i + 1, cible: ex.cible, note_coach: ex.note_coach ?? null
    }))
    const { error: e3 } = await supabase.from('exos_planifies').insert(rows)
    if (e3) { console.error(e3); return false }
  }
  return true
}

// ================= SUIVI : POIDS =================

export async function getWeightSeries(): Promise<Mesure[]> {
  const { data, error } = await supabase
    .from('mesures').select('*').eq('type', 'poids').order('jour', { ascending: true })
  if (error) { console.error(error); return [] }
  return (data ?? []) as Mesure[]
}

export async function getWeightForDay(jour: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('mesures').select('valeur').eq('type', 'poids').eq('jour', jour).maybeSingle()
  if (error) { console.error(error); return null }
  return data?.valeur ?? null
}

export async function getLatestWeight(): Promise<number | null> {
  const { data, error } = await supabase
    .from('mesures').select('valeur').eq('type', 'poids')
    .order('jour', { ascending: false }).limit(1).maybeSingle()
  if (error) { console.error(error); return null }
  return data?.valeur ?? null
}

export async function saveWeight(valeur: number, jour: string): Promise<boolean> {
  const found = await supabase
    .from('mesures').select('id').eq('type', 'poids').eq('jour', jour).maybeSingle()
  if (found.data?.id) {
    const { error } = await supabase.from('mesures').update({ valeur }).eq('id', found.data.id)
    if (error) console.error(error); return !error
  }
  const { error } = await supabase.from('mesures').insert({ type: 'poids', valeur, jour })
  if (error) console.error(error); return !error
}

// ================= SUIVI : RESSENTI =================

export async function getRessentiForDay(jour: string): Promise<{ fatigue: number | null; forme: number | null } | null> {
  const { data, error } = await supabase
    .from('ressentis').select('fatigue, forme').eq('jour', jour).maybeSingle()
  if (error) { console.error(error); return null }
  return data ?? null
}

export async function saveRessenti(fatigue: number | null, forme: number | null, jour: string): Promise<boolean> {
  const found = await supabase.from('ressentis').select('id').eq('jour', jour).maybeSingle()
  if (found.data?.id) {
    const { error } = await supabase.from('ressentis').update({ fatigue, forme }).eq('id', found.data.id)
    if (error) console.error(error); return !error
  }
  const { error } = await supabase.from('ressentis').insert({ fatigue, forme, jour })
  if (error) console.error(error); return !error
}

// ================= OBJECTIFS (Bloc D) =================

export interface Cible {
  id: string
  indicateur: string
  exercice_id: string | null
  valeur: number
  unite: string | null
  sens: 'hausse' | 'baisse'
  type: 'phase' | 'horizon'
  echeance: string | null
}

export async function getCibles(): Promise<Cible[]> {
  const { data, error } = await supabase
    .from('cibles').select('id, indicateur, exercice_id, valeur, unite, sens, type, echeance')
    .eq('actif', true)
  if (error) { console.error(error); return [] }
  return (data ?? []) as Cible[]
}

// ================= HISTORIQUE (Bloc E) =================

export interface HistoItem {
  id: string
  fait_le: string
  ressenti: number | null
  note: string | null
  seance: { nom: string; nature: string; jour: string; statut: string } | null
  nbSeries: number
}

export async function getHistorique(): Promise<HistoItem[]> {
  const { data, error } = await supabase
    .from('seances_realisees')
    .select('id, fait_le, ressenti, note, series_realisees(id), seances_planifiees(nom, nature, jour, statut)')
    .order('fait_le', { ascending: false })
    .limit(50)
  if (error) { console.error(error); return [] }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    fait_le: r.fait_le,
    ressenti: r.ressenti,
    note: r.note,
    seance: r.seances_planifiees ?? null,
    nbSeries: r.series_realisees?.length ?? 0
  })) as HistoItem[]
}

// Programme actif (pour l'en-tête de l'historique)
export async function getActiveProgramme(): Promise<{ id: string; nom: string } | null> {
  const { data, error } = await supabase
    .from('programmes').select('id, nom').eq('actif', true).order('ordre').limit(1).maybeSingle()
  if (error) { console.error(error); return null }
  return (data as { id: string; nom: string }) ?? null
}

// ================= ÉVOLUTION (Bloc G) =================

export interface PointSerie { jour: string; valeur: number }
export interface ExoProgress {
  exercice_id: string
  nom: string
  unite: string
  nbSeances: number
  points: PointSerie[]
}

export async function getExoProgressions(): Promise<ExoProgress[]> {
  const { data, error } = await supabase
    .from('series_realisees')
    .select('reps, charge, duree_s, exos_planifies(exercice_id, exercices(nom, unite)), seances_realisees(fait_le, seances_planifiees(jour))')
  if (error) { console.error(error); return [] }

  const map = new Map<string, ExoProgress & { byDay: Map<string, number> }>()

  for (const row of (data ?? []) as any[]) {
    const exo = row.exos_planifies
    const exId = exo?.exercice_id
    if (!exId) continue
    const nom = exo?.exercices?.nom ?? 'Exercice'
    const unite = exo?.exercices?.unite ?? 'reps_charge'
    const jour = row.seances_realisees?.seances_planifiees?.jour
      ?? (row.seances_realisees?.fait_le ?? '').slice(0, 10)
    if (!jour) continue

    const val = row.charge != null ? Number(row.charge)
      : row.reps != null ? Number(row.reps)
      : row.duree_s != null ? Number(row.duree_s)
      : null
    if (val == null) continue

    if (!map.has(exId)) {
      map.set(exId, { exercice_id: exId, nom, unite, nbSeances: 0, points: [], byDay: new Map() })
    }
    const e = map.get(exId)!
    const prev = e.byDay.get(jour)
    if (prev == null || val > prev) e.byDay.set(jour, val)
  }

  const out: ExoProgress[] = []
  for (const e of map.values()) {
    const points = [...e.byDay.entries()]
      .map(([jour, valeur]) => ({ jour, valeur }))
      .sort((a, b) => a.jour.localeCompare(b.jour))
    out.push({ exercice_id: e.exercice_id, nom: e.nom, unite: e.unite, nbSeances: points.length, points })
  }
  out.sort((a, b) => b.nbSeances - a.nbSeances)
  return out
}

// ================= SUIVI : SOMMEIL =================

export interface Sommeil {
  jour: string
  heure_coucher: string | null
  heure_reveil: string | null
  duree_h: number | null
}

export function dureeSommeil(coucher: string, reveil: string): number {
  const [hc, mc] = coucher.split(':').map(Number)
  const [hr, mr] = reveil.split(':').map(Number)
  let mins = (hr * 60 + mr) - (hc * 60 + mc)
  if (mins < 0) mins += 24 * 60
  return Math.round((mins / 60) * 100) / 100
}

export async function getSommeilForDay(jour: string): Promise<Sommeil | null> {
  const { data, error } = await supabase
    .from('sommeil').select('jour, heure_coucher, heure_reveil, duree_h')
    .eq('jour', jour).maybeSingle()
  if (error) { console.error(error); return null }
  return (data as Sommeil) ?? null
}

export async function saveSommeil(
  jour: string, coucher: string, reveil: string
): Promise<boolean> {
  const duree_h = dureeSommeil(coucher, reveil)
  const found = await supabase.from('sommeil').select('id').eq('jour', jour).maybeSingle()
  const payload = { jour, heure_coucher: coucher, heure_reveil: reveil, duree_h }
  if (found.data?.id) {
    const { error } = await supabase.from('sommeil').update(payload).eq('id', found.data.id)
    if (error) console.error(error); return !error
  }
  const { error } = await supabase.from('sommeil').insert(payload)
  if (error) console.error(error); return !error
}

export async function getSommeilSeries(): Promise<{ jour: string; valeur: number }[]> {
  const { data, error } = await supabase
    .from('sommeil').select('jour, duree_h').not('duree_h', 'is', null).order('jour', { ascending: true })
  if (error) { console.error(error); return [] }
  return (data ?? []).map((r: any) => ({ jour: r.jour, valeur: Number(r.duree_h) }))
}
