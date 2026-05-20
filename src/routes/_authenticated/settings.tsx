import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const Route = createFileRoute("/_authenticated/settings")({ component: () => (
  <div className="space-y-4"><h1 className="text-2xl font-bold">Settings</h1>
    <Card><CardHeader><CardTitle>Account & roles</CardTitle></CardHeader>
    <CardContent className="text-sm text-muted-foreground">Manage users, roles, and integrations.</CardContent></Card></div>
) });