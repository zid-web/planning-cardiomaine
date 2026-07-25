# Checklist production — Cardiomaine Planning

## Variables d’environnement (Vercel → Settings → Environment Variables → Production)

| Variable | Requis | Notes |
|----------|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Oui** | URL du projet Supabase hébergé |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Oui** | Clé anon (publique) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Oui** (G5) | Server-only — jamais `NEXT_PUBLIC_` |
| `GUARD_API_BASE_URL` | Recommandé | Ex. `https://guard-api-cardiomaine.onrender.com` (sinon fallback `GUARD_API_URL` / défaut Render) |
| `GUARD_API_URL` | Optionnel | Alias legacy utilisé par `guard-api-actions` |
| `GUARD_API_KEY` | Optionnel | Si le backend Render exige `x-api-key` |
| `ANTHROPIC_API_KEY` | **Non (Next.js)** | Uniquement sur le **backend Render**, pas dans Vercel/frontend |
| `CRON_SECRET` | Optionnel | Si défini : Vercel Cron peut envoyer `Authorization: Bearer …`. Les pings **sans** header (cron-job.org) restent autorisés. Un mauvais Bearer → 401. |
| `NEXT_PUBLIC_SENTRY_DSN` | Optionnel | Quand Sentry est branché |

Après ajout / modification : **Redeploy** Production.  
`vercel.json` : cron quotidien Hobby-safe `0 4 * * *` → `/api/ping-solver`. Pour garder Render chaud : **cron externe toutes les 5 min** vers la même URL (évite aussi l’échec de deploy si un `*/5` est remis dans `vercel.json` sur Hobby).

> **Statut (2026-07-25)** : variables Production vérifiées manuellement dans le dashboard Vercel.  
> Migration `20250725000004_…` + keep-alive cron : confirmés côté équipe.  
> **Attention** : les URLs `*.vercel.app` du projet v0 sont souvent derrière **Deployment Protection (SSO)**. Un cron externe / probe sans cookie reçoit un 302 vers `vercel.com/sso-api` — le keep-alive Render ne fonctionne alors pas. Utiliser un domaine public, ou un bypass token Vercel, et vérifier que le deploy Production pointe bien sur `main` HEAD (pas seulement un ancien alias).

## Migrations Supabase (hébergé)

Appliquer si pas déjà fait :

- `20250725000000_create_schedule_history.sql`
- `20250725000001_enable_realtime_schedules.sql`
- `20250725000002_prevent_role_self_escalation.sql`
- `20250725000003_fix_role_escalation_trigger.sql`
- `20250725000004_perf_indexes_and_feedback.sql` (index + table `app_feedback`)
- (+ Realtime `change_requests` déjà présent)

Vérifier Publication `supabase_realtime` : tables `schedules` + `change_requests`.

## Smoke tests post-déploiement

1. Login admin → `/protected/planning`
2. Grille globale : edit cellule → toast « Planning enregistré » → F5 → persistance
3. Historique : entrée `schedule_history`
4. Exporter en PDF
5. (Optionnel) Générer avec Solveur / voice (cold start Render ~60s)
6. Deux onglets admin : sync Realtime
7. Médecin : demande de changement → admin approuve
8. `/protected/admin/users` : liste visible (service role)
9. Bouton **Feedback** (bas-droite) → envoi → visible dans `/protected/admin/feedback`
10. Cron : `GET /api/ping-solver` répond `{ success: true }` (logs Vercel)

## Logs

Les `console.log` de debug (`[v0]`, payloads, etc.) ont été retirés.  
Conservation : `console.error` / `console.warn` pour le monitoring.
