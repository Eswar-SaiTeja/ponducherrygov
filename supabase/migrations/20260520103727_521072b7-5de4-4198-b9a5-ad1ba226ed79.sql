
-- Restrict students SELECT to admins
DROP POLICY IF EXISTS s_read ON public.students;
CREATE POLICY s_read ON public.students FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Restrict cards SELECT to admins
DROP POLICY IF EXISTS c_read ON public.cards;
CREATE POLICY c_read ON public.cards FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Restrict uploads SELECT to admins
DROP POLICY IF EXISTS u_read ON public.uploads;
CREATE POLICY u_read ON public.uploads FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Harden activity_logs: actor must be non-null and equal to auth.uid()
UPDATE public.activity_logs SET actor_id = '00000000-0000-0000-0000-000000000000'
  WHERE actor_id IS NULL;
ALTER TABLE public.activity_logs ALTER COLUMN actor_id SET NOT NULL;

DROP POLICY IF EXISTS al_ins ON public.activity_logs;
CREATE POLICY al_ins ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id IS NOT NULL AND actor_id = auth.uid());
