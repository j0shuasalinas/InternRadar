import { createHash } from "node:crypto";
import { Resend } from "resend";
import { inngest } from "@/lib/inngest/client";
import { createUnsubscribeToken, getLocalAlertTime, isDigestHour, isReminderHour, localWeekKey } from "@/lib/alerts";
import { getMatchReasons, evaluateEligibility, type Opportunity, type Preferences } from "@/lib/domain";
import type { OpportunityRecord, ProfileRecord } from "@/lib/database.types";
import type { EmailOpportunity } from "@/lib/email/templates";
import { renderDeadlineReminder, renderWeeklyDigest } from "@/lib/email/templates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AlertKind = "weekly_digest" | "deadline_reminder";
type AlertEvent = { userId: string; kind: AlertKind; periodKey: string };
type PreferenceRow = {
  user_id: string;
  weekly_digest_enabled: boolean;
  deadline_reminders_enabled: boolean;
  profiles: Pick<ProfileRecord, "timezone"> | null;
};
type TrackedRow = {
  opportunity_id: string;
  status: string;
  opportunities: Pick<OpportunityRecord, "company" | "title" | "location" | "work_mode" | "eligibility_basis" | "eligible_class_years" | "eligibility_notes" | "deadline_date" | "deadline_at" | "source_url"> | null;
};

const PAGE_SIZE = 100;
const MAX_PAGES_PER_SCHEDULE = 100;
const MAX_LISTINGS_PER_USER = 250;
const MAX_TRACKED_PER_USER = 1000;
const MAX_EMAIL_MATCHES = 8;

function settingsError(): Error {
  return new Error("Email delivery configuration is incomplete. Set RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_APP_URL, and UNSUBSCRIBE_SECRET.");
}

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !process.env.RESEND_FROM_EMAIL || !process.env.NEXT_PUBLIC_APP_URL || !process.env.UNSUBSCRIBE_SECRET) throw settingsError();
  return new Resend(apiKey);
}

function mapOpportunity(row: OpportunityRecord): Opportunity {
  return {
    id: row.id,
    canonicalSourceId: row.canonical_source_id,
    company: row.company,
    title: row.title,
    description: row.description,
    eligibleClassYears: row.eligible_class_years as Opportunity["eligibleClassYears"],
    eligibilityBasis: row.eligibility_basis,
    eligibilityNotes: row.eligibility_notes,
    location: row.location,
    workMode: row.work_mode,
    compensationType: row.compensation_type,
    compensationDetails: row.compensation_details,
    sourceUrl: row.source_url,
    deadlineDate: row.deadline_date,
    deadlineAt: row.deadline_at,
    lastVerifiedAt: row.last_verified_at,
    status: row.status,
    isDemo: row.is_demo,
    createdAt: row.created_at,
  };
}

function mapTrackedOpportunity(row: NonNullable<TrackedRow["opportunities"]>, timezone: string): EmailOpportunity {
  const deadline = row.deadline_at
    ? new Date(row.deadline_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone })
    : row.deadline_date
      ? new Date(`${row.deadline_date}T12:00:00Z`).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })
      : "Not listed";
  const eligibility = row.eligibility_basis === "listed_years"
    ? `Source names: ${row.eligible_class_years.join(", ")}`
    : row.eligibility_basis === "undergraduates"
      ? "Source says undergraduate students; class-year detail is not specified"
      : "Class-year eligibility is unclear; check the original source";
  return {
    company: row.company,
    title: row.title,
    location: row.location,
    workMode: row.work_mode,
    deadline,
    sourceUrl: row.source_url,
    eligibility,
  };
}

function deliveryKey(userId: string, kind: AlertKind, periodKey: string, opportunityId?: string): string {
  return createHash("sha256").update([userId, kind, periodKey, opportunityId ?? "digest"].join(":")).digest("hex");
}

