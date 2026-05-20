import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_ROWS = 500;

const studentRowSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  roll_number: z.string().trim().min(1).max(100),
  department: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().email().max(255).nullable().optional(),
  mobile_number: z.string().trim().max(20).regex(/^[0-9+\- ]*$/, "Invalid mobile number format").nullable().optional(),
  aadhaar_number: z.string().trim().length(12).regex(/^[0-9]{12}$/, "Aadhaar must be exactly 12 digits").nullable().optional(),
  pincode: z.string().trim().length(6).regex(/^[0-9]{6}$/, "Pincode must be exactly 6 digits").nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(100).nullable().optional(),
  gender: z.string().trim().max(50).nullable().optional(),
  batch: z.string().trim().max(50).nullable().optional(),
  stream: z.string().trim().max(100).nullable().optional(),
  university: z.string().trim().max(200).nullable().optional(),
  emergency_contact: z.string().trim().max(20).regex(/^[0-9+\- ]*$/, "Invalid contact format").nullable().optional(),
});

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
        full_name: String(r.full_name ?? r["Full Name"] ?? "").trim(),
        roll_number: String(r.roll_number ?? r["Roll Number"] ?? "").trim(),
        department: r.department ? String(r.department).trim() : null,
        email: r.email ? String(r.email).trim() : null,
        mobile_number: r.mobile_number ? String(r.mobile_number).trim() : null,
        aadhaar_number: r.aadhaar_number ? String(r.aadhaar_number).trim() : null,
        pincode: r.pincode ? String(r.pincode).trim() : null,
        address: r.address ? String(r.address).trim() : null,
        city: r.city ? String(r.city).trim() : null,
        state: r.state ? String(r.state).trim() : null,
        gender: r.gender ? String(r.gender).trim() : null,
        batch: r.batch ? String(r.batch).trim() : null,
        stream: r.stream ? String(r.stream).trim() : null,
        university: r.university ? String(r.university).trim() : null,
        emergency_contact: r.emergency_contact ? String(r.emergency_contact).trim() : null,
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
