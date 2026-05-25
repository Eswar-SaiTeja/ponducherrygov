import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const optStr = (max: number, extra?: (s: z.ZodString) => z.ZodString) => {
  let base = z.string().trim().max(max);
  if (extra) base = extra(base);
  return z.preprocess((v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  }, base.nullable());
};

const createStudentSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(200),
  roll_number: z.string().trim().min(1, "Roll number is required").max(100),
  department: optStr(200),
  date_of_birth: optStr(20, (s) => s.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")),
  email: optStr(255, (s) => s.email("Invalid email")),
  mobile_number: optStr(20, (s) => s.regex(/^[0-9+\- ]+$/, "Mobile must contain digits only")),
  aadhaar_number: optStr(12, (s) => s.regex(/^[0-9]{12}$/, "Aadhaar must be 12 digits")),
  pincode: optStr(6, (s) => s.regex(/^[0-9]{6}$/, "Pincode must be 6 digits")),
  address: optStr(500),
  city: optStr(100),
  state: optStr(100),
  gender: optStr(50),
  batch: optStr(50),
  stream: optStr(100),
  university: optStr(200),
  emergency_contact: optStr(20, (s) => s.regex(/^[0-9+\- ]+$/, "Contact must contain digits only")),
});

export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createStudentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("students")
      .insert({ ...data, created_by: userId } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("students").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("students").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: data.ids.length };
  });