async function sendWithDeliveryRecord(input: {
  userId: string;
  to: string;
  kind: AlertKind;
  periodKey: string;
  opportunityId?: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
}) {
  const admin = createSupabaseAdminClient();
  const key = deliveryKey(input.userId, input.kind, input.periodKey, input.opportunityId);
  const { data: existing, error: readError } = await admin.from("email_deliveries")
    .select("id,status")
    .eq("delivery_key", key)
    .maybeSingle();
  if (readError) throw readError;
  if (existing?.status === "sent") return { sent: false, reason: "already_sent" };

  let deliveryId = existing?.id;
  if (!deliveryId) {
    const { data: inserted, error: insertError } = await admin.from("email_deliveries").insert({
      user_id: input.userId,
      opportunity_id: input.opportunityId ?? null,
      kind: input.kind,
      period_key: input.periodKey,
      delivery_key: key,
      provider_idempotency_key: key,
      status: "pending",
    }).select("id").maybeSingle();
    if (insertError?.code === "23505") {
      const { data: raced } = await admin.from("email_deliveries").select("id,status").eq("delivery_key", key).maybeSingle();
      if (raced?.status === "sent") return { sent: false, reason: "already_sent" };
      deliveryId = raced?.id;
    } else if (insertError || !inserted) {
      throw insertError ?? new Error("Could not create an email delivery record.");
    } else {
      deliveryId = inserted.id;
    }
  }
  if (!deliveryId) throw new Error("Email delivery record was not available after insertion.");

  const { error: attemptError } = await admin.from("email_deliveries").update({ status: "pending", attempted_at: new Date().toISOString(), last_error: null }).eq("id", deliveryId);
  if (attemptError) throw attemptError;
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    headers: {
      "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  }, { idempotencyKey: key });

  if (error) {
    await admin.from("email_deliveries").update({ status: "failed", last_error: error.message.slice(0, 500) }).eq("id", deliveryId);
    throw new Error(`Resend delivery failed: ${error.message}`);
  }

  const { error: updateError } = await admin.from("email_deliveries").update({
    status: "sent",
    provider_message_id: data.id,
    sent_at: new Date().toISOString(),
    last_error: null,
  }).eq("id", deliveryId);
  if (updateError) throw updateError;
  return { sent: true, id: data.id };
}

async function getUserAlertContext(userId: string) {
  const admin = createSupabaseAdminClient();
  const [{ data: authResult, error: authError }, { data: profileData, error: profileError }, { data: settingData, error: settingError }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    admin.from("notification_settings").select("weekly_digest_enabled,deadline_reminders_enabled").eq("user_id", userId).maybeSingle(),
  ]);
  if (authError || profileError || settingError || !authResult.user?.email || !profileData || !settingData) return null;
  const profile = profileData as ProfileRecord;
  if (!profile.current_class_year || !profile.major || !profile.graduation_year || !profile.onboarding_completed_at) return null;
  const preferences: Preferences = {
    graduationYear: profile.graduation_year,
    major: profile.major,
    skills: profile.skills,
    preferredLocations: profile.preferred_locations,
    remotePreference: profile.remote_preference,
    currentClassYear: profile.current_class_year,
    timezone: profile.timezone,
  };
  return {
    admin,
    email: authResult.user.email,
    profile,
    preferences,
    settings: settingData as { weekly_digest_enabled: boolean; deadline_reminders_enabled: boolean },
  };
}

