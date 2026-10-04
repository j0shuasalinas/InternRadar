"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { savedSearchFiltersSchema } from "@/lib/domain";

const reportSchema = z.object({
  opportunityId: z.uuid(),
  slug: z.string().min(1).max(240).regex(/^[a-z0-9-]+$/),
  reason: z.enum(["closed", "inaccurate", "suspicious", "other"]),
  details: z.string().trim().max(2000),
});

export async function reportOpportunityAction(formData: FormData): Promise<void> {
  const parsed = reportSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    slug: formData.get("slug"),
    reason: formData.get("reason"),
    details: String(formData.get("details") ?? ""),
  });
  if (!parsed.success) redirect("/");
  if (!isSupabaseConfigured()) redirect("/sign-in?error=configuration");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/internships/${parsed.data.slug}`)}`);

  const { data: listing, error: listingError } = await supabase.from("opportunities")
    .select("id")
    .eq("id", parsed.data.opportunityId)
    .eq("slug", parsed.data.slug)
    .eq("status", "published")
    .eq("is_demo", false)
    .maybeSingle();
  if (listingError || !listing) redirect(`/internships/${parsed.data.slug}?reported=error`);

  const { error } = await supabase.from("opportunity_reports").insert({
    opportunity_id: listing.id,
    user_id: user.id,
    reason: parsed.data.reason,
    details: parsed.data.details,
  });
  if (error && error.code !== "23505") redirect(`/internships/${parsed.data.slug}?reported=error`);
  redirect(`/internships/${parsed.data.slug}?reported=${error?.code === "23505" ? "duplicate" : "1"}`);
}

const savedSearchNameSchema = z.string().trim().min(1).max(80);

export async function saveSearchAction(formData: FormData): Promise<void> {
  const name = savedSearchNameSchema.safeParse(formData.get("name"));
  const filters = savedSearchFiltersSchema.safeParse({
    query: String(formData.get("query") ?? "").trim() || undefined,
    classYear: String(formData.get("classYear") ?? "") || undefined,
    location: String(formData.get("location") ?? "").trim() || undefined,
    workMode: String(formData.get("workMode") ?? "") || undefined,
    compensation: String(formData.get("compensation") ?? "") || undefined,
    deadlineBefore: String(formData.get("deadlineBefore") ?? "") || undefined,
  });
  if (!name.success || !filters.success) redirect("/discover?error=search");
  if (!isSupabaseConfigured()) redirect("/settings?error=configuration");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase.from("saved_searches").upsert({
    user_id: user.id,
    name: name.data,
    filters: filters.data,
    notify_email: true,
  }, { onConflict: "user_id,filters", ignoreDuplicates: true });
  if (error) redirect("/discover?error=search");
  redirect("/settings?message=search");
}

export async function removeSavedSearchAction(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("savedSearchId"));
  if (!id.success || !isSupabaseConfigured()) redirect("/settings?error=search");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { error } = await supabase.from("saved_searches")
    .delete().eq("id", id.data).eq("user_id", user.id);
  if (error) redirect("/settings?error=search");
  redirect("/settings?message=search");
}
