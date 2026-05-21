import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_ROWS = 500;

const optStr = (max: number, extra?: (s: z.ZodString) => z.ZodString) => {
  let base = z.string().trim().max(max);
  if (extra) base = extra(base);
  return z.preprocess((v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  }, base.nullable());
};

const studentRowSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(200),
  roll_number: z.string().trim().min(1, "Roll number is required").max(100),
  department: optStr(200),
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

const pick = (r: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "") return r[k];
    const lk = k.toLowerCase();
    for (const actual of Object.keys(r)) {
      if (actual.toLowerCase().replace(/[\s_-]/g, "") === lk.replace(/[\s_-]/g, "")) {
        const v = r[actual];
        if (v !== undefined && v !== null && String(v).trim() !== "") return v;
      }
    }
  }
  return null;
};

const importSchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1).max(MAX_ROWS, `Maximum ${MAX_ROWS} rows per upload`),
  filename: z.string().min(1).max(500),
});

export const importStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const normalizedRows = data.rows.map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        full_name: String(pick(r, "full_name", "name") ?? "").trim(),
        roll_number: String(pick(r, "roll_number", "rollno", "roll") ?? "").trim(),
        department: pick(r, "department", "dept"),
        email: pick(r, "email", "email_id"),
        mobile_number: pick(r, "mobile_number", "mobile", "phone"),
        aadhaar_number: pick(r, "aadhaar_number", "aadhaar", "aadhar"),
        pincode: pick(r, "pincode", "pin", "zip"),
        address: pick(r, "address"),
        city: pick(r, "city"),
        state: pick(r, "state"),
        gender: pick(r, "gender"),
        batch: pick(r, "batch", "year"),
        stream: pick(r, "stream"),
        university: pick(r, "university"),
        emergency_contact: pick(r, "emergency_contact", "emergency"),
      };
    });

    const validRows: Record<string, unknown>[] = [];
    const errors: { row: number; field: string; message: string }[] = [];

    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      const parse = studentRowSchema.safeParse(row);
      if (parse.success) {
        validRows.push({
          ...parse.data,
          created_by: userId,
        });
      } else {
        for (const issue of parse.error.issues) {
          errors.push({
            row: i + 1,
            field: issue.path.join("."),
            message: issue.message,
          });
        }
      }
    }

    if (validRows.length === 0) {
      return { inserted: 0, total: data.rows.length, errors };
    }

    const { error } = await supabase.from("students").insert(validRows as never);

    if (error) {
      throw new Error(`Insert failed: ${error.message}`);
    }

    // Log upload metadata
    await supabase.from("uploads").insert({
      filename: data.filename,
      kind: "excel",
      total_rows: data.rows.length,
      valid_rows: validRows.length,
      error_rows: errors.length > 0 ? Math.max(1, data.rows.length - validRows.length) : 0,
      uploaded_by: userId,
      status: errors.length > 0 ? "partial" : "completed",
      errors: errors.length > 0 ? errors : null,
    } as never);

    return { inserted: validRows.length, total: data.rows.length, errors };
  });
