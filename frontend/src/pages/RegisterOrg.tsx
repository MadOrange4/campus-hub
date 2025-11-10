import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { KeyRound, Lock, Building2 } from "lucide-react";

export default function RegisterOrg() {
  const nav = useNavigate();
  const [key, setKey] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      setLoading(true);
      
      //Verify org key
      const keyRef = doc(db, "orgKeys", key);
      const keySnap = await getDoc(keyRef);
      if (!keySnap.exists()) throw new Error("Invalid or expired organization key");
      const orgData = keySnap.data();

      //Create org account
      const cred = await createUserWithEmailAndPassword(auth, orgData.email, pw);
      await updateProfile(cred.user, { displayName: orgData.name });

      //Delete key (one-time use)
      await deleteDoc(keyRef);

      //Step 4: Redirect
      nav("/login");
    } catch (ex: any) {
      setErr(ex?.code ?? ex?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-background text-text px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-brand/10 border border-brand/20">
            <Building2 className="size-6 text-brand" />
          </div>
          <h1 className="mt-3 text-2xl font-semibold">Organization Account</h1>
          <p className="text-sm text-text-muted">
            Use your unique organization key to register.
          </p>
        </div>

        <form onSubmit={onSubmit} className="bg-surface border border-border rounded-2xl shadow-soft p-6">
          {err && (
            <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
              {err}
            </div>
          )}

          <label className="block text-sm font-medium mb-1">Organization Key</label>
          <div className="relative">
            <input
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-brand"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter provided key"
              type="text"
              required
            />
            <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          </div>

          <label className="block text-sm font-medium mt-4 mb-1">Set Password</label>
          <div className="relative">
            <input
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
              type="password"
              required
            />
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          </div>

          <button
            disabled={loading}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand text-background hover:bg-brand-600 disabled:opacity-70"
          >
            {loading ? "Creating…" : "Create Organization Account"}
          </button>

          <p className="mt-4 text-xs text-text-muted text-center">
            <Link to="/register" className="underline">
              Back to student registration
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
