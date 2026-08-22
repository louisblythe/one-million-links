import { test, expect } from "@playwright/test";

test.describe("public discovery", () => {
  test("list, grid, and map modes work and persist", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("link leaderboard");
    await expect(page.locator("#directoryList")).toBeVisible();
    await expect.poll(() => page.locator("#directoryRows .directory-row").count()).toBeGreaterThanOrEqual(40);

    await page.getByRole("button", { name: "Grid" }).click();
    await expect(page.locator("#directoryList")).toBeVisible();
    await expect(page.locator("#directoryRows")).toHaveClass(/is-grid/);

    await page.getByRole("button", { name: "Map" }).click();
    await expect(page.locator("#purchaseMapPanel")).toBeVisible();
    await expect(page.locator("#mapLocationCount")).toContainText("mapped");
    await page.reload();
    await expect(page.locator("#purchaseMapPanel")).toBeVisible();
  });

  test("search and category filtering update discovery results", async ({ page }) => {
    await page.goto("/?view=list");
    await page.locator("#companySearch").fill("WebFX");
    await expect(page.locator("#searchResults")).toBeVisible();
    await expect(page.locator("#searchResults")).toContainText("WebFX");
    await expect(page.locator("#directoryRows .directory-row")).toHaveCount(1);
    await page.locator("#categoryFilter").selectOption("Finance");
    await expect(page.locator("#directoryRows")).toContainText("No claimed links match this view");
  });

  test("listing share buttons appear on hover and target the public square", async ({ page }) => {
    await page.goto("/?view=list");
    const firstListing = page.locator("#directoryRows .directory-row").first();
    const shareOnX = firstListing.getByRole("link", { name: /Share .* on X/ });
    await expect(shareOnX).not.toBeVisible();
    await firstListing.hover();
    await expect(shareOnX).toBeVisible();
    await expect(shareOnX).toHaveAttribute("href", /twitter\.com\/intent\/tweet/);
    await expect(shareOnX).toHaveAttribute("href", /squares%2F\d+/);
    await expect(shareOnX).toHaveAttribute("href", /utm_source%3Dx/);
    await expect(firstListing.getByRole("link", { name: /LinkedIn/ })).toBeVisible();
    await expect(firstListing.getByRole("link", { name: /Facebook/ })).toBeVisible();
  });

  test("claim pages expose a customer-specific PNG social card", async ({ page, request }) => {
    await page.goto("/squares/138");
    const imageUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(imageUrl).toMatch(/\/og\/squares\/138\.png$/);

    const image = await request.get(imageUrl);
    expect(image.ok()).toBeTruthy();
    expect(image.headers()["content-type"]).toBe("image/png");
    const bytes = await image.body();
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
  });

  test("claim dialog validates, prices, closes, and reopens", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Claim #1/ }).click();
    await expect(page.locator("#claimDialog")).toBeVisible();
    await page.locator("#url").fill("https://new-company.example/");
    await expect(page.locator("#label")).toHaveValue("New Company");
    const minimumBid = Number(await page.locator("#payment_level").getAttribute("min"));
    expect(minimumBid).toBeGreaterThanOrEqual(1);
    await expect(page.locator("#checkoutButton")).toContainText(`$${minimumBid}`);
    await page.getByRole("button", { name: "Close claim form" }).click();
    await expect(page.locator("#claimDialog")).not.toBeVisible();
  });

  test("new purchase completes through the deterministic local Stripe seam", async ({ page }) => {
    await page.route("https://piqo.app/piqo.js", (route) => route.abort());
    await page.addInitScript(() => {
      window.__PIQO_EVENTS__ = [];
      window.piqo = (...args) => window.__PIQO_EVENTS__.push(args);
    });
    const square = 900000 + Math.floor(Date.now() % 90000);
    const label = `Brand ${square}`;
    await page.goto(`/?square=${square}`);
    await page.getByRole("button", { name: /Claim #1/ }).click();
    await expect.poll(() => page.evaluate(() => window.__PIQO_EVENTS__?.some((event) => event[0] === "claim_started"))).toBeTruthy();
    await page.locator("#url").fill(`https://brand-${square}.example/`);
    await expect(page.locator("#label")).toHaveValue(label);
    await page.locator("#checkoutButton").click();
    await expect(page).toHaveURL(/\/success\?session_id=e2e_/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Square claimed");
    await expect(page.getByText(label)).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__PIQO_EVENTS__?.some((event) => event[0] === "purchase"))).toBeTruthy();

    const listingPath = await page.getByRole("link", { name: "View live listing" }).getAttribute("href");
    expect(listingPath).toMatch(/^\/squares\/\d+$/);
    await page.goto(listingPath);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(label);
    await page.goto(`/profile/brand-${square}.example`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
    await page.goto("/collections/Other");
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  });

  test("category sponsors bid for a fixed-term ranked placement", async ({ page }) => {
    await page.goto("/collections/Agency");
    await expect(page.getByRole("heading", { name: "Agency sponsors" })).toBeVisible();
    const selectedLabel = await page.locator("#sponsorUrl option:checked").textContent();
    const firstBid = Number(await page.locator("#sponsorBid").inputValue());
    expect(firstBid).toBeGreaterThanOrEqual(10);
    await page.getByRole("button", { name: "Sponsor this category" }).click();
    await expect(page).toHaveURL(/\/collections\/Agency\?sponsored=1$/);
    await expect(page.locator(".sponsor-list")).toContainText(selectedLabel.split(" · ")[0]);
    await expect(page.locator(".sponsor-list")).toContainText(`$${firstBid}`);
    await expect(page.locator("#sponsorBid")).toHaveValue(String(firstBid + 1));
    await expect(page.locator("#sponsorHelp")).toContainText("previous");
    await expect(page.locator("#sponsorHelp")).toContainText("difference");
  });
});

