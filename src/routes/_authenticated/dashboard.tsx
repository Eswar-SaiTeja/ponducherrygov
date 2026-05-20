import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, ShieldCheck, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const [stats, setStats] = useState({ students: 0, cards: 0, pending: 0, errors: 0 });

  useEffect(() => {
    (async () => {
      const [s, c, p] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }),
        supabase.from("cards").select("*", { count: "exact", head: true }).eq("status", "generated"),
        supabase.from("students").select("*", { count: "exact", head: true }).eq("kyc_status", "pending"),
      ]);
      setStats({ students: s.count ?? 0, cards: c.count ?? 0, pending: p.count ?? 0, errors: 0 });
    })();
  }, []);

  const tiles = [
    { label: "Total Students", value: stats.students, icon: Users, tone: "primary" },
    { label: "Active Cards", value: stats.cards, icon: CreditCard, tone: "success" },
    { label: "Pending Verification", value: stats.pending, icon: ShieldCheck, tone: "warning" },
    { label: "Exceptions", value: stats.errors, icon: AlertTriangle, tone: "destructive" },
  ];

  const chartData = Array.from({ length: 7 }, (_, i) => ({
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
    cards: Math.round(20 + Math.random() * 60),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of student records, KYC, and card generation</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t, i) => (
          <motion.div key={t.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
                <div className="h-9 w-9 rounded-lg bg-[image:var(--gradient-primary)] flex items-center justify-center text-primary-foreground">
                  <t.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{t.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Cards generated (last 7 days)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="day" stroke="currentColor" opacity={0.5} />
              <YAxis stroke="currentColor" opacity={0.5} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Area type="monotone" dataKey="cards" stroke="var(--primary)" fill="url(#g)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}