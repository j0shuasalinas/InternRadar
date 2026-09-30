"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Bookmark, BriefcaseBusiness, Building2, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Compass, ExternalLink, Filter, LayoutDashboard, MapPin, Radar, Search, Settings2, Sparkles, X } from "lucide-react";
import { z } from "zod";
import { applicationStatuses, evaluateEligibility, filterOpportunities, getMatchReasons, preferencesSchema, type ApplicationStatus, type ClassYear, type Opportunity, type Preferences } from "@/lib/domain";

const trackedSchema = z.object({
  opportunityId: z.string(),
  status: z.enum(applicationStatuses),
  notes: z.string(),
  appliedAt: z.string().optional(),
  followUpDate: z.string().optional(),
});
const demoStateSchema = z.object({
  profile: preferencesSchema,
  applications: z.array(trackedSchema),
  weeklyDigest: z.boolean(),
  deadlineReminders: z.boolean(),
});
type TrackedEntry = z.infer<typeof trackedSchema>;
type DemoState = z.infer<typeof demoStateSchema>;
type View = "overview" | "discover" | "applications" | "settings";

const initialState: DemoState = {
  profile: {
    graduationYear: 2028,
    major: "Computer Science",
    skills: ["TypeScript", "Python", "SQL"],
    preferredLocations: ["Boston", "Remote"],
    remotePreference: "hybrid",
    currentClassYear: "sophomore",
    timezone: "America/New_York",
  },
  applications: [],
  weeklyDigest: false,
  deadlineReminders: false,
};

const storageKey = "internradar-local-demo-v1";
let clientState = initialState;
let hasReadStorage = false;
const subscribers = new Set<() => void>();

function getClientSnapshot(): DemoState {
  if (!hasReadStorage && typeof window !== "undefined") {
    hasReadStorage = true;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = demoStateSchema.safeParse(JSON.parse(raw));
        if (parsed.success) clientState = parsed.data;
      }
    } catch {
      clientState = initialState;
    }
  }
  return clientState;
}

function getServerSnapshot(): DemoState {
  return initialState;
}

