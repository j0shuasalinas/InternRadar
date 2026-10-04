import Link from "next/link";
import { ArrowRight, Bookmark, CalendarDays, Check, CircleHelp, Compass, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { dateKeyInTimeZone } from "@/lib/domain";
import { requireAuthenticatedUser } from "@/lib/auth";
import type { ProfileRecord } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DashboardRow = { id: string; status: string; opportunities: { company: string; title: string } | null };
type FollowUpRow = { id: string; status: string; follow_up_date: string; opportunities: { company: string; title: string } | null };

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const profileResult = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (profileResult.error) return <DataLoadError />;
  const profile = profileResult.data as ProfileRecord | null;
  if (!profile?.onboarding_completed_at || !profile.current_class_year || !profile.major) redirect("/onboarding");
  const today = dateKeyInTimeZone(new Date(), profile.timezone);
  const activeApplications = supabase.from("tracked_applications").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["applied", "interview", "offer"]);
  const activeFollowUps = supabase.from("tracked_applications").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).not("follow_up_date", "is", null).not("status", "in", '("rejected","withdrawn")');
  const [trackedResult, activeResult, interviewResult, upcomingCountResult, overdueCountResult, recentResult, upcomingResult, overdueResult] = await Promise.all([
    supabase.from("tracked_applications").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    activeApplications,
    supabase.from("tracked_applications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "interview"),
    activeFollowUps.gte("follow_up_date", today),
    supabase.from("tracked_applications").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).not("follow_up_date", "is", null).not("status", "in", '("rejected","withdrawn")').lt("follow_up_date", today),
    supabase.from("tracked_applications").select("id,status,opportunities(company,title)")
      .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(4),
    supabase.from("tracked_applications").select("id,status,follow_up_date,opportunities(company,title)")
      .eq("user_id", user.id).not("follow_up_date", "is", null).not("status", "in", '("rejected","withdrawn")')
      .gte("follow_up_date", today).order("follow_up_date", { ascending: true }).limit(4),
    supabase.from("tracked_applications").select("id,status,follow_up_date,opportunities(company,title)")
      .eq("user_id", user.id).not("follow_up_date", "is", null).not("status", "in", '("rejected","withdrawn")')
      .lt("follow_up_date", today).order("follow_up_date", { ascending: true }).limit(4),
  ]);

  if ([trackedResult, activeResult, interviewResult, upcomingCountResult, overdueCountResult, recentResult, upcomingResult, overdueResult]
    .some((result) => result.error)) return <DataLoadError />;
  const rows = (recentResult.data ?? []) as unknown as DashboardRow[];
  const upcomingFollowUps = (upcomingResult.data ?? []) as unknown as FollowUpRow[];
  const overdueFollowUps = (overdueResult.data ?? []) as unknown as FollowUpRow[];

  return <>
    <PageHeading eyebrow="YOUR NEXT CHAPTER" title="A little more direction." description={`A clear view of your search, ${profile.current_class_year} year. Start with a role that fits.`} action={<Link className="button button-blue" href="/discover">Find opportunities <ArrowRight size={15} /></Link>} />
    <section className="metrics-row" aria-label="Your application totals">
      <Metric icon={<Bookmark size={17} />} label="Roles tracked" value={trackedResult.count ?? 0} tone="blue" />
      <Metric icon={<Check size={17} />} label="Applications started" value={activeResult.count ?? 0} tone="green" />
      <Metric icon={<Sparkles size={17} />} label="Interviews" value={interviewResult.count ?? 0} tone="yellow" />
      <Metric icon={<CalendarDays size={17} />} label="Follow-ups ahead" value={upcomingCountResult.count ?? 0} tone="coral" />
    </section>
    <section className="overview-grid">
      <div className="content-panel">
        <div className="panel-heading"><div><span className="section-label">RECENTLY UPDATED</span><h2>Your applications</h2></div><Link className="inline-link" href="/applications">View tracker <ArrowRight size={14} /></Link></div>
        {rows.length ? <div className="compact-list">{rows.slice(0, 4).map((row) => <Link className="compact-opportunity" href="/applications" key={row.id}><span className="company-stamp">{row.opportunities?.company.slice(0, 1) ?? "?"}</span><span className="compact-copy"><strong>{row.opportunities?.title ?? "Opportunity"}</strong><small>{row.opportunities?.company ?? "Listing unavailable"}</small></span><span className={`status-pill status-${row.status}`}>{row.status}</span><ArrowRight size={15} /></Link>)}</div> : <div className="dashboard-empty"><span className="empty-icon"><Compass size={19} /></span><div><strong>Your tracker is ready.</strong><p>Save an opportunity to keep your next step visible.</p></div><Link className="inline-link" href="/discover">Explore roles <ArrowRight size={14} /></Link></div>}
      </div>
      <div className="content-panel next-step-panel"><span className="section-label">YOUR SEARCH</span><div className="next-step-icon"><CircleHelp size={20} /></div><h2>Eligibility, with evidence.</h2><p>See whether a listing names your class year, says undergraduate students, or leaves eligibility unclear.</p><Link className="button button-dark" href="/discover">Browse opportunities <ArrowRight size={14} /></Link></div>
    </section>
    <section className="content-panel follow-up-panel">
      <div className="panel-heading"><div><span className="section-label">YOUR NEXT ACTIONS</span><h2>Follow-ups</h2></div><Link className="inline-link" href="/applications">Open tracker <ArrowRight size={14} /></Link></div>
      {overdueCountResult.count ? <p className="follow-up-alert" role="status">{overdueCountResult.count} follow-up{overdueCountResult.count === 1 ? "" : "s"} overdue. Pick up where you left off.</p> : <p className="follow-up-clear">Nothing overdue. Keep your next follow-up date current.</p>}
      {[...overdueFollowUps, ...upcomingFollowUps].length
        ? <div className="follow-up-list">{[...overdueFollowUps, ...upcomingFollowUps].map((row) => <FollowUpItem key={row.id} row={row} today={today} />)}</div>
        : <p className="follow-up-empty">Add a personal follow-up date to a tracked application to see your next action here.</p>}
    </section>
  </>;
}

function FollowUpItem({ row, today }: { row: FollowUpRow; today: string }) {
  const isOverdue = row.follow_up_date < today;
  const formattedDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" })
    .format(new Date(`${row.follow_up_date}T12:00:00Z`));
  return <Link className={`follow-up-item${isOverdue ? " is-overdue" : ""}`} href="/applications">
    <span className="follow-up-date">{formattedDate}</span>
    <span className="follow-up-copy"><strong>{row.opportunities?.title ?? "Opportunity"}</strong><small>{row.opportunities?.company ?? "Listing unavailable"} · {row.status}</small></span>
    <span className="follow-up-state">{isOverdue ? "Overdue" : "Due"}</span>
    <ArrowRight size={14} />
  </Link>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action: React.ReactNode }) {
  return <div className="page-heading"><div><span className="section-label">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <div className="metric"><span className={`metric-icon metric-${tone}`}>{icon}</span><span className="metric-value">{value}</span><span className="metric-label">{label}</span></div>;
}

function DataLoadError() {
  return <div className="data-error" role="alert"><CircleHelp size={21} /><div><strong>We couldn’t load your dashboard.</strong><p>Check your Supabase connection and migration status, then refresh. Your data has not been replaced with demo records.</p></div></div>;
}