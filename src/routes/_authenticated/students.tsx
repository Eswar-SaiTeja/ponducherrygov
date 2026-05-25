import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Trash2, Loader2 } from "lucide-react";
import { deleteStudent, deleteStudents } from "@/lib/students.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/students")({ component: StudentsPage });

type Row = { id: string; full_name: string; roll_number: string; department: string | null; email: string | null; kyc_status: string; pvc_status: string };

function StudentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const doDelete = useServerFn(deleteStudent);
  const doBulkDelete = useServerFn(deleteStudents);

  const load = async () => {
    const { data } = await supabase.from("students").select("id,full_name,roll_number,department,email,kyc_status,pvc_status").order("created_at", { ascending: false }).limit(1000);
    setRows((data as Row[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => !q || r.full_name.toLowerCase().includes(q.toLowerCase()) || r.roll_number.toLowerCase().includes(q.toLowerCase()));

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someSelected = filtered.some((r) => selected.has(r.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete student "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await doDelete({ data: { id } });
      toast.success("Student deleted");
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected student(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await doBulkDelete({ data: { ids } });
      toast.success(`${ids.length} student(s) deleted`);
      setRows((prev) => prev.filter((r) => !selected.has(r.id)));
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message || "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-sm text-muted-foreground">{rows.length} records</p>
        </div>
        <Button asChild><Link to="/students/new"><Plus className="h-4 w-4 mr-1" /> Add Student</Link></Button>
      </div>
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or roll number" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" disabled={bulkDeleting} onClick={handleBulkDelete}>
              {bulkDeleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete {selected.size}
            </Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} aria-checked={allSelected ? "true" : someSelected ? "mixed" : "false"} onCheckedChange={toggleSelectAll} />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Roll #</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>KYC</TableHead>
              <TableHead>PVC</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No students yet. Add one or upload an Excel file.
                </TableCell>
              </TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleRow(r.id)} />
                </TableCell>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell>{r.roll_number}</TableCell>
                <TableCell>{r.department ?? "—"}</TableCell>
                <TableCell>{r.email ?? "—"}</TableCell>
                <TableCell><Badge variant={r.kyc_status === "approved" ? "default" : "secondary"}>{r.kyc_status}</Badge></TableCell>
                <TableCell><Badge variant="outline">{r.pvc_status}</Badge></TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" disabled={deletingId === r.id} onClick={() => handleDelete(r.id, r.full_name)}>
                    <Trash2 className="h-4 w-4" />
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