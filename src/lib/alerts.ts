import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const unsubscribeClaimsSchema = z.object({ userId: z.uuid(), expiresAt: z.number().int() });
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function signingSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("UNSUBSCRIBE_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function signature(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function createUnsubscribeToken(userId: string, now = Date.now()): string {
  const claims = unsubscribeClaimsSchema.parse({
    userId,
    expiresAt: Math.floor(now / 1000) + 60 * 60 * 24 * 45,
  });
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyUnsubscribeToken(token: string, now = Date.now()): { userId: string } | null {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;

  try {
    const expectedSignature = signature(payload);
    const supplied = Buffer.from(suppliedSignature, "base64url");
    const expected = Buffer.from(expectedSignature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

    const claims = unsubscribeClaimsSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (!claims.success || claims.data.expiresAt <= Math.floor(now / 1000)) return null;
    return { userId: claims.data.userId };
  } catch {
    return null;
  }
}

export function getLocalAlertTime(now: Date, timezone: string): { date: string; weekday: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"),
    hour: Number(get("hour")),
  };
}

export function localWeekKey(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Expected an ISO local date.");
  const daysSinceMonday = (parsed.getUTCDay() + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - daysSinceMonday);
  return parsed.toISOString().slice(0, 10);
}

export function isDigestHour(now: Date, timezone: string): boolean {
  const local = getLocalAlertTime(now, timezone);
  return local.weekday === dayNames[1] && local.hour === 9;
}

export function isReminderHour(now: Date, timezone: string): boolean {
  return getLocalAlertTime(now, timezone).hour === 9;
}