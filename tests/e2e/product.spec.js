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
    await page.locator("#categoryFilter").selectOption("Business, Finance & Legal");
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

  test("inline claim form accepts any payment and calculates the top bid", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#claimForm")).toBeVisible();
    await expect(page.locator("#claimForm form > .bid-amount + .website-checkout-row")).toHaveCount(1);
    await expect(page.locator("#claimCategory")).toHaveValue("");
    await expect(page.locator("#claimCategory option")).toHaveCount(29);
    await expect(page.locator(".lifetime-totals")).toContainText("Total paid");
    await expect(page.locator(".lifetime-totals")).toContainText("Total bids");
    await expect(page.locator(".lifetime-totals")).toContainText("Outbound clicks");
    const firstListingMetrics = page.locator(".directory-row__metric").first();
    await expect(firstListingMetrics).toContainText("paid");
    await expect(firstListingMetrics).toContainText("click");
    await page.locator("#url").fill("https://new-company.example/");
    await page.locator("#claimCategory").selectOption("Developer Tools");
    await expect(page.locator("#label")).toHaveValue("New Company");
    await page.locator("#payment_level").fill("1");
    await expect(page.locator("#checkoutButton")).toContainText("$1");
    await page.getByRole("button", { name: /Take #1/ }).click();
    await expect(page.locator("#placementPreview")).toContainText("above the current");
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
    await page.locator("#url").focus();
    await expect.poll(() => page.evaluate(() => window.__PIQO_EVENTS__?.some((event) => event[0] === "claim_started"))).toBeTruthy();
    await page.locator("#url").fill(`https://brand-${square}.example/`);
    await page.locator("#claimCategory").selectOption("SEO & AI Visibility");
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
    await page.goto("/collections/SEO%20%26%20AI%20Visibility");
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  });

  test("repeat bids add credit while preserving the paid listing category", async ({ page, request }) => {
    const before = (await (await request.get("/api/squares")).json()).squares.find(square => square.url === "https://www.webfx.com/");
    expect(before).toBeTruthy();
    for (let i = 0; i < 2; i++) {
      await page.goto("/");
      await page.locator("#url").fill(before.url);
      await page.locator("#claimCategory").selectOption("Other");
      await page.locator("#payment_level").fill("5");
      await page.locator("#checkoutButton").click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Square claimed");
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Square claimed");
    }
    const after = (await (await request.get("/api/squares")).json()).squares.find(square => square.square_id === before.square_id);
    expect(after.category).toBe(before.category);
    expect(after.featured_amount_cents).toBe(Number(before.featured_amount_cents || 0) + 1000);
  });

  test("category sponsors bid for a fixed-term ranked placement", async ({ page }) => {
    await page.goto("/collections/Agencies%2C%20Studios%20%26%20Services");
    await expect(page.getByRole("heading", { name: "Agencies, Studios & Services sponsors" })).toBeVisible();
    const selectedLabel = await page.locator("#sponsorUrl option:checked").textContent();
    const firstBid = Number(await page.locator("#sponsorBid").inputValue());
    expect(firstBid).toBeGreaterThanOrEqual(10);
    await page.getByRole("button", { name: "Sponsor this category" }).click();
    await expect(page).toHaveURL(/\/collections\/Agencies%2C%20Studios%20%26%20Services\?sponsored=1$/);
    await expect(page.locator(".sponsor-list")).toContainText(selectedLabel.split(" · ")[0]);
    await expect(page.locator(".sponsor-list")).toContainText(`$${firstBid}`);
    await expect(page.locator("#sponsorBid")).toHaveValue(String(firstBid + 1));
    await expect(page.locator("#sponsorHelp")).toContainText("previous");
    await expect(page.locator("#sponsorHelp")).toContainText("difference");
  });
});

test.describe("content, rankings, and machine-readable surfaces", () => {
  test("leaderboard handles zero, partial, and full traffic podiums truthfully", async ({ page, request }) => {
    const fixture = await request.post("/checkout", { form: {
      label: "Leaderboard fixture", url: `https://leaderboard-${Date.now()}.example/`,
      category: "Other", payment_level: "1",
    } });
    expect(fixture.ok()).toBeTruthy();
    const response = await page.goto("/stats");
    expect(response.headers()["cache-control"]).toBe("no-store");
    await expect(page.locator(".podium-empty")).toContainText("The throne is open");
    await expect(page.locator(".podium-card")).toHaveCount(0);
    await expect(page.locator(".stats-chart__axis")).toHaveCount(1);

    const squaresResponse = await request.get("/api/squares");
    const { squares } = await squaresResponse.json();
    const other = squares.find((square) => square.category === "Other");
    const agencies = squares.filter((square) => square.category === "Agencies, Studios & Services").slice(0, 2);
    expect(other).toBeTruthy();
    expect(agencies).toHaveLength(2);

    const click = async (square) => {
      const result = await request.get(`/go/${Number(square.square_id) + 1}`, { maxRedirects: 0 });
      expect(result.status()).toBe(302);
    };

    await click(other);
    await click(other);
    await page.reload();
    await expect(page.locator(".podium-card")).toHaveCount(1);
    await expect(page.locator(".podium-card").first()).toContainText("2 clicks");
    await expect(page.locator(".stats-board").filter({ hasText: "Scene Stealers" }).locator("li").first()).toContainText("Other");

    await click(agencies[0]);
    await page.reload();
    await expect(page.locator(".podium-card")).toHaveCount(2);
    await expect(page.locator(".stats-board").filter({ hasText: "Scene Stealers" }).locator("li").first()).toContainText("Other");

    await click(agencies[1]);
    await page.reload();
    await expect(page.locator(".podium-card")).toHaveCount(3);
  });

  const pages = [
    ["/about", /How public claims work/i],
    ["/stats", /Big links/i],
    ["/leaderboards/most-clicked", /Most Clicked Squares/i],
    ["/leaderboards/founding-squares", /Founding Squares/i],
    ["/leaderboards/newest-claims", /Newest Claims/i],
    ["/leaderboards/largest-territories", /Largest Territories/i],
    ["/squares/138", /WebFX/i],
    ["/profile/webfx.com", /WebFX/i],
    ["/collections/Agencies%2C%20Studios%20%26%20Services", /Agencies, Studios & Services listings/i],
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
    const legacyCategory = await request.get("/collections/agency", { maxRedirects: 0 });
    expect(legacyCategory.status()).toBe(301);
    expect(legacyCategory.headers().location).toBe("http://127.0.0.1:8791/collections/Agencies%2C%20Studios%20%26%20Services");
    for (const path of ["/not-found", "/squares/1000001", "/leaderboards/nope", "/collections/nonsense", "/success"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
      expect(response.headers()["x-robots-tag"], path).toContain("noindex");
    }
  });
});
