import { ReactNode, useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, sendEmailVerification } from "firebase/auth";

export default function RequireVerified({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      setReady(true);
      if (!u) return; // your outer route guard should handle redirect to /login
      const token = await u.getIdTokenResult(true);
      const provider = token.signInProvider; // "password" | "google.com" | ...
      setEmail(u.email);
      setNeedsVerify(provider === "password" && !u.emailVerified);
    });
    return () => off();
  }, []);

  async function resend() {
    if (!auth.currentUser) return;
    try {
      setErr(null);
      setResending(true);
      await sendEmailVerification(auth.currentUser);
    } catch (e: any) {
      setErr(e?.message ?? "Could not resend verification email");
    } finally {
      setResending(false);
    }
  }

  if (!ready) {
    return <div className="min-h-dvh grid place-items-center bg-background text-text">Loading…</div>;
  }

  if (needsVerify) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background text-text px-4">
        <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-soft p-6">
          <h1 className="text-xl font-semibold">Verify your email</h1>
          <p className="text-sm text-text-muted mt-2">
            We sent a verification link to <b>{email}</b>. Click it, then return here and refresh.
          </p>
          {err && (
            <div className="mt-3 rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
              {err}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 rounded-xl border border-border px-3 py-2 hover:bg-muted"
            >
              I verified — Refresh
            </button>
            <button
              disabled={resending}
              onClick={resend}
              className="flex-1 rounded-xl bg-brand text-background px-3 py-2 hover:bg-brand-600 disabled:opacity-70"
            >
              {resending ? "Resending…" : "Resend email"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}