import { expect, test } from "@playwright/test";

test("freshman and sophomore opportunity discovery stays explicit", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByText("LOCAL DEMO DATA")).toBeVisible();
  await page.getByRole("button", { name: "Discover" }).click();

  await expect(page.getByRole("heading", { name: "Discover opportunities" })).toBeVisible();
  await expect(page.getByText("Confirmed eligible").first()).toBeVisible();
  await expect(page.getByText("Eligibility unclear").first()).toBeVisible();
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
  await page.getByLabel("Application status").selectOption("applied");
  await page.getByLabel("Follow-up date").fill("2026-10-15");
  await page.getByLabel("Private notes").fill("Tailored resume and portfolio sent.");
  await expect(page.getByText("applied", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /Applications/ }).click();
  await expect(page.getByLabel("Application status")).toHaveValue("applied");
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