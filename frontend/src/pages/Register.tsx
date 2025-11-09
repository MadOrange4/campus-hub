import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../lib/firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "../../node_modules/firebase/auth";
import { isAllowedEmail } from "../lib/auth-domain";
import { Mail, Eye, EyeOff, UserPlus } from "lucide-react";
import { isStrongPassword } from "../lib/password-strength.ts";

type StrengthInfo = {
  score: 0 | 1 | 2 | 3 | 4;   // 0=very weak … 4=strong
  percent: number;            // 0–100 for the bar
  label: string;              // text label
};

// fast, lightweight strength estimator for the UI (no banned-list check here)
// we still do the real checks in onSubmit with isStrongPassword()
function measureStrength(pw: string): StrengthInfo {
  if (!pw) return { score: 0, percent: 0, label: "Very weak" };

  const len = pw.length;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[\W_]/.test(pw);
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  // Penalize obvious repetition (e.g., 'aaaaaa', 'abcabcabc')
  const repeatedSeq =
    /(.)\1{2,}/.test(pw) || /(..)\1{2,}/.test(pw) || /(...)\1{2,}/.test(pw);

  // Base points: length
  let pts = 0;
  if (len >= 16) pts += 3;
  else if (len >= 12) pts += 2.5;
  else if (len >= 10) pts += 2;
  else if (len >= 8) pts += 1.5;
  else if (len >= 6) pts += 1;

  // Variety points
  pts += (classes - 1) * 0.75; // 0, .75, 1.5, 2.25

  // Light penalty for repetition
  if (repeatedSeq) pts -= 0.75;

  // Clamp 0–4 and map to score
  const clamped = Math.max(0, Math.min(4, pts / 1.5)); // normalize roughly into 0–4
  const rawScore = Math.round(clamped as number) as 0 | 1 | 2 | 3 | 4;

  const scoreToLabel = ["Very weak", "Weak", "Fair", "Good", "Strong"] as const;
  const percent = Math.min(100, Math.max(0, Math.floor((rawScore / 4) * 100)));

  return { score: rawScore, percent, label: scoreToLabel[rawScore] };
}

function strengthColor(score: number) {
  // Tailwind-ish colors: danger → warning → brand/green
  if (score <= 1) return "bg-red-500";
  if (score === 2) return "bg-yellow-500";
  if (score === 3) return "bg-amber-500";
  return "bg-emerald-600";
}

export default function Register() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const strength = useMemo(() => measureStrength(pw), [pw]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!isAllowedEmail(email)) {
      setErr("Please use your @umass.edu email.");
      return;
    }

    // Real password policy check (banned list, etc.)
    const res = isStrongPassword(pw);
    if (!res.strong) {
      const msg =
        "Your Password is too weak:\n- " +
        res.issues.filter(Boolean).join("\n- ");
      setErr(msg);
      return;
    }

    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
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
          noValidate
          className="bg-surface border border-border rounded-2xl shadow-soft p-6"
        >
          {err && (
            <div
              className="mb-4 rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm"
              style={{ whiteSpace: "pre-line" }}
            >
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

              {/* Password strength meter */}
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span>Password strength</span>
                  <span>{strength.label}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className={`h-2 ${strengthColor(strength.score)}`}
                    style={{ width: `${strength.percent}%`, transition: "width 180ms ease" }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-text-muted">
                  Tip: longer passphrases with mixed character types are stronger.
                </div>
              </div>

              <button
                type="submit"
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