import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, Loader2, Pencil } from "lucide-react";
import { listExceptions, getExceptionCounts, type ExceptionCategory } from "@/lib/exceptions.functions";
import { deleteStudents } from "@/lib/students.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/exceptions")({ component: ExceptionsPage });

const CATS: { key: ExceptionCategory; label: string }[] = [
  { key: "validation", label: "Validation Error" },
  { key: "missing_photo", label: "Missing Photo" },
  { key: "dup_aadhaar", label: "Duplicate Aadhaar" },
  { key: "dup_mobile", label: "Duplicate Mobile" },
  { key: "kyc_rejected", label: "KYC Rejected" },
  { key: "card_failed", label: "Card Generation Failed" },
];

type Row = {
  id: string;
  full_name: string | null;
  roll_number: string;
  department: string | null;
  email: string | null;
  mobile_number: string | null;
  aadhaar_number: string | null;
  photo_url: string | null;
  kyc_status: string;
  validation_errors: unknown;
};

function ExceptionsPage() {
  const [cat, setCat] = useState<ExceptionCategory>("validation");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fetchList = useServerFn(listExceptions);
  const fetchCounts = useServerFn(getExceptionCounts);
  const doBulkDelete = useServerFn(deleteStudents);

  const counts = useQuery({ queryKey: ["exc-counts"], queryFn: () => fetchCounts() });
  const list = useQuery({
    queryKey: ["exc", cat],
    queryFn: () => fetchList({ data: { category: cat } }),
  });

  const rows = (list.data?.rows ?? []) as Row[];

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  };
  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const downloadCsv = () => {
    const target = selected.size > 0 ? rows.filter((r) => selected.has(r.id)) : rows;
    if (target.length === 0) { toast.info("No rows to export"); return; }
    const headers = ["id", "full_name", "roll_number", "department", "email", "mobile_number", "aadhaar_number", "kyc_status", "errors"];
    const escape = (v: unknown) => {
      const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of target) {
      lines.push([r.id, r.full_name, r.roll_number, r.department, r.email, r.mobile_number, r.aadhaar_number, r.kyc_status, r.validation_errors].map(escape).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exceptions-${cat}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} student record(s)? This cannot be undone.`)) return;
    try {
      await doBulkDelete({ data: { ids: Array.from(selected) } });
      toast.success(`Deleted ${selected.size} record(s)`);
      setSelected(new Set());
      list.refetch();
      counts.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const tabCount = (k: ExceptionCategory) => counts.data?.[k] ?? 0;

  const errorSummary = (r: Row) => {
    if (cat === "validation" && Array.isArray(r.validation_errors)) {
      return (r.validation_errors as Array<{ message?: string; field?: string }>).map((e) => e.message || e.field || "error").join("; ");
    }
    if (cat === "missing_photo") return "Photo not uploaded";
    if (cat === "dup_aadhaar") return `Duplicate aadhaar: ${r.aadhaar_number}`;
    if (cat === "dup_mobile") return `Duplicate mobile: ${r.mobile_number}`;
    if (cat === "kyc_rejected") return "KYC rejected";
    if (cat === "card_failed") return "Card generation failed";
    return "";
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Exceptions</h1>
        <p className="text-sm text-muted-foreground">Categorized issues requiring manual action. Filter, export, and resolve in bulk.</p>
      </div>

      <Tabs value={cat} onValueChange={(v) => { setCat(v as ExceptionCategory); setSelected(new Set()); }}>
        <TabsList className="flex-wrap h-auto">
          {CATS.map((c) => (
            <TabsTrigger key={c.key} value={c.key}>
              {c.label}
              <span className="ml-1.5 text-xs text-muted-foreground">({tabCount(c.key)})</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-sm text-muted-foreground">
            {selected.size > 0 ? `${selected.size} selected` : `${rows.length} record(s)`}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={downloadCsv}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export {selected.size > 0 ? "selected" : "all"} CSV
            </Button>
            {selected.size > 0 && (
              <Button size="sm" variant="destructive" onClick={bulkDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete {selected.size}
              </Button>
            )}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Roll #</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>KYC</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No exceptions in this category. </TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleRow(r.id)} /></TableCell>
                <TableCell className="font-medium">{r.full_name || "—"}</TableCell>
                <TableCell>{r.roll_number}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={errorSummary(r)}>{errorSummary(r)}</TableCell>
                <TableCell><Badge variant={r.kyc_status === "approved" ? "default" : r.kyc_status === "rejected" ? "destructive" : "secondary"}>{r.kyc_status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/students">
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}