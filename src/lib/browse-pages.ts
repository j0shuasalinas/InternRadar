export type BrowsePageDefinition = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  classYear?: "freshman" | "sophomore";
  paid?: boolean;
  remote?: boolean;
  keyword?: string;
};

export const browsePages: BrowsePageDefinition[] = [
  {
    slug: "freshman-internships",
    title: "Internships for Freshmen",
    description: "Explore current internship listings that explicitly name first-year college students or state undergraduate eligibility.",
    intro: "Early internships can be hard to find when listings hide eligibility in the fine print. These current curated roles state their student eligibility clearly—or are labeled as potentially relevant when sources mention undergraduates without naming class years.",
    classYear: "freshman",
  },
  {
    slug: "paid-sophomore-internships",
    title: "Paid Internships for Sophomores",
    description: "Browse currently open paid internships with source-stated eligibility for college sophomores.",
    intro: "A focused directory of paid opportunities for second-year students. Check each source’s eligibility wording and deadline before applying.",
    classYear: "sophomore",
    paid: true,
  },
  {
    slug: "remote-undergraduate-research-internships",
    title: "Remote Undergraduate Research Internships",
    description: "Find current remote research internships and verify undergraduate eligibility on the original source.",
    intro: "Remote research roles can widen access to labs and research teams. Listings below are curated, linked to the employer source, and never treated as class-year eligible unless the source supports it.",
    remote: true,
    keyword: "research",
  },
  {
    slug: "computer-science-sophomore-internships",
    title: "Computer Science Internships for Sophomores",
    description: "Browse current software and computer science internship listings relevant to sophomore students.",
    intro: "Discover software and computing opportunities with transparent class-year evidence, original sources, and deadline details when provided.",
    classYear: "sophomore",
    keyword: "computer",
  },
];

type BrowseListing = {
  eligibility_basis: string;
  eligible_class_years: string[];
  compensation_type: string;
  work_mode: string;
  title: string;
  description: string;
};

export function filterBrowseListings<T extends BrowseListing>(
  definition: BrowsePageDefinition,
  listings: T[],
): T[] {
  const keyword = definition.keyword?.toLowerCase();
  return listings.filter((listing) => {
    const hasYearEvidence = listing.eligibility_basis !== "unclear" &&
      (!definition.classYear ||
        listing.eligibility_basis === "undergraduates" ||
        listing.eligible_class_years.includes(definition.classYear));
    const isPaid = !definition.paid || listing.compensation_type === "paid";
    const isRemote = !definition.remote || listing.work_mode === "remote";
    const hasKeyword = !keyword || `${listing.title} ${listing.description}`.toLowerCase().includes(keyword);
    return hasYearEvidence && isPaid && isRemote && hasKeyword;
  });
}
