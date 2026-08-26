-- ============================================================================
-- Keep-alive planifié depuis Supabase (pg_cron + pg_net)
-- ============================================================================
-- Remplace la planification par GitHub Actions, dont les crons sur dépôt
-- gratuit sont « best-effort » : retards de 5 à 20 min, exécutions sautées aux
-- heures de charge, et désactivation automatique du workflow après 60 jours
-- sans activité dans le dépôt. pg_cron s'exécute dans la base, à l'heure.
--
-- Deux tâches :
--   1. `ping-render-solver`  — réveille le solveur Render sur la même fenêtre
--      que le workflow GitHub (lun-ven, 06:00-10:50 UTC = matinées 8h-12h).
--   2. `ping-supabase-self`  — appelle l'API REST du projet une fois par jour
--      pour générer une requête entrante et éviter la mise en pause après
--      7 jours d'inactivité.
--
-- IMPORTANT — à exécuter par un admin du projet, pas par l'application :
--   * pg_cron s'exécute en UTC (comme les crons GitHub).
--   * pg_net envoie les requêtes en asynchrone ; les réponses arrivent dans
--     `net._http_response` (purgée automatiquement au bout de quelques heures).
--   * Les URL et la clé anon sont lues depuis Vault — voir le bloc « Secrets »
--     ci-dessous, à renseigner AVANT d'appliquer cette migration.
--   * Cette migration est idempotente : `cron.unschedule` puis `cron.schedule`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

grant usage on schema net to postgres;

-- ---------------------------------------------------------------------------
-- 2. Secrets (Vault)
-- ---------------------------------------------------------------------------
-- À créer une fois, hors migration, depuis le SQL editor du dashboard :
--
--   select vault.create_secret(
--     'https://guard-api-cardiomaine.onrender.com', 'render_solver_url');
--   select vault.create_secret(
--     'https://rmrxsaiianffhpxpntws.supabase.co', 'supabase_project_url');
--   select vault.create_secret('<clé anon>', 'supabase_anon_key');
--
-- La clé anon est publique par nature (elle est déjà exposée au navigateur) ;
-- Vault sert ici à garder la valeur hors du dépôt, pas à la protéger.

create or replace function public.keep_alive_secret(secret_name text)
returns text
language sql
stable
security definer
set search_path = vault, public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name;
$$;

revoke all on function public.keep_alive_secret(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tâche 1 — réveil du solveur Render (lun-ven, matinées)
-- ---------------------------------------------------------------------------
-- Fenêtre identique au workflow GitHub : 06:00-10:50 UTC, soit 8h-12h50 en
-- France l'été (UTC+2) et 7h-11h50 l'hiver (UTC+1). ~112 h d'instance hours
-- par mois sur les 750 h du plan gratuit Render.
select cron.unschedule('ping-render-solver')
where exists (select 1 from cron.job where jobname = 'ping-render-solver');

select cron.schedule(
  'ping-render-solver',
  '*/10 6-10 * * 1-5',
  $$
    select net.http_get(
      url := public.keep_alive_secret('render_solver_url') || '/',
      timeout_milliseconds := 55000
    );
  $$
);

-- ---------------------------------------------------------------------------
-- 4. Tâche 2 — auto-ping REST (évite la pause à 7 jours d'inactivité)
-- ---------------------------------------------------------------------------
-- Une requête SQL interne ne compte pas nécessairement comme « activité » pour
-- la mise en pause d'un projet gratuit : on passe donc par l'API REST, ce qui
-- produit une vraie requête entrante sur le projet.
select cron.unschedule('ping-supabase-self')
where exists (select 1 from cron.job where jobname = 'ping-supabase-self');

select cron.schedule(
  'ping-supabase-self',
  '17 6 * * *',
  $$
    select net.http_get(
      url := public.keep_alive_secret('supabase_project_url')
             || '/rest/v1/settings?select=id&limit=1',
      headers := jsonb_build_object(
        'apikey', public.keep_alive_secret('supabase_anon_key'),
        'Authorization', 'Bearer ' || public.keep_alive_secret('supabase_anon_key')
      ),
      timeout_milliseconds := 10000
    );
  $$
);

-- ---------------------------------------------------------------------------
-- 5. Vérification (à lancer manuellement après application)
-- ---------------------------------------------------------------------------
--   select jobid, jobname, schedule, active from cron.job;
--
--   -- 10 dernières exécutions et leur statut
--   select j.jobname, d.status, d.return_message, d.start_time
--   from cron.job_run_details d
--   join cron.job j using (jobid)
--   order by d.start_time desc
--   limit 10;
--
--   -- codes HTTP renvoyés par les pings (pg_net purge cette table
--   -- automatiquement au bout de quelques heures)
--   select id, status_code, error_msg, created
--   from net._http_response
--   order by created desc
--   limit 10;
