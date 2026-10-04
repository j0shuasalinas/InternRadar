import Link from "next/link";
import { ArrowRight, Bookmark, CalendarDays, CircleHelp, ExternalLink, Search } from "lucide-react";
import { z } from "zod";
import { removeApplicationAction, updateApplicationAction } from "@/app/actions/workspace";
import { requireAuthenticatedUser } from "@/lib/auth";
import { applicationStatuses, deadlineConfidenceLabel } from "@/lib/domain";
import type { ApplicationStatusHistoryRecord, TrackedApplicationWithOpportunity } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const statusSchema = z.enum(applicationStatuses);
type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function safeSearch(value: string | undefined): string {
  return value?.slice(0, 80).trim().toLowerCase() ?? "";
}

function displayDeadline(date: string | null, timestamp: string | null): string {
  if (timestamp) return new Date(timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  if (date) return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
  return "Not listed";
}

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAuthenticatedUser();
  const params = await searchParams;
  const rawStatus = first(params.status);
  const status = rawStatus ? statusSchema.safeParse(rawStatus) : null;
  const query = safeSearch(first(params.q));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("tracked_applications")
    .select("id,opportunity_id,status,notes,applied_at,follow_up_date,application_checklist,experience_examples,created_at,updated_at,opportunities!inner(company,title,location,deadline_date,deadline_at,deadline_type,source_url)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) return <DataLoadError />;
  const rows = (data ?? []) as unknown as TrackedApplicationWithOpportunity[];
  const historyResult = rows.length
    ? await supabase.from("application_status_history")
      .select("id,tracked_application_id,previous_status,new_status,changed_at")
      .in("tracked_application_id", rows.map(({ id }) => id))
      .order("changed_at", { ascending: false })
      .limit(1000)
    : { data: [], error: null };
  if (historyResult.error) return <DataLoadError />;
  const historyByApplication = new Map<string, ApplicationStatusHistoryRecord[]>();
  for (const item of (historyResult.data ?? []) as ApplicationStatusHistoryRecord[]) {
    const events = historyByApplication.get(item.tracked_application_id) ?? [];
    if (events.length < 4) events.push(item);
    historyByApplication.set(item.tracked_application_id, events);
  }
  const visible = rows.filter((row) => {
    const listing = row.opportunities;
    const matchesQuery = !query || `${listing?.company ?? ""} ${listing?.title ?? ""}`.toLowerCase().includes(query);
    const matchesStatus = !status || !status.success || row.status === status.data;
    return matchesQuery && matchesStatus;
  });

  return <>
    <PageHeading eyebrow="KEEP THE MOMENTUM" title="Application tracker" description="Take one practical next step, save your notes, and add your dates to your calendar." action={<div className="tracker-heading-actions"><a className="button button-quiet" href="/api/calendar"><CalendarDays size={14} /> Export calendar</a><span className="tracked-total"><strong>{rows.length}</strong> tracked</span></div>} />
    {first(params.error) && <p className="form-message form-error" role="alert">We couldn’t save that update. Check the fields and try again.</p>}
    {first(params.message) && <p className="form-message form-success" role="status">Your tracker was updated.</p>}
    <form className="tracker-toolbar" action="/applications" method="get"><label className="search-field"><Search size={16} /><span className="sr-only">Search tracked roles</span><input name="q" defaultValue={query} placeholder="Search tracked roles" /></label><label className="select-field"><span className="sr-only">Filter by application status</span><select name="status" defaultValue={status?.success ? status.data : ""}><option value="">All statuses</option>{applicationStatuses.map((value) => <option value={value} key={value}>{value[0]?.toUpperCase()}{value.slice(1)}</option>)}</select></label><button className="button button-dark" type="submit"><Search size={14} /> Search</button></form>
    {visible.length ? <div className="tracker-list">{visible.map((row) => {
      const listing = row.opportunities;
      return <article className="tracker-card" key={row.id}>
        <div className="tracker-title"><span className="company-stamp">{listing?.company.slice(0, 1) ?? "?"}</span><div><strong>{listing?.title ?? "Opportunity unavailable"}</strong><small>{listing?.company ?? "This listing is no longer available"} · {listing?.location ?? ""}</small></div><a className="icon-button" href={listing?.source_url ?? "#"} target="_blank" rel="noopener noreferrer" aria-label={`Open source for ${listing?.title ?? "opportunity"}`}><ExternalLink size={15} /></a></div>
        <form action={updateApplicationAction} className="tracker-edit-form">
          <input type="hidden" name="applicationId" value={row.id} />
          <div className="tracker-fields"><label>Application status<select name="status" defaultValue={row.status}>{applicationStatuses.map((value) => <option value={value} key={value}>{value[0]?.toUpperCase()}{value.slice(1)}</option>)}</select></label><label>Application date<input name="appliedAt" type="date" defaultValue={row.applied_at ?? ""} /></label><label>Follow-up date<input name="followUpDate" type="date" defaultValue={row.follow_up_date ?? ""} /></label></div>
          <label className="notes-field">Private notes<textarea name="notes" defaultValue={row.notes} maxLength={3000} rows={2} placeholder="What did you send? Who should you follow up with?" /></label>
          <details className="application-next-steps" open>
            <summary>Your application checklist</summary>
            <label><input type="checkbox" name="requirementsReviewed" defaultChecked={row.application_checklist.requirementsReviewed} /> Review the eligibility and application requirements on the employer site</label>
            <label><input type="checkbox" name="materialsPrepared" defaultChecked={row.application_checklist.materialsPrepared} /> Prepare the resume, portfolio, or materials requested</label>
            <label><input type="checkbox" name="appliedOnSource" defaultChecked={row.application_checklist.appliedOnSource} /> Submit through the original employer site</label>
            <label className="notes-field">Coursework, projects, clubs, or volunteering that show relevant skills<textarea name="experienceExamples" defaultValue={row.experience_examples} maxLength={3000} rows={3} placeholder="Example: class project using SQL; robotics club prototype; volunteer data cleanup." /></label>
            <Link href="/toolkit">See the early-career application toolkit <ArrowRight size={13} /></Link>
          </details>
          <div className="tracker-footer"><span className={`status-pill status-${row.status}`}>{row.status}</span>{listing && <span><CalendarDays size={12} /> Deadline: {displayDeadline(listing.deadline_date, listing.deadline_at)} · {deadlineConfidenceLabel(listing.deadline_type)}</span>}<button className="inline-link" type="submit">Save changes <ArrowRight size={13} /></button></div>
        </form>
        <StatusHistory entries={historyByApplication.get(row.id) ?? []} />
        <form action={removeApplicationAction} className="remove-tracked-form"><input type="hidden" name="applicationId" value={row.id} /><button className="text-button" type="submit">Remove from tracker</button></form>
      </article>;
    })}</div> : <div className="empty-state"><span className="empty-icon"><Bookmark size={20} /></span><h2>{rows.length ? "No tracked roles match." : "Your tracker is ready."}</h2><p>{rows.length ? "Clear the search or status filter to see everything." : "Save a published opportunity from Discover and it will appear here."}</p>{!rows.length && <Link className="button button-blue" href="/discover">Discover opportunities <ArrowRight size={14} /></Link>}</div>}
  </>;
}

function StatusHistory({ entries }: { entries: ApplicationStatusHistoryRecord[] }) {
  if (!entries.length) return null;
  return <div className="status-history" aria-label="Application status history">
    <strong>Status history</strong>
    <ol>{entries.map((entry, index) => <li key={entry.id}>
      <span className={`status-pill status-${entry.new_status}`}>{entry.previous_status ? `${entry.previous_status} → ${entry.new_status}` : `Added as ${entry.new_status}`}</span>
      <time dateTime={entry.changed_at}>{new Date(entry.changed_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
      {index === 0 && <span className="history-current">Latest</span>}
    </li>)}</ol>
  </div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action: React.ReactNode }) {
  return <div className="page-heading"><div><span className="section-label">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function DataLoadError() {
  return <div className="data-error" role="alert"><CircleHelp size={21} /><div><strong>We couldn’t load your applications.</strong><p>Check your Supabase connection and migration status. No sample data was substituted.</p></div></div>;
}