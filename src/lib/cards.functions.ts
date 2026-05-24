import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const genSchema = z.object({
  student_id: z.string().uuid(),
  card_type: z.enum(["pvc", "debit"]),
});

function makeCardNumber(prefix: string) {
  const n = Math.floor(Math.random() * 1e12).toString().padStart(12, "0");
  return `${prefix}-${n.slice(0, 4)}-${n.slice(4, 8)}-${n.slice(8, 12)}`;
}

export const generateCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => genSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: s, error: sErr } = await supabase
      .from("students")
      .select("id, full_name, roll_number, kyc_status, verified")
      .eq("id", data.student_id)
      .single();
    if (sErr || !s) throw new Error("Student not found");
    if (s.kyc_status !== "approved" || !s.verified)
      throw new Error("Student must be KYC-approved and verified");

    const prefix = data.card_type === "pvc" ? "PVC" : "DBT";
    const card_number = makeCardNumber(prefix);
    const validity = new Date();
    validity.setFullYear(validity.getFullYear() + 4);
    const validityStr = validity.toISOString().slice(0, 10);
    const qr_payload = JSON.stringify({
      t: data.card_type,
      n: card_number,
      sid: s.id,
      roll: s.roll_number,
      v: validityStr,
    });

    const { data: card, error } = await supabase
      .from("cards")
      .insert({
        student_id: s.id,
        card_type: data.card_type,
        card_number,
        qr_payload,
        validity: validityStr,
        status: "generated",
        generated_at: new Date().toISOString(),
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);

    const statusCol = data.card_type === "pvc" ? "pvc_status" : "debit_status";
    await supabase.from("students").update({ [statusCol]: "generated" } as never).eq("id", s.id);

    return { card };
  });

export const updateCardStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      card_id: z.string().uuid(),
      status: z.enum(["pending", "generated", "dispatched", "delivered", "failed"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("cards")
      .update({ status: data.status } as never)
      .eq("id", data.card_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
