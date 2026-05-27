CREATE TABLE public.kyc_reason_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('rejection','approval')),
  label text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kyc_reason_templates TO authenticated;
GRANT ALL ON public.kyc_reason_templates TO service_role;
ALTER TABLE public.kyc_reason_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY krt_read ON public.kyc_reason_templates FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY krt_write ON public.kyc_reason_templates FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TABLE public.kyc_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('review','approve','reject')),
  reason text,
  remarks text,
  previous_status text,
  new_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_kyc_reviews_student ON public.kyc_reviews(student_id, created_at DESC);
GRANT SELECT, INSERT ON public.kyc_reviews TO authenticated;
GRANT ALL ON public.kyc_reviews TO service_role;
ALTER TABLE public.kyc_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY kr_read ON public.kyc_reviews FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY kr_ins ON public.kyc_reviews FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()) AND reviewer_id = auth.uid());

INSERT INTO public.kyc_reason_templates (kind, label, body) VALUES
  ('rejection','Photo unclear','Submitted photo is blurry or unrecognizable. Please re-upload a clear passport-style photo.'),
  ('rejection','Aadhaar mismatch','Name on Aadhaar does not match the student record.'),
  ('rejection','Invalid mobile','Mobile number is invalid or unreachable.'),
  ('rejection','Missing document','One or more required documents are missing.'),
  ('rejection','Duplicate record','A duplicate record exists for this student.'),
  ('rejection','Other','Please see remarks for details.'),
  ('approval','All verified','All documents verified successfully.'),
  ('approval','Manual override','Approved after manual verification.');