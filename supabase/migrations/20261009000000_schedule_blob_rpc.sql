-- Chargement rapide du planning : évite de télécharger le blob `full_schedule`
-- (copie de TOUTES les semaines) à chaque ouverture, et de le réécrire en
-- entier à chaque sauvegarde. Le code retombe sur l'ancien comportement tant
-- que ces fonctions n'existent pas.

-- Semaines présentes uniquement dans le blob (sans ligne propre) : normalement aucune.
create or replace function public.schedule_blob_only_weeks()
returns table (week_key text, schedule_data jsonb)
language sql
stable
security invoker
set search_path = public
as $$
  select e.key, e.value
  from public.schedules b, jsonb_each(b.schedule_data) e
  where b.week_key = 'full_schedule'
    and jsonb_typeof(b.schedule_data) = 'object'
    and not exists (select 1 from public.schedules r where r.week_key = e.key);
$$;

-- Met à jour UNE semaine dans le blob sans le renvoyer en entier au serveur.
create or replace function public.schedule_blob_set_week(p_week text, p_data jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.schedules
  set schedule_data = jsonb_set(coalesce(schedule_data, '{}'::jsonb), array[p_week], p_data, true),
      updated_at = now()
  where week_key = 'full_schedule';
$$;

grant execute on function public.schedule_blob_only_weeks() to authenticated;
grant execute on function public.schedule_blob_set_week(text, jsonb) to authenticated;
