import { z } from "zod";

export const classYears = ["freshman", "sophomore", "junior", "senior", "graduate"] as const;
export const applicationStatuses = ["saved", "applied", "interview", "offer", "rejected", "withdrawn"] as const;
export const classYearSchema = z.enum(classYears);
export const applicationStatusSchema = z.enum(applicationStatuses);

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const preferencesSchema = z.object({
  graduationYear: z.coerce.number().int().min(2026).max(2040),
  major: z.string().trim().min(1).max(100),
  skills: z.array(z.string().trim().min(1).max(50)).max(30),
  preferredLocations: z.array(z.string().trim().min(1).max(100)).max(20),
  remotePreference: z.enum(["any", "remote", "hybrid", "onsite"]),
  currentClassYear: classYearSchema,
  timezone: z.string().trim().min(1).max(80).refine(isTimeZone, "Choose a valid IANA time zone.").default("UTC"),
});

export const opportunityInputSchema = z.object({
  company: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(8000),
  eligibleClassYears: z.array(classYearSchema).max(5).refine((years) => new Set(years).size === years.length),
  eligibilityBasis: z.enum(["listed_years", "undergraduates", "unclear"]),
  eligibilityNotes: z.string().trim().max(1000).nullable(),
  location: z.string().trim().min(1).max(160),
  workMode: z.enum(["remote", "hybrid", "onsite"]),
  compensationType: z.enum(["paid", "unpaid", "unknown"]),
  compensationDetails: z.string().trim().max(160).nullable(),
  sourceUrl: z.string().url().refine(isSafeExternalUrl, "Use a public HTTPS source URL."),
  canonicalSourceId: z.string().trim().max(240).nullable(),
  deadlineDate: z.iso.date().nullable(),
  deadlineAt: z.iso.datetime({ offset: true }).nullable(),
  lastVerifiedAt: z.iso.datetime({ offset: true }),
  status: z.enum(["draft", "published", "closed"]),
}).superRefine((opportunity, context) => {
  if (opportunity.eligibilityBasis === "listed_years" && opportunity.eligibleClassYears.length === 0) {
    context.addIssue({ code: "custom", path: ["eligibleClassYears"], message: "List the class years stated by the source." });
  }
  if (opportunity.eligibilityBasis !== "listed_years" && opportunity.eligibleClassYears.length > 0) {
    context.addIssue({ code: "custom", path: ["eligibleClassYears"], message: "Clear listed years when eligibility is broad or unclear." });
  }
  if (opportunity.status === "published" && opportunity.eligibilityBasis !== "listed_years" && !opportunity.eligibilityNotes?.trim()) {
    context.addIssue({ code: "custom", path: ["eligibilityNotes"], message: "Add the source language that supports broad or unclear eligibility." });
  }
  if (opportunity.deadlineDate && opportunity.deadlineAt) {
    context.addIssue({ code: "custom", path: ["deadlineAt"], message: "Use either a date-only deadline or a precise timestamp." });
  }
});

export type ClassYear = z.infer<typeof classYearSchema>;
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type OpportunityInput = z.infer<typeof opportunityInputSchema>;
export type Eligibility = "confirmed" | "potential" | "unclear" | "not_eligible";
export type MatchFit = {
  score: number;
  tier: "strong" | "promising" | "explore";
  breakdown: {
    eligibility: number;
    major: number;
    skills: number;
    location: number;
    workMode: number;
  };
  reasons: string[];
};
export type ListingFreshness = {
  state: "fresh" | "due" | "stale";
  daysSinceVerified: number | null;
};

export type Opportunity = OpportunityInput & {
  id: string;
  isDemo: boolean;
  createdAt: string;
};

export type OpportunityFilters = {
  query?: string;
  classYear?: ClassYear;
  location?: string;
  workMode?: Opportunity["workMode"];
  compensationType?: Opportunity["compensationType"];
  deadlineBefore?: string;
  page?: number;
  pageSize?: number;
};

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second !== undefined && second >= 64 && second <= 127) ||
    (first === 198 && second !== undefined && (second === 18 || second === 19)) ||
    (first !== undefined && first >= 224);
}

function isLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const ipv4Mapped = normalized.startsWith("::ffff:") ? normalized.slice(7) : null;
  const isIpv6 = normalized.includes(":");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    (isIpv6 && (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized) || normalized.startsWith("ff"))) ||
    isPrivateIpv4(normalized) ||
    Boolean(ipv4Mapped && isPrivateIpv4(ipv4Mapped))
  );
}

export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !isLocalHost(hostname)
    );
  } catch {
    return false;
  }
}

export function evaluateEligibility(opportunity: Opportunity, profile: Preferences): Eligibility {
  if (opportunity.eligibilityBasis === "unclear") return "unclear";
  if (opportunity.eligibilityBasis === "undergraduates") return "potential";

  return opportunity.eligibleClassYears.includes(profile.currentClassYear)
    ? "confirmed"
    : "not_eligible";
}

export function getMatchReasons(opportunity: Opportunity, profile: Preferences): string[] {
  const reasons: string[] = [];
  const eligibility = evaluateEligibility(opportunity, profile);

  if (eligibility === "confirmed") reasons.push(`Source lists ${profile.currentClassYear} students.`);
  if (eligibility === "potential") reasons.push("Source says undergraduate students; class years are not specified.");
  if (eligibility === "unclear") reasons.push("The source does not state class-year eligibility.");

  if (`${opportunity.title} ${opportunity.description}`.toLowerCase().includes(profile.major.toLowerCase())) {
    reasons.push(`Role title matches ${profile.major}.`);
  }

  const matchedSkills = profile.skills.filter((skill) =>
    `${opportunity.title} ${opportunity.description}`.toLowerCase().includes(skill.toLowerCase()),
  );
  if (matchedSkills.length) reasons.push(`Mentions ${matchedSkills.slice(0, 2).join(" and ")}.`);

  if (profile.preferredLocations.some((location) =>
    `${opportunity.location} ${opportunity.workMode}`.toLowerCase().includes(location.toLowerCase()),
  )) {
    reasons.push("Matches a preferred location.");
  }

  if (profile.remotePreference !== "any" && opportunity.workMode === profile.remotePreference) {
    reasons.push(`Matches your ${profile.remotePreference} preference.`);
  }

  return reasons;
}

export function calculateMatchFit(opportunity: Opportunity, profile: Preferences): MatchFit {
  const eligibility = evaluateEligibility(opportunity, profile);
  const roleText = `${opportunity.title} ${opportunity.description}`.toLowerCase();
  const majorMatches = roleText.includes(profile.major.toLowerCase());
  const matchedSkills = [...new Set(profile.skills.map((skill) => skill.trim()).filter(Boolean))]
    .filter((skill) => roleText.includes(skill.toLowerCase()));
  const locationMatches = profile.preferredLocations.some((location) =>
    `${opportunity.location} ${opportunity.workMode}`.toLowerCase().includes(location.toLowerCase()),
  );
  const workModeMatches = profile.remotePreference !== "any" &&
    opportunity.workMode === profile.remotePreference;

  const breakdown = {
    eligibility: eligibility === "confirmed" ? 40 : eligibility === "potential" ? 24 : eligibility === "unclear" ? 10 : 0,
    major: majorMatches ? 20 : 0,
    skills: Math.min(matchedSkills.length, 5) * 5,
    location: locationMatches ? 10 : 0,
    workMode: workModeMatches ? 5 : 0,
  };
  const score = Object.values(breakdown).reduce((total, value) => total + value, 0);
  const reasons = [
    eligibility === "confirmed"
      ? "Class year is explicitly confirmed by the source."
      : eligibility === "potential"
        ? "Source mentions undergraduates, but not individual class years."
        : eligibility === "unclear"
          ? "Source does not state eligible class years."
          : "Your class year is not listed as eligible.",
    ...(majorMatches ? [`Role text mentions your major: ${profile.major}.`] : []),
    ...(matchedSkills.length ? [`Matching skills: ${matchedSkills.slice(0, 5).join(", ")}.`] : []),
    ...(locationMatches ? ["Matches a preferred location."] : []),
    ...(workModeMatches ? [`Matches your ${profile.remotePreference} work-mode preference.`] : []),
  ];

  return {
    score,
    tier: score >= 75 ? "strong" : score >= 55 ? "promising" : "explore",
    breakdown,
    reasons,
  };
}

