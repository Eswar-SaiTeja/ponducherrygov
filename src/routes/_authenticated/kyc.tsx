import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, CheckCircle2, XCircle, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/kyc")({ component: KycPage });

type KycStatus = "pending" | "in_review" | "approved" | "rejected";
type Row = {
  id: string;
  full_name: string;
  roll_number: string;
  department: string | null;
  email: string | null;
  mobile_number: string | null;
  aadhaar_number: string | null;
  kyc_status: KycStatus;
  verified: boolean | null;
};

const STATUSES: { value: KycStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function KycPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<KycStatus | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("id,full_name,roll_number,department,email,mobile_number,aadhaar_number,kyc_status,verified")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: KycStatus) => {
    setPendingId(id);
    const { error } = await supabase
      .from("students")
      .update({ kyc_status: status, verified: status === "approved" })
      .eq("id", id);
    setPendingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`KYC ${status}`);
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, kyc_status: status, verified: status === "approved" } : r));
  };

  const filtered = rows.filter((r) => {
    if (tab !== "all" && r.kyc_status !== tab) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return r.full_name.toLowerCase().includes(s)
      || r.roll_number.toLowerCase().includes(s)
      || (r.email ?? "").toLowerCase().includes(s)
      || (r.aadhaar_number ?? "").includes(s);
  });

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s.value] = s.value === "all" ? rows.length : rows.filter((r) => r.kyc_status === s.value).length;
    return acc;
  }, {});

  const statusVariant = (s: KycStatus) =>
    s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">KYC Verification</h1>
        <p className="text-sm text-muted-foreground">Review and approve student KYC submissions.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as KycStatus | "all")}>
        <TabsList>
          {STATUSES.map((s) => (
            <TabsTrigger key={s.value} value={s.value}>
              {s.label} <span className="ml-1.5 text-xs text-muted-foreground">({counts[s.value] ?? 0})</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="p-4">
        <div className="relative mb-3">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, roll, email or Aadhaar" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Roll #</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Aadhaar</TableHead>
              <TableHead>KYC</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No students match this filter.</TableCell></TableRow>
            ) : filtered.map((r) => {
              const busy = pendingId === r.id;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell>{r.roll_number}</TableCell>
                  <TableCell>{r.email ?? "—"}</TableCell>
                  <TableCell>{r.mobile_number ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.aadhaar_number ?? "—"}</TableCell>
                  <TableCell><Badge variant={statusVariant(r.kyc_status)}>{r.kyc_status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {r.kyc_status !== "in_review" && r.kyc_status !== "approved" && r.kyc_status !== "rejected" && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => updateStatus(r.id, "in_review")}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> Review
                        </Button>
                      )}
                      {r.kyc_status !== "approved" && (
                        <Button size="sm" variant="default" disabled={busy} onClick={() => updateStatus(r.id, "approved")}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                      )}
                      {r.kyc_status !== "rejected" && (
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => updateStatus(r.id, "rejected")}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}