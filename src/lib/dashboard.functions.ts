import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function lastNDays(n: number) {
  const out: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

export const getDashboardMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();
    const since14 = new Date(todayStart);
    since14.setUTCDate(since14.getUTCDate() - 13);
    const since14Iso = since14.toISOString();

    const [
      uploadsToday,
      kycPending,
      cardQueue,
      generatedToday,
      failedCards,
      uploadsWindow,
      kycWindow,
      cardsByStatus,
      institutions,
      students,
      cardsAll,
      activity,
    ] = await Promise.all([
      supabase.from("uploads").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
      supabase.from("students").select("id", { count: "exact", head: true }).eq("kyc_status", "pending"),
      supabase.from("cards").select("id", { count: "exact", head: true }).in("status", ["pending", "queued"]),
      supabase.from("cards").select("id", { count: "exact", head: true }).eq("status", "generated").gte("generated_at", todayIso),
      supabase.from("cards").select("id", { count: "exact", head: true }).eq("status", "failed"),
      supabase.from("uploads").select("created_at, error_rows").gte("created_at", since14Iso),
      supabase.from("kyc_reviews").select("created_at, action").gte("created_at", since14Iso),
      supabase.from("cards").select("status"),
      supabase.from("institutions").select("id, name"),
      supabase.from("students").select("id, institution_id, kyc_status"),
      supabase.from("cards").select("id, student_id, status"),
      supabase.from("activity_logs").select("id, action, entity, entity_id, created_at, actor_id, metadata").order("created_at", { ascending: false }).limit(10),
    ]);

    const days = lastNDays(14);
    const uploadsByDay = Object.fromEntries(days.map((d) => [d, 0]));
    let failedValidations = 0;
    for (const r of uploadsWindow.data ?? []) {
      const k = dayKey(new Date(r.created_at as string));
      if (k in uploadsByDay) uploadsByDay[k] += 1;
      failedValidations += Number((r as { error_rows?: number }).error_rows ?? 0);
    }

    const verifyByDay: Record<string, { approved: number; rejected: number }> = {};
    days.forEach((d) => (verifyByDay[d] = { approved: 0, rejected: 0 }));
    for (const r of kycWindow.data ?? []) {
      const k = dayKey(new Date(r.created_at as string));
      if (!verifyByDay[k]) continue;
      if (r.action === "approve") verifyByDay[k].approved += 1;
      if (r.action === "reject") verifyByDay[k].rejected += 1;
    }

    const statusCounts: Record<string, number> = {};
    for (const c of cardsByStatus.data ?? []) {
      const s = (c as { status: string }).status;
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    }

    // Institution stats
    const studentsByInst = new Map<string, { total: number; verified: number }>();
    for (const s of students.data ?? []) {
      const key = (s as { institution_id: string | null }).institution_id ?? "unassigned";
      const cur = studentsByInst.get(key) ?? { total: 0, verified: 0 };
      cur.total += 1;
      if ((s as { kyc_status: string }).kyc_status === "approved") cur.verified += 1;
      studentsByInst.set(key, cur);
    }
    const studentIdToInst = new Map<string, string>();
    for (const s of students.data ?? []) {
      studentIdToInst.set(
        (s as { id: string }).id,
        (s as { institution_id: string | null }).institution_id ?? "unassigned",
      );
    }
    const cardsByInst = new Map<string, number>();
    for (const c of cardsAll.data ?? []) {
      if ((c as { status: string }).status !== "generated") continue;
      const sid = (c as { student_id: string }).student_id;
      const inst = studentIdToInst.get(sid) ?? "unassigned";
      cardsByInst.set(inst, (cardsByInst.get(inst) ?? 0) + 1);
    }
    const instName = new Map<string, string>();
    for (const i of institutions.data ?? []) {
      instName.set((i as { id: string }).id, (i as { name: string }).name);
    }
    const institutionStats = Array.from(studentsByInst.entries()).map(([id, s]) => ({
      id,
      name: id === "unassigned" ? "Unassigned" : instName.get(id) ?? "Unknown",
      students: s.total,
      verified: s.verified,
      verifiedPct: s.total ? Math.round((s.verified / s.total) * 100) : 0,
      cards: cardsByInst.get(id) ?? 0,
    }));

    return {
      tiles: {
        uploadsToday: uploadsToday.count ?? 0,
        kycPending: kycPending.count ?? 0,
        failedValidations,
        cardQueue: cardQueue.count ?? 0,
        generatedToday: generatedToday.count ?? 0,
        failedCards: failedCards.count ?? 0,
        apiStatus: "operational" as const,
      },
      uploadsByDay: days.map((d) => ({ day: d.slice(5), count: uploadsByDay[d] })),
      verifyByDay: days.map((d) => ({ day: d.slice(5), ...verifyByDay[d] })),
      cardStatus: ["pending", "queued", "generated", "dispatched", "delivered", "failed"].map((s) => ({
        status: s,
        count: statusCounts[s] ?? 0,
      })),
      institutionStats: institutionStats.sort((a, b) => b.students - a.students).slice(0, 10),
      activity: (activity.data ?? []).map((a) => ({
        id: (a as { id: string }).id,
        action: (a as { action: string }).action,
        entity: (a as { entity: string | null }).entity,
        entity_id: (a as { entity_id: string | null }).entity_id,
        created_at: (a as { created_at: string }).created_at,
        actor_id: (a as { actor_id: string }).actor_id,
      })),
    };
  });