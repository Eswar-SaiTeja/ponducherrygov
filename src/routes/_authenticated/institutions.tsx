import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const Route = createFileRoute("/_authenticated/institutions")({ component: () => (
  <div className="space-y-4"><h1 className="text-2xl font-bold">Institutions</h1>
    <Card><CardHeader><CardTitle>Manage colleges & universities</CardTitle></CardHeader>
    <CardContent className="text-sm text-muted-foreground">Multi-college support. Add institutions, codes, branding.</CardContent></Card></div>
) });