import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  fetchSignInMethodsForEmail,
  linkWithPopup,
  linkWithCredential,
  EmailAuthProvider,
  sendEmailVerification
} from "firebase/auth";
import type { User } from "firebase/auth"
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { isAllowedEmail } from "../lib/auth-domain";
import { Eye, EyeOff, Mail, LogIn, ArrowLeft, UserRoundPenIcon } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const nav = useNavigate();

  // Firestore upsert

  // Firestore upsert (non-destructive for roles)
  async function upsertUserDoc(u: User) {
    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);

    // read custom claims to seed initial role once (if admin)
    // NOTE: this only works after sign-in; ok here.
    const idtr = await u.getIdTokenResult(true);
    const isAdminClaim =
      idtr.claims.role === "admin" ||
      (Array.isArray(idtr.claims.roles) && idtr.claims.roles.includes("admin"));
    //TODO we should reduce code duplication among login, profile, register, userprofile (and maybe more) here
    const base = {
      uid: u.uid,
      email: (u.email ?? "").toLowerCase(),
      name: u.displayName ?? "",
      photoURL: u.photoURL ?? "",
      nameLower: (u.displayName ?? "").toLowerCase(),
      emailLower: (u.email ?? "").toLowerCase(),
      visibility: "campus",
      notificationPrefs: {
        eventReminders: true,
        emailUpdates: false,
        push: true,
      },
      domainOk: (u.email ?? "").toLowerCase().endsWith("@umass.edu"),
      updatedAt: serverTimestamp(),
    };

    if (!snap.exists()) {
      // FIRST TIME ONLY: set role based on claims (default: student)
      const role = isAdminClaim ? "admin" : "student";
      await setDoc(
        ref,
        {
          ...base,
          primaryRole: role,
          roles: [role],
          bio: "",
          pronouns: null,
          phone: null,
          year: null,
          major: null,
          isStaffVerified: false,
          createdAt: serverTimestamp(),
          // nice-to-have counters (optional)
          friendsCount: 0,
          pendingCount: 0,
          preferences: [""]
        },
        { merge: true }
      );
    } else {
      // EXISTING USER: DO NOT TOUCH primaryRole/roles
      await setDoc(
        ref,
        {
          ...base,
          // leave createdAt alone
        },
        { merge: true }
      );
    }
  }

  async function linkAccountsForSameEmail(user: User, pendingEmail: string, pendingCred: any) {
    // pendingCred may be OAuthCredential or EmailAuthCredential.
    // If the existing method is password, ask user to login with password, then link Google.
    const methods = await fetchSignInMethodsForEmail(auth, pendingEmail);
    if (methods.includes("password") && pendingCred?.providerId === "google.com") {
      // User already has a password account; link Google to it
      // (We assume they just signed in with password flow; otherwise, prompt them to do so.)
      await linkWithCredential(user, pendingCred);
      return;
    }
    if (methods.includes("google.com") && pendingCred?.providerId === "password") {
      // User already has a Google account; link password to it
      await linkWithPopup(user, new GoogleAuthProvider()); // reauth Google
      await linkWithCredential(user, pendingCred);
      return;
    }
    // Other cases: just try linking with popup
    if (pendingCred?.providerId === "google.com") {
      await linkWithPopup(user, new GoogleAuthProvider());
    }
  }

  async function doEmail(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // prevent double submit while pending

    setErr(null);
    const em = email.trim().toLowerCase();

    // Start the spinner up front
    setLoading(true);

    // Early validation: if we bail here, also stop spinner
    if (!isAllowedEmail(em)) {
      setErr("Please use your @umass.edu email.");
      setLoading(false);
      return;
    }

    try {
      const res = await signInWithEmailAndPassword(auth, em, pw);

      if (!res.user.emailVerified) {
        try { await sendEmailVerification(res.user); } catch {}
        setErr("Please verify your email. We’ve sent you a link.");
        await auth.signOut();
        return; // finally will still run, clearing loading
      }

      await upsertUserDoc(res.user);
      nav("/app");
    } catch (ex: any) {
      const code = ex?.code ?? "";
      if (
        code === "auth/invalid-credential" ||
        code === "auth/user-not-found" ||
        code === "auth/wrong-password" ||
        code === "auth/invalid-login-credentials"
      ) {
        setErr("Incorrect email or password.");
      } else if (code === "auth/too-many-requests") {
        setErr("Too many attempts. Try again later.");
      } else {
        setErr(ex?.message || "Sign-in failed.");
      }
    } finally {
      setLoading(false); // <-- guarantees the button text resets
    }
  }

  async function doGoogle() {
    try {
      setErr(null);
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ hd: "umass.edu" });
      const res = await signInWithPopup(auth, provider);
      if (!isAllowedEmail(res.user.email)) {
        setErr("Please use your @umass.edu email.");
        await auth.signOut();
        return;
      }
      await upsertUserDoc(res.user);
      nav("/app");
    } catch (ex: any) {
      // Handle account-exists-with-different-credential
      if (ex?.code === "auth/account-exists-with-different-credential" && ex?.customData?.email) {
        const pendingEmail = ex.customData.email as string;
        setErr("That email already exists with a different sign-in method. Please sign in with the original method, then we’ll link Google.");
        // The pending OAuth credential is ex.customData? In Web v9, you may reconstruct:
        // const pendingCred = GoogleAuthProvider.credentialFromError(ex);
        // After user signs in with the other method, call linkAccountsForSameEmail(currentUser, pendingEmail, pendingCred)
      } else {
        setErr(ex?.code ?? ex?.message ?? "Google sign-in failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-text grid place-items-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-brand/10 border border-brand/20">
            <span className="text-brand font-bold">CH</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold">Sign in to Campus Hub</h1>
          <p className="text-sm text-text-muted">UMass Amherst accounts only</p>
        </div>

        {/* Card */}
        <form
          onSubmit={doEmail}
          className="bg-surface border border-border rounded-2xl shadow-soft p-6"
        >
          {/* Error */}
          {err && (
            <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
              {err}
            </div>
          )}

          {/* Email */}
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="email"
          >
            UMass Email
          </label>
          <div className="relative">
            <input
              id="email"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-brand"
              placeholder="you@umass.edu"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (err) setErr(null);
              }}
              autoComplete="email"
              required
            />
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          </div>

          {/* Password */}
          <label
            className="block text-sm font-medium mt-4 mb-1"
            htmlFor="password"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-brand"
              placeholder="••••••••"
              type={showPw ? "text" : "password"}
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                if (err) setErr(null);
              }}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? (
                <EyeOff className="size-4 text-text-muted" />
              ) : (
                <Eye className="size-4 text-text-muted" />
              )}
            </button>
          </div>

          {/* Register */}
          <button
            type="button"
            onClick={() => nav("/register")}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
          >
            <UserRoundPenIcon className="size-4" />
            Create an account
          </button>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand text-background hover:bg-brand-600 disabled:opacity-70"
          >
            <LogIn className="size-4" />
            {loading ? "Signing in…" : "Sign in"}
          </button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3 text-text-muted">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={doGoogle}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface hover:bg-muted disabled:opacity-70"
          >
            <GoogleG className="size-4" />
            Continue with Google
          </button>
        

          {/* Back to Landing */}
          <button
            type="button"
            onClick={() => nav("/")}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Back to landing
          </button>

          {/* Helper */}
          <p className="mt-4 text-xs text-text-muted">
            By continuing, you agree to our acceptable use and that you’ll sign
            in with a valid <b>@umass.edu</b> address.
          </p>
        </form>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-text-muted">
          Having trouble? Try a different browser or clear cookies for{" "}
          <code>localhost</code>.
        </p>
      </div>
    </div>
  );
}

