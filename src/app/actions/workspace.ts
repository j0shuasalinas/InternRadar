"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { applicationStatusSchema, preferencesSchema } from "@/lib/domain";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidSchema = z.uuid();
const dateSchema = z.union([z.literal(""), z.iso.date()]);

async function currentUserOrRedirect() {
  if (!isSupabaseConfigured()) redirect("/sign-in?error=configuration");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

export async function saveOpportunityAction(formData: FormData): Promise<void> {
  const opportunityId = uuidSchema.safeParse(formData.get("opportunityId"));
  if (!opportunityId.success) redirect("/discover?error=listing");
  const { supabase, user } = await currentUserOrRedirect();

  const { data: listing } = await supabase.from("opportunities")
    .select("id")
    .eq("id", opportunityId.data)
    .eq("status", "published")
    .eq("is_demo", false)
    .maybeSingle();
  if (!listing) redirect("/discover?error=listing");

  const { error } = await supabase.from("tracked_applications").insert({
    user_id: user.id,
    opportunity_id: opportunityId.data,
    status: "saved",
  });
  if (error && error.code !== "23505") redirect("/discover?error=save");
  redirect("/applications?message=saved");
}

export async function updateApplicationAction(formData: FormData): Promise<void> {
  const applicationId = uuidSchema.safeParse(formData.get("applicationId"));
  const status = applicationStatusSchema.safeParse(formData.get("status"));
  const appliedAt = dateSchema.safeParse(formData.get("appliedAt"));
  const followUpDate = dateSchema.safeParse(formData.get("followUpDate"));
  const notes = z.string().max(3000).safeParse(formData.get("notes"));
  if (!applicationId.success || !status.success || !appliedAt.success || !followUpDate.success || !notes.success) {
    redirect("/applications?error=validation");
  }

  const { supabase, user } = await currentUserOrRedirect();
  const { data, error } = await supabase.from("tracked_applications").update({
    status: status.data,
    applied_at: appliedAt.data || null,
    follow_up_date: followUpDate.data || null,
    notes: notes.data,
  }).eq("id", applicationId.data).eq("user_id", user.id).select("id").maybeSingle();

  if (error || !data) redirect("/applications?error=save");
  redirect("/applications?message=updated");
}

export async function removeApplicationAction(formData: FormData): Promise<void> {
  const applicationId = uuidSchema.safeParse(formData.get("applicationId"));
  if (!applicationId.success) redirect("/applications?error=listing");
  const { supabase, user } = await currentUserOrRedirect();
  const { error } = await supabase.from("tracked_applications").delete()
    .eq("id", applicationId.data)
    .eq("user_id", user.id);
  if (error) redirect("/applications?error=remove");
  redirect("/applications?message=removed");
}

export async function savePreferencesAction(formData: FormData): Promise<void> {
  const parsed = preferencesSchema.safeParse({
    graduationYear: formData.get("graduationYear"),
    major: formData.get("major"),
    skills: String(formData.get("skills") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    preferredLocations: String(formData.get("preferredLocations") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    remotePreference: formData.get("remotePreference"),
    currentClassYear: formData.get("currentClassYear"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) redirect("/settings?error=validation");
  const { supabase, user } = await currentUserOrRedirect();
  const { error } = await supabase.from("profiles").update({
    graduation_year: parsed.data.graduationYear,
    major: parsed.data.major,
    skills: parsed.data.skills,
    preferred_locations: parsed.data.preferredLocations,
    remote_preference: parsed.data.remotePreference,
    current_class_year: parsed.data.currentClassYear,
    timezone: parsed.data.timezone,
    onboarding_completed_at: new Date().toISOString(),
  }).eq("id", user.id);
  if (error) redirect("/settings?error=save");
  redirect("/settings?message=profile");
}