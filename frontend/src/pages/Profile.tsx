import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  ArrowLeft,
  LogOut,
  Mail,
  PencilLine,
  UserCircle2,
  Bell,
  Moon,
  Sun,
} from "lucide-react";

export default function Profile() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof auth["currentUser"]> | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [notify, setNotify] = useState(true);
  const [dark, setDark] = useState<boolean>(() => document.documentElement.classList.contains("dark"));

  // Guard: must be signed in
  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setDisplayName(u?.displayName || u?.email?.split("@")[0] || "Student");
      setReady(true);
      if (!u) nav("/login", { replace: true });
    });
    return () => off();
  }, [nav]);

  const initials = useMemo(() => {
    const base = (displayName || user?.email || "Campus Hub").trim();
    return base
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("");
  }, [displayName, user?.email]);

  function toggleTheme() {
    const root = document.documentElement;
    root.classList.toggle("dark");
    setDark(root.classList.contains("dark"));
  }

  async function doLogout() {
    await signOut(auth);
    // router guard will redirect to /login
  }

  if (!ready || !user) {
    return <div className="min-h-dvh grid place-items-center bg-background text-text">Loading…</div>;
  }

  return (
    <div className="min-h-dvh bg-background text-text">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => nav("/app")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Back to App
          </button>
          <button
            onClick={doLogout}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand text-background hover:bg-brand-600"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Identity card */}
        <section className="bg-surface border border-border rounded-2xl shadow-soft p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={displayName}
                className="size-20 rounded-2xl border border-border object-cover"
              />
            ) : (
              <div className="size-20 rounded-2xl border border-border bg-brand/10 grid place-items-center">
                <span className="text-brand font-semibold text-xl">{initials}</span>
              </div>
            )}

            {/* Name + email */}
            <div className="flex-1 w-full">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-semibold">{displayName}</h1>
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-brand/10 text-brand border border-brand/20">
                  <UserCircle2 className="size-3.5" /> UMass Student
                </span>
              </div>

              <p className="mt-1 text-sm text-text-muted inline-flex items-center gap-2">
                <Mail className="size-4" />
                {user.email}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
                  onClick={() => alert("Coming soon: change photo")}
                >
                  <PencilLine className="size-4" />
                  Edit photo
                </button>
                <button
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
                  onClick={() => alert("Coming soon: change name")}
                >
                  <PencilLine className="size-4" />
                  Edit name
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* About & Preferences */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* About */}
          <section className="bg-surface border border-border rounded-2xl shadow-soft p-6">
            <h2 className="text-lg font-semibold">About</h2>
            <p className="text-sm text-text-muted">Write a short intro for your profile.</p>
            <textarea
              className="mt-3 w-full min-h-28 rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g., CS major, loves intramural basketball and hackathons."
            />
            <div className="mt-3 flex justify-end">
              <button
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand text-background hover:bg-brand-600"
                onClick={() => alert("Saved (stub)")}
              >
                Save
              </button>
            </div>
          </section>

          {/* Preferences */}
          <section className="bg-surface border border-border rounded-2xl shadow-soft p-6">
            <h2 className="text-lg font-semibold">Preferences</h2>
            <ul className="mt-3 space-y-3">
              <li className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-text-muted" />
                  <div>
                    <p className="font-medium">Event reminders</p>
                    <p className="text-sm text-text-muted">Receive reminders before events you RSVP to.</p>
                  </div>
                </div>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={notify}
                    onChange={() => setNotify((v) => !v)}
                  />
                  <span className="w-11 h-6 bg-muted rounded-full relative transition
                                   after:content-[''] after:absolute after:top-0.5 after:left-0.5
                                   after:w-5 after:h-5 after:bg-surface after:rounded-full after:transition
                                   peer-checked:bg-brand peer-checked:after:translate-x-5"></span>
                </label>
              </li>

              <li className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {dark ? <Moon className="size-4 text-text-muted" /> : <Sun className="size-4 text-text-muted" />}
                  <div>
                    <p className="font-medium">Appearance</p>
                    <p className="text-sm text-text-muted">Toggle light / dark theme.</p>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className="px-3 py-2 rounded-xl border border-border bg-surface hover:bg-muted"
                >
                  Switch to {dark ? "Light" : "Dark"}
                </button>
              </li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
