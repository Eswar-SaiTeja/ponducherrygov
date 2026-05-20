import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const Route = createFileRoute("/_authenticated/validation")({ component: () => (
  <div className="space-y-4"><h1 className="text-2xl font-bold">Validation Errors</h1>
    <Card><CardHeader><CardTitle>Exception dashboard</CardTitle></CardHeader>
    <CardContent className="text-sm text-muted-foreground">No validation errors. Upload an Excel file to run the validation engine (Aadhaar length, mobile format, email format, duplicates).</CardContent></Card></div>
) });