import { expect, test } from "@playwright/test";

test("freshman and sophomore opportunity discovery stays explicit", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByText("LOCAL DEMO DATA")).toBeVisible();
  await page.getByRole("button", { name: "Discover" }).click();

  await expect(page.getByRole("heading", { name: "Discover opportunities" })).toBeVisible();
  await expect(page.getByText("Confirmed eligible").first()).toBeVisible();
  await expect(page.getByText("Eligibility unclear").first()).toBeVisible();
  await expect(page.locator('[aria-label*="out of 100"]').first()).toBeVisible();
  await expect(page.getByText("How fit scores work")).toBeVisible();
  await expect(page.locator(".listing-freshness").first()).toBeVisible();
  const classYear = page.getByLabel("Eligible class year");
  await classYear.selectOption("junior");
  await expect(page.getByRole("heading", { name: "Mechanical Engineering Intern" })).toBeVisible();
  await classYear.selectOption("");
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mechanical Engineering Intern" })).toBeVisible();
  await page.getByRole("textbox", { name: "Search title or company" }).fill("Fieldnote");
  await expect(page.getByRole("heading", { name: "Data Research Intern" })).toBeVisible();
  await expect(page.getByText("Potentially relevant").first()).toBeVisible();
});

test("save and track an opportunity with status, notes, and follow-up", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Discover" }).click();

  const saveButton = page.getByRole("button", { name: "Save Software Engineering Intern" });
  await saveButton.click();
  await expect(page.getByRole("button", { name: "Saved Software Engineering Intern" })).toBeDisabled();
  await page.getByRole("button", { name: /Applications/ }).click();

  await expect(page.getByRole("heading", { name: "Application tracker" })).toBeVisible();
  await page.locator(".tracker-card .tracker-fields select").first().selectOption("applied");
  await page.getByLabel("Follow-up date").fill("2026-10-15");
  await page.getByLabel("Private notes").fill("Tailored resume and portfolio sent.");
  await expect(page.locator(".tracker-card .tracker-footer .status-applied")).toBeVisible();
  await expect(page.getByText("Status history")).toBeVisible();
  await expect(page.getByText("Current")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /Applications/ }).click();
  await expect(page.locator(".tracker-card .tracker-fields select").first()).toHaveValue("applied");
  await expect(page.getByLabel("Follow-up date")).toHaveValue("2026-10-15");
  await expect(page.getByLabel("Private notes")).toHaveValue("Tailored resume and portfolio sent.");
});

test("demo and email preview remain usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Find internships you’re eligible for/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/demo");
  await page.getByRole("button", { name: "Discover" }).click();
  await expect(page.getByRole("heading", { name: "Discover opportunities" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/api/email-preview?kind=weekly_digest");
  await expect(page.getByText("DEVELOPMENT PREVIEW · FICTIONAL DATA · NOTHING WAS SENT")).toBeVisible();
});

test("landing page links to curated directories and robots keeps private areas out of discovery", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Start with what fits." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Internships for freshmen" })).toHaveAttribute("href", "/internships/browse/freshman-internships");
  await expect(page.getByRole("link", { name: "Paid sophomore internships" })).toHaveAttribute("href", "/internships/browse/paid-sophomore-internships");

  await page.goto("/robots.txt");
  const robots = await page.locator("body").innerText();
  expect(robots).toContain("/api");
  expect(robots).toContain("/dashboard");
  expect(robots).toContain("/unsubscribe");
  expect(robots).toContain("/sitemap.xml");
});

test("student toolkit is public and provides practical first-application guidance", async ({ page }) => {
  await page.goto("/toolkit");
  await expect(page).toHaveTitle(/Early-Career Internship Toolkit/);
  await expect(page.getByRole("heading", { name: /Your first internship application can start/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Gather evidence you already have/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Browse curated opportunities/ })).toBeVisible();
});

test("calendar export is not available to signed-out visitors", async ({ page }) => {
  const response = await page.request.get("/api/calendar");
  expect([401, 503]).toContain(response.status());
  expect(response.headers()["cache-control"]).not.toContain("public");
});