import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 min
const WARN_MS = 2 * 60 * 1000; // warn 2 min before

export function useSessionTimeout() {
  const lastActivity = useRef(Date.now());
  const warned = useRef(false);

  useEffect(() => {
    const reset = () => {
      lastActivity.current = Date.now();
      warned.current = false;
    };
    const events: (keyof DocumentEventMap)[] = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => document.addEventListener(e, reset, { passive: true }));

    const interval = window.setInterval(async () => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= TIMEOUT_MS) {
        await supabase.auth.signOut();
        toast.error("Session expired due to inactivity. Please sign in again.");
      } else if (idle >= TIMEOUT_MS - WARN_MS && !warned.current) {
        warned.current = true;
        toast.warning("Your session will expire in 2 minutes due to inactivity.");
      }
    }, 30_000);

    return () => {
      events.forEach((e) => document.removeEventListener(e, reset));
      window.clearInterval(interval);
    };
  }, []);
}