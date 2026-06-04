import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/uploads/guide")({ component: Guide });

function Guide() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/uploads"><ArrowLeft className="h-4 w-4" /> Back to uploads</Link>
        </Button>
        <Button onClick={() => window.print()} size="sm" variant="outline">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Validation guide & naming standards</CardTitle></CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert space-y-4">
          <section>
            <h3 className="font-semibold">Required columns</h3>
            <ul className="list-disc pl-5 text-sm">
              <li><b>full_name</b> — required, max 200 chars</li>
              <li><b>roll_number</b> — required, unique per institution, max 100 chars</li>
            </ul>
          </section>
          <section>
            <h3 className="font-semibold">Optional columns</h3>
            <ul className="list-disc pl-5 text-sm">
              <li><b>department</b>, <b>email</b>, <b>mobile_number</b>, <b>address</b>, <b>city</b>, <b>state</b></li>
              <li><b>aadhaar_number</b> — exactly 12 digits, no spaces</li>
              <li><b>pincode</b> — exactly 6 digits</li>
              <li><b>gender</b>, <b>batch</b>, <b>stream</b>, <b>university</b>, <b>emergency_contact</b></li>
            </ul>
          </section>
          <section>
            <h3 className="font-semibold">Format rules</h3>
            <ul className="list-disc pl-5 text-sm">
              <li>Email must be a valid address</li>
              <li>Mobile numbers may contain digits, spaces, +, and -</li>
              <li>Aadhaar and pincode must contain digits only</li>
              <li>Empty cells are treated as null</li>
            </ul>
          </section>
          <section>
            <h3 className="font-semibold">Photo naming</h3>
            <p className="text-sm">Photos must be uploaded as a single ZIP. Filename must match the student's <b>roll_number</b> exactly. Supported formats: .jpg, .jpeg, .png. Recommended size: 600×800 (3:4 portrait), &lt; 500 KB.</p>
            <p className="text-sm">Example: <code>BCA2024001.jpg</code> will be linked to the student with roll_number <code>BCA2024001</code>.</p>
          </section>
          <section>
            <h3 className="font-semibold">Upload limits</h3>
            <ul className="list-disc pl-5 text-sm">
              <li>Excel/CSV: up to 2,000 rows per file</li>
              <li>Photos ZIP: up to 500 images per upload</li>
            </ul>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}