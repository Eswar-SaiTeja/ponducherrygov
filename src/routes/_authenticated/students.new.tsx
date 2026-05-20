import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/students/new")({ component: AddStudent });

const fields: { key: string; label: string; type?: string }[] = [
  { key: "full_name", label: "Full Name" },
  { key: "roll_number", label: "Roll Number" },
  { key: "department", label: "Department" },
  { key: "date_of_birth", label: "Date of Birth", type: "date" },
  { key: "mobile_number", label: "Mobile Number" },
  { key: "email", label: "Email", type: "email" },
  { key: "aadhaar_number", label: "Aadhaar Number" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
  { key: "gender", label: "Gender" },
  { key: "batch", label: "Batch" },
  { key: "stream", label: "Stream" },
  { key: "university", label: "University" },
  { key: "emergency_contact", label: "Emergency Contact" },
];

function AddStudent() {
  const navigate = useNavigate();
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload: Record<string, string | null> = {};
    for (const f of fields) payload[f.key] = form[f.key] || null;
    payload.full_name = form.full_name; payload.roll_number = form.roll_number;
    const { error } = await supabase.from("students").insert(payload as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Student added");
    navigate({ to: "/students" });
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold">Add Student</h1>
      <Card>
        <CardHeader><CardTitle>Student details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input id={f.key} type={f.type ?? "text"} required={f.key === "full_name" || f.key === "roll_number"} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              </div>
            ))}
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/students" })}>Cancel</Button>
              <Button type="submit" disabled={busy}>Save Student</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}