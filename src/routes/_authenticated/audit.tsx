import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLogs } from "@/lib/audit.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/audit")({ component: AuditPage });

type LogRow = {
  id: string;
  actor_id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
  actor: { full_name: string | null; email: string | null } | null;
};

function AuditPage() {
  const fetchLogs = useServerFn(listAuditLogs);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [page, setPage] = useState(0);
  const LIMIT = 50;

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchLogs({
        data: {
          action: action || undefined,
          entity: entity || undefined,
          limit: LIMIT,
          offset: page * LIMIT,
        },
      });
      setLogs(r.logs as LogRow[]);
      setTotal(r.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const exportCsv = () => {
    const headers = ["Time", "Actor", "Action", "Entity", "Entity ID", "Metadata"];
    const rows = logs.map((l) => [
      l.created_at,
      l.actor?.email ?? l.actor_id,
      l.action,
      l.entity ?? "",
      l.entity_id ?? "",
      JSON.stringify(l.metadata ?? {}),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-muted-foreground">{total} total events</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!logs.length}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <Input placeholder="Filter by action (e.g. aadhaar.reveal)" value={action} onChange={(e) => setAction(e.target.value)} className="max-w-xs" />
          <Input placeholder="Filter by entity (e.g. students)" value={entity} onChange={(e) => setEntity(e.target.value)} className="max-w-xs" />
          <Button size="sm" onClick={() => { setPage(0); load(); }} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Apply
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No log entries.</TableCell></TableRow>
            ) : logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">{format(new Date(l.created_at), "yyyy-MM-dd HH:mm:ss")}</TableCell>
                <TableCell className="text-xs">{l.actor?.email ?? l.actor?.full_name ?? l.actor_id.slice(0, 8)}</TableCell>
                <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                <TableCell className="text-xs">{l.entity ?? "—"}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ""}</TableCell>
                <TableCell className="text-xs font-mono max-w-md truncate">{JSON.stringify(l.metadata ?? {})}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-end gap-2 mt-3">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <Button size="sm" variant="outline" disabled={(page + 1) * LIMIT >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </Card>
    </div>
  );
}