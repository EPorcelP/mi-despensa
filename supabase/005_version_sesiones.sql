-- Fase 10: no elimina datos ni modifica los inventarios.
BEGIN;
ALTER TABLE public.mdespensa_profiles
  ADD COLUMN IF NOT EXISTS session_version bigint NOT NULL DEFAULT 0;
-- Restringe a versiones no negativas, si aún no se había agregado.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mdespensa_profiles_session_version_check'
 AND conrelid='public.mdespensa_profiles'::regclass) THEN
 ALTER TABLE public.mdespensa_profiles ADD CONSTRAINT mdespensa_profiles_session_version_check CHECK (session_version >= 0);
 END IF;
END $$;
COMMIT;
