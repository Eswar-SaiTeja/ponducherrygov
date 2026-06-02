import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/security")({ component: SecuritySettings });

type Factor = { id: string; friendly_name?: string; factor_type: string; status: string };

function SecuritySettings() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrollQr, setEnrollQr] = useState<string | null>(null);
  const [enrollSecret, setEnrollSecret] = useState<string | null>(null);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  };

  useEffect(() => { load(); }, []);

  const startEnroll = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toISOString().slice(0,10)}` });
      if (error) throw error;
      setEnrollQr(data.totp.qr_code);
      setEnrollSecret(data.totp.secret);
      setEnrollFactorId(data.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  };

  const verifyEnroll = async () => {
    if (!enrollFactorId || !code) return;
    setBusy(true);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enrollFactorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId: challenge.id,
        code,
      });
      if (vErr) throw vErr;
      toast.success("Two-factor authentication enabled.");
      setEnrollQr(null); setEnrollSecret(null); setEnrollFactorId(null); setCode("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const unenroll = async (factorId: string) => {
    if (!confirm("Disable this authenticator? You'll need to re-enroll to use 2FA again.")) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success("Factor removed.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Security</h1>
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication (TOTP)</CardTitle>
          <CardDescription>Use an authenticator app (Google Authenticator, 1Password, Authy) for an extra layer at sign-in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {factors.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Active factors</div>
              {factors.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="text-sm">
                    <div className="font-medium">{f.friendly_name || "Authenticator"}</div>
                    <div className="text-xs text-muted-foreground">{f.factor_type} · <Badge variant={f.status === "verified" ? "default" : "secondary"}>{f.status}</Badge></div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => unenroll(f.id)} disabled={busy}>Remove</Button>
                </div>
              ))}
            </div>
          )}

          {!enrollQr && (
            <Button onClick={startEnroll} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add Authenticator
            </Button>
          )}

          {enrollQr && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="text-sm font-medium">Scan this QR with your authenticator app</div>
              <img src={enrollQr} alt="TOTP QR code" className="h-48 w-48 bg-white p-2 rounded" />
              <div className="text-xs text-muted-foreground">Or enter secret manually: <code className="font-mono">{enrollSecret}</code></div>
              <div className="space-y-2">
                <Label>Enter the 6-digit code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} placeholder="123456" />
              </div>
              <div className="flex gap-2">
                <Button onClick={verifyEnroll} disabled={busy || code.length !== 6}>
                  {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Verify & enable
                </Button>
                <Button variant="outline" onClick={() => { setEnrollQr(null); setEnrollSecret(null); setEnrollFactorId(null); setCode(""); }}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>You will be automatically signed out after 30 minutes of inactivity.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}