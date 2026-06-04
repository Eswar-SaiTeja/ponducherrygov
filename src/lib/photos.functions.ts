import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const linkSchema = z.object({
  items: z
    .array(
      z.object({
        roll_number: z.string().min(1).max(100),
        path: z.string().min(1).max(500),
      }),
    )
    .min(1)
    .max(500),
});

export const bulkLinkPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => linkSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let linked = 0;
    const notFound: string[] = [];
    for (const it of data.items) {
      const { data: pub } = supabase.storage.from("student-photos").getPublicUrl(it.path);
      const { data: row, error } = await supabase
        .from("students")
        .update({ photo_url: pub.publicUrl, photo_status: "linked" } as never)
        .eq("roll_number", it.roll_number)
        .select("id");
      if (error) continue;
      if (!row || row.length === 0) notFound.push(it.roll_number);
      else linked += row.length;
    }
    return { linked, notFound };
  });

export const listMissingPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("students")
      .select("id, roll_number, full_name, department, photo_status")
      .or("photo_status.eq.missing,photo_status.eq.invalid_dimensions,photo_status.eq.needs_review")
      .order("roll_number", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const markPhotoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        roll_number: z.string().min(1),
        status: z.enum(["missing", "linked", "invalid_dimensions", "needs_review"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("students")
      .update({ photo_status: data.status } as never)
      .eq("roll_number", data.roll_number);
    if (error) throw new Error(error.message);
    return { ok: true };
  });