test.describe("content, rankings, and machine-readable surfaces", () => {
  const pages = [
    ["/about", /How public claims work/i],
    ["/stats", /Every claim/i],
    ["/leaderboards/most-clicked", /Most Clicked Squares/i],
    ["/leaderboards/founding-squares", /Founding Squares/i],
    ["/leaderboards/newest-claims", /Newest Claims/i],
    ["/leaderboards/largest-territories", /Largest Territories/i],
    ["/squares/138", /WebFX/i],
    ["/profile/webfx.com", /WebFX/i],
    ["/collections/Agency", /Agency listings/i],
  ];

  for (const [path, heading] of pages) {
    test(`${path} renders its complete public page`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    });
  }

  test("APIs, feeds, assets, redirects, and error states have correct contracts", async ({ request }) => {
    const squares = await request.get("/api/squares");
    expect(squares.ok()).toBeTruthy();
    expect((await squares.json()).squares.length).toBeGreaterThanOrEqual(40);

    const sessionId = crypto.randomUUID();
    const presence = await request.post("/api/presence", { data: { session_id: sessionId } });
    expect(presence.ok()).toBeTruthy();
    expect((await presence.json()).active_now).toBeGreaterThan(0);

    for (const path of ["/robots.txt", "/sitemap.xml", "/sitemaps/core.xml", "/feed.xml", "/claims.json", "/site.webmanifest", "/og-image.png", "/favicon.svg", "/assets/app.css", "/assets/app.js"]) {
      expect((await request.get(path)).ok(), path).toBeTruthy();
    }
    expect((await request.get("/rss.xml", { maxRedirects: 0 })).status()).toBe(301);
    expect((await request.get("/recent.json", { maxRedirects: 0 })).status()).toBe(301);
    for (const path of ["/not-found", "/squares/1000001", "/leaderboards/nope", "/collections/nonsense", "/success"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
      expect(response.headers()["x-robots-tag"], path).toContain("noindex");
    }
  });
});
