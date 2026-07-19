// Types alignés sur le schéma Supabase (schema-supabase.sql)

export type Nature = 'muscu' | 'course' | 'velo' | 'basket' | 'mobilite' | 'autre'
export type Statut = 'a_venir' | 'faite' | 'partielle' | 'sautee'
export type Etiquette = 'fixe' | 'option'

export interface Cible {
  series?: number
  reps?: number
  charge?: number
  duree_s?: number
  objectif?: string
}

export interface Exercice {
  id: string
  nom: string
  categorie: string | null
  unite: string
  consignes: string | null
}

export interface ExoPlanifie {
  id: string
  seance_id: string
  exercice_id: string
  ordre: number
  cible: Cible | null
  note_coach: string | null
  exercices: Pick<Exercice, 'nom' | 'unite' | 'consignes'> | null
}

export interface SeancePlanifiee {
  id: string
  modele_id: string | null
  nom: string
  nature: Nature
  jour: string
  etiquette: Etiquette
  statut: Statut
  distance_km: number | null
  denivele_m: number | null
  duree_min: number | null
  exos_planifies: ExoPlanifie[]
}

export interface Mesure {
  id: string
  type: string
  valeur: number
  jour: string
}

export interface SerieRealisee {
  id: string
  seance_real_id: string
  exo_planifie_id: string
  ordre: number
  reps: number | null
  charge: number | null
  duree_s: number | null
}

export interface SeanceRealisee {
  id: string
  planifiee_id: string
  fait_le: string
  ressenti: number | null
  note: string | null
  series_realisees?: SerieRealisee[]
}

export interface Programme {
  id: string
  nom: string
  objectif: string | null
}

export interface Bloc {
  id: string
  nom: string
  intention: string | null
  debut: string | null
  fin: string | null
  ordre: number
}