import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Search, Loader2, Download } from "lucide-react";
import { generateCard, updateCardStatus } from "@/lib/cards.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cards")({ component: CardsPage });

type Student = {
  id: string; full_name: string; roll_number: string; department: string | null;
  university: string | null; batch: string | null; photo_url: string | null;
  kyc_status: string; verified: boolean | null; pvc_status: string; debit_status: string;
};
type CardRow = {
  id: string; student_id: string; card_type: string; card_number: string | null;
  qr_payload: string | null; validity: string | null; status: string; generated_at: string | null;
  students?: { full_name: string; roll_number: string; department: string | null } | null;
};

const STATUS_OPTIONS = ["pending", "generated", "dispatched", "delivered", "failed"] as const;

function CardsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<CardRow | null>(null);
  const doGenerate = useServerFn(generateCard);
  const doUpdateStatus = useServerFn(updateCardStatus);

  const load = async () => {
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from("students")
        .select("id,full_name,roll_number,department,university,batch,photo_url,kyc_status,verified,pvc_status,debit_status")
        .eq("kyc_status", "approved").eq("verified", true)
        .order("full_name", { ascending: true }).limit(1000),
      supabase.from("cards")
        .select("id,student_id,card_type,card_number,qr_payload,validity,status,generated_at,students(full_name,roll_number,department)")
        .order("created_at", { ascending: false }).limit(500),
    ]);
    setStudents((s as Student[]) ?? []);
    setCards((c as unknown as CardRow[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async (student_id: string, card_type: "pvc" | "debit") => {
    const key = `${student_id}:${card_type}`;
    setBusyId(key);
    try {
      const res: any = await doGenerate({ data: { student_id, card_type } });
      toast.success(`${card_type.toUpperCase()} card generated`);
      await load();
      if (res?.card) setPreview(res.card as CardRow);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate card");
    } finally {
      setBusyId(null);
    }
  };

  const handleStatus = async (card_id: string, status: typeof STATUS_OPTIONS[number]) => {
    try {
      await doUpdateStatus({ data: { card_id, status } });
      toast.success("Status updated");
      setCards((prev) => prev.map((c) => (c.id === card_id ? { ...c, status } : c)));
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  const filtered = students.filter((s) => !q ||
    s.full_name.toLowerCase().includes(q.toLowerCase()) ||
    s.roll_number.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Card Generation</h1>
        <p className="text-sm text-muted-foreground">Generate PVC ID cards and Debit cards for verified students.</p>
      </div>

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="issued">Issued cards ({cards.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <Card className="p-4">
            <div className="relative mb-3">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search verified students" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Roll #</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>PVC</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No KYC-approved students found.
                  </TableCell></TableRow>
                ) : filtered.map((s) => {
                  const pvcBusy = busyId === `${s.id}:pvc`;
                  const debitBusy = busyId === `${s.id}:debit`;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell>{s.roll_number}</TableCell>
                      <TableCell>{s.department ?? "—"}</TableCell>
                      <TableCell><Badge variant={s.pvc_status === "not_generated" ? "outline" : "default"}>{s.pvc_status}</Badge></TableCell>
                      <TableCell><Badge variant={s.debit_status === "not_generated" ? "outline" : "default"}>{s.debit_status}</Badge></TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" disabled={pvcBusy || s.pvc_status !== "not_generated"}
                          onClick={() => handleGenerate(s.id, "pvc")}>
                          {pvcBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />} PVC
                        </Button>
                        <Button size="sm" disabled={debitBusy || s.debit_status !== "not_generated"}
                          onClick={() => handleGenerate(s.id, "debit")}>
                          {debitBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />} Debit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="issued" className="space-y-4">
          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Card #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Roll #</TableHead>
                  <TableHead>Valid till</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Preview</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No cards issued yet.</TableCell></TableRow>
                ) : cards.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.card_number}</TableCell>
                    <TableCell><Badge variant="outline">{c.card_type.toUpperCase()}</Badge></TableCell>
                    <TableCell>{c.students?.full_name ?? "—"}</TableCell>
                    <TableCell>{c.students?.roll_number ?? "—"}</TableCell>
                    <TableCell>{c.validity ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={c.status} onValueChange={(v) => handleStatus(c.id, v as any)}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setPreview(c)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {preview && <CardPreviewDialog card={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function CardPreviewDialog({ card, onClose }: { card: CardRow; onClose: () => void }) {
  const isDebit = card.card_type === "debit";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={onClose}>
      <div className="max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <Card className="overflow-hidden">
          <CardHeader><CardTitle className="text-base">{isDebit ? "Debit Card" : "Student ID Card"}</CardTitle></CardHeader>
          <CardContent>
            <div className={`rounded-2xl p-5 text-primary-foreground shadow-[var(--shadow-elegant)] aspect-[1.6/1] flex flex-col justify-between ${isDebit ? "bg-[image:var(--gradient-primary)]" : "bg-[image:var(--gradient-primary)]"}`}>
              <div>
                <div className="text-xs opacity-80">{isDebit ? "Lovable Debit" : "Student ID"}</div>
                <div className="text-lg font-semibold mt-1">{card.students?.full_name ?? "Student"}</div>
                <div className="text-xs opacity-80">{card.students?.department ?? ""} · {card.students?.roll_number ?? ""}</div>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-mono text-sm tracking-wider">{card.card_number}</div>
                  <div className="text-xs opacity-80">Valid till {card.validity ?? "—"}</div>
                </div>
                <div className="bg-white p-1 rounded">
                  <QRCodeSVG value={card.qr_payload ?? card.card_number ?? "CARD"} size={64} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => window.print()}><Download className="h-4 w-4" /> Print</Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
