import Link from "next/link";
import { ArrowRight, Bookmark, BriefcaseBusiness, Building2, CalendarDays, Check, CircleHelp, Compass, ExternalLink, Filter, MapPin, Search, Sparkles } from "lucide-react";
import { z } from "zod";
import { saveOpportunityAction } from "@/app/actions/workspace";
import { requireAuthenticatedUser } from "@/lib/auth";
import { calculateMatchFit, classYears, getMatchReasons, rankOpportunitiesByFit, type ClassYear, type Opportunity, type Preferences } from "@/lib/domain";
import type { OpportunityRecord, ProfileRecord } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const querySchema = z.object({
  q: z.string().max(100).optional(),
  classYear: z.enum(classYears).optional(),
  location: z.string().max(100).optional(),
  workMode: z.enum(["remote", "hybrid", "onsite"]).optional(),
  compensation: z.enum(["paid", "unpaid", "unknown"]).optional(),
  deadlineBefore: z.iso.date().optional(),
  sortBy: z.enum(["fit", "deadline"]).default("fit"),
  page: z.coerce.number().int().min(1).default(1),
});
type SearchParams = Record<string, string | string[] | undefined>;
const pageSize = 12;
const queryBatchSize = 500;
const maxRankedOpportunities = 5000;

function firstValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function dbOpportunity(row: OpportunityRecord): Opportunity {
  return {
    id: row.id,
    canonicalSourceId: row.canonical_source_id,
    company: row.company,
    title: row.title,
    description: row.description,
    eligibleClassYears: row.eligible_class_years as ClassYear[],
    eligibilityBasis: row.eligibility_basis,
    eligibilityNotes: row.eligibility_notes,
    location: row.location,
    workMode: row.work_mode,
    compensationType: row.compensation_type,
    compensationDetails: row.compensation_details,
    sourceUrl: row.source_url,
    deadlineDate: row.deadline_date,
    deadlineAt: row.deadline_at,
    lastVerifiedAt: row.last_verified_at,
    status: row.status,
    isDemo: row.is_demo,
    createdAt: row.created_at,
  };
}

function hrefForPage(page: number, filters: z.infer<typeof querySchema>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page })) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return `/discover?${params.toString()}`;
}

