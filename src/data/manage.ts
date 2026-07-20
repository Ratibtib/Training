import { supabase } from '../lib/supabase'
import type { Bloc } from '../lib/types'

// ============================================================
//  Gestion manuelle (Admin) — édition méta + suppression.
//  Garde-fou : tout ce qui a du réalisé est PROTÉGÉ.
// ============================================================

export interface ManagedSeance {
  id: string
  nom: string
  nature: string
  jour: string
  etiquette: string
  statut: string
  duree_min: number | null
  hasRealise: boolean
}

export async function getManagedSeances(debut: string, fin: string): Promise<ManagedSeance[]> {
  const { data, error } = await supabase
    .from('seances_planifiees')
    .select('id, nom, nature, jour, etiquette, statut, duree_min, seances_realisees(id)')
    .gte('jour', debut).lte('jour', fin)
    .order('jour', { ascending: true })
  if (error) { console.error(error); return [] }
  return (data ?? []).map((s: any) => ({
    id: s.id, nom: s.nom, nature: s.nature, jour: s.jour,
    etiquette: s.etiquette, statut: s.statut, duree_min: s.duree_min,
    hasRealise: s.statut === 'faite' || s.statut === 'partielle' || (s.seances_realisees?.length ?? 0) > 0
  }))
}

export async function updateSeanceMeta(
  id: string, patch: { nom?: string; jour?: string; etiquette?: string; duree_min?: number | null }
): Promise<boolean> {
  const { error } = await supabase.from('seances_planifiees').update(patch).eq('id', id)
  if (error) console.error(error)
  return !error
}

// Supprime une séance (cascade sur ses exos). Refuse si réalisé.
// Supprime une séance (cascade sur ses exos ET son réalisé éventuel).
// Édition MANUELLE : aucune protection — l'utilisateur décide (ménage, séances test).
export async function deleteSeance(id: string): Promise<boolean> {
  const { error } = await supabase.from('seances_planifiees').delete().eq('id', id)
  if (error) console.error(error)
  return !error
}

// Supprime toutes les séances NON réalisées d'une période. Renvoie le nb supprimé.
export async function deleteSeancesRange(debut: string, fin: string): Promise<number> {
  const seances = await getManagedSeances(debut, fin)
  const supprimables = seances.filter(s => !s.hasRealise).map(s => s.id)
  if (supprimables.length === 0) return 0
  const { error } = await supabase.from('seances_planifiees').delete().in('id', supprimables)
  if (error) { console.error(error); return 0 }
  return supprimables.length
}

export async function updateBloc(
  id: string, patch: { nom?: string; intention?: string | null; debut?: string | null; fin?: string | null }
): Promise<boolean> {
  const { error } = await supabase.from('blocs').update(patch).eq('id', id)
  if (error) console.error(error)
  return !error
}

// Supprime un bloc (ligne). Les séances liées par date ne sont PAS supprimées
// (fais le ménage des séances via la période si besoin).
export async function deleteBloc(id: string): Promise<boolean> {
  const { error } = await supabase.from('blocs').delete().eq('id', id)
  if (error) console.error(error)
  return !error
}

export async function getBlocsManage(): Promise<Bloc[]> {
  const prog = await supabase.from('programmes').select('id').eq('actif', true).order('ordre').limit(1).maybeSingle()
  if (!prog.data?.id) return []
  const { data, error } = await supabase
    .from('blocs').select('id, nom, intention, debut, fin, ordre')
    .eq('programme_id', prog.data.id).order('ordre', { ascending: true })
  if (error) { console.error(error); return [] }
  return (data ?? []) as Bloc[]
}

// ============================================================
//  Édition de la composition d'une séance (exos)
// ============================================================

export interface ExoLigne {
  id: string
  exercice_id: string
  exercice_nom: string
  unite: string
  ordre: number
  cible: any | null
  note_coach: string | null
}

export interface ExerciceBib {
  id: string
  nom: string
  unite: string
}

export async function getExosDeSeance(seanceId: string): Promise<ExoLigne[]> {
  const { data, error } = await supabase
    .from('exos_planifies')
    .select('id, exercice_id, ordre, cible, note_coach, exercices(nom, unite)')
    .eq('seance_id', seanceId).order('ordre', { ascending: true })
  if (error) { console.error(error); return [] }
  return (data ?? []).map((e: any) => ({
    id: e.id, exercice_id: e.exercice_id,
    exercice_nom: e.exercices?.nom ?? '?', unite: e.exercices?.unite ?? 'reps_charge',
    ordre: e.ordre, cible: e.cible, note_coach: e.note_coach
  }))
}

export async function getBibliotheque(): Promise<ExerciceBib[]> {
  const { data, error } = await supabase
    .from('exercices').select('id, nom, unite').order('nom', { ascending: true })
  if (error) { console.error(error); return [] }
  return (data ?? []) as ExerciceBib[]
}

export async function updateExo(
  id: string, patch: { cible?: any; note_coach?: string | null; ordre?: number }
): Promise<boolean> {
  const { error } = await supabase.from('exos_planifies').update(patch).eq('id', id)
  if (error) console.error(error)
  return !error
}

export async function deleteExo(id: string): Promise<boolean> {
  const { error } = await supabase.from('exos_planifies').delete().eq('id', id)
  if (error) console.error(error)
  return !error
}

// Échange l'ordre de deux exos (réordonnancement monter/descendre)
export async function swapExosOrdre(a: ExoLigne, b: ExoLigne): Promise<boolean> {
  const r1 = await supabase.from('exos_planifies').update({ ordre: b.ordre }).eq('id', a.id)
  const r2 = await supabase.from('exos_planifies').update({ ordre: a.ordre }).eq('id', b.id)
  return !r1.error && !r2.error
}

export async function addExoToSeance(
  seanceId: string, exerciceId: string, ordre: number
): Promise<boolean> {
  const { error } = await supabase.from('exos_planifies').insert({
    seance_id: seanceId, exercice_id: exerciceId, ordre, cible: {}, note_coach: null
  })
  if (error) console.error(error)
  return !error
}

// Crée un nouvel exercice dans la bibliothèque, renvoie son id
export async function createExercice(nom: string, unite: string): Promise<string | null> {
  const { data, error } = await supabase.from('exercices')
    .insert({ nom, unite, categorie: null }).select('id').single()
  if (error) { console.error(error); return null }
  return data.id
}

// ============================================================
//  Création d'une séance à la volée (Admin/Gérer)
// ============================================================

export interface NouvelleSeance {
  nom: string
  nature: string
  jour: string
  etiquette: string
  duree_min: number | null
}

export async function createSeance(s: NouvelleSeance): Promise<string | null> {
  const { data, error } = await supabase.from('seances_planifiees').insert({
    modele_id: null, nom: s.nom, nature: s.nature, jour: s.jour,
    etiquette: s.etiquette, statut: 'a_venir', duree_min: s.duree_min
  }).select('id').single()
  if (error) { console.error(error); return null }
  return data.id
}