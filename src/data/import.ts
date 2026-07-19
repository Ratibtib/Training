import { supabase } from '../lib/supabase'

// ============================================================
//  Moteur d'import — format athlete-import/v1
//  Règles : upsert par `cle`, le réalisé est sacré, jamais de suppression,
//  ancrage strict (bloc/exercice introuvable → rejet signalé).
// ============================================================

export interface ImportReport {
  ok: boolean
  erreurGlobale?: string
  programmes: { crees: number; majs: number }
  blocs: { crees: number; majs: number }
  exercices: { crees: number; majs: number }
  cibles: { crees: number; majs: number }
  seances: {
    crees: number; majs: number
    ignorees: string[]   // protégées car réalisées
    rejetees: { cle: string; raison: string }[]
  }
}

const vide = (): ImportReport => ({
  ok: true,
  programmes: { crees: 0, majs: 0 },
  blocs: { crees: 0, majs: 0 },
  exercices: { crees: 0, majs: 0 },
  cibles: { crees: 0, majs: 0 },
  seances: { crees: 0, majs: 0, ignorees: [], rejetees: [] }
})

// upsert générique par (user_id, cle). Renvoie l'id de la ligne, ou null.
async function upsertByCle(
  table: string, cle: string, payload: Record<string, any>
): Promise<{ id: string; created: boolean } | null> {
  const found = await supabase.from(table).select('id').eq('cle', cle).maybeSingle()
  if (found.data?.id) {
    const { error } = await supabase.from(table).update(payload).eq('id', found.data.id)
    if (error) { console.error(table, error); return null }
    return { id: found.data.id, created: false }
  }
  const { data, error } = await supabase.from(table).insert({ cle, ...payload }).select('id').single()
  if (error) { console.error(table, error); return null }
  return { id: data.id, created: true }
}

