import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, AlertCircle, Download, FileText, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { importStudents } from "@/lib/uploads.functions";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/uploads")({ component: Uploads });

const COLUMNS = [
  "full_name","roll_number","department","email","mobile_number",
  "aadhaar_number","pincode","address","city","state","gender","batch","stream","university","emergency_contact",
];
const MAX = 2000;

type Row = Record<string, string>;

function Uploads() {
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState("");
  const [errors, setErrors] = useState<{ row: number; field: string; message: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const importFn = useServerFn(importStudents);

  const normalizeKey = (k: string) => k.toLowerCase().replace(/[\s_-]/g, "");
  const mapRow = (raw: Record<string, unknown>): Row => {
    const lookup = new Map(Object.keys(raw).map((k) => [normalizeKey(k), k]));
    const out: Row = {};
    for (const c of COLUMNS) {
      const src = lookup.get(normalizeKey(c));
      out[c] = src ? String(raw[src] ?? "").trim() : "";
    }
    return out;
  };

  const onFile = async (file: File) => {
    setErrors([]);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    if (rows.length === 0) {
      toast.error("No rows found in the file.");
      return;
    }
    if (rows.length > MAX) {
      toast.warning(`File has ${rows.length} rows. Only the first ${MAX} will be imported.`);
    }
    const mapped = rows.slice(0, MAX).map(mapRow);
    setAllRows(mapped);
    setFilename(file.name);
    toast.info(`${mapped.length} rows parsed. Edit the preview before importing.`);
  };

  const updateCell = (rowIdx: number, col: string, val: string) => {
    setAllRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [col]: val };
      return next;
    });
  };

  const removeRow = (rowIdx: number) => {
    setAllRows((prev) => prev.filter((_, i) => i !== rowIdx));
  };

  const downloadTemplate = () => {
    const example = [
      { full_name: "Priya Sharma", roll_number: "BCA2024001", department: "BCA", email: "priya@example.com", mobile_number: "9876543210", aadhaar_number: "123456789012", pincode: "605001", gender: "F", batch: "2024", stream: "Computer Apps" },
      { full_name: "Arjun Kumar", roll_number: "BCA2024002", department: "BCA", email: "arjun@example.com", mobile_number: "9123456780", aadhaar_number: "", pincode: "605002", gender: "M", batch: "2024", stream: "Computer Apps" },
    ];
    const ws = XLSX.utils.json_to_sheet(example, { header: COLUMNS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "students_template.xlsx");
  };

  const importAll = async () => {
    if (!allRows.length) return;
    setBusy(true);
    setProgress(5);
    let inc = 5;
    const tick = setInterval(() => {
      inc = Math.min(inc + 7, 90);
      setProgress(inc);
    }, 250);
    try {
      const result = await importFn({
        data: { rows: allRows as unknown as Record<string, unknown>[], filename },
      });
      clearInterval(tick);
      setProgress(100);
      setErrors(result.errors);
      if (result.inserted === 0) {
        toast.error(`0 imported. ${result.errors.length} validation error(s) — see details below.`);
      } else if (result.errors.length > 0) {
        toast.warning(`${result.inserted} of ${result.total} rows imported. ${result.errors.length} errors below.`);
      } else {
        toast.success(`${result.inserted} students imported successfully.`);
        setAllRows([]); setFilename("");
      }
    } catch (err: unknown) {
      clearInterval(tick);
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const errorRowIdx = new Set(errors.map((e) => e.row - 1));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Upload Center</h1>
        <div className="flex gap-2">
          <Button onClick={downloadTemplate} variant="outline" size="sm">
            <Download className="h-4 w-4" /> Sample template
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/uploads/guide"><BookOpen className="h-4 w-4" /> Validation guide</Link>
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Bulk Excel / CSV upload</CardTitle></CardHeader>
        <CardContent>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${dragging ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30"}`}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <div className="font-medium">Drag & drop or click to upload</div>
            <div className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv · up to {MAX.toLocaleString()} rows</div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>

          {progress > 0 && (
            <div className="mt-4 space-y-1">
              <Progress value={progress} />
              <div className="text-xs text-muted-foreground text-right">{progress}%</div>
            </div>
          )}

          {allRows.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{filename}</span>
                <span className="text-muted-foreground">({allRows.length} rows)</span>
                <div className="ml-auto flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setAllRows([]); setFilename(""); setErrors([]); }}>Clear</Button>
                  <Button onClick={importAll} disabled={busy} size="sm">
                    {busy ? "Importing..." : `Import ${allRows.length} rows`}
                  </Button>
                </div>
              </div>
              <div className="border rounded-md overflow-auto max-h-[480px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      {COLUMNS.map((c) => <TableHead key={c} className="whitespace-nowrap">{c}</TableHead>)}
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allRows.slice(0, 200).map((r, i) => (
                      <TableRow key={i} className={errorRowIdx.has(i) ? "bg-destructive/10" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        {COLUMNS.map((c) => (
                          <TableCell key={c} className="p-1">
                            <Input
                              value={r[c] ?? ""}
                              onChange={(e) => updateCell(i, c, e.target.value)}
                              className="h-7 text-xs min-w-32"
                            />
                          </TableCell>
                        ))}
                        <TableCell className="p-1">
                          <Button variant="ghost" size="sm" onClick={() => removeRow(i)} className="h-7 text-xs">×</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {allRows.length > 200 && (
                  <div className="p-2 text-xs text-muted-foreground text-center border-t">
                    Showing first 200 of {allRows.length} rows in preview. All rows will be imported.
                  </div>
                )}
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-sm font-medium text-destructive">Validation errors ({errors.length})</div>
              <div className="bg-destructive/10 border border-destructive/30 rounded p-3 text-xs max-h-64 overflow-auto">
                {errors.slice(0, 100).map((e, i) => (
                  <div key={i}>Row {e.row} · <span className="font-medium">{e.field || "row"}</span>: {e.message}</div>
                ))}
                {errors.length > 100 && <div className="mt-1 text-muted-foreground">…and {errors.length - 100} more</div>}
              </div>
            </div>
          )}
          <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              Server-side validation enforces: full name & roll number required, email format, mobile digits, Aadhaar 12 digits, pincode 6 digits. Max {MAX.toLocaleString()} rows per upload, processed in batches of 100.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
