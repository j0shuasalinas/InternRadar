import { createCalendarEvents, renderIcalendar } from "@/lib/domain";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function calendarError(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(): Promise<Response> {
  if (!isSupabaseConfigured()) return calendarError("Calendar export requires Supabase configuration.", 503);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return calendarError("Authentication required.", 401);

  const [{ data: profile, error: profileError }, { data, error }] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
    supabase.from("tracked_applications")
      .select("id,applied_at,follow_up_date,opportunities(company,title,deadline_type,deadline_date,deadline_at,source_url)")
      .eq("user_id", user.id),
  ]);
  if (profileError || error) return calendarError("Could not export your application calendar.", 500);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    applied_at: string | null;
    follow_up_date: string | null;
    opportunities: {
      company: string;
      title: string;
      deadline_type: "exact_timestamp" | "date_only" | "rolling" | "not_listed" | "unknown";
      deadline_date: string | null;
      deadline_at: string | null;
      source_url: string;
    } | null;
  }>;
  const events = createCalendarEvents(rows.map((row) => {
    const listing = row.opportunities;
    return {
      id: row.id,
      title: listing?.title ?? "Tracked internship",
      company: listing?.company ?? "InternRadar application",
      deadlineType: listing?.deadline_type ?? "unknown",
      deadlineDate: listing?.deadline_date ?? null,
      deadlineAt: listing?.deadline_at ?? null,
      appliedAt: row.applied_at,
      followUpDate: row.follow_up_date,
      sourceUrl: listing?.source_url ?? null,
    };
  }));
  const calendar = renderIcalendar(events, profile?.timezone ?? "UTC");
  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="internradar-application-calendar.ics"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