export function rankOpportunitiesByFit(
  opportunities: Opportunity[],
  profile: Preferences,
): Opportunity[] {
  return opportunities
    .map((opportunity) => ({ opportunity, fit: calculateMatchFit(opportunity, profile) }))
    .sort((left, right) => {
      const scoreDifference = right.fit.score - left.fit.score;
      if (scoreDifference) return scoreDifference;
      const leftDeadline = left.opportunity.deadlineAt ?? left.opportunity.deadlineDate ?? "9999-12-31";
      const rightDeadline = right.opportunity.deadlineAt ?? right.opportunity.deadlineDate ?? "9999-12-31";
      const deadlineDifference = leftDeadline.localeCompare(rightDeadline);
      return deadlineDifference || right.opportunity.lastVerifiedAt.localeCompare(left.opportunity.lastVerifiedAt) ||
        left.opportunity.id.localeCompare(right.opportunity.id);
    })
    .map(({ opportunity }) => opportunity);
}

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const year = dateParts.year;
  const month = dateParts.month;
  const day = dateParts.day;
  if (!year || !month || !day) throw new Error(`Could not determine calendar date in time zone "${timeZone}".`);
  return `${year}-${month}-${day}`;
}

export function getListingFreshness(lastVerifiedAt: string, now = new Date()): ListingFreshness {
  const verifiedAt = Date.parse(lastVerifiedAt);
  if (Number.isNaN(verifiedAt)) return { state: "stale", daysSinceVerified: null };
  const elapsedDays = Math.max(0, Math.floor((now.getTime() - verifiedAt) / 86_400_000));
  return {
    state: elapsedDays <= 14 ? "fresh" : elapsedDays <= 30 ? "due" : "stale",
    daysSinceVerified: elapsedDays,
  };
}

export function filterOpportunities(
  opportunities: Opportunity[],
  filters: OpportunityFilters,
  options: { includeDemo?: boolean; now?: Date; profile?: Preferences; rankByFit?: boolean } = {},
): { items: Opportunity[]; total: number; page: number; pageCount: number } {
  const pageSize = Math.min(Math.max(filters.pageSize ?? 10, 1), 50);
  const page = Math.max(filters.page ?? 1, 1);
  const query = filters.query?.trim().toLowerCase();
  const today = (options.now ?? new Date()).toISOString().slice(0, 10);

  const filtered = opportunities.filter((opportunity) => {
    if (opportunity.status !== "published" || (!options.includeDemo && opportunity.isDemo)) return false;
    if (filters.classYear && opportunity.eligibilityBasis === "listed_years" && !opportunity.eligibleClassYears.includes(filters.classYear)) return false;
    if (filters.workMode && opportunity.workMode !== filters.workMode) return false;
    if (filters.compensationType && opportunity.compensationType !== filters.compensationType) return false;
    if (filters.location && !opportunity.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (filters.deadlineBefore && (!opportunity.deadlineDate || opportunity.deadlineDate > filters.deadlineBefore)) return false;
    if (opportunity.deadlineDate && opportunity.deadlineDate < today) return false;
    if (query && !`${opportunity.title} ${opportunity.company}`.toLowerCase().includes(query)) return false;
    return true;
  });

  const ordered = options.rankByFit && options.profile
    ? rankOpportunitiesByFit(filtered, options.profile)
    : filtered;
  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;

  return { items: ordered.slice(start, start + pageSize), total: ordered.length, page: safePage, pageCount };
}