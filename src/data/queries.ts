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

export async function terminerSeance(
  planifieeId: string, ressenti: number | null, note: string | null
): Promise<boolean> {
  const seanceRealId = await ensureSeanceRealisee(planifieeId)
  if (!seanceRealId) return false
  const u1 = await supabase.from('seances_realisees')
    .update({ ressenti, note, fait_le: new Date().toISOString() }).eq('id', seanceRealId)
  const u2 = await supabase.from('seances_planifiees')
    .update({ statut: 'faite' }).eq('id', planifieeId)
  if (u1.error) console.error(u1.error)
  if (u2.error) console.error(u2.error)
  return !u1.error && !u2.error
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
  points: PointSerie[]   // meilleure valeur par jour (charge, ou reps si pas de charge, ou durée)
}

// Courbe de poids (déjà: getWeightSeries renvoie les mesures)
// -> on la réutilise côté écran.

// Progression par exercice, calculée depuis le réalisé.
// Pour chaque exo réalisé : on prend, par jour, la meilleure série
// (charge max, sinon reps max, sinon durée max).
export async function getExoProgressions(): Promise<ExoProgress[]> {
  const { data, error } = await supabase
    .from('series_realisees')
    .select('reps, charge, duree_s, exos_planifies(exercice_id, exercices(nom, unite)), seances_realisees(fait_le, seances_planifiees(jour))')
  if (error) { console.error(error); return [] }

  // regroupe par exercice_id
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

    // valeur représentative de la série
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
  // les plus travaillés d'abord
  out.sort((a, b) => b.nbSeances - a.nbSeances)
  return out
}