function subscribe(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function updateDemoState(update: (current: DemoState) => DemoState): void {
  clientState = update(getClientSnapshot());
  if (typeof window !== "undefined") window.localStorage.setItem(storageKey, JSON.stringify(clientState));
  subscribers.forEach((listener) => listener());
}

function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

function prettyDate(value: string | null): string {
  if (!value) return "No deadline listed";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function eligibilityText(opportunity: Opportunity, profile: Preferences): { label: string; className: string } {
  const eligibility = evaluateEligibility(opportunity, profile);
  if (eligibility === "confirmed") return { label: "Confirmed eligible", className: "badge-confirmed" };
  if (eligibility === "potential") return { label: "Potentially relevant", className: "badge-potential" };
  if (eligibility === "unclear") return { label: "Eligibility unclear", className: "badge-unclear" };
  return { label: "Class year not listed", className: "badge-ineligible" };
}

function AppStatus({ status }: { status: ApplicationStatus }) {
  return <span className={`status-pill status-${status}`}>{status}</span>;
}

export default function DemoWorkspace({ opportunities }: { opportunities: Opportunity[] }) {
  const state = useDemoState();
  const [view, setView] = useState<View>("overview");
  const [classYearFilter, setClassYearFilter] = useState<ClassYear | "">(state.profile.currentClassYear);
  const [search, setSearch] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [compensation, setCompensation] = useState("");
  const [deadlineBefore, setDeadlineBefore] = useState("");
  const [location, setLocation] = useState("");
  const [page, setPage] = useState(1);
  const [applicationQuery, setApplicationQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");

  const discovery = filterOpportunities(opportunities, {
    query: search,
    classYear: classYearFilter || undefined,
    location: location || undefined,
    workMode: workMode ? workMode as Opportunity["workMode"] : undefined,
    compensationType: compensation ? compensation as Opportunity["compensationType"] : undefined,
    deadlineBefore: deadlineBefore || undefined,
    page,
    pageSize: 3,
  }, { includeDemo: true });
  const tracked = state.applications.map((entry) => ({ ...entry, opportunity: opportunities.find(({ id }) => id === entry.opportunityId) })).filter((entry) => entry.opportunity);
  const visibleApplications = tracked.filter(({ opportunity, status }) => {
    const matchesQuery = `${opportunity?.company} ${opportunity?.title}`.toLowerCase().includes(applicationQuery.toLowerCase());
    return matchesQuery && (!statusFilter || status === statusFilter);
  });
  function saveOpportunity(opportunityId: string): void {
    if (state.applications.some((entry) => entry.opportunityId === opportunityId)) return;
    updateDemoState((current) => ({ ...current, applications: [...current.applications, { opportunityId, status: "saved", notes: "" }] }));
  }

  function updateApplication(opportunityId: string, patch: Partial<TrackedEntry>): void {
    updateDemoState((current) => ({
      ...current,
      applications: current.applications.map((entry) => {
        if (entry.opportunityId !== opportunityId) return entry;
        const updated = { ...entry, ...patch };
        if (patch.status === "applied" && !updated.appliedAt) updated.appliedAt = new Date().toISOString().slice(0, 10);
        return updated;
      }),
    }));
  }

  function removeApplication(opportunityId: string): void {
    updateDemoState((current) => ({ ...current, applications: current.applications.filter((entry) => entry.opportunityId !== opportunityId) }));
  }

  function savePreferences(formData: FormData): void {
    const parsed = preferencesSchema.safeParse({
      graduationYear: formData.get("graduationYear"),
      major: formData.get("major"),
      skills: String(formData.get("skills") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      preferredLocations: String(formData.get("preferredLocations") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      remotePreference: formData.get("remotePreference"),
      currentClassYear: formData.get("currentClassYear"),
      timezone: formData.get("timezone"),
    });
    if (!parsed.success) {
      setSettingsMessage("Check the fields and try again.");
      return;
    }
    updateDemoState((current) => ({ ...current, profile: parsed.data }));
    setClassYearFilter(parsed.data.currentClassYear);
    setSettingsMessage("Preferences saved in this browser.");
  }

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link className="brand-lockup" href="/" aria-label="InternRadar home"><span className="brand-mark"><Radar size={18} /></span><span>intern<span className="brand-light">radar</span></span></Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="workspace-nav" aria-label="Workspace navigation">
          <NavButton active={view === "overview"} onClick={() => setView("overview")} icon={<LayoutDashboard size={17} />}>Overview</NavButton>
          <NavButton active={view === "discover"} onClick={() => setView("discover")} icon={<Compass size={17} />}>Discover</NavButton>
          <NavButton active={view === "applications"} onClick={() => setView("applications")} icon={<BriefcaseBusiness size={17} />} count={state.applications.length}>Applications</NavButton>
          <NavButton active={view === "settings"} onClick={() => setView("settings")} icon={<Settings2 size={17} />}>Preferences</NavButton>
        </nav>
        <div className="sidebar-spacer" />
        <div className="demo-note"><span className="demo-note-icon"><Sparkles size={15} /></span><div><strong>Local demo</strong><p>Fictional listings. Changes stay in this browser.</p></div></div>
        <a className="sidebar-signup" href="/sign-up">Create an account <ArrowRight size={14} /></a>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="mobile-brand"><Radar size={19} /> intern<span>radar</span></div>
          <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{viewLabels[view]}</strong></div>
          <div className="user-menu"><span className="user-avatar">AC</span><span><strong>Alex Chen</strong><small>Sophomore · {state.profile.major}</small></span><ChevronDown size={15} /></div>
        </header>

        <main className="workspace-content">
          <div className="demo-alert" role="note"><span><Sparkles size={15} /> LOCAL DEMO DATA</span><p>These companies and roles are fictional examples, not live openings. Nothing here is sent to email.</p><button type="button" aria-label="Dismiss demo notice" onClick={(event) => event.currentTarget.parentElement?.remove()}><X size={15} /></button></div>
          {view === "overview" && <OverviewView state={state} opportunities={opportunities} onNavigate={setView} />}
          {view === "discover" && <DiscoverView
            opportunities={discovery.items} total={discovery.total} page={discovery.page} pageCount={discovery.pageCount}
            profile={state.profile} trackedIds={new Set(state.applications.map(({ opportunityId }) => opportunityId))}
            search={search} classYear={classYearFilter} onClassYear={(value) => { setClassYearFilter(value); setPage(1); }} onSearch={(value) => { setSearch(value); setPage(1); }}
            workMode={workMode} onWorkMode={(value) => { setWorkMode(value); setPage(1); }}
            compensation={compensation} onCompensation={(value) => { setCompensation(value); setPage(1); }}
            deadlineBefore={deadlineBefore} onDeadline={(value) => { setDeadlineBefore(value); setPage(1); }}
            location={location} onLocation={(value) => { setLocation(value); setPage(1); }}
            onPage={setPage} onSave={saveOpportunity}
          />}
          {view === "applications" && <ApplicationsView
            applications={visibleApplications} query={applicationQuery} onQuery={setApplicationQuery}
            statusFilter={statusFilter} onStatusFilter={setStatusFilter} onUpdate={updateApplication} onRemove={removeApplication}
          />}
          {view === "settings" && <SettingsView
            state={state} onSave={savePreferences}
            onToggle={(key, value) => updateDemoState((current) => ({ ...current, [key]: value }))}
            message={settingsMessage}
          />}
        </main>
      </div>
    </div>
  );
}

const viewLabels: Record<View, string> = { overview: "Overview", discover: "Discover", applications: "Applications", settings: "Preferences" };

function NavButton({ active, icon, count, onClick, children }: { active: boolean; icon: ReactNode; count?: number; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`workspace-nav-item${active ? " is-active" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>{icon}<span>{children}</span>{count ? <span className="nav-count">{count}</span> : null}</button>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="section-label">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function OverviewView({ state, opportunities, onNavigate }: { state: DemoState; opportunities: Opportunity[]; onNavigate: (view: View) => void }) {
  const saved = state.applications.length;
  const applied = state.applications.filter(({ status }) => ["applied", "interview", "offer"].includes(status)).length;
  const interviews = state.applications.filter(({ status }) => status === "interview").length;
  const upcoming = state.applications.filter(({ followUpDate }) => followUpDate && followUpDate >= new Date().toISOString().slice(0, 10)).length;
  const fresh = filterOpportunities(opportunities, { classYear: state.profile.currentClassYear, pageSize: 2 }, { includeDemo: true }).items;

  return <>
    <PageHeading eyebrow="YOUR NEXT CHAPTER" title="A little more direction." description={`A clear view of your search, ${state.profile.currentClassYear} year. Start with a role that fits.`} action={<button type="button" className="button button-blue" onClick={() => onNavigate("discover")}>Find opportunities <ArrowRight size={15} /></button>} />
    <section className="metrics-row" aria-label="Application totals">
      <Metric icon={<Bookmark size={17} />} label="Roles tracked" value={saved} tone="blue" />
      <Metric icon={<Check size={17} />} label="Applications started" value={applied} tone="green" />
      <Metric icon={<Sparkles size={17} />} label="Interviews" value={interviews} tone="yellow" />
      <Metric icon={<CalendarDays size={17} />} label="Follow-ups ahead" value={upcoming} tone="coral" />
    </section>
    <section className="overview-grid">
      <div className="content-panel">
        <div className="panel-heading"><div><span className="section-label">A FEW TO EXPLORE</span><h2>On your radar</h2></div><button className="inline-link" type="button" onClick={() => onNavigate("discover")}>View all <ArrowRight size={14} /></button></div>
        <div className="compact-list">{fresh.map((opportunity) => <CompactOpportunity key={opportunity.id} opportunity={opportunity} profile={state.profile} onOpen={() => onNavigate("discover")} />)}</div>
      </div>
      <div className="content-panel next-step-panel">
        <span className="section-label">YOUR NEXT STEP</span>
        {saved === 0 ? <><div className="next-step-icon"><ArrowRight size={21} /></div><h2>Start with one save.</h2><p>Keep the roles you want to revisit close by. Your tracker is ready when you are.</p><button className="button button-dark" type="button" onClick={() => onNavigate("discover")}>Browse opportunities <ArrowRight size={14} /></button></> : <><div className="next-step-icon"><CalendarDays size={21} /></div><h2>{upcoming ? `${upcoming} follow-up${upcoming === 1 ? "" : "s"} on your list` : "Your tracker is ready."}</h2><p>Update a status, jot a note, or choose a follow-up date while the details are fresh.</p><button className="button button-dark" type="button" onClick={() => onNavigate("applications")}>Open tracker <ArrowRight size={14} /></button></>}
      </div>
    </section>
  </>;
}

function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: string }) {
  return <div className="metric"><span className={`metric-icon metric-${tone}`}>{icon}</span><span className="metric-value">{value}</span><span className="metric-label">{label}</span></div>;
}

function CompactOpportunity({ opportunity, profile, onOpen }: { opportunity: Opportunity; profile: Preferences; onOpen: () => void }) {
  const eligibility = eligibilityText(opportunity, profile);
  return <button className="compact-opportunity" type="button" onClick={onOpen}><span className="company-stamp">{opportunity.company.slice(0, 1)}</span><span className="compact-copy"><strong>{opportunity.title}</strong><small>{opportunity.company} <i /> {opportunity.location}</small></span><span className={`eligibility-badge ${eligibility.className}`}>{eligibility.label}</span><ArrowRight size={15} /></button>;
}

function DiscoverView(props: {
  opportunities: Opportunity[]; total: number; page: number; pageCount: number; profile: Preferences; trackedIds: Set<string>;
  search: string; classYear: ClassYear | ""; onClassYear: (value: ClassYear | "") => void; onSearch: (value: string) => void; workMode: string; onWorkMode: (value: string) => void;
  compensation: string; onCompensation: (value: string) => void; deadlineBefore: string; onDeadline: (value: string) => void;
  location: string; onLocation: (value: string) => void; onPage: (value: number) => void; onSave: (id: string) => void;
}) {
  return <>
    <PageHeading eyebrow="FIND YOUR FIT" title="Discover opportunities" description="Browse curated examples. Eligibility comes from what the source says, not a guess." />
    <div className="filter-bar">
      <label className="search-field"><Search size={17} /><span className="sr-only">Search title or company</span><input value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Search title or company" /></label>
      <label className="select-field"><span className="sr-only">Eligible class year</span><select value={props.classYear} onChange={(event) => props.onClassYear(event.target.value as ClassYear | "")}><option value="">Any class year</option><option value="freshman">Freshman</option><option value="sophomore">Sophomore</option><option value="junior">Junior</option><option value="senior">Senior</option><option value="graduate">Graduate</option></select><ChevronDown size={14} /></label>
      <label className="select-field"><span className="sr-only">Work mode</span><select value={props.workMode} onChange={(event) => props.onWorkMode(event.target.value)}><option value="">Any work mode</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select><ChevronDown size={14} /></label>
      <label className="select-field"><span className="sr-only">Compensation</span><select value={props.compensation} onChange={(event) => props.onCompensation(event.target.value)}><option value="">Any compensation</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="unknown">Not specified</option></select><ChevronDown size={14} /></label>
      <label className="location-field"><MapPin size={15} /><span className="sr-only">Location</span><input value={props.location} onChange={(event) => props.onLocation(event.target.value)} placeholder="Location" /></label>
      <label className="date-filter"><CalendarDays size={15} /><span className="sr-only">Deadline before</span><input type="date" value={props.deadlineBefore} onChange={(event) => props.onDeadline(event.target.value)} aria-label="Deadline before" /></label>
    </div>
    <div className="results-line"><span><Filter size={14} /> {props.total} fictional sample{props.total === 1 ? "" : "s"} for {props.classYear || "all class years"}</span><span>Eligibility checked against source notes</span></div>
    {props.opportunities.length ? <div className="opportunity-list">{props.opportunities.map((opportunity) => <OpportunityCard key={opportunity.id} opportunity={opportunity} profile={props.profile} isTracked={props.trackedIds.has(opportunity.id)} onSave={() => props.onSave(opportunity.id)} />)}</div> : <div className="empty-state"><span className="empty-icon"><Search size={21} /></span><h2>No sample roles match those filters.</h2><p>Try a different search, location, or deadline.</p><button type="button" className="button button-quiet" onClick={() => { props.onSearch(""); props.onClassYear(""); props.onWorkMode(""); props.onCompensation(""); props.onDeadline(""); props.onLocation(""); }}>Clear filters <X size={14} /></button></div>}
    {props.pageCount > 1 && <div className="pagination"><button type="button" disabled={props.page <= 1} onClick={() => props.onPage(props.page - 1)}>Previous</button><span>Page {props.page} of {props.pageCount}</span><button type="button" disabled={props.page >= props.pageCount} onClick={() => props.onPage(props.page + 1)}>Next <ArrowRight size={14} /></button></div>}
  </>;
}

function OpportunityCard({ opportunity, profile, isTracked, onSave }: { opportunity: Opportunity; profile: Preferences; isTracked: boolean; onSave: () => void }) {
  const eligibility = eligibilityText(opportunity, profile);
  const reasons = getMatchReasons(opportunity, profile).slice(0, 3);
  return <article className="opportunity-card">
    <div className="opportunity-main">
      <span className="company-stamp company-stamp-large">{opportunity.company.slice(0, 1)}</span>
      <div className="opportunity-title-block"><span className="company-name"><Building2 size={13} /> {opportunity.company}</span><h2>{opportunity.title}</h2><div className="opportunity-meta"><span><MapPin size={13} />{opportunity.location}</span><span><BriefcaseBusiness size={13} />{opportunity.workMode}</span><span><Clock3 size={13} />{opportunity.compensationType === "unknown" ? "Compensation not listed" : opportunity.compensationDetails ?? opportunity.compensationType}</span></div></div>
      <div className="opportunity-actions"><span className={`eligibility-badge ${eligibility.className}`}>{eligibility.className === "badge-confirmed" ? <Check size={12} /> : eligibility.className === "badge-potential" ? <Sparkles size={12} /> : <CircleHelp size={12} />}{eligibility.label}</span><button type="button" className={`save-button${isTracked ? " is-saved" : ""}`} onClick={onSave} disabled={isTracked} aria-label={isTracked ? `Saved ${opportunity.title}` : `Save ${opportunity.title}`}>{isTracked ? <Check size={15} /> : <Bookmark size={15} />}<span>{isTracked ? "Saved" : "Save role"}</span></button></div>
    </div>
    <div className="opportunity-bottom"><div className="match-reasons"><span className="section-label">WHY IT MATCHES</span><div>{reasons.map((reason) => <span key={reason}><Check size={12} />{reason}</span>)}</div></div><div className="listing-detail"><span>Deadline <strong>{prettyDate(opportunity.deadlineDate)}</strong></span><span>Verified <strong>{prettyDate(opportunity.lastVerifiedAt.slice(0, 10))}</strong></span><a href={opportunity.sourceUrl} target="_blank" rel="noreferrer">Source details <ExternalLink size={12} /></a></div></div>
    <div className="fictional-label">FICTIONAL LOCAL SAMPLE · NOT AN OPEN INTERNSHIP</div>
  </article>;
}

function ApplicationsView(props: {
  applications: Array<TrackedEntry & { opportunity: Opportunity | undefined }>;
  query: string; onQuery: (value: string) => void; statusFilter: string; onStatusFilter: (value: string) => void;
  onUpdate: (id: string, patch: Partial<TrackedEntry>) => void; onRemove: (id: string) => void;
}) {
  return <>
    <PageHeading eyebrow="KEEP THE MOMENTUM" title="Application tracker" description="A private place for your status, notes, and follow-up dates. Demo changes are saved only in this browser." action={<span className="tracked-total"><strong>{props.applications.length}</strong> tracked</span>} />
    <div className="tracker-toolbar"><label className="search-field"><Search size={16} /><span className="sr-only">Search tracked roles</span><input value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder="Search tracked roles" /></label><label className="select-field"><span className="sr-only">Filter by status</span><select value={props.statusFilter} onChange={(event) => props.onStatusFilter(event.target.value)}><option value="">All statuses</option>{applicationStatuses.map((status) => <option key={status} value={status}>{status[0]?.toUpperCase()}{status.slice(1)}</option>)}</select><ChevronDown size={14} /></label></div>
    {props.applications.length ? <div className="tracker-list">{props.applications.map(({ opportunity, status, notes, appliedAt, followUpDate }) => opportunity && <article className="tracker-card" key={opportunity.id}>
      <div className="tracker-title"><span className="company-stamp">{opportunity.company.slice(0, 1)}</span><div><strong>{opportunity.title}</strong><small>{opportunity.company}</small></div><button type="button" className="icon-button remove-button" onClick={() => props.onRemove(opportunity.id)} aria-label={`Remove ${opportunity.title}`} title="Remove from tracker"><X size={16} /></button></div>
      <div className="tracker-fields"><label>Application status<select value={status} onChange={(event) => props.onUpdate(opportunity.id, { status: event.target.value as ApplicationStatus })}>{applicationStatuses.map((item) => <option key={item} value={item}>{item[0]?.toUpperCase()}{item.slice(1)}</option>)}</select></label><label>Application date<input type="date" value={appliedAt ?? ""} onChange={(event) => props.onUpdate(opportunity.id, { appliedAt: event.target.value })} /></label><label>Follow-up date<input type="date" value={followUpDate ?? ""} onChange={(event) => props.onUpdate(opportunity.id, { followUpDate: event.target.value })} /></label></div>
      <label className="notes-field">Private notes<textarea value={notes} onChange={(event) => props.onUpdate(opportunity.id, { notes: event.target.value })} placeholder="What did you send? Who should you follow up with?" rows={2} /></label>
      <div className="tracker-footer"><AppStatus status={status} /><span>Deadline: {prettyDate(opportunity.deadlineDate)}</span><a href={opportunity.sourceUrl} target="_blank" rel="noreferrer">View source <ExternalLink size={12} /></a></div>
    </article>)}</div> : <div className="empty-state"><span className="empty-icon"><Bookmark size={20} /></span><h2>{props.query || props.statusFilter ? "No tracked roles match." : "Your tracker is ready."}</h2><p>{props.query || props.statusFilter ? "Clear the search or status filter to see everything." : "Save a role from Discover and it will appear here."}</p></div>}
  </>;
}

function SettingsView({ state, onSave, onToggle, message }: { state: DemoState; onSave: (data: FormData) => void; onToggle: (key: "weeklyDigest" | "deadlineReminders", value: boolean) => void; message: string }) {
  return <>
    <PageHeading eyebrow="MAKE IT YOURS" title="Your preferences" description="Tune what you see and how you want to hear about it. This local demo does not send email." />
    <div className="settings-layout">
      <form className="settings-panel" onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }}>
        <div className="settings-panel-heading"><span className="settings-icon"><Compass size={18} /></span><div><h2>Student profile</h2><p>Used to explain why a role may fit.</p></div></div>
        <div className="form-grid"><label>Current class year<select name="currentClassYear" defaultValue={state.profile.currentClassYear}><option value="freshman">Freshman</option><option value="sophomore">Sophomore</option><option value="junior">Junior</option><option value="senior">Senior</option><option value="graduate">Graduate student</option></select></label><label>Graduation year<input name="graduationYear" type="number" min="2026" max="2040" defaultValue={state.profile.graduationYear} /></label><label className="form-span">Major<input name="major" defaultValue={state.profile.major} maxLength={100} /></label><label className="form-span">Skills <small>Comma separated</small><input name="skills" defaultValue={state.profile.skills.join(", ")} /></label><label className="form-span">Preferred locations <small>Comma separated</small><input name="preferredLocations" defaultValue={state.profile.preferredLocations.join(", ")} /></label><label className="form-span">Work preference<select name="remotePreference" defaultValue={state.profile.remotePreference}><option value="any">Any work mode</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label><label className="form-span">Time zone <small>Used to time reminders</small><input name="timezone" defaultValue={state.profile.timezone} placeholder="America/New_York" /></label></div>
        <div className="settings-submit"><span aria-live="polite">{message}</span><button className="button button-dark" type="submit">Save preferences <Check size={14} /></button></div>
      </form>
      <section className="settings-panel alerts-panel">
        <div className="settings-panel-heading"><span className="settings-icon settings-icon-blue"><Bell size={18} /></span><div><h2>Email alerts</h2><p>Opt-in settings for a connected account.</p></div></div>
        <label className="toggle-row"><span><strong>Weekly opportunity digest</strong><small>New matches, excluding roles you already track.</small></span><input type="checkbox" checked={state.weeklyDigest} onChange={(event) => onToggle("weeklyDigest", event.target.checked)} /><span className="toggle-ui" aria-hidden="true" /></label>
        <label className="toggle-row"><span><strong>Deadline reminders</strong><small>Upcoming deadlines in your local time zone.</small></span><input type="checkbox" checked={state.deadlineReminders} onChange={(event) => onToggle("deadlineReminders", event.target.checked)} /><span className="toggle-ui" aria-hidden="true" /></label>
        <p className="settings-note"><CircleHelp size={14} /> Demo toggles are local only. Connect Supabase and Resend to deliver email.</p>
      </section>
    </div>
  </>;
}