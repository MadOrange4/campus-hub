import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../lib/firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { isAllowedEmail } from "../lib/auth-domain";
import { LogIn, Mail, Eye, EyeOff, UserPlus } from "lucide-react";
import { isStrongPassword } from "../lib/password-strength.ts";

export default function Register() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!isAllowedEmail(email)) {
      setErr("Please use your @umass.edu email.");
      return;
    }
    const obj = isStrongPassword(pw);
    let str = "Your Password is too weak:\n";
    [0, 1, 2, 3].forEach((i) => {
      str += obj.issues[i];
    });
    if (!obj.strong) {
      setErr(str);
      return;
    }
    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      if (name.trim())
        await updateProfile(cred.user, { displayName: name.trim() });
      await sendEmailVerification(cred.user);
      setSent(true);
    } catch (ex: any) {
      setErr(ex?.code ?? ex?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!auth.currentUser) return;
    try {
      setLoading(true);
      await sendEmailVerification(auth.currentUser);
    } catch (ex: any) {
      setErr(ex?.code ?? ex?.message ?? "Could not resend verification");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-background text-text px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-brand/10 border border-brand/20">
            <span className="text-brand font-bold">CH</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold">Create your account</h1>
          <p className="text-sm text-text-muted">UMass Amherst emails only</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-surface border border-border rounded-2xl shadow-soft p-6"
        >
          {err && (
            <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
              {err}
            </div>
          )}

          {!sent ? (
            <>
              <label className="block text-sm font-medium mb-1">
                Full name
              </label>
              <input
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tim Minuteman"
                autoComplete="name"
              />

              <label className="block text-sm font-medium mt-4 mb-1">
                UMass Email
              </label>
              <div className="relative">
                <input
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-brand"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@umass.edu"
                  type="email"
                  autoComplete="email"
                  required
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
              </div>

              <label className="block text-sm font-medium mt-4 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-brand"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="••••••••"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted"
                >
                  {showPw ? (
                    <EyeOff className="size-4 text-text-muted" />
                  ) : (
                    <Eye className="size-4 text-text-muted" />
                  )}
                </button>
              </div>

              <button
                disabled={loading}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand text-background hover:bg-brand-600 disabled:opacity-70"
              >
                <UserPlus className="size-4" />
                {loading ? "Creating…" : "Create account"}
              </button>

              <p className="mt-4 text-xs text-text-muted">
                Already have an account?{" "}
                <Link to="/login" className="underline">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 px-3 py-2 text-sm">
                We sent a verification link to <b>{email}</b>. Click it, then
                come back and sign in.
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => nav("/login")}
                  className="flex-1 rounded-xl border border-border px-3 py-2 hover:bg-muted"
                >
                  Back to sign in
                </button>
                <button
                  type="button"
                  onClick={resend}
                  className="flex-1 rounded-xl bg-brand text-background px-3 py-2 hover:bg-brand-600 disabled:opacity-70"
                  disabled={loading}
                >
                  Resend email
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
