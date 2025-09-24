// src/pages/Landing.tsx
// Uses semantic colors from theme.css + tailwind.config.js

import { CalendarDays, Bell, Users, Sparkles, ShieldCheck, Github, ArrowRight } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-dvh bg-background text-text">
      {/* Header / Nav */}
      <header className="sticky top-0 z-20 backdrop-blur bg-surface/70 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <a href="/" className="font-semibold tracking-tight">Campus Hub</a>
          <nav className="hidden sm:flex items-center gap-2">
            <a href="#features" className="px-3 py-2 rounded-xl hover:bg-muted">Features</a>
            <a href="#how" className="px-3 py-2 rounded-xl hover:bg-muted">How it works</a>
            <a href="#tech" className="px-3 py-2 rounded-xl hover:bg-muted">Tech</a>
          </nav>
          <div className="flex items-center gap-2">
            <a href="/login" className="px-3 py-2 rounded-xl border border-border hover:bg-muted">Open App</a>
            <a
              href="https://github.com/MadOrange4/campus-hub"
              target="_blank"
              className="px-3 py-2 rounded-xl bg-text text-background hover:opacity-90 inline-flex items-center gap-2"
            >
              <Github className="size-4" /> Star
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand/15 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-14 md:py-20 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
              All your <span className="text-brand-600">campus events</span> in one place.
            </h1>
            <p className="mt-4 text-text-muted text-lg md:text-xl max-w-prose">
              Campus Hub helps UMass students discover, track, and attend events they care about with personalized feeds, reminders, and club pages.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/app" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-background hover:bg-brand-600">
                Launch <ArrowRight className="size-4" />
              </a>
              <a href="#features" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:bg-muted">
                Learn more
              </a>
            </div>
            <p className="mt-3 text-sm text-text-muted">Built by Team Oriole • React + FastAPI + Firebase</p>
          </div>

          <div className="relative">
            <div className="aspect-[4/3] w-full rounded-2xl border border-border bg-surface shadow-soft grid place-items-center">
              {/* Placeholder illustration block */}
              <div className="text-center p-2">
                <img src="preview.png"></img>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <h2 className="text-2xl md:text-3xl font-bold">Features students love</h2>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Feature icon={<Sparkles className="size-5" />} title="Personalized feed" desc="See events tailored to your major and interests." />
          <Feature icon={<Bell className="size-5" />} title="Smart reminders" desc="Get notified before events start so you never miss out." />
          <Feature icon={<Users className="size-5" />} title="Club pages" desc="Follow clubs, browse posts, and RSVP in seconds." />
          <Feature icon={<CalendarDays className="size-5" />} title="Central calendar" desc="Month view with quick filters and add-to-calendar files." />
          <Feature icon={<ShieldCheck className="size-5" />} title="Secure auth" desc="Login via Firebase; roles enforced on the server." />
          <Feature icon={<ArrowRight className="size-5" />} title="Fast & responsive" desc="Built mobile-first with Tailwind and modern tooling." />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <h2 className="text-2xl md:text-3xl font-bold">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          <Step n={1} title="Sign in" desc="Use your email or Google via Firebase Auth." />
          <Step n={2} title="Pick interests" desc="Select majors, tags, and clubs to follow." />
          <Step n={3} title="Discover & RSVP" desc="Browse your feed, set reminders, and attend." />
        </ol>
      </section>

      {/* Tech stack */}
      <section id="tech" className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <h2 className="text-2xl md:text-3xl font-bold">Tech stack</h2>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TechCard title="Frontend" items={["React + Vite (TypeScript)", "Tailwind CSS", "Router, icons"]} />
          <TechCard title="Backend" items={["FastAPI (Python)", "CORS + auth middleware", "REST JSON endpoints"]} />
          <TechCard title="Services" items={["Firebase Auth", "Firestore (DB) via server", "Storage + (optional) FCM"]} />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="p-6 md:p-8 rounded-2xl border border-border bg-surface flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div>
            <h3 className="text-xl md:text-2xl font-semibold">Ready to try Campus Hub?</h3>
            <p className="text-text-muted">Open the demo app and explore the events feed.</p>
          </div>
          <div className="flex gap-3">
            <a href="/app" className="px-4 py-2 rounded-xl bg-brand text-background hover:bg-brand-600">Open App</a>
            <a href="https://github.com/MadOrange4/campus-hub" target="_blank" className="px-4 py-2 rounded-xl border border-border bg-surface hover:bg-muted">View Code</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 text-sm text-text-muted flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Campus Hub</p>
          <div className="flex items-center gap-3">
            <a className="hover:underline" href="#features">Features</a>
            <a className="hover:underline" href="#how">How it works</a>
            <a className="hover:underline" href="#tech">Tech</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <article className="p-5 rounded-2xl border border-border bg-surface">
      <div className="inline-flex items-center justify-center size-9 rounded-xl bg-brand/10 text-brand-700 border border-brand/20">
        {icon}
      </div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="text-sm text-text-muted">{desc}</p>
    </article>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <li className="p-5 rounded-2xl border border-border bg-surface">
      <div className="inline-flex items-center justify-center size-8 rounded-full bg-brand text-background font-semibold">{n}</div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="text-sm text-text-muted">{desc}</p>
    </li>
  );
}

function TechCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="p-5 rounded-2xl border border-border bg-surface">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-text-muted">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
