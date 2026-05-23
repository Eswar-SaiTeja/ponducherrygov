import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Trash2 } from "lucide-react";
import { deleteStudent } from "@/lib/students.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/students")({ component: StudentsPage });

type Row = { id: string; full_name: string; roll_number: string; department: string | null; email: string | null; kyc_status: string; pvc_status: string };

function StudentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const doDelete = useServerFn(deleteStudent);

  const load = async () => {
    const { data } = await supabase.from("students").select("id,full_name,roll_number,department,email,kyc_status,pvc_status").order("created_at", { ascending: false }).limit(1000);
    setRows((data as Row[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete student "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await doDelete({ data: { id } });
      toast.success("Student deleted");
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = rows.filter((r) => !q || r.full_name.toLowerCase().includes(q.toLowerCase()) || r.roll_number.toLowerCase().includes(q.toLowerCase()));

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
        <div className="relative mb-3">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or roll number" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Roll #</TableHead><TableHead>Department</TableHead><TableHead>Email</TableHead><TableHead>KYC</TableHead><TableHead>PVC</TableHead><TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No students yet. Add one or upload an Excel file.</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id}>
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