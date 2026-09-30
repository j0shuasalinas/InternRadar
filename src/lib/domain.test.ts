import { describe, expect, it } from "vitest";
import { evaluateEligibility, filterOpportunities, getMatchReasons, isSafeExternalUrl, type Opportunity, type Preferences } from "@/lib/domain";

const profile: Preferences = {
  graduationYear: 2028,
  major: "Computer Science",
  skills: ["TypeScript", "SQL"],
  preferredLocations: ["Boston"],
  remotePreference: "hybrid",
  currentClassYear: "sophomore",
  timezone: "America/New_York",
};

function listing(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opportunity-1",
    company: "Northstar Labs",
    title: "Software Engineering Intern",
    description: "Build TypeScript and SQL data tools for students.",
    eligibleClassYears: ["freshman", "sophomore"],
    eligibilityBasis: "listed_years",
    eligibilityNotes: "First- and second-year students welcome.",
    location: "Boston, MA",
    workMode: "hybrid",
    compensationType: "paid",
    compensationDetails: "$28/hour",
    sourceUrl: "https://careers.example.org/intern",
    canonicalSourceId: "northstar-software-intern",
    deadlineDate: "2027-02-01",
    deadlineAt: null,
    lastVerifiedAt: "2026-09-29T12:00:00Z",
    status: "published",
    isDemo: false,
    createdAt: "2026-09-01T12:00:00Z",
    ...overrides,
  };
}

describe("eligibility and preference matching", () => {
  it("confirms only class years explicitly listed by the source", () => {
    expect(evaluateEligibility(listing(), profile)).toBe("confirmed");
    expect(evaluateEligibility(listing({ eligibleClassYears: ["junior", "senior"] }), profile)).toBe("not_eligible");
  });

  it("does not infer class-year eligibility when the source is unclear", () => {
    expect(evaluateEligibility(listing({ eligibilityBasis: "unclear", eligibleClassYears: [] }), profile)).toBe("unclear");
    expect(getMatchReasons(listing({ eligibilityBasis: "unclear", eligibleClassYears: [] }), profile)[0]).toContain("does not state");
  });

  it("marks broad undergraduate language as potentially relevant", () => {
    expect(evaluateEligibility(listing({ eligibilityBasis: "undergraduates", eligibleClassYears: [] }), profile)).toBe("potential");
  });

  it("explains preference matches without overstating eligibility", () => {
    expect(getMatchReasons(listing(), profile)).toEqual(expect.arrayContaining([
      "Source lists sophomore students.",
      "Mentions TypeScript and SQL.",
      "Matches a preferred location.",
      "Matches your hybrid preference.",
    ]));
  });
});

describe("opportunity discovery filters", () => {
  it("excludes closed, expired, and demo listings by default", () => {
    const results = filterOpportunities([
      listing(),
      listing({ id: "closed", status: "closed" }),
      listing({ id: "expired", deadlineDate: "2026-01-01" }),
      listing({ id: "demo", isDemo: true }),
    ], {}, { now: new Date("2026-09-30T00:00:00Z") });

    expect(results.items.map(({ id }) => id)).toEqual(["opportunity-1"]);
  });

  it("searches title and company and paginates", () => {
    const results = filterOpportunities([
      listing(),
      listing({ id: "2", company: "Northstar Research", title: "Data Intern", deadlineDate: null }),
      listing({ id: "3", company: "Elsewhere", deadlineDate: null }),
    ], { query: "northstar", page: 2, pageSize: 1 }, { now: new Date("2026-09-30T00:00:00Z") });

    expect(results.total).toBe(2);
    expect(results.items[0]?.id).toBe("2");
    expect(results.pageCount).toBe(2);
  });
});

describe("source URL validation", () => {
  it("allows public HTTPS sources and rejects unsafe schemes or local hosts", () => {
    expect(isSafeExternalUrl("https://careers.example.org/role")).toBe(true);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("http://localhost:3000/")).toBe(false);
    expect(isSafeExternalUrl("https://user:pass@example.org/")).toBe(false);
  });
});