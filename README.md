# Athlète — app de suivi (PWA)

Suivi et pilotage d'entraînement. Front-only : React + Vite, données dans Supabase
(sécurisées par RLS), installable comme PWA, déployée en statique sur Netlify.

## Prérequis
- Node.js 18+ (idéalement 20/22)
- Comptes : GitHub, Supabase, Netlify
- Le schéma + le seed déjà exécutés dans Supabase (schema-supabase.sql, schema-seed.sql)

## Démarrer en local
```bash
npm install
cp .env.example .env.local   # puis renseigne tes 2 clés Supabase
npm run dev
```
Ouvre l'URL affichée. Connecte-toi avec le compte Supabase Auth créé
(le même dont l'uid a servi au seed).

### Où trouver les clés Supabase
Dashboard Supabase → Project Settings → API :
- `VITE_SUPABASE_URL` = Project URL
- `VITE_SUPABASE_ANON_KEY` = anon public key
(La clé anon est publique : c'est le RLS qui protège les données, pas le secret de la clé.)

## Build & déploiement Netlify
- Push sur GitHub → Netlify branché sur le repo déploie automatiquement.
- Build command : `npm run build`  ·  Publish directory : `dist`
- Renseigne les 2 variables d'env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
  dans Netlify → Site settings → Environment variables.
- `netlify.toml` gère déjà la redirection SPA.

## Installer sur mobile
Ouvre l'URL Netlify (https) sur le téléphone → menu navigateur → "Ajouter à l'écran d'accueil".
La session reste active : tu ne te reconnectes pas à chaque fois.

## Structure
```
src/
  lib/supabase.ts   client Supabase (session persistante)
  lib/types.ts      types alignés sur le schéma SQL
  auth/             provider de session + écran de login
  data/queries.ts   couche d'accès (séance du jour, semaine, poids...)
  screens/Today.tsx première vue connectée (lit tes vraies données)
```

## État actuel (squelette)
- [x] Auth + session persistante
- [x] PWA installable
- [x] Écran "séance du jour" lisant les vraies données
- [x] Cases à cocher en état local optimiste (réagit sans réseau)
- [ ] Écriture différée de series_realisees (à brancher)
- [ ] Vues Semaine / Bloc, Suivi (poids + échelles), Objectifs (lignes de piste)
- [ ] Mode offline complet (si le réseau piste lâche)