export async function importJSON(raw: string): Promise<ImportReport> {
  const rep = vide()

  // 1) Parse
  let doc: any
  try { doc = JSON.parse(raw) }
  catch { return { ...rep, ok: false, erreurGlobale: "JSON invalide (erreur de syntaxe)." } }
  if (doc.format !== 'athlete-import/v1') {
    return { ...rep, ok: false, erreurGlobale: `Format attendu "athlete-import/v1", reçu "${doc.format ?? '—'}".` }
  }

  // 2) Programme (0 ou 1)
  const progCleToId: Record<string, string> = {}
  if (doc.programme) {
    const p = doc.programme
    const r = await upsertByCle('programmes', p.cle, {
      nom: p.nom, objectif: p.objectif ?? null, ordre: p.ordre ?? 0, actif: p.actif ?? false
    })
    if (r) { progCleToId[p.cle] = r.id; r.created ? rep.programmes.crees++ : rep.programmes.majs++ }
  }

  // 3) Blocs
  const blocCleToId: Record<string, string> = {}
  for (const b of doc.blocs ?? []) {
    // résoudre le programme d'ancrage (fichier ou base)
    let progId = progCleToId[b.programme_cle]
    if (!progId) {
      const f = await supabase.from('programmes').select('id').eq('cle', b.programme_cle).maybeSingle()
      progId = f.data?.id
    }
    if (!progId) {
      rep.seances.rejetees.push({ cle: b.cle, raison: `bloc: programme "${b.programme_cle}" introuvable` })
      continue
    }
    const r = await upsertByCle('blocs', b.cle, {
      programme_id: progId, nom: b.nom, intention: b.intention ?? null,
      debut: b.debut ?? null, fin: b.fin ?? null, ordre: b.ordre ?? 0
    })
    if (r) { blocCleToId[b.cle] = r.id; r.created ? rep.blocs.crees++ : rep.blocs.majs++ }
  }

  // 4) Exercices (bibliothèque)
  const exoRefToId: Record<string, string> = {}
  for (const e of doc.exercices ?? []) {
    const r = await upsertByCle('exercices', e.cle, {
      nom: e.nom, categorie: e.categorie ?? null,
      unite: e.unite ?? 'reps_charge', consignes: e.consignes ?? null
    })
    if (r) { exoRefToId[e.cle] = r.id; r.created ? rep.exercices.crees++ : rep.exercices.majs++ }
  }
  async function resolveExoRef(ref: string): Promise<string | null> {
    if (exoRefToId[ref]) return exoRefToId[ref]
    const f = await supabase.from('exercices').select('id').eq('cle', ref).maybeSingle()
    if (f.data?.id) { exoRefToId[ref] = f.data.id; return f.data.id }
    return null
  }

  // 5) Séances (le cœur) + protection du réalisé
  for (const s of doc.seances ?? []) {
    // ancrage bloc
    let blocId = blocCleToId[s.bloc_cle]
    if (!blocId) {
      const f = await supabase.from('blocs').select('id').eq('cle', s.bloc_cle).maybeSingle()
      blocId = f.data?.id
    }
    if (!blocId) {
      rep.seances.rejetees.push({ cle: s.cle, raison: `bloc "${s.bloc_cle}" introuvable` })
      continue
    }

    // séance existante ? a-t-elle du réalisé ?
    const existing = await supabase
      .from('seances_planifiees').select('id, statut').eq('cle', s.cle).maybeSingle()

    if (existing.data?.id) {
      const seanceId = existing.data.id
      const statut = existing.data.statut
      let hasReal = statut === 'faite' || statut === 'partielle'
      if (!hasReal) {
        const real = await supabase.from('seances_realisees').select('id').eq('planifiee_id', seanceId).limit(1)
        hasReal = (real.data?.length ?? 0) > 0
      }
      if (hasReal) { rep.seances.ignorees.push(s.cle); continue }  // PROTÉGÉ

      // sans réalisé → on remplace : maj séance + recrée ses exos
      await supabase.from('seances_planifiees').update({
        nom: s.nom, nature: s.nature, jour: s.jour,
        etiquette: s.etiquette ?? 'fixe',
        duree_min: s.duree_min ?? null, distance_km: s.distance_km ?? null, denivele_m: s.denivele_m ?? null
      }).eq('id', seanceId)
      await supabase.from('exos_planifies').delete().eq('seance_id', seanceId)
      const okExos = await insertExos(s, seanceId, resolveExoRef, rep)
      if (okExos) rep.seances.majs++
    } else {
      // création
      const ins = await supabase.from('seances_planifiees').insert({
        cle: s.cle, modele_id: null, nom: s.nom, nature: s.nature, jour: s.jour,
        etiquette: s.etiquette ?? 'fixe', statut: 'a_venir',
        duree_min: s.duree_min ?? null, distance_km: s.distance_km ?? null, denivele_m: s.denivele_m ?? null
      }).select('id').single()
      if (ins.error) { rep.seances.rejetees.push({ cle: s.cle, raison: 'échec création' }); continue }
      const okExos = await insertExos(s, ins.data.id, resolveExoRef, rep)
      if (okExos) rep.seances.crees++
    }
  }

  // 6) Cibles (objectifs)
  for (const c of doc.cibles ?? []) {
    let exoId: string | null = null
    if (c.exo_ref) exoId = await resolveExoRef(c.exo_ref)
    const r = await upsertByCle('cibles', c.cle, {
      indicateur: c.indicateur, exercice_id: exoId,
      valeur: c.valeur, unite: c.unite ?? null,
      sens: c.sens ?? 'hausse', type: c.type ?? 'phase',
      echeance: c.echeance ?? null, actif: true
    })
    if (r) r.created ? rep.cibles.crees++ : rep.cibles.majs++
  }

  return rep
}

async function insertExos(
  s: any, seanceId: string,
  resolveExoRef: (ref: string) => Promise<string | null>,
  rep: ImportReport
): Promise<boolean> {
  const rows: any[] = []
  for (const exo of s.exos ?? []) {
    const exId = await resolveExoRef(exo.exo_ref)
    if (!exId) {
      rep.seances.rejetees.push({ cle: exo.cle, raison: `exercice "${exo.exo_ref}" introuvable` })
      continue
    }
    rows.push({
      cle: exo.cle, seance_id: seanceId, exercice_id: exId,
      ordre: exo.ordre ?? 0, cible: exo.cible ?? null, note_coach: exo.note_coach ?? null
    })
  }
  if (rows.length === 0) return true
  const { error } = await supabase.from('exos_planifies').insert(rows)
  if (error) { console.error(error); return false }
  return true
}