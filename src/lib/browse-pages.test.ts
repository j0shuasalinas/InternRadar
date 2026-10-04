import { describe, expect, it } from "vitest";
import { browsePages, filterBrowseListings } from "@/lib/browse-pages";

describe("curated SEO browse collections", () => {
  it("never includes unclear class-year eligibility in a freshman collection", () => {
    const freshmanPage = browsePages.find((page) => page.slug === "freshman-internships");
    if (!freshmanPage) throw new Error("Freshman collection is not configured.");

    const listings = [
      { id: "named", title: "Software Intern", description: "", eligibility_basis: "listed_years", eligible_class_years: ["freshman"], compensation_type: "paid", work_mode: "remote" },
      { id: "undergrad", title: "Research Intern", description: "", eligibility_basis: "undergraduates", eligible_class_years: [], compensation_type: "paid", work_mode: "remote" },
      { id: "unclear", title: "Studio Intern", description: "", eligibility_basis: "unclear", eligible_class_years: [], compensation_type: "paid", work_mode: "remote" },
      { id: "excluded", title: "Senior Intern", description: "", eligibility_basis: "listed_years", eligible_class_years: ["senior"], compensation_type: "paid", work_mode: "remote" },
    ];

    expect(filterBrowseListings(freshmanPage, listings).map(({ id }) => id)).toEqual(["named", "undergrad"]);
  });

  it("applies paid, remote, and keyword criteria without relaxing eligibility evidence", () => {
    const researchPage = browsePages.find((page) => page.slug === "remote-undergraduate-research-internships");
    if (!researchPage) throw new Error("Remote research collection is not configured.");

    const listings = [
      { id: "match", title: "Research Intern", description: "Undergraduate research", eligibility_basis: "undergraduates", eligible_class_years: [], compensation_type: "paid", work_mode: "remote" },
      { id: "onsite", title: "Research Intern", description: "Undergraduate research", eligibility_basis: "undergraduates", eligible_class_years: [], compensation_type: "paid", work_mode: "onsite" },
      { id: "unclear", title: "Research Intern", description: "Research role", eligibility_basis: "unclear", eligible_class_years: [], compensation_type: "paid", work_mode: "remote" },
    ];

    expect(filterBrowseListings(researchPage, listings).map(({ id }) => id)).toEqual(["match"]);
  });
});
