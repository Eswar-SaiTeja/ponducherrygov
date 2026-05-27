import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, CheckCircle2, XCircle, Eye, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { updateKycStatus, bulkUpdateKyc, listKycHistory, listReasonTemplates } from "@/lib/kyc.functions";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/kyc")({ component: KycPage });

type KycStatus = "pending" | "in_review" | "approved" | "rejected";
type Action = "approved" | "rejected" | "in_review";
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ action: Action; ids: string[] } | null>(null);
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [drawerStudent, setDrawerStudent] = useState<Row | null>(null);

  const doUpdate = useServerFn(updateKycStatus);
  const doBulk = useServerFn(bulkUpdateKyc);
  const doHistory = useServerFn(listKycHistory);
  const fetchTemplates = useServerFn(listReasonTemplates);

  const templates = useQuery({ queryKey: ["kyc-templates"], queryFn: () => fetchTemplates() });
  const history = useQuery({
    queryKey: ["kyc-history", drawerStudent?.id],
    queryFn: () => doHistory({ data: { studentId: drawerStudent!.id } }),
    enabled: !!drawerStudent,
  });

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

  const openDialog = (action: Action, ids: string[]) => {
    setReason("");
    setRemarks("");
    setDialog({ action, ids });
  };

  const submitDialog = async () => {
    if (!dialog) return;
    const targetStatus: KycStatus = dialog.action;
    if (dialog.action === "rejected" && remarks.trim().length === 0) {
      toast.error("Remarks are required when rejecting");
      return;
    }
    setSubmitting(true);
    try {
      if (dialog.ids.length === 1) {
        await doUpdate({ data: { id: dialog.ids[0], status: targetStatus, reason: reason || null, remarks: remarks || null } });
      } else {
        await doBulk({ data: { ids: dialog.ids, status: targetStatus, reason: reason || null, remarks: remarks || null } });
      }
      toast.success(`KYC ${targetStatus} for ${dialog.ids.length} record(s)`);
      setRows((prev) => prev.map((r) => dialog.ids.includes(r.id) ? { ...r, kyc_status: targetStatus, verified: targetStatus === "approved" } : r));
      setDialog(null);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = rows.filter((r) => {
    if (tab !== "all" && r.kyc_status !== tab) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (r.full_name ?? "").toLowerCase().includes(s)
      || r.roll_number.toLowerCase().includes(s)
      || (r.email ?? "").toLowerCase().includes(s)
      || (r.aadhaar_number ?? "").includes(s);
  });

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s.value] = s.value === "all" ? rows.length : rows.filter((r) => r.kyc_status === s.value).length;
    return acc;
  }, {});

  const statusVariant = (s: KycStatus) =>
    s === "approved" ? "default" : s === "rejected" ? "destructive" : s === "in_review" ? "outline" : "secondary";

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
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

  const filteredTemplates = (templates.data?.templates ?? []).filter((t: { kind: string }) =>
    dialog?.action === "rejected" ? t.kind === "rejection" : dialog?.action === "approved" ? t.kind === "approval" : true
  );

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
        {selected.size > 0 && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-muted/40">
            <span className="text-sm">{selected.size} selected</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="default" onClick={() => openDialog("approved", Array.from(selected))}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Bulk approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => openDialog("rejected", Array.from(selected))}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Bulk reject
              </Button>
            </div>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
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
              <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No students match this filter.</TableCell></TableRow>
            ) : filtered.map((r) => {
              return (
                <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                  <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleRow(r.id)} /></TableCell>
                  <TableCell className="font-medium">
                    <button className="text-left hover:underline" onClick={() => setDrawerStudent(r)}>{r.full_name ?? "—"}</button>
                  </TableCell>
                  <TableCell>{r.roll_number}</TableCell>
                  <TableCell>{r.email ?? "—"}</TableCell>
                  <TableCell>{r.mobile_number ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.aadhaar_number ?? "—"}</TableCell>
                  <TableCell><Badge variant={statusVariant(r.kyc_status)}>{r.kyc_status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDrawerStudent(r)} title="Audit trail">
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      {r.kyc_status !== "in_review" && r.kyc_status !== "approved" && r.kyc_status !== "rejected" && (
                        <Button size="sm" variant="outline" onClick={() => openDialog("in_review", [r.id])}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> Review
                        </Button>
                      )}
                      {r.kyc_status !== "approved" && (
                        <Button size="sm" variant="default" onClick={() => openDialog("approved", [r.id])}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                      )}
                      {r.kyc_status !== "rejected" && (
                        <Button size="sm" variant="destructive" onClick={() => openDialog("rejected", [r.id])}>
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

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.action === "approved" ? "Approve" : dialog?.action === "rejected" ? "Reject" : "Mark as in review"} — {dialog?.ids.length} record(s)
            </DialogTitle>
            <DialogDescription>
              {dialog?.action === "rejected" ? "Remarks are required for rejection." : "Add an optional reason and remarks for the audit trail."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {dialog?.action !== "in_review" && filteredTemplates.length > 0 && (
              <div className="space-y-1.5">
                <Label>Reason template</Label>
                <Select value={reason} onValueChange={(v) => {
                  setReason(v);
                  const tpl = filteredTemplates.find((t: { label: string }) => t.label === v);
                  if (tpl && !remarks) setRemarks(tpl.body);
                }}>
                  <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
                  <SelectContent>
                    {filteredTemplates.map((t: { id: string; label: string }) => (
                      <SelectItem key={t.id} value={t.label}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Remarks {dialog?.action === "rejected" && <span className="text-destructive">*</span>}</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add details for the audit log..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={submitting}>Cancel</Button>
            <Button onClick={submitDialog} disabled={submitting} variant={dialog?.action === "rejected" ? "destructive" : "default"}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!drawerStudent} onOpenChange={(o) => !o && setDrawerStudent(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{drawerStudent?.full_name ?? "Student"}</SheetTitle>
            <SheetDescription>Roll # {drawerStudent?.roll_number}</SheetDescription>
          </SheetHeader>
          {drawerStudent && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-muted-foreground">Email</div><div>{drawerStudent.email ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Mobile</div><div>{drawerStudent.mobile_number ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Aadhaar</div><div className="font-mono">{drawerStudent.aadhaar_number ? `XXXX-XXXX-${drawerStudent.aadhaar_number.slice(-4)}` : "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">KYC</div><Badge variant={statusVariant(drawerStudent.kyc_status)}>{drawerStudent.kyc_status}</Badge></div>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5"><History className="h-4 w-4" /> Audit trail</h3>
                {history.isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (history.data?.history ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No KYC actions recorded yet.</p>
                ) : (
                  <ol className="space-y-3 border-l pl-4">
                    {(history.data!.history as Array<{ id: string; action: string; reason: string | null; remarks: string | null; previous_status: string | null; new_status: string | null; created_at: string; reviewer_name: string }>).map((h) => (
                      <li key={h.id} className="relative">
                        <div className="absolute -left-[1.4rem] top-1.5 h-2 w-2 rounded-full bg-primary" />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={h.action === "approve" ? "default" : h.action === "reject" ? "destructive" : "outline"}>{h.action}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}</span>
                        </div>
                        <div className="text-sm mt-1">
                          <span className="text-muted-foreground">{h.previous_status ?? "—"}</span>
                          <span className="mx-1">→</span>
                          <span>{h.new_status ?? "—"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">by {h.reviewer_name}</div>
                        {h.reason && <div className="text-xs mt-1"><span className="font-medium">Reason:</span> {h.reason}</div>}
                        {h.remarks && <div className="text-xs mt-0.5 text-muted-foreground">{h.remarks}</div>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}