ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS kyc_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pvc_status text DEFAULT 'not_generated',
  ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_url text;