-- Fix activity_logs INSERT policy to also require admin
DROP POLICY IF EXISTS al_ins ON public.activity_logs;
CREATE POLICY "al_ins" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()) AND actor_id IS NOT NULL AND actor_id = auth.uid());

-- Fix institutions SELECT policy to require admin (consistent with write policy)
DROP POLICY IF EXISTS i_read ON public.institutions;
CREATE POLICY "i_read" ON public.institutions FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- Update handle_new_user trigger to assign 'staff' role by default instead of 'admin'
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  RETURN NEW;
END $function$;