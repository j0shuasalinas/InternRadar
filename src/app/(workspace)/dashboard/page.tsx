import Link from "next/link";
import { ArrowRight, Bookmark, CalendarDays, Check, CircleHelp, Compass, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth";
import type { ProfileRecord } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DashboardRow = { id: string; status: string; follow_up_date: string | null; opportunities: { company: string; title: string } | null };

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const [profileResult, recentResult, totalResult, appliedResult, interviewResult, followUpResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("tracked_applications").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("tracked_applications").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["applied", "interview", "offer"]),
    supabase.from("tracked_applications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "interview"),
    supabase.from("tracked_applications").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("follow_up_date", today),
    supabase.from("tracked_applications").select("id,status,follow_up_date,opportunities(company,title)").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(4),
  ]);

  if (profileResult.error || recentResult.error || totalResult.error || appliedResult.error || interviewResult.error || followUpResult.error) return <DataLoadError />;
  const profile = profileResult.data as ProfileRecord | null;
  if (!profile?.onboarding_completed_at || !profile.current_class_year || !profile.major) redirect("/onboarding");
  const rows = (recentResult.data ?? []) as unknown as DashboardRow[];
  const applied = appliedResult.count ?? 0;
  const interviews = interviewResult.count ?? 0;
  const followUps = followUpResult.count ?? 0;

  return <>
    <PageHeading eyebrow="YOUR NEXT CHAPTER" title="A little more direction." description={`A clear view of your search, ${profile.current_class_year} year. Start with a role that fits.`} action={<Link className="button button-blue" href="/discover">Find opportunities <ArrowRight size={15} /></Link>} />
    <section className="metrics-row" aria-label="Your application totals">
      <Metric icon={<Bookmark size={17} />} label="Roles tracked" value={totalResult.count ?? 0} tone="blue" />
      <Metric icon={<Check size={17} />} label="Applications started" value={applied} tone="green" />
      <Metric icon={<Sparkles size={17} />} label="Interviews" value={interviews} tone="yellow" />
      <Metric icon={<CalendarDays size={17} />} label="Follow-ups ahead" value={followUps} tone="coral" />
    </section>
    <section className="overview-grid">
      <div className="content-panel">
        <div className="panel-heading"><div><span className="section-label">RECENTLY UPDATED</span><h2>Your applications</h2></div><Link className="inline-link" href="/applications">View tracker <ArrowRight size={14} /></Link></div>
        {rows.length ? <div className="compact-list">{rows.slice(0, 4).map((row) => <Link className="compact-opportunity" href="/applications" key={row.id}><span className="company-stamp">{row.opportunities?.company.slice(0, 1) ?? "?"}</span><span className="compact-copy"><strong>{row.opportunities?.title ?? "Opportunity"}</strong><small>{row.opportunities?.company ?? "Listing unavailable"}</small></span><span className={`status-pill status-${row.status}`}>{row.status}</span><ArrowRight size={15} /></Link>)}</div> : <div className="dashboard-empty"><span className="empty-icon"><Compass size={19} /></span><div><strong>Your tracker is ready.</strong><p>Save an opportunity to keep your next step visible.</p></div><Link className="inline-link" href="/discover">Explore roles <ArrowRight size={14} /></Link></div>}
      </div>
      <div className="content-panel next-step-panel"><span className="section-label">YOUR SEARCH</span><div className="next-step-icon"><CircleHelp size={20} /></div><h2>Eligibility, with evidence.</h2><p>See whether a listing names your class year, says undergraduate students, or leaves eligibility unclear.</p><Link className="button button-dark" href="/discover">Browse opportunities <ArrowRight size={14} /></Link></div>
    </section>
  </>;
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