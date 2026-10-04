import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, ExternalLink, MapPin } from "lucide-react";
import { reportOpportunityAction } from "@/app/actions/public";
import { deadlineConfidenceLabel, shouldEmitJobPostingSchema } from "@/lib/domain";
import { getPublishedOpportunity } from "@/lib/public-opportunities";

type InternshipPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export const dynamic = "force-dynamic";

function pageDescription(description: string): string {
  const plainText = description.replace(/\s+/g, " ").trim();
  return plainText.length > 155 ? `${plainText.slice(0, 152).trimEnd()}…` : plainText;
}

export async function generateMetadata({ params }: InternshipPageProps): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getPublishedOpportunity(slug);
  if (!listing) return { title: "Internship not found", robots: { index: false, follow: false } };

  const title = `${listing.title} at ${listing.company}`;
  const description = `${pageDescription(listing.description)} Eligibility: ${listing.eligibility_basis === "listed_years" ? listing.eligible_class_years.join(", ") : listing.eligibility_basis === "undergraduates" ? "undergraduate students; class years not specified" : "not stated by source"}.`;
  return {
    title,
    description,
    alternates: { canonical: `/internships/${listing.slug}` },
    openGraph: { title, description, type: "article", url: `/internships/${listing.slug}` },
  };
}

export default async function InternshipDetailPage({ params, searchParams }: InternshipPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const listing = await getPublishedOpportunity(slug);
  if (!listing) notFound();

  const eligibility = listing.eligibility_basis === "listed_years"
    ? `The source explicitly names: ${listing.eligible_class_years.join(", ")}.`
    : listing.eligibility_basis === "undergraduates"
      ? "The source mentions undergraduate students but does not name individual class years."
      : "The source does not state which class years are eligible.";
  const deadline = listing.deadline_at
    ? new Date(listing.deadline_at).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })
    : listing.deadline_date
      ? new Date(`${listing.deadline_date}T12:00:00Z`).toLocaleDateString(undefined, { dateStyle: "long", timeZone: "UTC" })
      : listing.deadline_type === "rolling"
        ? "Rolling application"
        : listing.deadline_type === "not_listed"
          ? "No deadline listed by the source"
          : "Deadline not verified";
  const canUseJobPostingSchema = shouldEmitJobPostingSchema({
    workMode: listing.work_mode,
    location: listing.location,
    sourcePostedDate: listing.source_posted_date,
  });
  const jobPosting = canUseJobPostingSchema ? {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: listing.title,
    description: listing.description,
    identifier: { "@type": "PropertyValue", name: listing.company, value: listing.canonical_source_id ?? listing.slug },
    datePosted: listing.source_posted_date,
    ...(listing.deadline_at ? { validThrough: listing.deadline_at } : listing.deadline_date ? { validThrough: listing.deadline_date } : {}),
    employmentType: "INTERN",
    hiringOrganization: { "@type": "Organization", name: listing.company },
    jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: { "@type": "Country", name: "US" },
  } : null;
  return <main className="public-opportunity-page">
    {jobPosting && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPosting).replace(/</g, "\\u003c") }} />}
    <header className="public-opportunity-header"><Link href="/" className="brand-lockup"><span className="brand-mark">IR</span><span>intern<span className="brand-light">radar</span></span></Link><Link className="button button-dark button-small" href="/sign-up">Create a free account <ArrowRight size={14} /></Link></header>
    <nav className="public-breadcrumb" aria-label="Breadcrumb"><Link href="/"><ArrowLeft size={14} /> InternRadar</Link><span>/</span><Link href="/internships/browse/freshman-internships">Internships</Link><span>/</span><span>{listing.title}</span></nav>
    {query.reported === "1" && <p className="form-message form-success" role="status">Thanks. Your report was sent to the InternRadar review team.</p>}
    {query.reported === "duplicate" && <p className="form-message form-success" role="status">You’ve already reported this listing. Thank you for helping us keep it current.</p>}
    {query.reported === "error" && <p className="form-message form-error" role="alert">We couldn’t submit that report. Sign in and try again.</p>}
    <header className="public-detail-hero">
      <span className="section-label">CURATED INTERNSHIP LISTING</span>
      <h1>{listing.title}</h1>
      <p className="public-detail-company">{listing.company}</p>
      <div className="public-opportunity-facts"><span><MapPin size={15} />{listing.location}</span><span><BriefcaseBusiness size={15} />{listing.work_mode}</span><span>{listing.compensation_type === "unknown" ? "Compensation not listed" : listing.compensation_details ?? listing.compensation_type}</span></div>
    </header>
    <div className="public-detail-grid">
      <section className="public-detail-main">
        <h2>Eligibility from the source</h2>
        <p>{eligibility}</p>
        {listing.eligibility_notes && <div className="public-source-evidence"><strong>Curator’s source note</strong><blockquote>{listing.eligibility_notes}</blockquote><p>A curator recorded this note after checking the original listing. It may summarize rather than quote the source; verify current requirements with the employer.</p></div>}
        <h2>About this internship</h2><p>{listing.description}</p>
      </section>
      <aside className="public-detail-sidebar">
        <h2>Opportunity details</h2>
        <dl><div><dt>Application deadline</dt><dd>{deadline}</dd><small>{deadlineConfidenceLabel(listing.deadline_type)}</small></div>{listing.source_posted_date && <div><dt>Source posted date</dt><dd>{new Date(`${listing.source_posted_date}T12:00:00Z`).toLocaleDateString(undefined, { dateStyle: "long", timeZone: "UTC" })}</dd></div>}<div><dt>Last source check</dt><dd>{new Date(listing.last_verified_at).toLocaleDateString(undefined, { dateStyle: "long" })}</dd></div><div><dt>Compensation</dt><dd>{listing.compensation_type === "unknown" ? "Not listed" : listing.compensation_details ?? listing.compensation_type}</dd></div></dl>
        <a className="primary" href={listing.source_url} target="_blank" rel="noopener noreferrer">View original listing <ExternalLink size={14} /></a>
        <Link href="/sign-up">Save and track this role <ArrowRight size={14} /></Link>
        <details className="public-report"><summary>Report an issue with this listing</summary><form action={reportOpportunityAction}>
      <input type="hidden" name="opportunityId" value={listing.id} /><input type="hidden" name="slug" value={listing.slug} />
      <label>What should we review?<select name="reason" required><option value="closed">The role is closed</option><option value="inaccurate">Details are inaccurate</option><option value="suspicious">The listing looks suspicious</option><option value="other">Other issue</option></select></label>
      <label>Details (optional)<textarea name="details" maxLength={2000} rows={3} placeholder="Tell us what you noticed." /></label>
      <button type="submit" className="button button-dark">Submit listing report</button>
        </form></details>
      </aside>
    </div>
    <footer className="public-opportunity-footer"><Link href="/internships/browse/freshman-internships">Browse curated internships <ArrowRight size={14} /></Link><span>Always verify eligibility, deadline, and application details with the original employer.</span></footer>
  </main>;
}
