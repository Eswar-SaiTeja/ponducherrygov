import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/uploads")({ component: Uploads });

function Uploads() {
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    setPreview(rows.slice(0, 10));
    toast.info(`${rows.length} rows parsed. Preview shows first 10.`);
  };

  const importAll = async () => {
    if (!preview.length) return;
    setBusy(true);
    const payload = preview.map((r) => ({
      full_name: String(r.full_name || r["Full Name"] || ""),
      roll_number: String(r.roll_number || r["Roll Number"] || ""),
      department: r.department ? String(r.department) : null,
      email: r.email ? String(r.email) : null,
      mobile_number: r.mobile_number ? String(r.mobile_number) : null,
    })).filter((r) => r.full_name && r.roll_number);
    const { error } = await supabase.from("students").insert(payload as never);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success(`${payload.length} students imported`); setPreview([]); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Upload Center</h1>
      <Card>
        <CardHeader><CardTitle>Bulk Excel / CSV upload</CardTitle></CardHeader>
        <CardContent>
          <label className="block border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:bg-accent/30 transition">
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <div className="font-medium">Click to upload</div>
            <div className="text-xs text-muted-foreground">Columns: full_name, roll_number, department, email, mobile_number</div>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          {preview.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Preview ({preview.length} rows)</div>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64">{JSON.stringify(preview, null, 2)}</pre>
              <div className="flex justify-end mt-3"><Button onClick={importAll} disabled={busy}>Import all</Button></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}