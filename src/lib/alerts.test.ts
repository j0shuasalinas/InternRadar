import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUnsubscribeToken, getLocalAlertTime, isDigestHour, localWeekKey, verifyUnsubscribeToken } from "@/lib/alerts";

const originalSecret = process.env.UNSUBSCRIBE_SECRET;

beforeEach(() => {
  process.env.UNSUBSCRIBE_SECRET = "test-secret-with-at-least-thirty-two-characters";
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.UNSUBSCRIBE_SECRET;
  else process.env.UNSUBSCRIBE_SECRET = originalSecret;
});

describe("timezone-aware alert scheduling", () => {
  it("uses each user's local wall clock rather than UTC hour", () => {
    const instant = new Date("2026-09-28T13:00:00Z");
    expect(getLocalAlertTime(instant, "America/New_York")).toMatchObject({ weekday: "Mon", hour: 9 });
    expect(isDigestHour(instant, "America/New_York")).toBe(true);
    expect(isDigestHour(instant, "Europe/Paris")).toBe(false);
  });

  it("uses Monday as the local weekly deduplication period", () => {
    expect(localWeekKey("2026-09-30")).toBe("2026-09-28");
    expect(localWeekKey("2026-10-04")).toBe("2026-09-28");
  });
});

describe("unsubscribe token security", () => {
  it("accepts a valid token and returns its signed user identity", () => {
    const token = createUnsubscribeToken("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 1_800_000_000_000);
    expect(verifyUnsubscribeToken(token, 1_800_000_000_000)).toEqual({ userId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" });
  });

  it("rejects tampered and expired tokens", () => {
    const token = createUnsubscribeToken("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", 1_800_000_000_000);
    const [payload, signature] = token.split(".");
    expect(verifyUnsubscribeToken(`${payload}.invalid`, 1_800_000_000_000)).toBeNull();
    expect(verifyUnsubscribeToken(token, 1_900_000_000_000)).toBeNull();
    expect(verifyUnsubscribeToken(`${payload}x.${signature}`, 1_800_000_000_000)).toBeNull();
  });
});