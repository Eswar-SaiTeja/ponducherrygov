import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

const MAX_ATTEMPTS = 5;
const WINDOW_MIN = 15;

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const checkRateLimit = async (emailToCheck: string): Promise<boolean> => {
    const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
    const { data, error } = await supabase
      .from("login_attempts")
      .select("created_at, success")
      .eq("email", emailToCheck.toLowerCase())
      .eq("success", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (error) return true; // fail open
    const failures = data?.length ?? 0;
    if (failures >= MAX_ATTEMPTS) {
      const oldest = data![MAX_ATTEMPTS - 1];
      const unlockAt = new Date(new Date(oldest.created_at).getTime() + WINDOW_MIN * 60_000);
      setLockedUntil(unlockAt);
      return false;
    }
    setRemainingAttempts(MAX_ATTEMPTS - failures);
    return true;
  };

  const recordAttempt = async (emailVal: string, success: boolean) => {
    try {
      await supabase.from("login_attempts").insert({
        email: emailVal.toLowerCase(),
        user_agent: navigator.userAgent.slice(0, 500),
        success,
      } as never);
    } catch {
      /* non-fatal */
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedUntil && lockedUntil > new Date()) {
      toast.error(`Too many failed attempts. Try again after ${lockedUntil.toLocaleTimeString()}.`);
      return;
    }
    setBusy(true);
    try {
      const ok = await checkRateLimit(email);
      if (!ok) {
        toast.error(`Account temporarily locked after ${MAX_ATTEMPTS} failed attempts. Try again later.`);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        await recordAttempt(email, false);
        throw error;
      }
      await recordAttempt(email, true);
      toast.success("Welcome back");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      if (remainingAttempts !== null) {
        const left = remainingAttempts - 1;
        setRemainingAttempts(left);
        if (left > 0) toast.warning(`${left} attempt(s) remaining before temporary lock.`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-secondary to-accent">
      <Card className="w-full max-w-md shadow-[var(--shadow-elegant)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-[image:var(--gradient-primary)] flex items-center justify-center text-primary-foreground">
            <CreditCard className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Student Card Portal</CardTitle>
          <CardDescription>PVC & Debit card management for institutions</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={busy || (!!lockedUntil && lockedUntil > new Date())}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
            {lockedUntil && lockedUntil > new Date() && (
              <p className="text-xs text-destructive text-center">
                Locked. Try again after {lockedUntil.toLocaleTimeString()}.
              </p>
            )}
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            New accounts are invite-only. Contact your administrator for access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
