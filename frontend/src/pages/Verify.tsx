import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { applyActionCode, checkActionCode } from "firebase/auth";

export default function Verify() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const oobCode = params.get("oobCode");
  const [msg, setMsg] = useState("Verifying your email…");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!oobCode) { setErr("Missing verification code."); return; }
      try {
        // Optional: pre-check to give nicer errors
        await checkActionCode(auth, oobCode);
        await applyActionCode(auth, oobCode);
        setMsg("Email verified! You can sign in now.");
        // If the user is signed in, refresh their token so emailVerified updates:
        if (auth.currentUser) await auth.currentUser.reload();
        // Bounce to login (or /app if you prefer)
        setTimeout(() => nav("/login", { replace: true }), 1200);
      } catch (e: any) {
        setErr(e?.message ?? "Verification link invalid or expired. Please request a new one.");
      }
    })();
  }, [oobCode, nav]);

  return (
    <div className="min-h-dvh grid place-items-center bg-background text-text px-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-soft p-6 text-center">
        {!err ? (
          <p className="text-sm">{msg}</p>
        ) : (
          <>
            <div className="mb-3 rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">{err}</div>
            <button onClick={() => nav("/login")} className="rounded-xl border border-border px-3 py-2 hover:bg-muted">
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}