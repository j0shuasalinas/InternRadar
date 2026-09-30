import { z } from "zod";

export const classYears = ["freshman", "sophomore", "junior", "senior", "graduate"] as const;
export const applicationStatuses = ["saved", "applied", "interview", "offer", "rejected", "withdrawn"] as const;
export const classYearSchema = z.enum(classYears);
export const applicationStatusSchema = z.enum(applicationStatuses);

export const preferencesSchema = z.object({
  graduationYear: z.coerce.number().int().min(2026).max(2040),
  major: z.string().trim().min(1).max(100),
  skills: z.array(z.string().trim().min(1).max(50)).max(30),
  preferredLocations: z.array(z.string().trim().min(1).max(100)).max(20),
  remotePreference: z.enum(["any", "remote", "hybrid", "onsite"]),
  currentClassYear: classYearSchema,
  timezone: z.string().trim().min(1).max(80).default("UTC"),
});

export const opportunityInputSchema = z.object({
  company: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(8000),
  eligibleClassYears: z.array(classYearSchema).max(5),
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
});

export type ClassYear = z.infer<typeof classYearSchema>;
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type OpportunityInput = z.infer<typeof opportunityInputSchema>;
export type Eligibility = "confirmed" | "potential" | "unclear" | "not_eligible";

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

export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      hostname !== "localhost" &&
      !hostname.endsWith(".localhost") &&
      !hostname.endsWith(".local")
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

  if (opportunity.title.toLowerCase().includes(profile.major.toLowerCase())) {
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

export function filterOpportunities(
  opportunities: Opportunity[],
  filters: OpportunityFilters,
  options: { includeDemo?: boolean; now?: Date } = {},
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

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;

  return { items: filtered.slice(start, start + pageSize), total: filtered.length, page: safePage, pageCount };
}