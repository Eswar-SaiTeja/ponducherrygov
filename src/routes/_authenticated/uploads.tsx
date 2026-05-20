import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { importStudents } from "@/lib/uploads.functions";

export const Route = createFileRoute("/_authenticated/uploads")({ component: Uploads });

function Uploads() {
  const [allRows, setAllRows] = useState<Record<string, unknown>[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState("");
  const importFn = useServerFn(importStudents);

  const onFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    if (rows.length === 0) {
      toast.error("No rows found in the file.");
      return;
    }
    if (rows.length > 500) {
      toast.warning(`File has ${rows.length} rows. Only the first 500 will be imported.`);
    }
    setAllRows(rows);
    setPreview(rows.slice(0, 10));
    setFilename(file.name);
    toast.info(`${rows.length} rows parsed. Preview shows first 10.`);
  };

  const importAll = async () => {
    if (!allRows.length) return;
    setBusy(true);
    try {
      const result = await importFn({
        data: {
          rows: allRows.slice(0, 500),
          filename,
        },
      });
      if (result.errors.length > 0) {
        toast.warning(`${result.inserted} of ${result.total} rows imported. ${result.errors.length} validation errors found.`);
      } else {
        toast.success(`${result.inserted} students imported successfully.`);
      }
      setAllRows([]);
      setPreview([]);
      setFilename("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
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
          {allRows.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{filename}</span>
                <span className="text-muted-foreground">({allRows.length} rows, max 500 imported)</span>
              </div>
              <div className="text-sm font-medium">Preview (first 10 rows)</div>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64">{JSON.stringify(preview, null, 2)}</pre>
              <div className="flex justify-end">
                <Button onClick={importAll} disabled={busy}>
                  {busy ? "Importing..." : `Import ${Math.min(allRows.length, 500)} rows`}
                </Button>
              </div>
            </div>
          )}
          <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              Server-side validation enforces: full name & roll number required, email format, mobile digits, Aadhaar 12 digits, pincode 6 digits. Max 500 rows per upload.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
