import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const Route = createFileRoute("/_authenticated/notifications")({ component: () => (
  <div className="space-y-4"><h1 className="text-2xl font-bold">Notifications</h1>
    <Card><CardHeader><CardTitle>Recent</CardTitle></CardHeader>
    <CardContent className="text-sm text-muted-foreground">No notifications yet.</CardContent></Card></div>
) });