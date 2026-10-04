import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, CalendarDays, ExternalLink, MapPin } from "lucide-react";
import { deadlineConfidenceLabel } from "@/lib/domain";
import { browsePages, filterBrowseListings } from "@/lib/browse-pages";
import { getPublishedOpportunities } from "@/lib/public-opportunities";
import type { OpportunityRecord } from "@/lib/database.types";

const getBrowseResults = cache(async (slug: string) => {
  const definition = browsePages.find((item) => item.slug === slug);
  if (!definition) return null;

  const all = await getPublishedOpportunities();
  const listings = filterBrowseListings(definition, all);
  return { definition, listings };
});

export function generateStaticParams() {
  return browsePages.map(({ slug }) => ({ slug }));
}

type BrowsePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: BrowsePageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getBrowseResults(slug);
  if (!result) return { title: "Internship browse page not found", robots: { index: false, follow: false } };

  const url = `/internships/browse/${result.definition.slug}`;
  return {
    title: result.definition.title,
    description: result.definition.description,
    alternates: { canonical: url },
    openGraph: { title: result.definition.title, description: result.definition.description, url, type: "website" },
    ...(result.listings.length ? {} : { robots: { index: false, follow: true } }),
  };
}

export const dynamic = "force-dynamic";

export default async function InternshipBrowsePage({ params }: BrowsePageProps) {
  const { slug } = await params;
  const result = await getBrowseResults(slug);
  if (!result) notFound();
  const { definition, listings } = result;

  return <main className="public-opportunity-page">
    <header className="public-opportunity-header"><Link href="/" className="brand-lockup"><span className="brand-mark">IR</span><span>intern<span className="brand-light">radar</span></span></Link><Link className="button button-dark button-small" href="/sign-up">Create a free account <ArrowRight size={14} /></Link></header>
    <nav className="public-breadcrumb" aria-label="Breadcrumb"><Link href="/">InternRadar</Link><span>/</span><span>Internships</span><span>/</span><span>{definition.title}</span></nav>
    <section className="browse-hero"><span className="section-label">CURATED OPPORTUNITY DIRECTORY</span><h1>{definition.title}</h1><p>{definition.intro}</p><p className="browse-data-note">Only current published production listings appear here. Fictional demo data is never included.</p></section>
    <section className="browse-results" aria-labelledby="browse-results-heading">
      <div className="browse-results-heading"><div><span className="section-label">OPEN LISTINGS</span><h2 id="browse-results-heading">{listings.length} current {listings.length === 1 ? "opportunity" : "opportunities"}</h2></div><Link className="button button-quiet" href="/sign-up">Personalize your matches <ArrowRight size={14} /></Link></div>
      {listings.length ? <><div className="public-listing-list">{listings.slice(0, 50).map((listing) => <PublicListingCard listing={listing} key={listing.id} />)}</div>{listings.length > 50 && <p className="browse-data-note">Showing 50 recently verified listings. Create an account to search all current opportunities.</p>}</> : <div className="empty-state"><h2>No matching listings are currently published.</h2><p>We won’t invent listings for search traffic. Check back as verified opportunities are added.</p></div>}
    </section>
    <footer className="public-opportunity-footer"><Link href="/internships/browse/freshman-internships">Browse for freshmen</Link><Link href="/internships/browse/paid-sophomore-internships">Paid sophomore internships</Link><Link href="/internships/browse/remote-undergraduate-research-internships">Remote research internships</Link><span>Eligibility and deadlines can change; confirm with the original source.</span></footer>
  </main>;
}

function PublicListingCard({ listing }: { listing: OpportunityRecord }) {
  const deadline = listing.deadline_at
    ? new Date(listing.deadline_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : listing.deadline_date ?? (listing.deadline_type === "rolling" ? "Rolling" : "Not listed");
  const eligibility = listing.eligibility_basis === "listed_years"
    ? `Source names: ${listing.eligible_class_years.join(", ")}`
    : listing.eligibility_basis === "undergraduates"
      ? "Undergraduates mentioned; individual years not stated"
      : "Eligibility unclear from source";

  return <article className="public-listing-card">
    <div><span className="public-listing-company">{listing.company}</span><h3><Link href={`/internships/${listing.slug}`}>{listing.title}</Link></h3><div className="public-opportunity-facts"><span><MapPin size={14} />{listing.location}</span><span><BriefcaseBusiness size={14} />{listing.work_mode}</span><span>{listing.compensation_details ?? (listing.compensation_type === "unknown" ? "Compensation not listed" : listing.compensation_type)}</span></div><p className="public-listing-eligibility">{eligibility}</p></div>
    <div className="public-listing-deadline"><span><CalendarDays size={14} />Deadline: {deadline}</span><small>{deadlineConfidenceLabel(listing.deadline_type)}</small><a href={listing.source_url} target="_blank" rel="noopener noreferrer">Original source <ExternalLink size={12} /></a></div>
  </article>;
}
