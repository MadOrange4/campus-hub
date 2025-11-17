import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, deleteDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { KeyRound, Mail, Lock, Building2, User, FileText } from "lucide-react";

export default function OrgApplication() {
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [social, setSocial] = useState("");
  const [description, setDescription] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(false);

    if (!orgName || !contactName || !contactEmail || !social || !description) {
        setErr("Please fill out all required fields.");
        return;
    }

    try {
      setLoading(true);

      // Add a new document to the "orgApplications" collection
      await addDoc(collection(db, "orgApplications"), {
        orgName,
        orgNameLower: orgName.toLowerCase(),
        contactName,
        contactEmail: contactEmail.toLowerCase(),
        social,
        description,
        status: "pending", // Admin can review this
        submittedAt: serverTimestamp(),
      });

      setSuccess(true);
      // Reset form
      setOrgName("");
      setContactName("");
      setContactEmail("");
      setSocial("");
      setDescription("");

    } catch (ex: any) {
      setErr(ex?.message ?? "Application failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-background text-text px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-brand/10 border border-brand/20">
            <Building2 className="size-6 text-brand" />
          </div>
          <h1 className="mt-3 text-2xl font-semibold">Organization Application</h1>
          <p className="text-sm text-text-muted">
            Submit your club's information for approval.
          </p>
        </div>

        <form onSubmit={onSubmit} className="bg-surface border border-border rounded-2xl shadow-soft p-6">
          {err && (
            <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 text-danger px-3 py-2 text-sm">
              {err}
            </div>
          )}
          {success && (
             <div className="mb-4 rounded-xl border border-success/40 bg-success/10 text-success px-3 py-2 text-sm">
              Application submitted! We'll review it and get back to you soon.
            </div>
          )}

          <label className="block text-sm font-medium mb-1">Organization Name</label>
          <div className="relative mb-4">
            <input
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-brand"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. 'Coding Club'"
              type="text"
              required
            />
            <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          </div>

          <label className="block text-sm font-medium mb-1">Your Full Name</label>
          <div className="relative mb-4">
            <input
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-brand"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. 'Jane Doe'"
              type="text"
              required
            />
            <User className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          </div>

          <label className="block text-sm font-medium mb-1">School Email</label>
          <div className="relative mb-4">
            <input
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-brand"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Your email address"
              type="email"
              required
            />
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          </div>
          
          <label className="block text-sm font-medium mb-1">Club Description</label>
          <div className="relative mb-4">
            <textarea
              className="w-full min-h-[80px] rounded-xl border border-border bg-surface px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-brand"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is your club about?"
            />
            <FileText className="absolute right-3 top-3.5 size-4 text-text-muted" />
          </div>

          <label className="block text-sm font-medium mb-1">Club Community</label>
          <div className="relative mb-4">
            <textarea
              className="w-full min-h-[80px] rounded-xl border border-border bg-surface px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-brand"
              value={social}
              onChange={(e) => setSocial(e.target.value)}
              placeholder="Instagram page, organizaiton website, etc..."
            />
            <FileText className="absolute right-3 top-3.5 size-4 text-text-muted" />
          </div>

          <button
            disabled={loading}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand text-background hover:bg-brand-600 disabled:opacity-70"
          >
            {loading ? "Submitting…" : "Submit Application"}
          </button>

          <p className="mt-4 text-xs text-text-muted text-center">
            <Link to="/profile" className="underline">
              Back to Profile
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