function unsubscribeUrl(userId: string): string {
  const token = createUnsubscribeToken(userId);
  return `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
}

function isPreferenceMatch(opportunity: Opportunity, preferences: Preferences): boolean {
  if (evaluateEligibility(opportunity, preferences) === "not_eligible") return false;
  const reasons = getMatchReasons(opportunity, preferences);
  return reasons.some((reason) => !reason.startsWith("Source lists") && !reason.startsWith("Source says") && !reason.startsWith("The source does not"));
}

async function sendWeeklyDigest(event: AlertEvent) {
  const context = await getUserAlertContext(event.userId);
  if (!context?.settings.weekly_digest_enabled) return { sent: false, reason: "not_opted_in" };
  const local = getLocalAlertTime(new Date(), context.profile.timezone);
  if (localWeekKey(local.date) !== event.periodKey) return { sent: false, reason: "stale_period" };

  const { data: trackedData, error: trackedError } = await context.admin.from("tracked_applications")
    .select("opportunity_id", { count: "exact" })
    .eq("user_id", event.userId)
    .limit(MAX_TRACKED_PER_USER);
  if (trackedError) throw trackedError;
  if ((trackedData?.length ?? 0) >= MAX_TRACKED_PER_USER) return { sent: false, reason: "tracking_exclusion_limit" };
  const tracked = new Set(((trackedData ?? []) as Array<{ opportunity_id: string }>).map(({ opportunity_id }) => opportunity_id));
  const today = new Date().toISOString().slice(0, 10);
  const { data: listingsData, error: listingsError } = await context.admin.from("opportunities")
    .select("*")
    .eq("status", "published")
    .eq("is_demo", false)
    .or(`deadline_date.is.null,deadline_date.gte.${today}`)
    .order("last_verified_at", { ascending: false })
    .limit(MAX_LISTINGS_PER_USER);
  if (listingsError) throw listingsError;

  const matches = ((listingsData ?? []) as unknown as OpportunityRecord[])
    .map(mapOpportunity)
    .filter((opportunity) =>
      !tracked.has(opportunity.id) &&
      (!opportunity.deadlineAt || new Date(opportunity.deadlineAt).getTime() >= Date.now()) &&
      isPreferenceMatch(opportunity, context.preferences),
    )
    .slice(0, MAX_EMAIL_MATCHES);
  if (!matches.length) return { sent: false, reason: "no_matches" };

  const emailOpportunities = matches.map((opportunity) => mapTrackedOpportunity({
    company: opportunity.company,
    title: opportunity.title,
    location: opportunity.location,
    work_mode: opportunity.workMode,
    eligibility_basis: opportunity.eligibilityBasis,
    eligible_class_years: opportunity.eligibleClassYears,
    eligibility_notes: opportunity.eligibilityNotes,
    deadline_date: opportunity.deadlineDate,
    deadline_at: opportunity.deadlineAt,
    source_url: opportunity.sourceUrl,
  }, context.profile.timezone));
  const unsubscribe = unsubscribeUrl(event.userId);
  const email = renderWeeklyDigest(emailOpportunities, unsubscribe);
  return sendWithDeliveryRecord({
    userId: event.userId,
    to: context.email,
    kind: "weekly_digest",
    periodKey: event.periodKey,
    subject: "New opportunities for your InternRadar",
    ...email,
    unsubscribeUrl: unsubscribe,
  });
}

async function sendDeadlineReminders(event: AlertEvent) {
  const context = await getUserAlertContext(event.userId);
  if (!context?.settings.deadline_reminders_enabled) return { sent: false, reason: "not_opted_in" };
  const local = getLocalAlertTime(new Date(), context.profile.timezone);
  if (local.date !== event.periodKey) return { sent: false, reason: "stale_period" };

  const { data, error } = await context.admin.from("tracked_applications")
    .select("opportunity_id,status,opportunities!inner(company,title,location,work_mode,eligibility_basis,eligible_class_years,eligibility_notes,deadline_date,deadline_at,source_url)")
    .eq("user_id", event.userId)
    .limit(MAX_TRACKED_PER_USER);
  if (error) throw error;

  const now = Date.now();
  const end = now + 7 * 24 * 60 * 60 * 1000;
  const upcoming = ((data ?? []) as unknown as TrackedRow[]).filter((row) => {
    if (!row.opportunities || ["withdrawn", "rejected"].includes(row.status)) return false;
    const deadline = row.opportunities.deadline_at
      ? new Date(row.opportunities.deadline_at).getTime()
      : row.opportunities.deadline_date
        ? new Date(`${row.opportunities.deadline_date}T23:59:59Z`).getTime()
        : Number.NaN;
    return deadline >= now && deadline <= end;
  });

  const unsubscribe = unsubscribeUrl(event.userId);
  let sent = 0;
  for (let offset = 0; offset < upcoming.length; offset += 20) {
    const batch = upcoming.slice(offset, offset + 20);
    const messages = await Promise.all(batch.map(async (row) => {
      const listing = row.opportunities;
      if (!listing) return null;
      const emailOpportunity = mapTrackedOpportunity(listing, context.profile.timezone);
      const email = renderDeadlineReminder(emailOpportunity, unsubscribe);
      return sendWithDeliveryRecord({
        userId: event.userId,
        opportunityId: row.opportunity_id,
        to: context.email,
        kind: "deadline_reminder",
        periodKey: event.periodKey,
        subject: `Deadline coming up: ${listing.title}`,
        ...email,
        unsubscribeUrl: unsubscribe,
      });
    }));
    sent += messages.filter((message) => message?.sent).length;
  }
  return { reminders: sent };
}

export const scheduleAlertDispatch = inngest.createFunction(
  { id: "internradar-hourly-alert-schedule", triggers: { cron: "0 * * * *" }, retries: 2 },
  async ({ step }) => {
    const now = new Date();
    const events: Array<{ name: "internradar/alerts.dispatch"; data: AlertEvent }> = [];
    const admin = createSupabaseAdminClient();
    let batchNumber = 0;
    let queued = 0;

    for (let page = 0; page < MAX_PAGES_PER_SCHEDULE; page += 1) {
      const from = page * PAGE_SIZE;
      const { settings, timezones } = await step.run(`load-alert-settings-${page}`, async () => {
        const { data, error } = await admin.from("notification_settings")
          .select("user_id,weekly_digest_enabled,deadline_reminders_enabled")
          .or("weekly_digest_enabled.eq.true,deadline_reminders_enabled.eq.true")
          .order("user_id")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const pageSettings = (data ?? []) as Array<Omit<PreferenceRow, "profiles">>;
        const userIds = pageSettings.map(({ user_id }) => user_id);
        const { data: profiles, error: profileError } = userIds.length
          ? await admin.from("profiles").select("id,timezone").in("id", userIds)
          : { data: [], error: null };
        if (profileError) throw profileError;
        const profileRows = (profiles ?? []) as Array<{ id: string; timezone: string }>;
        return {
          settings: pageSettings,
          timezones: Object.fromEntries(profileRows.map(({ id, timezone }) => [id, timezone])) as Record<string, string>,
        };
      });

      for (const setting of settings) {
        const timezone = timezones[setting.user_id];
        if (!timezone) continue;
        try {
          const local = getLocalAlertTime(now, timezone);
          if (setting.weekly_digest_enabled && isDigestHour(now, timezone)) {
            events.push({ name: "internradar/alerts.dispatch", data: { userId: setting.user_id, kind: "weekly_digest", periodKey: localWeekKey(local.date) } });
          }
          if (setting.deadline_reminders_enabled && isReminderHour(now, timezone)) {
            events.push({ name: "internradar/alerts.dispatch", data: { userId: setting.user_id, kind: "deadline_reminder", periodKey: local.date } });
          }
        } catch {
          continue;
        }
      }

      while (events.length >= PAGE_SIZE) {
        const batch = events.splice(0, PAGE_SIZE);
        await step.sendEvent(`dispatch-alerts-${batchNumber}`, batch);
        batchNumber += 1;
        queued += batch.length;
      }
      if (settings.length < PAGE_SIZE) break;
    }

    while (events.length) {
      const batch = events.splice(0, PAGE_SIZE);
      await step.sendEvent(`dispatch-alerts-${batchNumber}`, batch);
      batchNumber += 1;
      queued += batch.length;
    }
    return { queued };
  },
);

export const dispatchAlert = inngest.createFunction(
  { id: "internradar-alert-delivery", triggers: { event: "internradar/alerts.dispatch" }, retries: 3 },
  async ({ event, step }) => {
    const alert = event.data as AlertEvent;
    return step.run(`send-${alert.kind}-${alert.periodKey}`, async () => {
      return alert.kind === "weekly_digest" ? sendWeeklyDigest(alert) : sendDeadlineReminders(alert);
    });
  },
);