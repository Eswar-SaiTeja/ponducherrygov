import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const Route = createFileRoute("/_authenticated/reports")({ component: () => (
  <div className="space-y-4"><h1 className="text-2xl font-bold">Reports</h1>
    <Card><CardHeader><CardTitle>Export</CardTitle></CardHeader>
    <CardContent className="text-sm text-muted-foreground">PDF / Excel exports for student analytics, card status, institution reports, daily processing.</CardContent></Card></div>
) });