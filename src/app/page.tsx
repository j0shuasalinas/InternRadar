import Link from "next/link";
import { ArrowDownRight, ArrowRight, Bookmark, CalendarClock, Check, CircleHelp, Radar, Search, Sparkles } from "lucide-react";

const previewRoles = [
  { company: "Northstar Labs", role: "Software Engineering Intern", label: "Sophomores named", tone: "confirmed" },
  { company: "Fieldnote", role: "Data Research Intern", label: "Undergraduate", tone: "potential" },
  { company: "Juniper Studio", role: "Product Design Intern", label: "Eligibility unclear", tone: "unclear" },
];
const demoHref = process.env.NODE_ENV === "production" ? "/sign-up" : "/demo";
const demoLabel = process.env.NODE_ENV === "production" ? "Create your account" : "Explore demo";

export default function Home() {
  return (
    <main className="landing-page">
      <header className="site-header">
        <Link href="/" className="brand-lockup" aria-label="InternRadar home">
          <span className="brand-mark"><Radar size={19} strokeWidth={2.2} /></span>
          <span>intern<span className="brand-light">radar</span></span>
        </Link>
        <nav className="top-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <Link href={demoHref}>{demoLabel}</Link>
        </nav>
        <div className="header-actions">
          <Link className="text-link" href="/sign-in">Sign in</Link>
          <Link className="button button-dark button-small" href="/sign-up">Create account <ArrowRight size={15} /></Link>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> A clearer start to your career</div>
          <h1>Find internships you’re <em>eligible for.</em><br />Track your next step.</h1>
          <p className="hero-description">Good opportunities shouldn’t be hidden behind a class-year guess. See what the listing actually says, find roles that fit, and keep every application moving.</p>
          <div className="hero-actions">
            <Link className="button button-blue" href="/sign-up">Build your free radar <ArrowRight size={16} /></Link>
            <Link className="button button-quiet" href={demoHref}>{process.env.NODE_ENV === "production" ? "Create an account" : "Try the interactive demo"} <ArrowDownRight size={16} /></Link>
          </div>
          <div className="hero-note"><Check size={14} /> No payment details. No invented success stats. Just your next step.</div>
        </div>

        <div className="preview-wrap" aria-label="Preview of the InternRadar opportunity finder">
          <div className="preview-topline"><span><span className="live-dot" /> YOUR OPPORTUNITY RADAR</span><span>FALL 2026</span></div>
          <div className="preview-heading">
            <div><span className="preview-kicker">MATCHES FOR</span><h2>Computer science<br />sophomores</h2></div>
            <div className="preview-count"><strong>03</strong><span>to review</span></div>
          </div>
          <div className="preview-filters"><span><Search size={13} /> software</span><span>Remote + hybrid <span className="filter-caret">⌄</span></span></div>
          <div className="preview-list">
            {previewRoles.map((role) => (
              <article className="preview-role" key={role.company}>
                <div className="company-stamp">{role.company.slice(0, 1)}</div>
                <div className="preview-role-copy"><strong>{role.role}</strong><span>{role.company} <i /> Boston · Hybrid</span></div>
                <span className={`match-tag match-${role.tone}`}>{role.tone === "confirmed" ? <Check size={11} /> : role.tone === "potential" ? <Sparkles size={11} /> : <CircleHelp size={11} />}{role.label}</span>
                <Bookmark className="preview-bookmark" size={16} />
              </article>
            ))}
          </div>
          <div className="preview-footer"><span><CalendarClock size={14} /> Deadlines, verified dates, and source links</span><Link href={demoHref}>{demoLabel} <ArrowRight size={13} /></Link></div>
          <div className="preview-caption">Fictional preview data · not open internships</div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Product principles">
        <span><Check size={15} /> Eligibility stated plainly</span>
        <span><Bookmark size={15} /> Applications in one place</span>
        <span><CalendarClock size={15} /> Reminders on your schedule</span>
      </section>

      <section className="browse-discovery" aria-labelledby="browse-heading">
        <div className="browse-discovery-heading">
          <span className="section-label">EXPLORE THE DIRECTORY</span>
          <h2 id="browse-heading">Start with what fits.</h2>
          <p>Browse focused collections of current listings. Eligibility is based on what each source says, not a guess.</p>
        </div>
        <div className="browse-discovery-links">
          <Link href="/internships/browse/freshman-internships">Internships for freshmen <ArrowRight size={15} /></Link>
          <Link href="/internships/browse/paid-sophomore-internships">Paid sophomore internships <ArrowRight size={15} /></Link>
          <Link href="/internships/browse/remote-undergraduate-research-internships">Remote undergraduate research internships <ArrowRight size={15} /></Link>
          <Link href="/internships/browse/computer-science-sophomore-internships">Computer science internships for sophomores <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-intro">
          <span className="section-label">A BETTER FIRST STEP</span>
          <h2>Less guessing.<br /><span>More doing.</span></h2>
          <p>InternRadar is built around the details that matter when you’re early in college: who can apply, where the role is, and what to do next.</p>
        </div>
        <div className="steps-list">
          <article className="step-row"><span className="step-index">01</span><div><h3>See the eligibility evidence</h3><p>Listings distinguish named class years, broad undergraduate criteria, and details the source never states.</p></div><span className="step-icon"><CircleHelp size={19} /></span></article>
          <article className="step-row"><span className="step-index">02</span><div><h3>Make the search yours</h3><p>Filter by major, skills, place, work mode, compensation, and the deadlines you can still make.</p></div><span className="step-icon"><Search size={19} /></span></article>
          <article className="step-row"><span className="step-index">03</span><div><h3>Keep the next step visible</h3><p>Save a role, note what you sent, and set a follow-up date. Your dashboard reflects your actual applications.</p></div><span className="step-icon"><CalendarClock size={19} /></span></article>
        </div>
      </section>

      <footer className="site-footer"><Link href="/" className="brand-lockup"><span className="brand-mark"><Radar size={17} /></span><span>intern<span className="brand-light">radar</span></span></Link><span>Built for the beginning of your career.</span><Link href={demoHref}>{process.env.NODE_ENV === "production" ? "Create an account" : "See the local demo"} <ArrowRight size={13} /></Link></footer>
    </main>
  );
}
