"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { opportunityInputSchema } from "@/lib/domain";
import { requireAdmin } from "@/lib/auth";

const opportunityIdSchema = z.union([z.literal(""), z.uuid()]);

export async function saveOpportunityAdminAction(formData: FormData): Promise<void> {
  const id = opportunityIdSchema.safeParse(formData.get("opportunityId") ?? "");
  const parsed = opportunityInputSchema.safeParse({
    company: formData.get("company"),
    title: formData.get("title"),
    description: formData.get("description"),
    eligibleClassYears: formData.getAll("eligibleClassYears"),
    eligibilityBasis: formData.get("eligibilityBasis"),
    eligibilityNotes: String(formData.get("eligibilityNotes") ?? "").trim() || null,
    location: formData.get("location"),
    workMode: formData.get("workMode"),
    compensationType: formData.get("compensationType"),
    compensationDetails: String(formData.get("compensationDetails") ?? "").trim() || null,
    sourceUrl: formData.get("sourceUrl"),
    canonicalSourceId: String(formData.get("canonicalSourceId") ?? "").trim() || null,
    deadlineDate: String(formData.get("deadlineDate") ?? "") || null,
    deadlineAt: String(formData.get("deadlineAt") ?? "") || null,
    lastVerifiedAt: new Date().toISOString(),
    status: formData.get("status"),
  });

  if (!id.success || !parsed.success) redirect("/admin?error=validation");
  const sourceRechecked = formData.get("sourceRechecked") === "on";
  if (parsed.data.status === "published" && !sourceRechecked) redirect("/admin?error=verification");
  const { user, supabase } = await requireAdmin();
  const opportunity = parsed.data;
  let lastVerifiedAt = sourceRechecked ? new Date().toISOString() : opportunity.lastVerifiedAt;
  if (id.data && !sourceRechecked) {
    const { data: existing, error } = await supabase.from("opportunities")
      .select("last_verified_at").eq("id", id.data).maybeSingle();
    if (error || !existing) redirect("/admin?error=save");
    lastVerifiedAt = existing.last_verified_at;
  }
  const values = {
    canonical_source_id: opportunity.canonicalSourceId,
    company: opportunity.company,
    title: opportunity.title,
    description: opportunity.description,
    eligible_class_years: opportunity.eligibleClassYears,
    eligibility_basis: opportunity.eligibilityBasis,
    eligibility_notes: opportunity.eligibilityNotes,
    location: opportunity.location,
    work_mode: opportunity.workMode,
    compensation_type: opportunity.compensationType,
    compensation_details: opportunity.compensationDetails,
    source_url: opportunity.sourceUrl,
    deadline_date: opportunity.deadlineDate,
    deadline_at: opportunity.deadlineAt,
    last_verified_at: lastVerifiedAt,
    status: opportunity.status,
    closed_at: opportunity.status === "closed" ? new Date().toISOString() : null,
  };
  const result = id.data
    ? await supabase.from("opportunities").update(values).eq("id", id.data).select("id").maybeSingle()
    : await supabase.from("opportunities").insert({ ...values, created_by: user.id, is_demo: false }).select("id").maybeSingle();

  if (result.error?.code === "23505") redirect("/admin?error=duplicate");
  if (result.error || !result.data) redirect("/admin?error=save");
  redirect("/admin?message=saved");
}