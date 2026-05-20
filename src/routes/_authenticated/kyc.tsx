import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const Route = createFileRoute("/_authenticated/kyc")({ component: () => (
  <div className="space-y-4"><h1 className="text-2xl font-bold">KYC Monitoring</h1>
    <Card><CardHeader><CardTitle>Pending approvals</CardTitle></CardHeader>
    <CardContent className="text-sm text-muted-foreground">KYC workflow: pending → in review → approved/rejected. Connect to students table to manage stages.</CardContent></Card></div>
) });