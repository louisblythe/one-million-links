import { test, expect } from "@playwright/test";

test("mobile discovery and claim flow remain usable without horizontal overflow", async ({ page }) => {
  await page.goto("/?view=list");
  await expect(page.locator("#directoryList")).toBeVisible();
  const viewport = page.viewportSize();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(viewport.width + 1);
  await expect(page.locator("#claimForm")).toBeVisible();
  await page.locator("#url").fill("https://mobile-flow.example/");
  await expect(page.locator("#label")).toHaveValue("Mobile Flow");
  await expect(page.locator("#checkoutButton")).toBeEnabled();
});

test("mobile stats and map views render", async ({ page }) => {
  await page.goto("/stats");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every claim");
  await expect(page.getByText("Online now", { exact: true })).toBeVisible();
  await expect(page.locator("#statsActiveNow")).not.toHaveText("—");
  await expect(page.locator("#statsSessions24h")).not.toHaveText("—");
  await expect(page.locator("#statsFreshness")).toContainText("Live audience updated");
  const viewport = page.viewportSize();
  const statsWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(statsWidth).toBeLessThanOrEqual(viewport.width + 1);
  await page.goto("/?view=map");
  await expect(page.locator("#purchaseMapPanel")).toBeVisible();
});
