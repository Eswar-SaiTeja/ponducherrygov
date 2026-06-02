import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listSchema = z.object({
  actorId: z.string().uuid().optional(),
  entity: z.string().max(100).optional(),
  action: z.string().max(100).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().min(0).default(0),
});

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // gate: admin only (RLS already enforces, but fail fast)
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => ["admin", "super_admin"].includes(r.role as string));
    if (!isAdmin) throw new Error("Forbidden");

    let q = supabase
      .from("activity_logs")
      .select("id, actor_id, action, entity, entity_id, metadata, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.actorId) q = q.eq("actor_id", data.actorId);
    if (data.entity) q = q.eq("entity", data.entity);
    if (data.action) q = q.ilike("action", `%${data.action}%`);
    if (data.since) q = q.gte("created_at", data.since);
    if (data.until) q = q.lte("created_at", data.until);

    const { data: logs, error, count } = await q;
    if (error) throw new Error(error.message);

    // Enrich with actor profile
    const actorIds = Array.from(new Set((logs ?? []).map((l) => l.actor_id).filter(Boolean)));
    let profilesByid: Record<string, { full_name: string | null; email: string | null }> = {};
    if (actorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds as string[]);
      profilesByid = Object.fromEntries((profs ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]));
    }

    return {
      logs: (logs ?? []).map((l) => ({
        ...l,
        actor: l.actor_id ? profilesByid[l.actor_id] ?? null : null,
      })),
      total: count ?? 0,
    };
  });