import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const categorySchema = z.enum([
  "validation",
  "missing_photo",
  "dup_aadhaar",
  "dup_mobile",
  "kyc_rejected",
  "card_failed",
]);

export type ExceptionCategory = z.infer<typeof categorySchema>;

export const listExceptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ category: categorySchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const baseCols = "id, full_name, roll_number, department, email, mobile_number, aadhaar_number, photo_url, kyc_status, validation_errors";
    if (data.category === "validation") {
      const { data: rows } = await supabase
        .from("students")
        .select(baseCols)
        .not("validation_errors", "is", null)
        .limit(1000);
      return { rows: (rows ?? []).filter((r) => Array.isArray((r as { validation_errors: unknown[] }).validation_errors) && (r as { validation_errors: unknown[] }).validation_errors.length > 0) };
    }
    if (data.category === "missing_photo") {
      const { data: rows } = await supabase.from("students").select(baseCols).is("photo_url", null).limit(1000);
      return { rows: rows ?? [] };
    }
    if (data.category === "kyc_rejected") {
      const { data: rows } = await supabase.from("students").select(baseCols).eq("kyc_status", "rejected").limit(1000);
      return { rows: rows ?? [] };
    }
    if (data.category === "card_failed") {
      const { data: cards } = await supabase.from("cards").select("id, student_id, card_type, status, created_at").eq("status", "failed").limit(1000);
      const ids = (cards ?? []).map((c) => (c as { student_id: string }).student_id);
      if (ids.length === 0) return { rows: [] };
      const { data: rows } = await supabase.from("students").select(baseCols).in("id", ids);
      return { rows: rows ?? [] };
    }
    // duplicates
    const col = data.category === "dup_aadhaar" ? "aadhaar_number" : "mobile_number";
    const { data: rows } = await supabase.from("students").select(baseCols).not(col, "is", null).limit(2000);
    const counts = new Map<string, number>();
    for (const r of rows ?? []) {
      const v = (r as Record<string, unknown>)[col] as string | null;
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return { rows: (rows ?? []).filter((r) => {
      const v = (r as Record<string, unknown>)[col] as string | null;
      return v && (counts.get(v) ?? 0) > 1;
    }) };
  });

export const getExceptionCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [students, cards] = await Promise.all([
      supabase.from("students").select("id, aadhaar_number, mobile_number, photo_url, kyc_status, validation_errors").limit(5000),
      supabase.from("cards").select("id", { count: "exact", head: true }).eq("status", "failed"),
    ]);
    const rows = students.data ?? [];
    let validation = 0, missingPhoto = 0, rejected = 0;
    const aadhaarMap = new Map<string, number>();
    const mobileMap = new Map<string, number>();
    for (const r of rows) {
      const rr = r as { aadhaar_number: string | null; mobile_number: string | null; photo_url: string | null; kyc_status: string; validation_errors: unknown };
      if (Array.isArray(rr.validation_errors) && rr.validation_errors.length > 0) validation++;
      if (!rr.photo_url) missingPhoto++;
      if (rr.kyc_status === "rejected") rejected++;
      if (rr.aadhaar_number) aadhaarMap.set(rr.aadhaar_number, (aadhaarMap.get(rr.aadhaar_number) ?? 0) + 1);
      if (rr.mobile_number) mobileMap.set(rr.mobile_number, (mobileMap.get(rr.mobile_number) ?? 0) + 1);
    }
    let dupAadhaar = 0, dupMobile = 0;
    aadhaarMap.forEach((c) => { if (c > 1) dupAadhaar += c; });
    mobileMap.forEach((c) => { if (c > 1) dupMobile += c; });
    return {
      validation,
      missing_photo: missingPhoto,
      dup_aadhaar: dupAadhaar,
      dup_mobile: dupMobile,
      kyc_rejected: rejected,
      card_failed: cards.count ?? 0,
    };
  });