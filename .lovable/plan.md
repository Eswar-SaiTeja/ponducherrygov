# Plan: Operational Dashboard, Exceptions, KYC Upgrade

Three sizable modules. I'll deliver them in one pass, but keep each scoped and shippable.

## 1. Dashboard — Real Operational Metrics

Rewrite `src/routes/_authenticated/dashboard.tsx` + new server fn `src/lib/dashboard.functions.ts` (auth-protected, queries via `requireSupabaseAuth`).

Stat tiles (server-aggregated, single RPC-style fn returning all counts):
- Today uploads (uploads where `created_at::date = today`)
- KYC pending (students.kyc_status = 'pending')
- Failed validations (uploads.error_rows sum today + students with non-empty validation_errors)
- Card print queue (cards.status in 'pending'/'queued')
- Generated today (cards.status = 'generated' AND generated_at::date = today)
- API status (static "operational" indicator — health check via simple supabase ping)

Widgets:
- Daily upload graph — last 14 days, count of uploads grouped by day (Recharts AreaChart)
- Verification trend — last 14 days, approved vs rejected line (Recharts LineChart)
- Card generation progress — stacked bar: pending / queued / generated / failed (today + 7d toggle)
- Institution performance — table: institution name, students, verified %, cards generated
- Recent activity — last 10 rows from `activity_logs` joined with `profiles` for actor name

## 2. Exceptions Module

New route `src/routes/_authenticated/exceptions.tsx` + `src/lib/exceptions.functions.ts`.

Categories (tabbed):
- Validation Error — students with `validation_errors` jsonb non-empty
- Missing Photo — students with `photo_url IS NULL`
- Duplicate Aadhaar — group by aadhaar_number having count > 1
- Duplicate Mobile — group by mobile_number having count > 1
- KYC Rejected — students.kyc_status = 'rejected'
- Card Generation Failed — cards.status = 'failed'

Per-row actions:
- View details (drawer with full row + error list)
- Edit & retry (link to students edit — minimal: re-open form with values prefilled)
- Delete row

Bulk actions:
- Download error rows as CSV (current filtered tab)
- Bulk delete

Replaces the placeholder `validation.tsx` route — sidebar link updated.

## 3. KYC Upgrade

Schema migration:
- New table `public.kyc_reviews` (id, student_id, reviewer_id, action enum: review|approve|reject, reason text, remarks text, created_at)
- New table `public.kyc_reason_templates` (id, kind: 'rejection'|'approval', label, body, created_at)
- Seed ~6 default rejection reasons
- Trigger on student kyc_status change → write activity_logs row

Server fns in `src/lib/kyc.functions.ts`:
- `updateKycStatus({ id, status, reason?, remarks })` — remarks required when rejecting; writes kyc_reviews + students update
- `bulkUpdateKyc({ ids, status, reason?, remarks })`
- `listKycHistory({ studentId })` returns timeline
- `listReasonTemplates()`

UI rewrite `src/routes/_authenticated/kyc.tsx`:
- Row checkboxes + bulk approve/reject toolbar
- Approve/Reject opens dialog: reason dropdown (from templates) + remarks textarea (required for reject)
- Status badges with semantic colors (pending=secondary, in_review=warning, approved=success, rejected=destructive)
- Click row → drawer with audit-trail timeline (who, when, action, reason, remarks)
- "Document preview" — show photo_url + aadhaar masked in drawer

## Files

Created:
- `src/lib/dashboard.functions.ts`
- `src/lib/exceptions.functions.ts`
- `src/lib/kyc.functions.ts`
- `src/routes/_authenticated/exceptions.tsx`
- `supabase/migrations/<ts>_kyc_reviews.sql`

Edited:
- `src/routes/_authenticated/dashboard.tsx` (full rewrite)
- `src/routes/_authenticated/kyc.tsx` (full rewrite)
- `src/components/app-sidebar.tsx` (add Exceptions link, remove/repoint Validation)

## Notes / Trade-offs

- "API status" tile = simple green indicator + last-checked timestamp; no external service polling.
- Institution stats join assumes some students have `institution_id`; rows without it bucket under "Unassigned".
- "Fix-and-reupload" workflow = download error CSV → user edits → re-imports via existing Uploads page. No new dedicated re-upload UI.
- Duplicate detection runs at query time (not a materialized view); fine up to a few thousand students.

Confirm and I'll build it.
