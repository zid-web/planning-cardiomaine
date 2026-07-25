# Performance & monitoring — Cardiomaine Planning

## Baseline mesurée (2026-07-25, agent cloud)

| Mesure | Résultat |
|--------|----------|
| Render `GET /` (cold) | **~22.4 s** TTFB |
| Render `GET /` (warm, +2s) | **~0.23 s** TTFB |
| Next `/auth/login` (local) | ~57 ms |

Conclusion : le cold start Render est le goulot principal pour solveur / voice / PDF.

## Optimisations livrées

1. **Cron keep-alive** — `GET /api/ping-solver` (route publique dans `proxy.ts`). Optionnel : `CRON_SECRET` + header `Authorization: Bearer …`.
   - **`vercel.json`** utilise un cron **quotidien** (`0 4 * * *`) pour rester compatible **Hobby** (un cron / jour). Un schedule `*/5 * * * *` fait échouer le déploiement sur Hobby.
   - **URL keep-alive Production (stable)** :  
     `https://v0-recreate-attached-ui-zids-projects-22b662f4.vercel.app/api/ping-solver`  
     → doit renvoyer `{"success":true,…}` **sans** login.  
   - **Ne pas** utiliser les URLs de déploiement hashées du type `v0-recreate-attached-p2ci9kbnq-…` : ce sont d’**anciens** déploiements immuables (souvent encore protégés / sans la route publique).  
   - **Recommandé** : cron externe toutes les 5–10 min (cron-job.org) vers l’URL stable ci-dessus.
2. **Cache solveur** — TTL 5 min en mémoire (`lib/solver-cache.ts`) pour même `weekStartDate` + `weekendMode`.
3. **SWR** — chargement `full-schedule` sur `/protected/planning` (`dedupingInterval` 10s, revalidate on focus).
4. **Lazy load** — `VoiceAndUploadPanel`, `VacationsModal`, `GuardGenerationButton` via `React.lazy`.
5. **Index SQL** — `schedules.updated_at`, equity/vacations/change_requests (migration `20250725000004_…`).
6. **Logs structurés** — `lib/perf-log.ts` + timings solveur / ping.
7. **Vercel Analytics** (déjà présent) + **Speed Insights** (`@vercel/speed-insights`).

## Monitoring

| Outil | Statut |
|-------|--------|
| Vercel Analytics | Activé dans `app/layout.tsx` |
| Vercel Speed Insights | Activé |
| Sentry | Prêt à brancher : définir `NEXT_PUBLIC_SENTRY_DSN` puis `bun add @sentry/nextjs` + wizard ; erreurs structurées via `lib/sentry.ts` en attendant |
| Logs Vercel / Render | Consulter pour `ping-solver` et `[solver-api]` JSON |

## Variables utiles

- `GUARD_API_BASE_URL` / `GUARD_API_URL`
- `CRON_SECRET` (recommandé en prod pour le cron)
- `NEXT_PUBLIC_SENTRY_DSN` (optionnel)

## Suite possible

- Redis / KV pour cache solveur multi-instance
- SWR par `week_key` au lieu du blob `full_schedule`
- Bundle analyzer (`@next/bundle-analyzer`) en CI
