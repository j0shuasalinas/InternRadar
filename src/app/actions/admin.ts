"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { opportunityInputSchema } from "@/lib/domain";
import { requireAdmin } from "@/lib/auth";

const opportunityIdSchema = z.union([z.literal(""), z.uuid()]);
const reportReviewSchema = z.object({
  reportId: z.uuid(),
  status: z.enum(["open", "reviewed", "resolved"]),
});

export async function updateOpportunityReportAction(formData: FormData): Promise<void> {
  const parsed = reportReviewSchema.safeParse({
    reportId: formData.get("reportId"),
    status: formData.get("status"),
  });
  if (!parsed.success) redirect("/admin?error=report");

  const { user, supabase } = await requireAdmin();
  const { data, error } = await supabase.from("opportunity_reports").update({
    status: parsed.data.status,
    reviewed_at: parsed.data.status === "open" ? null : new Date().toISOString(),
    reviewed_by: parsed.data.status === "open" ? null : user.id,
  }).eq("id", parsed.data.reportId).select("id").maybeSingle();
  if (error || !data) redirect("/admin?error=report");
  redirect("/admin?message=report");
}

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
    deadlineType: formData.get("deadlineType"),
    sourcePostedDate: String(formData.get("sourcePostedDate") ?? "") || null,
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
    deadline_type: opportunity.deadlineType,
    source_posted_date: opportunity.sourcePostedDate,
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