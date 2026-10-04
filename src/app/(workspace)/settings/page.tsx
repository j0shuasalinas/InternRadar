import Link from "next/link";
import { Bell, CircleHelp, Compass, Save } from "lucide-react";
import { saveNotificationSettingsAction } from "@/app/actions/auth";
import { removeSavedSearchAction } from "@/app/actions/public";
import { savePreferencesAction } from "@/app/actions/workspace";
import { requireAuthenticatedUser } from "@/lib/auth";
import type { ProfileRecord, SavedSearchRecord } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NotificationRecord = { weekly_digest_enabled: boolean; deadline_reminders_enabled: boolean; saved_search_alerts_enabled: boolean };
type SearchParams = Record<string, string | string[] | undefined>;

function message(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAuthenticatedUser();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [{ data: profileData, error: profileError }, { data: settingsData, error: settingsError }, { data: savedSearchData, error: savedSearchError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("notification_settings").select("weekly_digest_enabled,deadline_reminders_enabled,saved_search_alerts_enabled").eq("user_id", user.id).maybeSingle(),
    supabase.from("saved_searches").select("id,name,filters,notify_email,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (profileError || settingsError || savedSearchError) return <DataLoadError />;
  const profile = profileData as ProfileRecord | null;
  const settings = settingsData as NotificationRecord | null;
  const savedSearches = (savedSearchData ?? []) as unknown as SavedSearchRecord[];
  if (message(params.error)) return <p className="form-message form-error" role="alert">We couldn’t save your changes. Check the fields and try again.</p>;
  const success = message(params.message);

  return <>
    <PageHeading eyebrow="MAKE IT YOURS" title="Your preferences" description="Tune what you see and how you hear about it." />
    {success && <p className="form-message form-success" role="status">{success === "profile" ? "Your profile preferences were saved." : success === "search" ? "Your saved searches were updated." : "Your email preferences were saved."}</p>}
    {!profile?.onboarding_completed_at && <p className="settings-reminder">Complete your profile to see class-year-aware matches. <Link href="/onboarding">Finish profile</Link></p>}
    <div className="settings-layout">
      <form action={savePreferencesAction} className="settings-panel">
        <div className="settings-panel-heading"><span className="settings-icon"><Compass size={18} /></span><div><h2>Student profile</h2><p>Used to explain why an opportunity may fit.</p></div></div>
        <div className="form-grid"><label>Current class year<select name="currentClassYear" defaultValue={profile?.current_class_year ?? "freshman"}><option value="freshman">Freshman</option><option value="sophomore">Sophomore</option><option value="junior">Junior</option><option value="senior">Senior</option><option value="graduate">Graduate student</option></select></label><label>Graduation year<input name="graduationYear" type="number" min="2026" max="2040" defaultValue={profile?.graduation_year ?? 2029} required /></label><label className="form-span">Major<input name="major" maxLength={100} defaultValue={profile?.major ?? ""} required /></label><label className="form-span">Skills <small>Comma separated</small><input name="skills" defaultValue={profile?.skills.join(", ") ?? ""} /></label><label className="form-span">Preferred locations <small>Comma separated</small><input name="preferredLocations" defaultValue={profile?.preferred_locations.join(", ") ?? ""} /></label><label className="form-span">Work preference<select name="remotePreference" defaultValue={profile?.remote_preference ?? "any"}><option value="any">Any work mode</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label><label className="form-span">Time zone <small>Used to schedule alerts in local time.</small><input name="timezone" defaultValue={profile?.timezone ?? "UTC"} required maxLength={80} /></label></div>
        <div className="settings-submit"><span>Preferences update your match explanations.</span><button className="button button-dark" type="submit">Save profile <Save size={14} /></button></div>
      </form>
      <form action={saveNotificationSettingsAction} className="settings-panel alerts-panel">
        <div className="settings-panel-heading"><span className="settings-icon settings-icon-blue"><Bell size={18} /></span><div><h2>Email alerts</h2><p>Optional. Unsubscribe any time.</p></div></div>
        <label className="toggle-row"><span><strong>Weekly opportunity digest</strong><small>New matches based on your profile, excluding roles you already track.</small></span><input type="checkbox" name="weeklyDigest" defaultChecked={settings?.weekly_digest_enabled ?? false} /><span className="toggle-ui" aria-hidden="true" /></label>
        <label className="toggle-row"><span><strong>Saved-search email alerts</strong><small>Include new roles matching your saved searches in the weekly digest.</small></span><input type="checkbox" name="savedSearchAlerts" defaultChecked={settings?.saved_search_alerts_enabled ?? false} /><span className="toggle-ui" aria-hidden="true" /></label>
        <label className="toggle-row"><span><strong>Deadline reminders</strong><small>Reminders for deadlines you can still make, timed for your profile time zone.</small></span><input type="checkbox" name="deadlineReminders" defaultChecked={settings?.deadline_reminders_enabled ?? false} /><span className="toggle-ui" aria-hidden="true" /></label>
        <p className="settings-note"><CircleHelp size={14} /> Emails send only after Inngest and Resend are configured. <button className="inline-link" type="submit">Save alerts</button></p>
      </form>
    </div>
    <section className="saved-searches-panel settings-panel">
      <div className="settings-panel-heading"><span className="settings-icon"><Compass size={18} /></span><div><h2>Saved searches</h2><p>Save filters from Discover, then opt into matching weekly email updates.</p></div></div>
      {savedSearches.length ? <ul className="saved-search-list">{savedSearches.map((search) => <li key={search.id}><span><strong>{search.name}</strong><small>{Object.entries(search.filters).map(([key, value]) => `${key}: ${value}`).join(" · ") || "All current listings"}</small></span><form action={removeSavedSearchAction}><input type="hidden" name="savedSearchId" value={search.id} /><button className="text-button" type="submit" aria-label={`Remove saved search ${search.name}`}>Remove</button></form></li>)}</ul> : <p className="saved-search-empty">No saved searches yet. Set up filters in Discover and save them for later.</p>}
    </section>
  </>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading"><div><span className="section-label">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div>;
}

function DataLoadError() {
  return <div className="data-error" role="alert"><CircleHelp size={21} /><div><strong>We couldn’t load your preferences.</strong><p>Check your Supabase connection and migration status.</p></div></div>;
}