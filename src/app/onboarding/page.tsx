import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { saveOnboardingAction } from "@/app/actions/auth";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const [{ data: profile }, params] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    searchParams,
  ]);

  return <main className="onboarding-shell">
    <header className="onboarding-header"><Link href="/" className="brand-lockup"><span className="brand-mark"><GraduationCap size={18} /></span><span>intern<span className="brand-light">radar</span></span></Link><span>YOUR PROFILE · STEP 1 OF 1</span></header>
    <section className="onboarding-card">
      <span className="section-label">A SEARCH THAT FITS YOU</span>
      <h1>Start with where you are.</h1>
      <p>These details help explain matches. They never change what the source says about eligibility.</p>
      {params.error && <p className="form-message form-error" role="alert">{params.error === "save" ? "We couldn’t save your profile. Please try again." : "Check each field and try again."}</p>}
      <form action={saveOnboardingAction} className="profile-form">
        <div className="profile-form-grid">
          <label>Current class year<select name="currentClassYear" defaultValue={profile?.current_class_year ?? "freshman"} required><option value="freshman">Freshman</option><option value="sophomore">Sophomore</option><option value="junior">Junior</option><option value="senior">Senior</option><option value="graduate">Graduate student</option></select></label>
          <label>Expected graduation year<input name="graduationYear" type="number" min="2026" max="2040" defaultValue={profile?.graduation_year ?? 2029} required /></label>
          <label className="profile-form-wide">Major<input name="major" maxLength={100} defaultValue={profile?.major ?? ""} required placeholder="e.g. Biology, Computer Science" /></label>
          <label className="profile-form-wide">Skills<input name="skills" defaultValue={profile?.skills?.join(", ") ?? ""} placeholder="Python, research, Figma" /><small>Separate skills with commas.</small></label>
          <label className="profile-form-wide">Preferred locations<input name="preferredLocations" defaultValue={profile?.preferred_locations?.join(", ") ?? ""} placeholder="Boston, Remote" /><small>Separate locations with commas.</small></label>
          <label className="profile-form-wide">Work mode<select name="remotePreference" defaultValue={profile?.remote_preference ?? "any"}><option value="any">Any work mode</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label>
          <label className="profile-form-wide">Time zone<input name="timezone" defaultValue={profile?.timezone ?? "UTC"} required placeholder="America/New_York" /><small>Used to schedule weekly digests and reminders.</small></label>
        </div>
        <button className="button button-blue" type="submit">Save profile <ArrowRight size={15} /></button>
      </form>
    </section>
  </main>;
}