import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpenText, CheckCircle2, Lightbulb, Link2, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Early-Career Internship Toolkit",
  description: "Practical, honest guidance for first internship applications: understand requirements, show experience from coursework and projects, and follow through.",
  alternates: { canonical: "/toolkit" },
  openGraph: {
    title: "Early-Career Internship Toolkit",
    description: "Make a clear plan for your first internship application, even before you have internship experience.",
    type: "article",
  },
};

const examples = [
  ["Coursework", "A class project that used a role-relevant method, tool, or subject area."],
  ["Projects", "A personal or team project: what you built, your contribution, and the result."],
  ["Clubs and campus work", "A club, lab, student job, or event where you practiced collaboration or ownership."],
  ["Research and volunteering", "A research task or community contribution that demonstrates transferable skills."],
];

export default function ToolkitPage() {
  const toolkitCta = process.env.NODE_ENV === "production" ? "/sign-up" : "/demo";
  const toolkitCtaLabel = process.env.NODE_ENV === "production" ? "Create a free account" : "Try the interactive demo";
  return <main className="public-opportunity-page toolkit-page">
    <header className="public-opportunity-header"><Link href="/" className="brand-lockup"><span className="brand-mark">IR</span><span>intern<span className="brand-light">radar</span></span></Link><Link className="button button-dark button-small" href="/sign-up">Create a free account <ArrowRight size={14} /></Link></header>
    <nav className="public-breadcrumb" aria-label="Breadcrumb"><Link href="/"><ArrowLeft size={14} /> InternRadar</Link><span>/</span><span>Student toolkit</span></nav>
    <section className="toolkit-hero"><span className="section-label">A PRACTICAL STARTING POINT</span><h1>Your first internship application can start before your first internship.</h1><p>You may already have useful evidence in coursework, projects, campus work, clubs, research, or volunteering. This guide helps you connect it to a role honestly—without inventing experience or overstating fit.</p><Link className="button button-blue" href={toolkitCta}>{toolkitCtaLabel} <ArrowRight size={14} /></Link></section>
    <section className="toolkit-grid" aria-label="Application preparation steps">
      <article className="toolkit-card"><span className="toolkit-icon"><ShieldCheck size={18} /></span><h2>1. Check the source, not just the summary</h2><p>Read the original role page for class-year rules, required qualifications, location, compensation, and how to apply. If eligibility is unclear, ask the employer rather than assuming.</p><ul><li>Separate required qualifications from preferred ones.</li><li>Record any exact deadline and time zone.</li><li>Use InternRadar’s eligibility note as a guide, then verify it at the source.</li></ul></article>
      <article className="toolkit-card"><span className="toolkit-icon"><BookOpenText size={18} /></span><h2>2. Gather evidence you already have</h2><p>Choose one or two examples that demonstrate a skill the posting requests. Keep your role and contribution specific.</p><ul>{examples.map(([name, copy]) => <li key={name}><strong>{name}:</strong> {copy}</li>)}</ul><p>Use the private experience field in your application tracker to collect examples for each role.</p></article>
      <article className="toolkit-card"><span className="toolkit-icon"><Lightbulb size={18} /></span><h2>3. Make the connection concrete</h2><p>For each example, write one short note: context, what you did, and what changed or what you learned. Use numbers only when you can support them.</p><div className="toolkit-example"><strong>Instead of:</strong> “Good at data.”<br /><strong>Try:</strong> “Used SQL in a class project to clean and compare survey records with a three-person team.”</div><p>This is a structure example, not a claim about your experience—adapt it to what you actually did.</p></article>
      <article className="toolkit-card"><span className="toolkit-icon"><CheckCircle2 size={18} /></span><h2>4. Follow a small application checklist</h2><ol><li>Review eligibility and requirements on the employer site.</li><li>Prepare the requested materials, tailored to the role.</li><li>Apply through the original employer source.</li><li>Record your application date and a reasonable follow-up date.</li><li>Update the tracker when the employer responds.</li></ol><Link href="/applications">Open your application tracker <ArrowRight size={13} /></Link></article>
    </section>
    <section className="toolkit-trust"><Link2 size={18} /><div><strong>Keep your application factual.</strong><p>Never claim a skill, result, or eligibility status you can’t support. If a requirement is ambiguous, verify it with the employer.</p></div></section>
    <footer className="public-opportunity-footer"><Link href="/internships/browse/freshman-internships">Browse curated opportunities</Link><Link href="/sign-up">Build your personal opportunity radar</Link><span>Guidance is general; employers set their own requirements and selection process.</span></footer>
  </main>;
}
