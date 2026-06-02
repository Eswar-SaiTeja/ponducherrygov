import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Reveal the raw Aadhaar number for a single student.
 * Only super_admins may call. Each call is recorded in activity_logs for audit.
 */
export const revealAadhaar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ studentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check super_admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isSuper = (roles ?? []).some((r) => r.role === "super_admin");
    if (!isSuper) {
      throw new Error("Only super-admins can reveal Aadhaar numbers.");
    }

    const { data: student, error } = await supabase
      .from("students")
      .select("aadhaar_number, full_name")
      .eq("id", data.studentId)
      .single();
    if (error) throw new Error(error.message);

    // Audit log
    await supabase.from("activity_logs").insert({
      actor_id: userId,
      action: "aadhaar.reveal",
      entity: "students",
      entity_id: data.studentId,
      metadata: { student_name: student.full_name },
    } as never);

    return { aadhaar: student.aadhaar_number };
  });

/**
 * Returns whether the current user has super_admin role.
 */
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (data ?? []).map((r) => r.role as string);
    return {
      roles,
      isSuperAdmin: roles.includes("super_admin"),
      isAdmin: roles.includes("admin") || roles.includes("super_admin"),
    };
  });