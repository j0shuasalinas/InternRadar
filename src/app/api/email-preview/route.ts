import { NextRequest } from "next/server";
import { demoOpportunities } from "@/lib/demo/opportunities";
import { renderDeadlineReminder, renderWeeklyDigest } from "@/lib/email/templates";

export function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const kind = request.nextUrl.searchParams.get("kind") ?? "weekly_digest";
  const sample = demoOpportunities[0];
  const emailOpportunity = {
    company: sample.company,
    title: sample.title,
    location: sample.location,
    workMode: sample.workMode,
    deadline: sample.deadlineDate ?? "Not listed",
    sourceUrl: sample.sourceUrl,
    eligibility: "Fictional sample: source explicitly names freshmen and sophomores.",
  };
  const unsubscribeUrl = "http://localhost:3000/unsubscribe?token=preview-only";
  const preview = kind === "deadline_reminder"
    ? renderDeadlineReminder(emailOpportunity, unsubscribeUrl)
    : kind === "weekly_digest"
      ? renderWeeklyDigest([emailOpportunity], unsubscribeUrl)
      : null;
  if (!preview) return Response.json({ error: "kind must be weekly_digest or deadline_reminder" }, { status: 400 });

  const html = preview.html.replace("</main>", "<p style=\"padding:10px;background:#fff1c9;color:#745515;font-weight:700\">DEVELOPMENT PREVIEW · FICTIONAL DATA · NOTHING WAS SENT</p></main>");
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}