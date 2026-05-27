import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const statusEnum = z.enum(["pending", "in_review", "approved", "rejected"]);

const updateSchema = z.object({
  id: z.string().uuid(),
  status: statusEnum,
  reason: z.string().max(200).optional().nullable(),
  remarks: z.string().max(2000).optional().nullable(),
}).superRefine((v, ctx) => {
  if (v.status === "rejected" && (!v.remarks || v.remarks.trim().length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["remarks"], message: "Remarks are required when rejecting." });
  }
});

async function applyKycUpdate(
  supabase: ReturnType<typeof requireSupabaseAuth.handler> extends never ? never : import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  ids: string[],
  status: "pending" | "in_review" | "approved" | "rejected",
  reason: string | null,
  remarks: string | null,
) {
  const { data: current } = await supabase.from("students").select("id, kyc_status").in("id", ids);
  const prev = new Map<string, string>();
  for (const s of current ?? []) prev.set((s as { id: string }).id, (s as { kyc_status: string }).kyc_status);

  const { error } = await supabase
    .from("students")
    .update({ kyc_status: status, verified: status === "approved" } as never)
    .in("id", ids);
  if (error) throw new Error(error.message);

  const action = status === "approved" ? "approve" : status === "rejected" ? "reject" : "review";
  const reviewRows = ids.map((id) => ({
    student_id: id,
    reviewer_id: userId,
    action,
    reason: reason ?? null,
    remarks: remarks ?? null,
    previous_status: prev.get(id) ?? null,
    new_status: status,
  }));
  await supabase.from("kyc_reviews").insert(reviewRows as never);
  await supabase.from("activity_logs").insert(ids.map((id) => ({
    actor_id: userId,
    action: `kyc.${action}`,
    entity: "students",
    entity_id: id,
    metadata: { previous_status: prev.get(id) ?? null, new_status: status, reason, remarks },
  })) as never);
}

export const updateKycStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateSchema.parse(i))
  .handler(async ({ data, context }) => {
    await applyKycUpdate(context.supabase as never, context.userId, [data.id], data.status, data.reason ?? null, data.remarks ?? null);
    return { ok: true };
  });

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  status: statusEnum,
  reason: z.string().max(200).optional().nullable(),
  remarks: z.string().max(2000).optional().nullable(),
}).superRefine((v, ctx) => {
  if (v.status === "rejected" && (!v.remarks || v.remarks.trim().length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["remarks"], message: "Remarks are required when rejecting." });
  }
});

export const bulkUpdateKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => bulkSchema.parse(i))
  .handler(async ({ data, context }) => {
    await applyKycUpdate(context.supabase as never, context.userId, data.ids, data.status, data.reason ?? null, data.remarks ?? null);
    return { ok: true, count: data.ids.length };
  });

export const listKycHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ studentId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: reviews } = await supabase
      .from("kyc_reviews")
      .select("id, action, reason, remarks, previous_status, new_status, created_at, reviewer_id")
      .eq("student_id", data.studentId)
      .order("created_at", { ascending: false });
    const reviewerIds = Array.from(new Set((reviews ?? []).map((r) => (r as { reviewer_id: string }).reviewer_id)));
    let names = new Map<string, string>();
    if (reviewerIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", reviewerIds);
      names = new Map((profs ?? []).map((p) => [
        (p as { id: string }).id,
        (p as { full_name: string | null; email: string | null }).full_name || (p as { email: string | null }).email || "User",
      ]));
    }
    return { history: (reviews ?? []).map((r) => ({ ...(r as object), reviewer_name: names.get((r as { reviewer_id: string }).reviewer_id) ?? "Unknown" })) };
  });

export const listReasonTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("kyc_reason_templates")
      .select("id, kind, label, body")
      .order("created_at", { ascending: true });
    return { templates: data ?? [] };
  });