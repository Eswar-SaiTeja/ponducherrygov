import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QRCodeSVG } from "qrcode.react";
export const Route = createFileRoute("/_authenticated/cards")({ component: () => (
  <div className="space-y-4"><h1 className="text-2xl font-bold">Card Generation</h1>
    <Card className="max-w-md">
      <CardHeader><CardTitle>Card preview</CardTitle></CardHeader>
      <CardContent>
        <div className="rounded-2xl p-5 text-primary-foreground bg-[image:var(--gradient-primary)] shadow-[var(--shadow-elegant)] aspect-[1.6/1] flex flex-col justify-between">
          <div>
            <div className="text-xs opacity-80">Student ID Card</div>
            <div className="text-lg font-semibold mt-1">Student Name</div>
            <div className="text-xs opacity-80">Computer Science · Batch 2025</div>
          </div>
          <div className="flex items-end justify-between">
            <div className="text-xs">Valid till 06/2029</div>
            <div className="bg-white p-1 rounded"><QRCodeSVG value="STUDENT-001" size={56} /></div>
          </div>
        </div>
      </CardContent>
    </Card></div>
) });