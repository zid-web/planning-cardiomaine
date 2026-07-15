-- Données d'exemple pour tester le système de vacations
-- À exécuter APRÈS avoir créé la table doctor_vacations

-- Données de test - Vacations d'hiver 2026
INSERT INTO public.doctor_vacations (doctor_id, start_date, end_date, reason)
VALUES
  -- O - Vacances janvier
  ('O', '2026-01-28', '2026-01-31', 'Vacances d''hiver'),
  -- O - Vacances mars
  ('O', '2026-03-07', '2026-03-15', 'Conges printemps'),
  -- O - Vacances mai
  ('O', '2026-05-01', '2026-05-10', 'Pont du 1er mai'),
  
  -- M - Vacances février
  ('M', '2026-02-14', '2026-02-22', 'Vacances'),
  -- M - Vacances avril
  ('M', '2026-04-11', '2026-04-19', 'Vacances paques'),
  
  -- W - Vacances février/mars
  ('W', '2026-02-21', '2026-02-28', 'Conges'),
  -- W - Vacances juin
  ('W', '2026-06-15', '2026-06-22', 'Vacances ete'),
  
  -- Z - Vacances janvier
  ('Z', '2026-01-15', '2026-01-25', 'Conges'),
  -- Z - Vacances avril
  ('Z', '2026-04-06', '2026-04-13', 'Vacances'),
  
  -- H - Vacances février
  ('H', '2026-02-02', '2026-02-09', 'Conges d''hiver'),
  -- H - Vacances juillet
  ('H', '2026-07-20', '2026-08-03', 'Vacances ete'),
  
  -- S - Vacances mars
  ('S', '2026-03-23', '2026-03-30', 'Conges'),
  -- S - Vacances mai
  ('S', '2026-05-15', '2026-05-25', 'Vacances'),
  
  -- P - Vacances janvier/février
  ('P', '2026-01-02', '2026-01-12', 'Congé nouvel an'),
  -- P - Vacances août
  ('P', '2026-08-10', '2026-08-24', 'Vacances ete');

-- Requête de vérification
-- SELECT COUNT(*) as total_vacations, 
--        COUNT(DISTINCT doctor_id) as doctors_with_vacations,
--        MIN(start_date) as earliest,
--        MAX(end_date) as latest
-- FROM public.doctor_vacations;

-- Requête pour voir les vacations par médecin
-- SELECT doctor_id, 
--        COUNT(*) as vacation_periods,
--        SUM(end_date - start_date + 1) as total_days,
--        string_agg(reason, ', ') as reasons
-- FROM public.doctor_vacations
-- GROUP BY doctor_id
-- ORDER BY doctor_id;

-- Requête pour voir les vacations triées par date
-- SELECT doctor_id, 
--        start_date, 
--        end_date,
--        (end_date - start_date + 1) as duration_days,
--        reason
-- FROM public.doctor_vacations
-- ORDER BY start_date;
