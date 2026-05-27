import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, ShieldCheck, AlertTriangle, CreditCard, CheckCircle2, XCircle, Activity, Loader2 } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { getDashboardMetrics } from "@/lib/dashboard.functions";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const fetchMetrics = useServerFn(getDashboardMetrics);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: () => fetchMetrics(),
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const tiles = [
    { label: "Uploads Today", value: data.tiles.uploadsToday, icon: Upload },
    { label: "KYC Pending", value: data.tiles.kycPending, icon: ShieldCheck },
    { label: "Failed Validations", value: data.tiles.failedValidations, icon: AlertTriangle },
    { label: "Card Print Queue", value: data.tiles.cardQueue, icon: CreditCard },
    { label: "Generated Today", value: data.tiles.generatedToday, icon: CheckCircle2 },
    { label: "Failed Cards", value: data.tiles.failedCards, icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live snapshot of uploads, KYC, validations and card production.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-muted-foreground">API {data.tiles.apiStatus}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">{t.label}</CardTitle>
              <t.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{t.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Daily uploads (14 days)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.uploadsByDay}>
                <defs>
                  <linearGradient id="up" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="day" stroke="currentColor" opacity={0.5} fontSize={11} />
                <YAxis stroke="currentColor" opacity={0.5} fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#up)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Verification trend (14 days)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.verifyByDay}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="day" stroke="currentColor" opacity={0.5} fontSize={11} />
                <YAxis stroke="currentColor" opacity={0.5} fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="approved" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="rejected" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Card generation by status</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.cardStatus}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="status" stroke="currentColor" opacity={0.5} fontSize={11} />
                <YAxis stroke="currentColor" opacity={0.5} fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Recent activity</CardTitle></CardHeader>
          <CardContent>
            {data.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No activity yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-1 border-b last:border-0">
                    <span className="truncate">
                      <Badge variant="outline" className="mr-2 text-xs">{a.entity ?? "system"}</Badge>
                      {a.action}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Institution performance</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Verified</TableHead>
                <TableHead className="text-right">Verified %</TableHead>
                <TableHead className="text-right">Cards</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.institutionStats.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No data.</TableCell></TableRow>
              ) : data.institutionStats.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell className="text-right">{i.students}</TableCell>
                  <TableCell className="text-right">{i.verified}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={i.verifiedPct >= 80 ? "default" : i.verifiedPct >= 40 ? "secondary" : "destructive"}>{i.verifiedPct}%</Badge>
                  </TableCell>
                  <TableCell className="text-right">{i.cards}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}