function safeFilter(value: string | undefined): string | undefined {
  const safe = value?.replace(/[^a-zA-Z0-9\s-]/g, " ").trim().replace(/\s+/g, " ");
  return safe || undefined;
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAuthenticatedUser();
  const raw = await searchParams;
  const parsed = querySchema.safeParse({
    q: firstValue(raw.q), classYear: firstValue(raw.classYear), location: firstValue(raw.location),
    workMode: firstValue(raw.workMode), compensation: firstValue(raw.compensation),
    deadlineBefore: firstValue(raw.deadlineBefore), sortBy: firstValue(raw.sortBy), page: firstValue(raw.page),
  });
  const filters = parsed.success ? parsed.data : querySchema.parse({});
  const supabase = await createSupabaseServerClient();
  const [{ data: profileData, error: profileError }, { data: savedData, error: savedError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("tracked_applications").select("opportunity_id").eq("user_id", user.id),
  ]);

  if (profileError || savedError) return <DataLoadError />;
  const profileRow = profileData as ProfileRecord | null;
  if (!profileRow?.onboarding_completed_at || !profileRow.current_class_year || !profileRow.major || !profileRow.graduation_year) {
    return <ProfilePrompt />;
  }

  const profile: Preferences = {
    graduationYear: profileRow.graduation_year,
    major: profileRow.major,
    skills: profileRow.skills,
    preferredLocations: profileRow.preferred_locations,
    remotePreference: profileRow.remote_preference,
    currentClassYear: profileRow.current_class_year,
    timezone: profileRow.timezone,
  };
  const selectedYear = filters.classYear ?? profile.currentClassYear;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  let request = supabase.from("opportunities").select("*", { count: "exact" })
    .eq("status", "published")
    .eq("is_demo", false)
    .or(`deadline_date.is.null,deadline_date.gte.${today}`)
    .or(`deadline_at.is.null,deadline_at.gte.${now}`)
    .or(`eligibility_basis.eq.undergraduates,eligibility_basis.eq.unclear,eligible_class_years.cs.{${selectedYear}}`);

  const search = safeFilter(filters.q);
  const place = safeFilter(filters.location);
  if (search) request = request.or(`title.ilike.%${search}%,company.ilike.%${search}%`);
  if (place) request = request.ilike("location", `%${place}%`);
  if (filters.workMode) request = request.eq("work_mode", filters.workMode);
  if (filters.compensation) request = request.eq("compensation_type", filters.compensation);
  if (filters.deadlineBefore) {
    const endOfDay = new Date(`${filters.deadlineBefore}T23:59:59Z`).toISOString();
    request = request.or(`deadline_date.lte.${filters.deadlineBefore},deadline_at.lte.${endOfDay}`);
  }

  const { data: firstBatch, error, count } = await request.range(0, queryBatchSize - 1);
  if (error) return <DataLoadError />;
  const matchingCount = count ?? firstBatch.length;
  if (matchingCount > maxRankedOpportunities) return <RankingCapacityError />;

  const allRecords = [...((firstBatch ?? []) as unknown as OpportunityRecord[])];
  for (let offset = queryBatchSize; offset < matchingCount; offset += queryBatchSize) {
    const { data: batch, error: batchError } = await request.range(offset, Math.min(offset + queryBatchSize - 1, matchingCount - 1));
    if (batchError) return <DataLoadError />;
    allRecords.push(...((batch ?? []) as unknown as OpportunityRecord[]));
  }

  const rankingProfile: Preferences = { ...profile, currentClassYear: selectedYear };
  const allOpportunities = allRecords.map(dbOpportunity);
  const ranked = filters.sortBy === "fit"
    ? rankOpportunitiesByFit(allOpportunities, rankingProfile)
    : [...allOpportunities].sort((left, right) => {
      const leftDeadline = left.deadlineAt ?? left.deadlineDate;
      const rightDeadline = right.deadlineAt ?? right.deadlineDate;
      const difference = leftDeadline && rightDeadline
        ? Date.parse(leftDeadline) - Date.parse(rightDeadline)
        : leftDeadline ? -1 : rightDeadline ? 1 : 0;
      return difference || right.lastVerifiedAt.localeCompare(left.lastVerifiedAt) || left.id.localeCompare(right.id);
    });
  const pageCount = Math.max(1, Math.ceil(ranked.length / pageSize));
  const currentPage = Math.min(filters.page, pageCount);
  const opportunities = ranked.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const savedIds = new Set(((savedData ?? []) as Array<{ opportunity_id: string }>).map(({ opportunity_id }) => opportunity_id));

  return <>
    <PageHeading eyebrow="FIND YOUR FIT" title="Discover opportunities" description="Listings are curated and linked to their original source. Check the source before you apply." />
    {firstValue(raw.error) && <p className="form-message form-error" role="alert">We couldn’t save that role. Refresh the list and try again.</p>}
    <form className="filter-bar production-filters" action="/discover" method="get">
      <label className="search-field"><Search size={16} /><span className="sr-only">Search title or company</span><input name="q" defaultValue={filters.q} placeholder="Search title or company" /></label>
      <label className="select-field"><span className="sr-only">Eligible class year</span><select name="classYear" defaultValue={selectedYear}><option value="freshman">Freshman</option><option value="sophomore">Sophomore</option><option value="junior">Junior</option><option value="senior">Senior</option><option value="graduate">Graduate student</option></select></label>
      <label className="select-field"><span className="sr-only">Work mode</span><select name="workMode" defaultValue={filters.workMode ?? ""}><option value="">Any work mode</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label>
      <label className="select-field"><span className="sr-only">Compensation</span><select name="compensation" defaultValue={filters.compensation ?? ""}><option value="">Any compensation</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="unknown">Not specified</option></select></label>
      <label className="location-field"><MapPin size={15} /><span className="sr-only">Location</span><input name="location" defaultValue={filters.location} placeholder="Location" /></label>
      <label className="date-filter"><CalendarDays size={15} /><span className="sr-only">Deadline before</span><input name="deadlineBefore" type="date" defaultValue={filters.deadlineBefore} /></label>
      <label className="select-field"><span className="sr-only">Sort opportunities</span><select name="sortBy" defaultValue={filters.sortBy}><option value="fit">Best fit</option><option value="deadline">Soonest deadline</option></select></label>
      <button type="submit" className="button button-dark"><Filter size={14} /> Filter</button>
    </form>
    <div className="results-line"><span>{ranked.length} published roles for a {selectedYear}</span><span>Open listings only · ranked by transparent fit score</span></div>
    <details className="score-method"><summary>How fit scores work</summary><p>Scores use source-stated eligibility (40 confirmed, 24 undergraduate-only, 10 unclear), major match (20), each of up to five matching skills (5 each), preferred location (10), and preferred work mode (5). A score explains profile overlap; it does not guarantee selection or eligibility beyond the source.</p></details>
    {opportunities.length ? <div className="opportunity-list">{opportunities.map((opportunity) => {
      const record = allRecords.find(({ id }) => id === opportunity.id);
      if (!record) return null;
      const eligibility = opportunity.eligibilityBasis === "listed_years" ? "confirmed" : opportunity.eligibilityBasis === "undergraduates" ? "potential" : "unclear";
      const badge = eligibility === "confirmed" ? ["Confirmed eligible", "badge-confirmed"] : eligibility === "potential" ? ["Potentially relevant", "badge-potential"] : ["Eligibility unclear", "badge-unclear"];
      const fit = calculateMatchFit(opportunity, rankingProfile);
      const reasons = getMatchReasons(opportunity, rankingProfile).slice(0, 3);
      return <article className="opportunity-card" key={record.id}>
        <div className="opportunity-main"><span className="company-stamp company-stamp-large">{record.company.slice(0, 1)}</span><div className="opportunity-title-block"><span className="company-name"><Building2 size={13} /> {record.company}</span><h2>{record.title}</h2><div className="opportunity-meta"><span><MapPin size={13} />{record.location}</span><span><BriefcaseBusiness size={13} />{record.work_mode}</span><span>{record.compensation_type === "unknown" ? "Compensation not listed" : record.compensation_details ?? record.compensation_type}</span></div></div><div className="opportunity-actions"><span className={`match-score match-score-${fit.tier}`} aria-label={`${fit.tier} match, ${fit.score} out of 100`}><strong>{fit.score}</strong><span>{fit.tier} fit</span></span><span className={`eligibility-badge ${badge[1]}`}>{eligibility === "confirmed" ? <Check size={12} /> : eligibility === "potential" ? <Sparkles size={12} /> : <CircleHelp size={12} />}{badge[0]}</span>{savedIds.has(record.id) ? <span className="save-button is-saved"><Check size={14} /> Saved</span> : <form action={saveOpportunityAction}><input type="hidden" name="opportunityId" value={record.id} /><button className="save-button" type="submit"><Bookmark size={14} /> Save role</button></form>}</div></div>
        <div className="opportunity-bottom"><div className="match-reasons"><span className="section-label">WHY IT MATCHES</span><div>{reasons.map((reason) => <span key={reason}><Check size={12} />{reason}</span>)}</div>{record.eligibility_notes && <p className="eligibility-notes">Source note: {record.eligibility_notes}</p>}</div><div className="listing-detail"><span>Deadline <strong>{record.deadline_at ? new Date(record.deadline_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: profile.timezone }) : record.deadline_date ?? "Not listed"}</strong></span><span>Verified <strong>{new Date(record.last_verified_at).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: profile.timezone })}</strong></span><a href={record.source_url} target="_blank" rel="noopener noreferrer">Original source <ExternalLink size={12} /></a></div></div>
      </article>;
    })}</div> : <EmptyResults hasFilters={Boolean(filters.q || filters.location || filters.workMode || filters.compensation || filters.deadlineBefore)} />}
    {pageCount > 1 && <div className="pagination">{currentPage > 1 && <Link href={hrefForPage(currentPage - 1, filters)}>Previous</Link>}<span>Page {currentPage} of {pageCount}</span>{currentPage < pageCount && <Link href={hrefForPage(currentPage + 1, filters)}>Next <ArrowRight size={14} /></Link>}</div>}
  </>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading"><div><span className="section-label">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div>;
}

function DataLoadError() {
  return <div className="data-error" role="alert"><CircleHelp size={21} /><div><strong>We couldn’t load opportunities.</strong><p>Check your Supabase connection and migration status. Production results never fall back to fictional demo listings.</p></div></div>;
}

function RankingCapacityError() {
  return <div className="data-error" role="alert"><CircleHelp size={21} /><div><strong>We couldn’t rank this result set safely.</strong><p>There are more than 5,000 matching curated listings. Narrow your filters and try again; results are not shown in misleading partial-fit order.</p></div></div>;
}

function ProfilePrompt() {
  return <div className="empty-state"><span className="empty-icon"><Compass size={20} /></span><h2>Finish your student profile.</h2><p>Your class year helps us show eligibility clearly.</p><Link className="button button-blue" href="/onboarding">Complete profile <ArrowRight size={14} /></Link></div>;
}

function EmptyResults({ hasFilters }: { hasFilters: boolean }) {
  return <div className="empty-state"><span className="empty-icon"><Search size={20} /></span><h2>{hasFilters ? "No published roles match those filters." : "No published opportunities yet."}</h2><p>{hasFilters ? "Adjust the search or filters and try again." : "Check back after an admin verifies and publishes a listing."}</p></div>;
}