/** Minimal Google “G” mark (so you don’t need any extra deps) */
function GoogleG(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 533.5 544.3" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M533.5 278.4c0-18.5-1.7-36.3-4.9-53.6H272.1v101.4h147.1c-6.3 34-25.2 62.7-53.9 81.9v67h87.1c50.9-46.9 81.1-116 81.1-196.7z"
      />
      <path
        fill="#34A853"
        d="M272.1 544.3c72.9 0 134.2-24.1 178.9-65.6l-87.1-67c-24.2 16.2-55.3 25.8-91.8 25.8-70.6 0-130.4-47.6-151.9-111.7H31.1v70.2C75.5 492.6 169.3 544.3 272.1 544.3z"
      />
      <path
        fill="#FBBC05"
        d="M120.2 325.8c-10.7-31.9-10.7-66.3 0-98.2V157.4H31.1c-43.6 86.9-43.6 191.6 0 278.4l89.1-70z"
      />
      <path
        fill="#EA4335"
        d="M272.1 107.7c39.6-.6 77.7 13.5 107 39.8l79.8-79.8C411.6 23.8 343.4-1 272.1 0 169.3 0 75.5 51.7 31.1 157.4l89.1 70c21.5-64.1 81.3-111.7 151.9-111.7z"
      />
    </svg>
  );
}