import { CircleHelp, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { saveOpportunityAdminAction, updateOpportunityReportAction } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { classYears, getListingFreshness } from "@/lib/domain";
import type { OpportunityRecord } from "@/lib/database.types";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const staleBefore = new Date(new Date().getTime() - 15 * 86_400_000).toISOString();
  const requestedReportPage = Math.max(1, Math.trunc(Number(first(params.reportPage)) || 1));
  const reportPageSize = 50;
  const [listingsResult, freshnessResult, reportsResult] = await Promise.all([
    supabase.from("opportunities").select("*").order("updated_at", { ascending: false }).limit(100),
    supabase.from("opportunities").select("id", { count: "exact", head: true })
      .eq("status", "published").eq("is_demo", false).lte("last_verified_at", staleBefore),
    supabase.from("opportunity_reports")
      .select("id,opportunity_id,reason,details,status,created_at,opportunities!inner(title,company,slug)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((requestedReportPage - 1) * reportPageSize, requestedReportPage * reportPageSize - 1),
  ]);
  if (listingsResult.error || freshnessResult.error || reportsResult.error) return <div className="data-error" role="alert"><CircleHelp size={20} /><div><strong>Opportunity listings could not be loaded.</strong><p>Check the Supabase migration and database policies.</p></div></div>;
  const listings = (listingsResult.data ?? []) as unknown as OpportunityRecord[];
  let reports = reportsResult.data ?? [];
  const reportCount = reportsResult.count ?? reports.length;
  const reportPageCount = Math.max(1, Math.ceil(reportCount / reportPageSize));
  const currentReportPage = Math.min(requestedReportPage, reportPageCount);
  if (currentReportPage !== requestedReportPage) {
    const { data, error } = await supabase.from("opportunity_reports")
      .select("id,opportunity_id,reason,details,status,created_at,opportunities!inner(title,company,slug)")
      .order("created_at", { ascending: false })
      .range((currentReportPage - 1) * reportPageSize, currentReportPage * reportPageSize - 1);
    if (error) return <div className="data-error" role="alert"><CircleHelp size={20} /><div><strong>Listing reports could not be loaded.</strong><p>Check the Supabase migration and database policies.</p></div></div>;
    reports = data ?? [];
  }
  const message = first(params.message);
  const errorCode = first(params.error);

  return <>
    <div className="page-heading"><div><span className="section-label">ADMINISTRATION</span><h1>Opportunity management</h1><p>Create, verify, publish, edit, or close curated listings.</p></div><span className="admin-marker"><ShieldCheck size={15} /> Admin access</span></div>
    {message && <p className="form-message form-success" role="status">{message === "report" ? "Listing report review was updated." : "Listing saved. The verification date changes only when the original source is confirmed."}</p>}
    {errorCode && <p className="form-message form-error" role="alert">{errorCode === "duplicate" ? "That canonical source identifier is already in use." : errorCode === "verification" ? "Confirm you re-checked the original source before saving a published listing." : errorCode === "report" ? "The listing report could not be updated." : "The listing could not be saved. Check all fields and try again."}</p>}
    <section className="admin-create-panel"><div className="admin-section-heading"><div><span className="section-label">NEW LISTING</span><h2>Add an opportunity</h2></div></div><OpportunityForm /></section>
    <p className={`freshness-summary${freshnessResult.count ? " has-stale" : ""}`} role="status">{freshnessResult.count ?? 0} published production listing{freshnessResult.count === 1 ? "" : "s"} need re-verification (last checked over 14 days ago).</p>
    <section className="admin-listings"><div className="admin-section-heading"><div><span className="section-label">STUDENT FEEDBACK</span><h2>Listing reports <span>{reportCount} total</span></h2></div></div>
      <p className="report-open-count">{reports.filter((report) => report.status === "open").length} open on this page</p>
      {reports.length ? <div className="report-review-list">{reports.map((report) => {
        const opportunity = report.opportunities as unknown as { title: string; company: string; slug: string };
        return <article className="report-review-card" key={report.id}>
          <div><span className={`status-pill status-${report.status}`}>{report.status}</span><h3><a href={`/internships/${opportunity.slug}`} target="_blank" rel="noopener noreferrer">{opportunity.title}</a></h3><p>{opportunity.company} · {report.reason} · {new Date(report.created_at).toLocaleDateString()}</p>{report.details && <blockquote>{report.details}</blockquote>}</div>
          <form action={updateOpportunityReportAction}><input type="hidden" name="reportId" value={report.id} /><label>Review status<select name="status" defaultValue={report.status}><option value="open">Open</option><option value="reviewed">Reviewed</option><option value="resolved">Resolved</option></select></label><button className="button button-dark" type="submit">Save review</button></form>
        </article>;
      })}</div> : <p className="admin-empty">No listing reports yet.</p>}
      {reportPageCount > 1 && <nav className="pagination" aria-label="Listing report pages">{currentReportPage > 1 && <Link href={`/admin?reportPage=${currentReportPage - 1}`}>Previous reports</Link>}<span>Page {currentReportPage} of {reportPageCount}</span>{currentReportPage < reportPageCount && <Link href={`/admin?reportPage=${currentReportPage + 1}`}>Next reports</Link>}</nav>}
    </section>
    <section className="admin-listings"><div className="admin-section-heading"><div><span className="section-label">CURATED DATA</span><h2>Existing listings <span>{listings.length}</span></h2></div></div>
      {listings.length ? <div className="admin-list">{listings.map((listing) => {
        const freshness = getListingFreshness(listing.last_verified_at);
        return <details className="admin-listing" key={listing.id}><summary><span className={`status-pill status-${listing.status}`}>{listing.status}</span><span className="admin-listing-name"><strong>{listing.title}</strong><small>{listing.company} · Verified {new Date(listing.last_verified_at).toLocaleDateString()}</small></span><span className={`freshness-pill freshness-${freshness.state}`}>{freshness.state === "fresh" ? "Recent check" : freshness.state === "due" ? "Re-check due" : "Stale · re-check"}</span><span className="admin-listing-mode">{listing.is_demo ? "LOCAL DEMO" : "PRODUCTION"}</span></summary><OpportunityForm listing={listing} /></details>;
      })}</div> : <p className="admin-empty">No curated listings yet. Add the first listing above.</p>}
    </section>
  </>;
}

function OpportunityForm({ listing }: { listing?: OpportunityRecord }) {
  return <form action={saveOpportunityAdminAction} className="admin-form">
    <input type="hidden" name="opportunityId" value={listing?.id ?? ""} />
    <div className="admin-form-grid">
      <label>Company<input name="company" required maxLength={120} defaultValue={listing?.company ?? ""} /></label>
      <label>Title<input name="title" required maxLength={180} defaultValue={listing?.title ?? ""} /></label>
      <label className="admin-form-wide">Description<textarea name="description" required rows={4} maxLength={8000} defaultValue={listing?.description ?? ""} /></label>
      <label>Eligibility source<select name="eligibilityBasis" defaultValue={listing?.eligibility_basis ?? "unclear"}><option value="listed_years">Specific class years listed</option><option value="undergraduates">Undergraduate students stated</option><option value="unclear">Class-year eligibility unclear</option></select></label>
      <fieldset className="admin-years"><legend>Eligible class years</legend>{classYears.map((year) => <label key={year}><input type="checkbox" name="eligibleClassYears" value={year} defaultChecked={listing?.eligible_class_years.includes(year) ?? false} />{year}</label>)}<small>Only check years the original source explicitly names.</small></fieldset>
      <label className="admin-form-wide">Eligibility notes<input name="eligibilityNotes" maxLength={1000} defaultValue={listing?.eligibility_notes ?? ""} placeholder="Quote or summarize the source’s eligibility language" /></label>
      <label>Location<input name="location" required maxLength={160} defaultValue={listing?.location ?? ""} /></label>
      <label>Work mode<select name="workMode" defaultValue={listing?.work_mode ?? "remote"}><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label>
      <label>Compensation<select name="compensationType" defaultValue={listing?.compensation_type ?? "unknown"}><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="unknown">Unknown / not listed</option></select></label>
      <label>Compensation details<input name="compensationDetails" maxLength={160} defaultValue={listing?.compensation_details ?? ""} /></label>
      <label className="admin-form-wide">Original source URL<input name="sourceUrl" type="url" placeholder="https://careers.example.com/role" required defaultValue={listing?.source_url ?? ""} /><small>Public HTTPS URLs only. Do not enter redirect or tracking URLs.</small></label>
      <label>Canonical source identifier<input name="canonicalSourceId" maxLength={240} defaultValue={listing?.canonical_source_id ?? ""} placeholder="Company requisition ID or stable URL key" /></label>
      <label>Status<select name="status" defaultValue={listing?.status ?? "draft"}><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option></select></label>
      <label>Deadline certainty<select name="deadlineType" defaultValue={listing?.deadline_type ?? "unknown"}><option value="exact_timestamp">Exact timestamp stated</option><option value="date_only">Date stated; time unknown</option><option value="rolling">Rolling deadline stated</option><option value="not_listed">Source says no deadline</option><option value="unknown">Deadline not verified</option></select><small>Choose only what the original source supports.</small></label>
      <label>Deadline date<input name="deadlineDate" type="date" defaultValue={listing?.deadline_date ?? ""} /><small>Required for date-only deadlines.</small></label>
      <label className="admin-form-wide">Exact deadline timestamp<input name="deadlineAt" type="text" defaultValue={listing?.deadline_at ?? ""} placeholder="2026-12-01T17:00:00-05:00" /><small>ISO 8601 with UTC offset. Use only if the source gives a precise time.</small></label>
      <label>Source posted date<input name="sourcePostedDate" type="date" defaultValue={listing?.source_posted_date ?? ""} /><small>Optional; enter only when the original listing states when it was posted.</small></label>
    </div>
    <label className="verification-confirmation"><input type="checkbox" name="sourceRechecked" /> I checked the original source and confirmed this listing is still open and accurately represented. Published listings require this confirmation.</label>
    <div className="admin-form-footer"><span>Last verified changes only when you confirm a source check.</span><button className="button button-dark" type="submit">{listing ? "Save listing" : "Create listing"}</button></div>
  </form>;
}