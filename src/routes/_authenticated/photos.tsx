import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import JSZip from "jszip";
import imageCompression from "browser-image-compression";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Image as ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bulkLinkPhotos, listMissingPhotos } from "@/lib/photos.functions";

export const Route = createFileRoute("/_authenticated/photos")({ component: Photos });

type Item = {
  roll: string;
  filename: string;
  size: number;
  width: number;
  height: number;
  status: "ready" | "invalid_dim" | "too_large" | "uploaded" | "failed";
  message?: string;
  blob?: Blob;
  path?: string;
};

const MIN_W = 300, MIN_H = 400, MAX_W = 2000, MAX_H = 2500;

function getDims(blob: Blob): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { resolve({ w: img.width, h: img.height }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ w: 0, h: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

function Photos() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const linkFn = useServerFn(bulkLinkPhotos);
  const missingFn = useServerFn(listMissingPhotos);
  const qc = useQueryClient();

  const missing = useQuery({ queryKey: ["missing-photos"], queryFn: () => missingFn() });

  const onZip = async (file: File) => {
    setBusy(true); setProgress(0); setStep("Reading ZIP..."); setItems([]);
    try {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter((f) => !f.dir && /\.(jpe?g|png)$/i.test(f.name));
      if (entries.length === 0) { toast.error("No JPG/PNG images in ZIP."); return; }
      if (entries.length > 500) { toast.warning(`ZIP has ${entries.length} files. Only first 500 processed.`); }
      const slice = entries.slice(0, 500);
      const out: Item[] = [];
      for (let i = 0; i < slice.length; i++) {
        const entry = slice[i];
        setStep(`Processing ${entry.name}`);
        setProgress(Math.round(((i + 1) / slice.length) * 100));
        const blob = await entry.async("blob");
        const filename = entry.name.split("/").pop() ?? entry.name;
        const roll = filename.replace(/\.(jpe?g|png)$/i, "");
        let compressed: Blob = blob;
        try {
          compressed = await imageCompression(new File([blob], filename, { type: blob.type || "image/jpeg" }), {
            maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true,
          });
        } catch { /* keep original */ }
        const { w, h } = await getDims(compressed);
        let status: Item["status"] = "ready";
        let message: string | undefined;
        if (w < MIN_W || h < MIN_H) { status = "invalid_dim"; message = `Too small (${w}×${h})`; }
        else if (w > MAX_W || h > MAX_H) { status = "invalid_dim"; message = `Too large (${w}×${h})`; }
        else if (compressed.size > 1024 * 1024) { status = "too_large"; message = `${(compressed.size / 1024).toFixed(0)} KB`; }
        out.push({ roll, filename, size: compressed.size, width: w, height: h, status, message, blob: compressed });
      }
      setItems(out);
      toast.success(`${out.length} photos processed. ${out.filter((i) => i.status === "ready").length} ready to upload.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read ZIP");
    } finally {
      setBusy(false); setStep("");
    }
  };

  const uploadAll = async () => {
    const ready = items.filter((i) => i.status === "ready" && i.blob);
    if (!ready.length) { toast.error("No ready photos to upload."); return; }
    setBusy(true); setProgress(0); setStep("Uploading to storage...");
    const updated = [...items];
    const linkItems: { roll_number: string; path: string }[] = [];
    for (let i = 0; i < ready.length; i++) {
      const it = ready[i];
      const ext = it.filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${it.roll}.${ext}`;
      const { error } = await supabase.storage.from("student-photos").upload(path, it.blob!, { upsert: true, contentType: it.blob!.type || "image/jpeg" });
      const idx = updated.findIndex((u) => u.filename === it.filename);
      if (error) {
        updated[idx] = { ...updated[idx], status: "failed", message: error.message };
      } else {
        updated[idx] = { ...updated[idx], status: "uploaded", path };
        linkItems.push({ roll_number: it.roll, path });
      }
      setProgress(Math.round(((i + 1) / ready.length) * 100));
      setItems([...updated]);
    }
    setStep("Linking to students...");
    try {
      const res = await linkFn({ data: { items: linkItems } });
      toast.success(`Linked ${res.linked} photos.${res.notFound.length ? ` ${res.notFound.length} roll numbers not found.` : ""}`);
      qc.invalidateQueries({ queryKey: ["missing-photos"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Linking failed");
    } finally {
      setBusy(false); setStep("");
      setTimeout(() => setProgress(0), 800);
    }
  };

  const counts = {
    ready: items.filter((i) => i.status === "ready").length,
    invalid: items.filter((i) => i.status === "invalid_dim" || i.status === "too_large").length,
    uploaded: items.filter((i) => i.status === "uploaded").length,
    failed: items.filter((i) => i.status === "failed").length,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Photo upload</h1>
      <Card>
        <CardHeader><CardTitle>ZIP bulk upload</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onZip(f); }}
            className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:bg-accent/30"
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <div className="font-medium">Drag & drop or click to upload ZIP</div>
            <div className="text-xs text-muted-foreground mt-1">Files named by roll_number (e.g. BCA2024001.jpg). Up to 500 photos.</div>
            <input ref={inputRef} type="file" accept=".zip" className="hidden" onChange={(e) => e.target.files?.[0] && onZip(e.target.files[0])} />
          </div>

          {(busy || progress > 0) && (
            <div className="space-y-1">
              <Progress value={progress} />
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>{step}</span><span>{progress}%</span>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <>
              <div className="flex gap-2 flex-wrap items-center text-sm">
                <Badge variant="secondary"><CheckCircle2 className="h-3 w-3" /> Ready: {counts.ready}</Badge>
                <Badge variant="destructive"><AlertCircle className="h-3 w-3" /> Invalid: {counts.invalid}</Badge>
                {counts.uploaded > 0 && <Badge>Uploaded: {counts.uploaded}</Badge>}
                {counts.failed > 0 && <Badge variant="destructive">Failed: {counts.failed}</Badge>}
                <div className="ml-auto">
                  <Button onClick={uploadAll} disabled={busy || counts.ready === 0} size="sm">
                    Upload {counts.ready} ready photos
                  </Button>
                </div>
              </div>
              <div className="border rounded-md overflow-auto max-h-[480px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Roll number</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Dimensions</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => (
                      <TableRow key={it.filename}>
                        <TableCell className="font-mono text-xs">{it.roll}</TableCell>
                        <TableCell className="text-xs">{it.filename}</TableCell>
                        <TableCell className="text-xs">{it.width}×{it.height}</TableCell>
                        <TableCell className="text-xs">{(it.size / 1024).toFixed(0)} KB</TableCell>
                        <TableCell>
                          {it.status === "ready" && <Badge variant="secondary">Ready</Badge>}
                          {it.status === "uploaded" && <Badge>Uploaded</Badge>}
                          {it.status === "invalid_dim" && <Badge variant="destructive" title={it.message}>Invalid dim</Badge>}
                          {it.status === "too_large" && <Badge variant="destructive" title={it.message}>Too large</Badge>}
                          {it.status === "failed" && <Badge variant="destructive" title={it.message}>Failed</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" /> Missing photo report
          </CardTitle>
        </CardHeader>
        <CardContent>
          {missing.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (missing.data?.rows ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">All students have valid photos.</div>
          ) : (
            <div className="border rounded-md overflow-auto max-h-96">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Roll number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(missing.data?.rows ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.roll_number}</TableCell>
                      <TableCell className="text-sm">{r.full_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.department ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{r.photo_status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}