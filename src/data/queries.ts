import { supabase } from '../lib/supabase'
import type { SeancePlanifiee, Mesure } from '../lib/types'

// Séance du jour, sinon la prochaine à venir. Charge exos + exercices liés.
export async function getTodayOrNextSession(): Promise<SeancePlanifiee | null> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('seances_planifiees')
    .select('*, exos_planifies(*, exercices(nom, unite, consignes))')
    .gte('jour', today)
    .order('jour', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) { console.error(error); return null }
  if (!data) return null
  // Ordonne les exos par leur champ ordre
  data.exos_planifies?.sort((a: any, b: any) => a.ordre - b.ordre)
  return data as SeancePlanifiee
}

// Semaine courante (lundi → dimanche) pour la vue Semaine.
export async function getWeekSessions(): Promise<SeancePlanifiee[]> {
  const now = new Date()
  const day = (now.getDay() + 6) % 7 // 0 = lundi
  const monday = new Date(now); monday.setDate(now.getDate() - day)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('seances_planifiees')
    .select('*, exos_planifies(id)')
    .gte('jour', fmt(monday))
    .lte('jour', fmt(sunday))
    .order('jour', { ascending: true })

  if (error) { console.error(error); return [] }
  return (data ?? []) as SeancePlanifiee[]
}

// Série de poids pour la courbe de fonte.
export async function getWeightSeries(): Promise<Mesure[]> {
  const { data, error } = await supabase
    .from('mesures')
    .select('*')
    .eq('type', 'poids')
    .order('jour', { ascending: true })

  if (error) { console.error(error); return [] }
  return (data ?? []) as Mesure[]
}

// --- ÉCRITURE : saisie rapide en séance ---
// Marque une séance comme faite (appelé au "Terminer la séance").
export async function marquerSeanceFaite(seanceId: string) {
  const { error } = await supabase
    .from('seances_planifiees')
    .update({ statut: 'faite' })
    .eq('id', seanceId)
  if (error) console.error(error)
  return !error
}
