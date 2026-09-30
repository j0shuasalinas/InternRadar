import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/alerts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function page(title: string, message: string, token?: string, status = 200) {
  const form = token ? `<form method="post" action="/unsubscribe"><input type="hidden" name="token" value="${token}"><button type="submit">Unsubscribe from all email alerts</button></form>` : "";
  return new NextResponse(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · InternRadar</title><body style="margin:0;padding:48px 16px;background:#f5f6f3;color:#182b3c;font:16px/1.6 sans-serif"><main style="max-width:520px;margin:auto;padding:28px;background:#fff;border:1px solid #dce2e3;border-radius:8px"><p style="color:#315fc7;font-weight:700">INTERNRADAR</p><h1>${title}</h1><p>${message}</p>${form}</main></body></html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, private" },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const claims = verifyUnsubscribeToken(token);
  if (!claims) return page("Link expired", "This unsubscribe link is invalid or has expired. Update alerts in your InternRadar preferences.", undefined, 400);
  return page("Email preferences", "Confirm below to turn off weekly opportunity digests and deadline reminders.", token);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const token = request.nextUrl.searchParams.get("token") ?? String(formData.get("token") ?? "");
  const claims = verifyUnsubscribeToken(token);
  if (!claims) return page("Link expired", "This unsubscribe link is invalid or has expired. Update alerts in your InternRadar preferences.", undefined, 400);

  const { error } = await createSupabaseAdminClient().from("notification_settings").update({
    weekly_digest_enabled: false,
    deadline_reminders_enabled: false,
  }).eq("user_id", claims.userId);
  if (error) return page("Could not update preferences", "Please retry from the unsubscribe link or change your settings in InternRadar.", undefined, 500);
  return page("You’re unsubscribed", "Weekly digests and deadline reminders are now off.");
}