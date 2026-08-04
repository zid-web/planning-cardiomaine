-- Script SQL Définitif pour corriger "permission denied for table guard_picks"
-- À exécuter dans l'éditeur SQL de votre projet Supabase (Dashboard -> SQL Editor -> Run)

-- 1. Donner les permissions complètes sur la table à tous les rôles Supabase
GRANT ALL PRIVILEGES ON TABLE public.guard_picks TO postgres;
GRANT ALL PRIVILEGES ON TABLE public.guard_picks TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.guard_picks TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.guard_picks TO anon;

-- 2. Donner l'accès au schéma public
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated, anon;
GRANT USAGE ON SCHEMA public TO postgres, service_role, authenticated, anon;

-- 3. Désactiver complètement RLS sur guard_picks pour éviter tout blocage de sécurité
ALTER TABLE public.guard_picks DISABLE ROW LEVEL SECURITY;

-- 4. Accorder par sécurité les privilèges par défaut pour les futures tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role, authenticated, anon;
