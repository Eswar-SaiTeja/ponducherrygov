import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/students")({ component: StudentsPage });

type Row = { id: string; full_name: string; roll_number: string; department: string | null; email: string | null; kyc_status: string; pvc_status: string };

function StudentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("students").select("id,full_name,roll_number,department,email,kyc_status,pvc_status").order("created_at", { ascending: false }).limit(100);
      setRows((data as Row[]) ?? []);
    })();
  }, []);

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
              <TableHead>Name</TableHead><TableHead>Roll #</TableHead><TableHead>Department</TableHead><TableHead>Email</TableHead><TableHead>KYC</TableHead><TableHead>PVC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No students yet. Add one or upload an Excel file.</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell>{r.roll_number}</TableCell>
                <TableCell>{r.department ?? "—"}</TableCell>
                <TableCell>{r.email ?? "—"}</TableCell>
                <TableCell><Badge variant={r.kyc_status === "approved" ? "default" : "secondary"}>{r.kyc_status}</Badge></TableCell>
                <TableCell><Badge variant="outline">{r.pvc_status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}