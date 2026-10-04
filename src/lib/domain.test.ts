import { describe, expect, it } from "vitest";
import { calculateMatchFit, evaluateEligibility, filterOpportunities, getMatchReasons, isSafeExternalUrl, opportunityInputSchema, preferencesSchema, rankOpportunitiesByFit, type Opportunity, type Preferences } from "@/lib/domain";

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

  it("scores only explicit eligibility and profile matches using documented weights", () => {
    const fit = calculateMatchFit(listing(), profile);

    expect(fit.score).toBe(65);
    expect(fit.tier).toBe("promising");
    expect(fit.breakdown).toEqual({
      eligibility: 40,
      major: 0,
      skills: 10,
      location: 10,
      workMode: 5,
    });
    expect(fit.reasons).toContain("Class year is explicitly confirmed by the source.");
    expect(fit.reasons).toContain("Matching skills: TypeScript, SQL.");
  });

  it("caps skill contribution and never promotes unclear eligibility to confirmed", () => {
    const matchingProfile = {
      ...profile,
      major: "Computer Science",
      skills: ["TypeScript", "SQL", "data", "tools", "student", "research"],
    };
    const highFit = calculateMatchFit(
      listing({ description: "Computer Science students build TypeScript SQL data tools for research." }),
      matchingProfile,
    );
    const unclearFit = calculateMatchFit(
      listing({ eligibilityBasis: "unclear", eligibleClassYears: [] }),
      profile,
    );

    expect(highFit.score).toBe(100);
    expect(highFit.tier).toBe("strong");
    expect(highFit.breakdown.skills).toBe(25);
    expect(unclearFit.breakdown.eligibility).toBe(10);
    expect(unclearFit.reasons).toContain("Source does not state eligible class years.");
  });

  it("ranks all opportunities by fit before applying pagination", () => {
    const unclear = listing({
      id: "unclear",
      eligibilityBasis: "unclear",
      eligibleClassYears: [],
      eligibilityNotes: "Source does not state class years.",
      description: "A role with no matching terms.",
      location: "Chicago",
      workMode: "onsite",
    });
    const results = filterOpportunities(
      [unclear, listing()],
      { page: 1, pageSize: 1 },
      { profile, rankByFit: true, now: new Date("2026-09-30T00:00:00Z") },
    );

    expect(results.items.map(({ id }) => id)).toEqual(["opportunity-1"]);
    expect(rankOpportunitiesByFit([unclear, listing()], profile).map(({ id }) => id))
      .toEqual(["opportunity-1", "unclear"]);
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
    expect(isSafeExternalUrl("https://10.1.2.3/role")).toBe(false);
    expect(isSafeExternalUrl("https://[::1]/role")).toBe(false);
    expect(isSafeExternalUrl("https://user:pass@example.org/")).toBe(false);
  });

  it("rejects invalid time zones so scheduled emails are not silently mistimed", () => {
    expect(preferencesSchema.safeParse({ ...profile, timezone: "Mars/Olympus" }).success).toBe(false);
  });

  it("requires source notes when a published listing has broad or unclear eligibility", () => {
    const input = {
      company: "Fieldnote",
      title: "Research Intern",
      description: "Research role.",
      eligibleClassYears: [],
      eligibilityBasis: "unclear",
      eligibilityNotes: null,
      location: "Remote",
      workMode: "remote",
      compensationType: "unknown",
      compensationDetails: null,
      sourceUrl: "https://careers.example.org/research",
      canonicalSourceId: null,
      deadlineDate: null,
      deadlineAt: null,
      lastVerifiedAt: "2026-09-30T12:00:00Z",
      status: "published",
    };

    expect(opportunityInputSchema.safeParse(input).success).toBe(false);
    expect(opportunityInputSchema.safeParse({ ...input, eligibilityNotes: "Source does not state eligible class years." }).success).toBe(true);
  });
});