## Scope

Three modules requested: (4) Security & audit, (5) Bulk upload UX, (6) Photo upload automation. Below is what I will build vs defer, with honest trade-offs — several "production" items (real face detection, AES at rest, 2FA, device fingerprinting) need infra/services I shouldn't fake.

---

## 4. Security & Audit

### Build now
- **Aadhaar masking** — utility `maskAadhaar()` (`XXXX-XXXX-1234`); apply across students table, KYC, exceptions, drawers. Add `revealAadhaar` server fn (admin-only, logs to `activity_logs`) for click-to-reveal.
- **Role-based field visibility** — extend `has_role` usage: `super_admin` sees raw Aadhaar; `admin`/`staff` see masked only. Enforce in `revealAadhaar` server fn.
- **Session timeout** — client-side idle timer (default 30 min). Toast warning at 28 min, auto sign-out at 30. Configurable constant.
- **Login attempt restriction** — track failed attempts in new `login_attempts` table (email, ip, ts). Block sign-in client-side after 5 failures in 15 min with countdown.
- **IP & device logging** — capture `request.headers` (`x-forwarded-for`, `user-agent`) inside an audit middleware; write to `activity_logs.metadata`.
- **Activity log viewer** — new route `/audit` (super_admin only): filterable table (actor, action, entity, date range), pagination, CSV export.

### Defer with note
- **AES encryption at rest** — Postgres column-level encryption needs pgcrypto + key management (Supabase Vault). I'll document the SQL approach in plan but not enable without a key-rotation story; current Supabase encryption-at-rest already covers disk-level. Skipping unless you explicitly want pgcrypto on `aadhaar_number`.
- **2FA for super admin** — Supabase Auth MFA is dashboard-configured; I'll add a `/settings/security` page with "Enable MFA" button that calls `supabase.auth.mfa.enroll` (TOTP). Works but user must scan QR.
- **Device tracking** beyond user-agent string requires fingerprinting library — skipping.

---

## 5. Bulk Upload UX

### Build now
- **Drag-and-drop** — wire dropzone to existing label in `uploads.tsx`.
- **Upload progress %** — chunk client-side parsing + server insert in batches of 50; show progress bar.
- **Auto column mapping** — preview step shows detected → target column mapping with editable dropdowns before import (already partially in `pick()` server-side; surface it on client).
- **Editable preview table** — replace JSON `<pre>` with a real table; inline-edit cells before confirming import.
- **Retry failed rows** — after import, "Fix & retry" button loads only error rows back into the editable table.
- **Sample template download** — generated `.xlsx` via SheetJS with headers + 2 example rows. Button on Uploads page.
- **Validation guide / naming standards** — markdown page at `/uploads/guide` (renderable, printable). PDF not needed — browser print works.

### Defer
- **Background processing** — true background jobs need a queue (pg_cron + worker). Current sync import for ≤500 rows is fine; I'll bump limit to 2000 with batched inserts + progress instead.

---

## 6. Photo Upload System

### Build now
- **ZIP upload** + filename → roll_number matching (if not already there).
- **Image compression** — client-side via `browser-image-compression` (max 500KB, 1024px).
- **Auto crop to passport ratio (3:4)** — `react-easy-crop` or canvas-based center crop.
- **Dimension validation** — min 300×400, max 2000×2500; reject otherwise.
- **Photo status enum on `students`** — add column `photo_status`: `missing | linked | invalid_dimensions | needs_review`.
- **Missing photo report** — route in Exceptions: lists students by photo_status.

### Defer with note
- **Face detection / blur detection / background validation** — these need ML (face-api.js is ~10MB and unreliable; production uses paid APIs like AWS Rekognition). I'll add Lovable AI Gateway integration using `google/gemini-2.5-flash-image` for a "Validate photo" action that returns face-detected/blur/bg-ok flags. Per-image cost; runs on demand, not bulk.

---

## Files

**New:**
- `supabase/migrations/<ts>_security_audit.sql` — `login_attempts`, `photo_status` enum + column, indexes
- `src/lib/security.functions.ts` — `revealAadhaar`, `logFailedLogin`, `recordActivity`
- `src/lib/audit.functions.ts` — `listAuditLogs`, `exportAuditLogs`
- `src/lib/photos.functions.ts` — `validatePhotoAI`, `bulkLinkPhotos`
- `src/lib/aadhaar.ts` — masking utility
- `src/hooks/use-session-timeout.tsx`
- `src/routes/_authenticated/audit.tsx`
- `src/routes/_authenticated/uploads.guide.tsx`
- `src/routes/_authenticated/settings.security.tsx`
- `src/components/editable-preview-table.tsx`

**Edited:**
- `src/routes/_authenticated/uploads.tsx` — drag-drop, progress, editable table, template download, retry
- `src/routes/_authenticated/students.tsx` + `kyc.tsx` + `exceptions.tsx` — apply masking
- `src/routes/login.tsx` — failed-attempt throttling
- `src/routes/_authenticated.tsx` — mount session timeout
- `src/components/app-sidebar.tsx` — Audit link (super_admin only), Security settings
- `src/lib/uploads.functions.ts` — batched insert, raise limit to 2000

**Deps:** `browser-image-compression`, `react-easy-crop`, `jszip`

---

## Trade-offs

- This is ~12 hours of careful work. Reply **"go"** to build everything, or pick subsets (e.g. "security only", "skip photo AI", "skip MFA"). I'd recommend splitting into 3 turns: security → upload UX → photos.
- Anything in "Defer" stays out unless you call it out.
