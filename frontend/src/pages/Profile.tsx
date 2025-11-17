import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut, getAuth} from "firebase/auth";
import {
  ArrowLeft,
  LogOut,
  Mail,
  UserCircle2,
  Bell,
  Moon,
  Sun,
  ShieldCheck,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

/* ---------------- Types ---------------- */
type Role = "student"|"staff"|"admin"|"professor"|"ta"|"club_officer";
type Year = "freshman"|"sophomore"|"junior"|"senior";
type Visibility = "public"|"campus"|"private";
type Preference_Types = "defaultPreference"|"preference1"|"preference2"

type UserProfile = {
  uid: string;
  email: string;
  name?: string;
  photoURL?: string;
  primaryRole?: Role;
  roles: Role[];
  year?: Year | null;
  major?: string | null;
  bio?: string;
  pronouns?: string | null; // stored as the actual selection or custom text
  phone?: string | null;    // stored as E.164 (+1413xxxxxxx)
  visibility: Visibility;
  notificationPrefs: { eventReminders: boolean; emailUpdates: boolean; push: boolean; [k: string]: boolean };
  domainOk: boolean;
  isStaffVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
  preferences: Preference_Types[];
};

/* ---------------- Constants ---------------- */
const YEAR_OPTIONS: Year[] = ["freshman","sophomore","junior","senior"];
const VIS_OPTIONS: Visibility[] = ["public","campus","private"];
const PRONOUN_OPTIONS = [
  "he/him","she/her","they/them","he/they","she/they","prefer not to say","self-describe" as const
];
const INTEREST_OPTIONS = [
  "sports",
  "music",
  "gaming",
  "coding",
  "fitness",
  "travel",
  "volunteering",
  "art",
  "entrepreneurship",
  "research",
  "greek-life",
] as const;

export default function Profile() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [fbUser, setFbUser] = useState<ReturnType<typeof auth["currentUser"]> | null>(null);

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  function openDeleteModal() {
    setShowDeleteModal(true);
  }
  function closeDeleteModal() {
    setShowDeleteModal(false);
  }

  // Editable fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [major, setMajor] = useState<string>("");
  const [year, setYear] = useState<Year | null>(null);

  const [interests, setInterests] = useState<string[]>([]);

  // Pronouns: either a preset or custom text when "self-describe"
  const [pronounsPreset, setPronounsPreset] = useState<string>(""); // one of PRONOUN_OPTIONS or ""
  const [pronounsCustom, setPronounsCustom] = useState<string>("");

  // Phone formatting: display formatted, store E.164
  const [phoneDisplay, setPhoneDisplay] = useState<string>("");
  const [visibility, setVisibility] = useState<Visibility>("campus");
  const [eventReminders, setEventReminders] = useState(true);

  const [friendsCountLive, setFriendsCountLive] = useState<number>(0);
  const [pendingCountLive, setPendingCountLive] = useState<number>(0);

  const [preferences, setPreferencces] = useState(false);
  const [dark, setDark] = useState<boolean>(() => document.documentElement.classList.contains("dark"));

  /* ------------ Auth guard + load profile ------------- */
  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      setReady(true);
      if (!u) {
        nav("/login", { replace: true });
        return;
      }
      try {
        setErr(null);
        const idToken = await u.getIdToken(true);
        const r = await fetch("/api/users/me", { headers: { Authorization: `Bearer ${idToken}` } });
        if (!r.ok) throw new Error(await r.text());
        const p: UserProfile = await r.json();
        setProfile(p);

        setDisplayName(p.name || u.email?.split("@")[0] || "Student");
        setBio(p.bio ?? "");
        setMajor(p.major ?? "");
        setYear((p.year as Year) ?? null);

        // Pronouns hydrate
        if (!p.pronouns || p.pronouns === "") {
          setPronounsPreset("");
          setPronounsCustom("");
        } else if (PRONOUN_OPTIONS.includes(p.pronouns as any)) {
          setPronounsPreset(p.pronouns as string);
          setPronounsCustom("");
        } else {
          setPronounsPreset("self-describe");
          setPronounsCustom(p.pronouns);
        }

        // Phone hydrate: p.phone is E.164; render formatted US number if +1
        setPhoneDisplay(formatUSPhoneFromE164(p.phone ?? ""));

        setVisibility(p.visibility);
        setEventReminders(Boolean(p.notificationPrefs?.eventReminders));
      } catch (e: any) {
        setErr(e?.message || "Failed to load profile");
      }
    });
    return () => off();
  }, [nav]);

  useEffect(() => {
  if (!fbUser?.uid) return;

  // Friends live count
  const offFriends = onSnapshot(
    collection(db, "users", fbUser.uid, "friends"),
    (snap) => setFriendsCountLive(snap.size),
    () => setFriendsCountLive(0)
  );

  // Pending requests live count (incoming)
  const offReqs = onSnapshot(
    query(collection(db, "users", fbUser.uid, "friendRequests"), orderBy("createdAt", "desc")),
    (snap) => setPendingCountLive(snap.size),
    () => setPendingCountLive(0)
  );

  return () => { offFriends(); offReqs(); };
}, [fbUser?.uid]);

  const initials = useMemo(() => {
    const base = (displayName || fbUser?.email || "Campus Hub").trim();
    return base.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  }, [displayName, fbUser?.email]);

  function toggleTheme() {
    const root = document.documentElement;
    root.classList.toggle("dark");
    setDark(root.classList.contains("dark"));
  }

  async function doLogout() {
    await signOut(auth);
  }

  async function handleDeleteAccount() {
  const auth = getAuth();
  const idToken = await auth.currentUser.getIdToken();

  const res = await fetch("/api/users/me", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  const data = await res.json();

  if (res.ok) {
    alert("Your account has been deleted.");
    await auth.signOut();
    window.location.href = "/";
  } else {
    alert("Failed to delete account: " + data.detail);
  }
}

  async function saveProfile() {
    if (!fbUser) return;
    try {
      setSaving(true);
      setErr(null);
      const idToken = await fbUser.getIdToken(true);

      // Build pronouns value to store
      const pronounsToStore =
        pronounsPreset === "self-describe" ? (pronounsCustom.trim() || null)
        : pronounsPreset || null;

      // Build phone E.164 (+1XXXXXXXXXX for US)
      const e164 = toE164US(phoneDisplay);

      const body = {
        name: displayName,
        bio,
        major: major || null,
        year: year ?? null,
        pronouns: pronounsToStore,
        phone: e164,                 // store normalized value
        visibility,
        notificationPrefs: {
          ...(profile?.notificationPrefs ?? {}),
          eventReminders: eventReminders,
        },
        preferences: preferences,
      };
      const r = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      const p: UserProfile = await r.json();
      setProfile(p);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Re-hydrate display phone just in case backend transforms
      setPhoneDisplay(formatUSPhoneFromE164(p.phone ?? ""));
    } catch (e: any) {
      setErr(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!ready || !fbUser) {
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
            className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-brand text-background hover:bg-brand-600"
          >
            <LogOut className="size-4" />
            Sign out
          </button>    
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {err && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
            {String(err)}
          </div>
        )}
        {saved && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 px-3 py-2 text-sm">
            ✓ Saved successfully
          </div>
        )}

        {/* Identity */}
        <section className="bg-surface border border-border rounded-2xl shadow-soft p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {fbUser.photoURL ? (
              <img src={fbUser.photoURL} alt={displayName} className="size-20 rounded-2xl border border-border object-cover" />
            ) : (
              <div className="size-20 rounded-2xl border border-border bg-brand/10 grid place-items-center">
                <span className="text-brand font-semibold text-xl">{initials}</span>
              </div>
            )}

            <div className="flex-1 w-full">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="text-xl md:text-2xl font-semibold bg-transparent border-b border-transparent focus:border-border outline-none rounded px-1"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-brand/10 text-brand border border-brand/20">
                  <UserCircle2 className="size-3.5" /> {capitalize(profile?.primaryRole ?? "student")}
                </span>
                {profile?.isStaffVerified && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-600/10 text-emerald-600 border border-emerald-600/20">
                    <ShieldCheck className="size-3.5" /> Verified staff
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-text-muted inline-flex items-center gap-2">
                <Mail className="size-4" />
                {fbUser.email}
              </p>
              {/* Social stats */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-surface/60 px-4 py-3">
                  <p className="text-xs text-text-muted">Friends</p>
                  <p className="mt-1 text-xl font-semibold">{friendsCountLive}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface/60 px-4 py-3">
                  <p className="text-xs text-text-muted">Requests</p>
                  <p className="mt-1 text-xl font-semibold">{pendingCountLive}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface/60 px-4 py-3 hidden sm:block">
                  <p className="text-xs text-text-muted">Visibility</p>
                  <p className="mt-1 text-sm font-medium capitalize">{visibility}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About & Preferences */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* About */}
          <section className="bg-surface border border-border rounded-2xl shadow-soft p-6">
            <h2 className="text-lg font-semibold">About</h2>
            <div className="mt-3 grid grid-cols-1 gap-3">
              {/* Major */}
              <label className="text-sm">
                <span className="block mb-1 text-text-muted">Major</span>
                <input
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  placeholder="Computer Science"
                />
              </label>

              {/* Year (custom select) */}
              <label className="text-sm">
                <span className="block mb-1 text-text-muted">Year</span>
                <CustomSelect
                  value={year}
                  placeholder="Select year…"
                  options={YEAR_OPTIONS}
                  onChange={(v) => setYear(v)}
                  render={(v) => v ? capitalize(v) : ""}
                />
              </label>

              {/* Pronouns (custom select + self-describe) */}
              <label className="text-sm">
                <span className="block mb-1 text-text-muted">Pronouns</span>
                <CustomSelect
                  value={pronounsPreset || ""}
                  placeholder="Select pronouns…"
                  options={PRONOUN_OPTIONS as readonly string[]}
                  onChange={(v) => setPronounsPreset(v || "")}
                  render={(v) => v ? v : ""}
                  allowClear
                />
                {pronounsPreset === "self-describe" && (
                  <input
                    className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
                    value={pronounsCustom}
                    onChange={(e) => setPronounsCustom(e.target.value)}
                    placeholder="Type your pronouns"
                  />
                )}
              </label>

              {/* Phone (formatted) */}
              <label className="text-sm">
                <span className="block mb-1 text-text-muted">Phone (US)</span>
                <input
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
                  inputMode="tel"
                  placeholder="(413) 555-1234"
                  value={phoneDisplay}
                  onChange={(e) => setPhoneDisplay(formatUSPhoneOnType(e.target.value))}
                />
                <p className="mt-1 text-xs text-text-muted">
                </p>
              </label>

              {/* Bio */}
              <label className="text-sm">
                <span className="block mb-1 text-text-muted">Bio</span>
                <textarea
                  className="w-full min-h-28 rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-brand"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="e.g., CS major, loves intramural basketball and hackathons."
                />
              </label>

              <label className="text-sm">
  <span className="block mb-1 text-text-muted">Interests</span>
  <MultiSelect
    values={interests}
    options={INTEREST_OPTIONS}
    onChange={setInterests}
    placeholder="Select interests…"
    render={(v) => capitalize(v)}
  />
</label>

              {/* Visibility (custom select) */}
              <label className="text-sm">
                <span className="block mb-1 text-text-muted">Profile visibility</span>
                <CustomSelect
                  value={visibility}
                  placeholder="Choose visibility…"
                  options={VIS_OPTIONS}
                  onChange={(v) => setVisibility(v as Visibility)}
                  render={(v) => v ? capitalize(v) : ""}
                />
              </label>

              <div className="mt-2 flex justify-end">
                <button
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand text-background hover:bg-brand-600 disabled:opacity-70"
                  onClick={saveProfile}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </section>

          {/* Preferences */}
        <section className="bg-surface border border-border rounded-2xl shadow-soft p-6 flex flex-col">
         <h2 className="text-lg font-semibold">Preferences</h2>
          <ul className="mt-3 space-y-3 flex-1">
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
                 checked={eventReminders}
                  onChange={() => setEventReminders((v) => !v)}
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

           {/* Delete Account */}
          <div className="flex justify-end mt-6">
            <button
             onClick={openDeleteModal}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-brand text-background hover:bg-brand-600"
            >
              Delete Account
           </button>
          </div>
         {/* Delete Confirmation Modal */}
          {showDeleteModal && (
           <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 w-96">
               <h2 className="text-xl font-semibold text-red-600 mb-2">Confirm Account Deletion</h2>
                <p className="text-gray-600 mb-6">
                 Are you sure you want to permanently delete your account? This action cannot be undone.
               </p>
                <div className="flex justify-end space-x-3">
                 <button
                   onClick={closeDeleteModal}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

/* ---------------- Helpers: formatting ---------------- */

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function onlyDigits(s: string) { return s.replace(/\D+/g, ""); }

// Formats whatever the user types into (XXX) XXX-XXXX progressively
function formatUSPhoneOnType(input: string) {
  const d = onlyDigits(input).slice(0, 10);
  const p1 = d.slice(0,3);
  const p2 = d.slice(3,6);
  const p3 = d.slice(6,10);
  if (d.length <= 3) return p1 ? `(${p1}` : "";
  if (d.length <= 6) return `(${p1}) ${p2}`;
  return `(${p1}) ${p2}-${p3}`;
}

// Convert E.164 +1XXXXXXXXXX to pretty US format
function formatUSPhoneFromE164(e164: string) {
  if (!e164) return "";
  const m = e164.match(/^\+1(\d{10})$/);
  if (!m) return e164; // non-US or invalid, show raw
  const d = m[1];
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
}

// Convert display string to E.164 (+1##########). Returns null if invalid/incomplete.
function toE164US(display: string): string | null {
  const d = onlyDigits(display);
  if (d.length === 0) return null;
  if (d.length === 10) return `+1${d}`;
  // Also allow users who paste +1##########
  if (/^\+1\d{10}$/.test(display)) return display;
  return null; // don’t save junk
}

/* ---------------- UI: Custom Select (headless) ---------------- */

type CustomSelectProps<T extends string> = {
  value: T | string | null;
  placeholder?: string;
  options: readonly T[] | readonly string[];
  onChange: (v: T | null) => void;
  render?: (v: T | string | null) => string;
  allowClear?: boolean;
};

function CustomSelect<T extends string>({
  value,
  placeholder = "Select…",
  options,
  onChange,
  render,
  allowClear = false,
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const label = value ? (render ? render(value) : String(value)) : "";

  return (
    <div className="relative" ref={boxRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full inline-flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 hover:bg-muted"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={label ? "" : "text-text-muted"}>{label || placeholder}</span>
        <ChevronDown className="size-4 text-text-muted" />
      </button>

      {open && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute z-30 mt-2 w-full rounded-xl border border-border bg-surface shadow-soft max-h-60 overflow-auto"
        >
          {allowClear && (
            <OptionRow
              active={false}
              selected={!value}
              onClick={() => { onChange(null); setOpen(false); }}
              label="— Clear —"
            />
          )}
          {(options as readonly string[]).map((opt) => {
            const selected = String(value) === String(opt);
            const lbl = render ? render(opt as T) : String(opt);
            return (
              <OptionRow
                key={String(opt)}
                active={false}
                selected={selected}
                label={lbl}
                onClick={() => { onChange(opt as T); setOpen(false); }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

type MultiSelectProps<T extends string> = {
  values: T[];
  options: readonly T[];
  placeholder?: string;
  onChange: (v: T[]) => void;
  render?: (v: T) => string;
};

function MultiSelect<T extends string>({
  values,
  options,
  placeholder = "Select…",
  onChange,
  render
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggle = (opt: T) => {
    const exists = values.includes(opt);
    onChange(
      exists ? values.filter((v) => v !== opt) : [...values, opt]
    );
  };

  return (
    <div className="relative" ref={boxRef}>
      {/* Button / Field */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-10 flex items-center justify-between flex-wrap gap-2 rounded-xl border border-border bg-surface px-3 py-2 hover:bg-muted text-left"
      >
        {values.length === 0 ? (
          <span className="text-text-muted">{placeholder}</span>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {values.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 bg-brand/10 text-brand px-2 py-1 rounded-lg text-xs"
              >
                {render ? render(v) : v}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(v);
                  }}
                  className="text-brand hover:text-brand-600"
                >
                  
                </button>
              </span>
            ))}
          </div>
        )}
        <ChevronDown className="size-4 shrink-0 text-text-muted ml-auto" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-border bg-surface shadow-soft max-h-60 overflow-auto">
          {options.map((opt) => {
            const selected = values.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt as T)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted"
              >
                <span>{render ? render(opt) : opt}</span>
                {selected && <Check className="size-4 text-brand" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OptionRow(props: { active: boolean; selected: boolean; label: string; onClick: () => void }) {
  const { selected, label, onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between`}
      role="option"
      aria-selected={selected}
    >
      <span>{label}</span>
      {selected && <Check className="size-4 text-brand" />}
    </button>
  );
}