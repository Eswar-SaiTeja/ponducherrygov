-- Photo status enum
CREATE TYPE public.photo_status AS ENUM ('missing','linked','invalid_dimensions','needs_review');

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS photo_status public.photo_status NOT NULL DEFAULT 'missing';

-- Login attempts table (for throttling)
CREATE TABLE public.login_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_attempts_email_time ON public.login_attempts(email, created_at DESC);

GRANT SELECT, INSERT ON public.login_attempts TO anon;
GRANT SELECT, INSERT ON public.login_attempts TO authenticated;
GRANT ALL ON public.login_attempts TO service_role;

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthed) can insert their own attempt record
CREATE POLICY la_ins ON public.login_attempts
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read attempts
CREATE POLICY la_read ON public.login_attempts
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- Index activity_logs for the viewer
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON public.activity_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity, entity_id);