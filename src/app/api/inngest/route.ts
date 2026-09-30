import { NextResponse, type NextRequest } from "next/server";
import { serve } from "inngest/next";
import { dispatchAlert, scheduleAlertDispatch } from "@/lib/inngest/alerts";
import { inngest } from "@/lib/inngest/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const handlers = serve({ client: inngest, functions: [scheduleAlertDispatch, dispatchAlert] });

function signingKeyMissing() {
  return process.env.NODE_ENV === "production" && !process.env.INNGEST_SIGNING_KEY;
}

export async function GET(request: NextRequest, context?: unknown) {
  if (signingKeyMissing()) return NextResponse.json({ error: "Inngest signing is not configured." }, { status: 503 });
  return handlers.GET(request, context);
}

export async function POST(request: NextRequest, context?: unknown) {
  if (signingKeyMissing()) return NextResponse.json({ error: "Inngest signing is not configured." }, { status: 503 });
  return handlers.POST(request, context);
}

export async function PUT(request: NextRequest, context?: unknown) {
  if (signingKeyMissing()) return NextResponse.json({ error: "Inngest signing is not configured." }, { status: 503 });
  return handlers.PUT(request, context);
}