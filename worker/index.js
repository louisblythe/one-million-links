import { APPLE_TOUCH_ICON_PNG_BASE64, OG_IMAGE_PNG_BASE64 } from "./generated-assets.js";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import socialFont from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2";

const resvgReady = initWasm(resvgWasm);

const TOTAL_SQUARES = 1_000_000;
const STRIPE_API_VERSION = "2026-07-29.dahlia";
const PUBLIC_HTML_CACHE = "public, max-age=300, s-maxage=600, stale-while-revalidate=86400";
const ASSET_CACHE = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
const VERSIONED_ASSET_CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";
const ASSET_VERSION = "20260822-recurring-funnel-2";
const DATAFAST_WEBSITE_ID = "dfid_covNyYU25Nl5a20HXqsd3";
const DATAFAST_DOMAIN = "linkforadollar.com";
const PIQO_SITE_ID = "zibyj4ic";
const PIQO_DOMAIN = "linkforadollar.com";
const CATEGORIES = ["AI", "SaaS", "Ecommerce", "Agency", "Media", "Developer tools", "Finance", "Local business", "Other"];
const SITEMAP_PAGE_SIZE = 45_000;
const NOINDEX_HEADERS = { "X-Robots-Tag": "noindex, follow" };
const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const canonical = canonicalRedirect(request, env);

    if (canonical) {
      return canonical;
    }

    try {
      if (isRead(request) && url.pathname === "/") {
        return html(homePage(await paidSquares(env), Number(url.searchParams.get("square") || "1"), env), 200, PUBLIC_HTML_CACHE);
      }

      if (isRead(request) && url.pathname === "/api/squares") {
        return json({ squares: await paidSquares(env) }, 200, NOINDEX_HEADERS);
      }

      if (request.method === "POST" && url.pathname === "/api/presence") {
        return json(await recordPresence(request, env), 200, { ...NOINDEX_HEADERS, "Cache-Control": "no-store" });
      }

      if (request.method === "POST" && url.pathname === "/sponsor/checkout") {
        return await createCategorySponsorCheckout(request, env);
      }

      if (isRead(request) && url.pathname === "/sponsor/success") {
        return await categorySponsorSuccess(url, env);
      }

      if (isRead(request) && url.pathname === "/about") {
        return html(aboutPage(env), 200, PUBLIC_HTML_CACHE);
      }

      if (isRead(request) && url.pathname === "/stats") {
        return html(statsPage(await paidSquares(env), env), 200, PUBLIC_HTML_CACHE);
      }

      const leaderboardMatch = url.pathname.match(/^\/leaderboards\/([^/]+)$/);
      if (isRead(request) && leaderboardMatch) {
        const page = leaderboardPage(leaderboardMatch[1], await paidSquares(env), env);

        return page
          ? html(page, 200, PUBLIC_HTML_CACHE)
          : notFoundResponse("That leaderboard does not exist.", env);
      }

      const squareMatch = url.pathname.match(/^\/squares\/(\d+)$/);
      if (isRead(request) && squareMatch) {
        const square = await squareForPublicId(env, Number(squareMatch[1]));

        if (!square) {
          return notFoundResponse("That square has not been claimed yet.", env);
        }

        const related = (await squaresForCategory(env, square.category || "Other")).filter((entry) => Number(entry.square_id) !== Number(square.square_id)).slice(0, 6);
        return html(squarePage(square, related, env), 200, PUBLIC_HTML_CACHE);
      }

      const profileMatch = url.pathname.match(/^\/profile\/([^/]+)$/);
      if (isRead(request) && profileMatch) {
        const requestedHost = decodeURIComponent(profileMatch[1]).toLowerCase();
        const canonicalPath = `/profile/${encodeURIComponent(requestedHost)}`;

        if (url.pathname !== canonicalPath) {
          return redirectResponse(absoluteUrl(env, canonicalPath), 301);
        }

        const profile = await profileForHost(env, requestedHost);

        if (!profile) {
          return notFoundResponse("That profile does not exist yet.", env);
        }

        return html(profilePage(profile, env), 200, PUBLIC_HTML_CACHE);
      }

      const collectionMatch = url.pathname.match(/^\/collections\/([^/]+)$/);
      if (isRead(request) && collectionMatch) {
        const category = categoryFromPath(decodeURIComponent(collectionMatch[1]));

        if (!category) {
          return notFoundResponse("That collection does not exist.", env);
        }

        const canonicalPath = `/collections/${encodeURIComponent(category)}`;
        if (url.pathname !== canonicalPath) {
          return redirectResponse(absoluteUrl(env, canonicalPath), 301);
        }

        const [squares, sponsors] = await Promise.all([
          squaresForCategory(env, category),
          categorySponsors(env, category),
        ]);
        if (squares.length === 0) {
          return notFoundResponse("That collection does not have any claimed squares yet.", env);
        }

        return html(collectionPage(category, squares, sponsors, env), 200, PUBLIC_HTML_CACHE);
      }

      const goMatch = url.pathname.match(/^\/go\/(\d+)$/);
      if (request.method === "GET" && goMatch) {
        return await outboundClick(Number(goMatch[1]) - 1, env);
      }

      if (request.method === "POST" && url.pathname === "/checkout") {
        return await createCheckout(request, env);
      }

      if (isRead(request) && url.pathname === "/success") {
        return await checkoutSuccess(url, env);
      }

      if (request.method === "POST" && url.pathname === "/stripe/webhook") {
        return await stripeWebhook(request, env);
      }

      if (isRead(request) && url.pathname === "/robots.txt") {
        return text(robotsTxt(env), 200, PUBLIC_HTML_CACHE);
      }

      if (isRead(request) && url.pathname === "/sitemap.xml") {
        return xml(await sitemapIndexXml(env), 200, PUBLIC_HTML_CACHE);
      }

      if (isRead(request) && url.pathname === "/sitemaps/core.xml") {
        return xml(await coreSitemapXml(env), 200, PUBLIC_HTML_CACHE);
      }

      const squareSitemapMatch = url.pathname.match(/^\/sitemaps\/squares-(\d+)\.xml$/);
      if (isRead(request) && squareSitemapMatch) {
        const body = await squareSitemapXml(env, Number(squareSitemapMatch[1]));
        return body ? xml(body, 200, PUBLIC_HTML_CACHE) : notFoundResponse("That sitemap shard does not exist.", env);
      }

      const profileSitemapMatch = url.pathname.match(/^\/sitemaps\/profiles-(\d+)\.xml$/);
      if (isRead(request) && profileSitemapMatch) {
        const body = await profileSitemapXml(env, Number(profileSitemapMatch[1]));
        return body ? xml(body, 200, PUBLIC_HTML_CACHE) : notFoundResponse("That sitemap shard does not exist.", env);
      }

      if (isRead(request) && url.pathname === "/rss.xml") {
        return redirectResponse(absoluteUrl(env, "/feed.xml"), 301);
      }

      if (isRead(request) && url.pathname === "/feed.xml") {
        return rss(rssXml(await paidSquares(env), env), 200, PUBLIC_HTML_CACHE, NOINDEX_HEADERS);
      }

      if (isRead(request) && url.pathname === "/recent.json") {
        return redirectResponse(absoluteUrl(env, "/claims.json"), 301);
      }

      if (isRead(request) && url.pathname === "/claims.json") {
        return json(recentClaimsJson(await paidSquares(env), env), 200, NOINDEX_HEADERS);
      }

      if (isRead(request) && url.pathname === "/og-image.png") {
        return binaryImage(ogImagePng(), "image/png");
      }

      if (isRead(request) && url.pathname === "/apple-touch-icon.png") {
        return binaryImage(appleTouchIconPng(), "image/png");
      }

      if (isRead(request) && url.pathname === "/site.webmanifest") {
        return new Response(siteManifest(env), { headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": ASSET_CACHE, ...SECURITY_HEADERS } });
      }

      if (isRead(request) && url.pathname === "/og-image.svg") {
        return new Response(ogImage(), { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": ASSET_CACHE, ...SECURITY_HEADERS } });
      }

      const squareOgPngMatch = url.pathname.match(/^\/og\/squares\/(\d+)\.png$/);
      if (isRead(request) && squareOgPngMatch) {
        const square = await squareForPublicId(env, Number(squareOgPngMatch[1]));
        return square
          ? binaryImage(await renderSocialPng(squareOgImage(square), square.logo_url), "image/png")
          : notFoundResponse("That square image does not exist.", env);
      }

      const squareOgMatch = url.pathname.match(/^\/og\/squares\/(\d+)\.svg$/);
      if (isRead(request) && squareOgMatch) {
        const square = await squareForPublicId(env, Number(squareOgMatch[1]));

        if (!square) {
          return new Response(ogImage(), { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": ASSET_CACHE, ...SECURITY_HEADERS } });
        }

        return new Response(squareOgImage(square), { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": ASSET_CACHE, ...SECURITY_HEADERS } });
      }

      const profileOgMatch = url.pathname.match(/^\/og\/profiles\/([^/]+)\.svg$/);
      if (isRead(request) && profileOgMatch) {
        const profile = await profileForHost(env, decodeURIComponent(profileOgMatch[1]));

        if (!profile) {
          return new Response(ogImage(), { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": ASSET_CACHE, ...SECURITY_HEADERS } });
        }

        return new Response(profileOgImage(profile), { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": ASSET_CACHE, ...SECURITY_HEADERS } });
      }

      const profileOgPngMatch = url.pathname.match(/^\/og\/profiles\/([^/]+)\.png$/);
      if (isRead(request) && profileOgPngMatch) {
        const profile = await profileForHost(env, decodeURIComponent(profileOgPngMatch[1]));
        return profile
          ? binaryImage(await renderSocialPng(profileOgImage(profile), profile.squares?.[0]?.logo_url), "image/png")
          : notFoundResponse("That profile image does not exist.", env);
      }

      if (isRead(request) && url.pathname === "/assets/app.css") {
        return new Response(css(), { headers: { "content-type": "text/css; charset=utf-8", "cache-control": VERSIONED_ASSET_CACHE, ...SECURITY_HEADERS } });
      }

      if (isRead(request) && url.pathname === "/assets/app.js") {
        return new Response(clientJs(), { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": VERSIONED_ASSET_CACHE, ...SECURITY_HEADERS } });
      }

      if (isRead(request) && url.pathname === "/favicon.svg") {
        return new Response(favicon(), { headers: { "content-type": "image/svg+xml", "cache-control": ASSET_CACHE, ...SECURITY_HEADERS } });
      }

      return notFoundResponse("Page not found.", env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";

      if (url.pathname === "/api/squares" || url.pathname === "/stripe/webhook") {
        return json({ error: message }, 400, NOINDEX_HEADERS);
      }

      return html(messagePage(message, env, "Something went wrong"), 500, "no-store", NOINDEX_HEADERS);
    }
  },
};

function isRead(request) {
  return request.method === "GET" || request.method === "HEAD";
}

async function recordPresence(request, env) {
  const body = await request.json().catch(() => ({}));
  const sessionId = String(body.session_id || "");
  if (!/^[a-f0-9-]{36}$/i.test(sessionId)) {
    throw new Error("A valid presence session is required.");
  }

  const now = new Date().toISOString();
  const nowSql = now.slice(0, 19).replace("T", " ");
  await env.DB.prepare(
    "INSERT INTO visitor_presence (session_id, first_seen, last_seen) VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET last_seen = excluded.last_seen",
  ).bind(sessionId, nowSql, nowSql).run();
  await env.DB.prepare("DELETE FROM visitor_presence WHERE last_seen < datetime('now', '-2 days')").run();
  const row = await env.DB.prepare(
    "SELECT SUM(CASE WHEN last_seen >= datetime('now', '-5 minutes') THEN 1 ELSE 0 END) AS active_now, SUM(CASE WHEN last_seen >= datetime('now', '-24 hours') THEN 1 ELSE 0 END) AS sessions_24h FROM visitor_presence",
  ).first();

  return { active_now: Number(row?.active_now || 0), sessions_24h: Number(row?.sessions_24h || 0), measured_at: now };
}

async function paidSquares(env) {
  const { results } = await env.DB.prepare(
    "SELECT square_id, label, description, url, owner_host, category, click_count, verified_company, territory_key, territory_size, featured_from, featured_until, featured_amount_cents, purchase_city, purchase_country, purchase_latitude, purchase_longitude, location_source, logo_url, paid_at FROM squares WHERE status = 'paid' ORDER BY square_id ASC",
  ).all();

  return results || [];
}

async function squaresForCategory(env, category) {
  const { results } = await env.DB.prepare(
    "SELECT square_id, label, description, url, owner_host, category, click_count, verified_company, territory_key, territory_size, featured_from, featured_until, featured_amount_cents, purchase_city, purchase_country, purchase_latitude, purchase_longitude, location_source, logo_url, paid_at FROM squares WHERE status = 'paid' AND category = ? ORDER BY click_count DESC, square_id ASC LIMIT 50",
  ).bind(category).all();

  return results || [];
}

async function categorySponsors(env, category) {
  const { results } = await env.DB.prepare(
    `SELECT category, url, label, amount_cents, active_until
      FROM category_sponsorships
      WHERE category = ? AND active_until > datetime('now')
      ORDER BY amount_cents DESC, updated_at ASC
      LIMIT 10`,
  ).bind(category).all();

  return results || [];
}

async function categorySponsorContext(env, category, url) {
  const [listing, existing, highest] = await Promise.all([
    env.DB.prepare("SELECT label FROM squares WHERE status = 'paid' AND category = ? AND url = ? LIMIT 1").bind(category, url).first(),
    env.DB.prepare("SELECT amount_cents FROM category_sponsorships WHERE category = ? AND url = ? LIMIT 1").bind(category, url).first(),
    env.DB.prepare("SELECT COALESCE(MAX(amount_cents), 0) AS amount FROM category_sponsorships WHERE category = ? AND active_until > datetime('now')").bind(category).first(),
  ]);

  if (!listing) throw new Error("Choose a paid listing from this category.");
  return {
    label: String(listing.label),
    previousCents: Number(existing?.amount_cents || 0),
    highestCents: Number(highest?.amount || 0),
  };
}

async function squareForPublicId(env, publicId) {
  if (!Number.isInteger(publicId) || publicId < 1 || publicId > TOTAL_SQUARES) {
    return null;
  }

  return await env.DB.prepare(
    "SELECT square_id, label, description, url, owner_host, category, click_count, verified_company, territory_key, territory_size, featured_from, featured_until, featured_amount_cents, purchase_city, purchase_country, purchase_latitude, purchase_longitude, location_source, logo_url, paid_at FROM squares WHERE status = 'paid' AND square_id = ?",
  ).bind(publicId - 1).first();
}

async function profileForHost(env, host) {
  const normalizedHost = host.toLowerCase();
  const { results } = await env.DB.prepare(
    "SELECT square_id, label, description, url, owner_host, category, click_count, verified_company, territory_key, territory_size, featured_from, featured_until, featured_amount_cents, purchase_city, purchase_country, purchase_latitude, purchase_longitude, location_source, logo_url, paid_at FROM squares WHERE status = 'paid' AND owner_host = ? ORDER BY square_id ASC",
  ).bind(normalizedHost).all();
  const squares = results || [];

  if (squares.length === 0) {
    return null;
  }

  const territories = new Set();
  const clickCount = squares.reduce((total, square) => total + Number(square.click_count || 0), 0);
  for (const square of squares) {
    territories.add(square.territory_key || `single:${square.square_id}`);
  }

  return {
    host: normalizedHost,
    label: squares[0].label,
    description: squares[0].description || "",
    url: squares[0].url,
    category: squares[0].category,
    verified_company: Boolean(Number(squares[0].verified_company || 0)),
    square_count: squares.length,
    territory_count: territories.size,
    click_count: clickCount,
    first_square: Number(squares[0].square_id) + 1,
    squares: squares.sort((a, b) => Number(a.square_id) - Number(b.square_id)),
  };
}

async function outboundClick(squareId, env) {
  const square = await env.DB.prepare(
    "SELECT square_id, url FROM squares WHERE square_id = ? AND status = 'paid'",
  ).bind(validateSquareId(squareId)).first();

  if (!square) {
    throw new Error("That square has not been claimed yet.");
  }

  await env.DB.prepare(
    "UPDATE squares SET click_count = COALESCE(click_count, 0) + 1 WHERE square_id = ? AND status = 'paid'",
  ).bind(squareId).run();

  return new Response(null, {
    status: 302,
    headers: {
      Location: square.url,
      "X-Robots-Tag": "noindex, nofollow",
      ...SECURITY_HEADERS,
    },
  });
}

async function createCheckout(request, env) {
  assertStripeSecret(env);

  const form = await request.formData();
  const label = normalizeLabel(String(form.get("label") || ""));
  const description = normalizeDescription(String(form.get("description") || ""));
  const linkUrl = normalizeUrl(String(form.get("url") || ""));
  const logoUrl = normalizeOptionalUrl(String(form.get("logo_url") || ""));
  const category = normalizeCategory(String(form.get("category") || "Other"));
  const promotionType = String(form.get("promotion_type") || "bid") === "monthly" ? "monthly" : "bid";
  const email = normalizeEmail(String(form.get("email") || ""));
  const rebid = await rebidContext(env, linkUrl);
  const previousBid = Math.floor(rebid.previousCents / 100);
  const highestBid = Math.floor(rebid.highestCents / 100);
  const minimumBid = Math.max(1, highestBid + 1, previousBid + 1);
  const monthlyAmount = promotionType === "monthly"
    ? normalizePaymentLevel(Number(form.get("payment_level") || 30), 1)
    : 0;
  const paymentLevel = promotionType === "monthly"
    ? previousBid + monthlyAmount
    : normalizePaymentLevel(Number(form.get("payment_level") || minimumBid), minimumBid);
  const amountDue = promotionType === "monthly" ? monthlyAmount : paymentLevel - previousBid;
  const featuredDays = promotionType === "monthly" ? 30 : amountDue;
  const purchaseLocation = await listingLocationFromRequest(request, String(form.get("country") || ""));
  const isNewListing = rebid.squareIds.length === 0;
  const squareIds = rebid.squareIds.length
    ? rebid.squareIds
    : [await reserveNextListing(env, label, description, linkUrl, category, email, logoUrl)];
  const primarySquareId = squareIds[0];

  const body = new URLSearchParams();
  body.set("mode", promotionType === "monthly" ? "subscription" : "payment");
  body.set("client_reference_id", String(primarySquareId));
  body.set("success_url", `${appUrl(env)}/success?session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${appUrl(env)}/?cancelled=1`);
  body.set("integration_identifier", `featured_placement_${randomLetters(8)}`);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", String(env.APP_CURRENCY || "usd").toLowerCase());
  body.set("line_items[0][price_data][unit_amount]", String(amountDue * 100));
  body.set("line_items[0][price_data][product]", env.STRIPE_PRODUCT_ID || "prod_Uam47pbENlHbmX");
  if (promotionType === "monthly") body.set("line_items[0][price_data][recurring][interval]", "month");
  body.set("metadata[square_id]", String(primarySquareId));
  body.set("metadata[label]", label);
  if (description) body.set("metadata[description]", description);
  body.set("metadata[url]", linkUrl);
  if (logoUrl) body.set("metadata[logo_url]", logoUrl);
  body.set("metadata[category]", category);
  body.set("metadata[square_ids]", squareIds.join(","));
  body.set("metadata[promotion_type]", promotionType);
  body.set("metadata[payment_level]", String(paymentLevel));
  body.set("metadata[previous_bid]", String(previousBid));
  body.set("metadata[amount_due]", String(amountDue));
  body.set("metadata[featured_days]", String(featuredDays));
  body.set("metadata[total_bid_cents]", String(paymentLevel * 100));
  if (promotionType === "monthly") {
    body.set("metadata[monthly_amount_cents]", String(monthlyAmount * 100));
    body.set("subscription_data[metadata][square_id]", String(primarySquareId));
    body.set("subscription_data[metadata][monthly_amount_cents]", String(monthlyAmount * 100));
    body.set("subscription_data[metadata][promotion_type]", "monthly");
  }
  const piqoVisitorId = piqoCookieValue(request, "piqo_visitor");
  const piqoSessionId = piqoCookieValue(request, "piqo_session");
  if (piqoVisitorId) {
    body.set("metadata[piqo_visitor_id]", piqoVisitorId);
    if (promotionType === "bid") {
      body.set("payment_intent_data[metadata][piqo_visitor_id]", piqoVisitorId);
    }
  }
  if (piqoSessionId) body.set("metadata[piqo_session_id]", piqoSessionId);
  if (purchaseLocation) {
    body.set("metadata[purchase_city]", purchaseLocation.city);
    body.set("metadata[purchase_country]", purchaseLocation.country);
    body.set("metadata[purchase_latitude]", String(purchaseLocation.latitude));
    body.set("metadata[purchase_longitude]", String(purchaseLocation.longitude));
    body.set("metadata[location_source]", purchaseLocation.source);
  }

  if (email) {
    body.set("customer_email", email);
  }

  if (env.E2E_TEST_MODE === "true") {
    return redirectResponse(`${appUrl(env)}/success?session_id=e2e_${primarySquareId}_${amountDue}_${paymentLevel}`, 303);
  }

  let response;
  let session;
  try {
    response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "content-type": "application/x-www-form-urlencoded",
        "stripe-version": STRIPE_API_VERSION,
      },
      body,
    });
    session = await response.json();
  } catch (error) {
    if (isNewListing) await releasePendingListing(env, primarySquareId);
    throw error;
  }

  if (!response.ok || !session.url) {
    if (isNewListing) await releasePendingListing(env, primarySquareId);
    throw new Error(session.error?.message || "Stripe checkout session could not be created.");
  }

  return Response.redirect(session.url, 303);
}

async function createCategorySponsorCheckout(request, env) {
  assertStripeSecret(env);
  const form = await request.formData();
  const category = normalizeCategory(String(form.get("category") || ""));
  const linkUrl = normalizeUrl(String(form.get("url") || ""));
  const email = normalizeEmail(String(form.get("email") || ""));
  const context = await categorySponsorContext(env, category, linkUrl);
  const previousBid = Math.floor(context.previousCents / 100);
  const highestBid = Math.floor(context.highestCents / 100);
  const minimumBid = Math.max(10, highestBid + 1, previousBid + 1);
  const paymentLevel = normalizePaymentLevel(Number(form.get("sponsor_bid") || minimumBid), minimumBid);
  const amountDue = paymentLevel - previousBid;
  const body = new URLSearchParams();

  body.set("mode", "payment");
  body.set("success_url", `${appUrl(env)}/sponsor/success?session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${appUrl(env)}/collections/${encodeURIComponent(category)}?sponsor_cancelled=1`);
  body.set("integration_identifier", `category_sponsor_${randomLetters(8)}`);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", String(env.APP_CURRENCY || "usd").toLowerCase());
  body.set("line_items[0][price_data][unit_amount]", String(amountDue * 100));
  body.set("line_items[0][price_data][product]", env.STRIPE_PRODUCT_ID || "prod_Uam47pbENlHbmX");
  body.set("metadata[purchase_type]", "category_sponsor");
  body.set("metadata[category]", category);
  body.set("metadata[url]", linkUrl);
  body.set("metadata[label]", context.label);
  body.set("metadata[amount_due_cents]", String(amountDue * 100));
  body.set("metadata[total_bid_cents]", String(paymentLevel * 100));
  if (email) body.set("customer_email", email);

  if (env.E2E_TEST_MODE === "true") {
    const sessionId = `e2e_sponsor_${randomLetters(12)}`;
    await markCategorySponsorPaid(env, { id: sessionId }, {
      category,
      url: linkUrl,
      label: context.label,
      amountDueCents: amountDue * 100,
      totalBidCents: paymentLevel * 100,
    });
    return redirectResponse(`${appUrl(env)}/collections/${encodeURIComponent(category)}?sponsored=1`, 303);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": STRIPE_API_VERSION,
    },
    body,
  });
  const session = await response.json();
  if (!response.ok || !session.url) throw new Error(session.error?.message || "Sponsor checkout session could not be created.");
  return Response.redirect(session.url, 303);
}

async function categorySponsorSuccess(url, env) {
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) return notFoundResponse("That sponsorship confirmation does not exist.", env);
  assertStripeSecret(env);
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "stripe-version": STRIPE_API_VERSION },
  });
  const session = await response.json();
  if (!response.ok || session.payment_status !== "paid" || session.metadata?.purchase_type !== "category_sponsor") {
    return html(messagePage("The sponsorship payment has not been confirmed.", env, "Payment not confirmed"), 400, "no-store", NOINDEX_HEADERS);
  }
  await markCategorySponsorPaid(env, session);
  const category = normalizeCategory(String(session.metadata.category));
  return redirectResponse(absoluteUrl(env, `/collections/${encodeURIComponent(category)}?sponsored=1`), 303);
}

async function markCategorySponsorPaid(env, session, values = null) {
  const category = values?.category || normalizeCategory(String(session.metadata?.category || ""));
  const url = values?.url || normalizeUrl(String(session.metadata?.url || ""));
  const label = values?.label || normalizeLabel(String(session.metadata?.label || ""));
  const amountDueCents = Number(values?.amountDueCents ?? session.metadata?.amount_due_cents);
  const totalBidCents = Number(values?.totalBidCents ?? session.metadata?.total_bid_cents);
  if (!session.id || !Number.isInteger(amountDueCents) || amountDueCents < 100 || !Number.isInteger(totalBidCents) || totalBidCents < 1000) {
    throw new Error("Category sponsorship metadata is invalid.");
  }
  const now = new Date().toISOString();
  const payment = await env.DB.prepare(
    `INSERT OR IGNORE INTO category_sponsor_payments
      (checkout_session_id, category, url, amount_cents, total_bid_cents, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(session.id, category, url, amountDueCents, totalBidCents, now).run();
  if (!Number(payment.meta?.changes || 0)) return;
  await env.DB.prepare(
    `INSERT INTO category_sponsorships
      (category, url, label, amount_cents, active_until, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime(?, '+30 days'), ?, ?)
      ON CONFLICT(category, url) DO UPDATE SET
        label = excluded.label,
        amount_cents = excluded.amount_cents,
        active_until = datetime(max(unixepoch(?), unixepoch(category_sponsorships.active_until)), 'unixepoch', '+30 days'),
        updated_at = excluded.updated_at`,
  ).bind(category, url, label, totalBidCents, now, now, now, now).run();
}

async function checkoutSuccess(url, env) {
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return notFoundResponse("That checkout confirmation does not exist.", env);
  }

  if (env.E2E_TEST_MODE === "true" && /^e2e_\d+_\d+_\d+$/.test(sessionId)) {
    const [, primaryIdValue, featuredDaysValue, paymentLevelValue] = sessionId.split("_");
    const primaryId = validateSquareId(Number(primaryIdValue));
    const primary = await env.DB.prepare("SELECT territory_key FROM squares WHERE square_id = ? AND status = 'pending'").bind(primaryId).first();
    if (!primary) {
      return notFoundResponse("That checkout confirmation does not exist.", env);
    }
    const rows = primary.territory_key
      ? await env.DB.prepare("SELECT square_id FROM squares WHERE territory_key = ? AND status = 'pending' ORDER BY square_id").bind(primary.territory_key).all()
      : { results: [{ square_id: primaryId }] };
    const squareIds = (rows.results || []).map((row) => Number(row.square_id));
    await markSquaresPaid(env, squareIds, sessionId, "e2e_payment", Number(featuredDaysValue), Number(paymentLevelValue) * 100);
    const claimedSquares = (await paidSquares(env)).filter((square) => squareIds.includes(Number(square.square_id)));
    return html(successPage(claimedSquares, env, {
      id: sessionId,
      amountTotal: Number(paymentLevelValue) * 100,
      currency: String(env.APP_CURRENCY || "usd").toLowerCase(),
    }), 200, "no-store", NOINDEX_HEADERS);
  }

  assertStripeSecret(env);
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "stripe-version": STRIPE_API_VERSION,
    },
  });
  const session = await response.json();

  if (!response.ok || session.payment_status !== "paid") {
    return html(messagePage("The payment has not been confirmed.", env, "Payment not confirmed"), 400, "no-store", NOINDEX_HEADERS);
  }

  const claimedSquareIds = metadataSquareIds(session);
  await markSquaresPaid(env, claimedSquareIds, session.id, session.payment_intent || null, metadataFeaturedDays(session), metadataTotalBidCents(session), metadataPurchaseLocation(session), metadataLogoUrl(session));

  const claimedSquares = claimedSquareIds.length
    ? (await paidSquares(env)).filter((square) => claimedSquareIds.includes(Number(square.square_id)))
    : [];

  return html(successPage(claimedSquares, env, {
    id: session.id,
    amountTotal: Number(session.amount_total || metadataTotalBidCents(session)),
    currency: String(session.currency || env.APP_CURRENCY || "usd").toLowerCase(),
  }), 200, "no-store", NOINDEX_HEADERS);
}

async function stripeWebhook(request, env) {
  assertStripeSecret(env);

  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Set STRIPE_WEBHOOK_SECRET before accepting webhooks.");
  }

  const signature = request.headers.get("stripe-signature") || "";
  const payload = await request.text();

  if (!(await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: "Invalid Stripe signature." }, 400);
  }

  const event = JSON.parse(payload);

  if (event.type === "checkout.session.completed" && event.data?.object?.payment_status === "paid") {
    const session = event.data.object;
    if (session.metadata?.purchase_type === "category_sponsor") {
      await markCategorySponsorPaid(env, session);
    } else {
      await markSquaresPaid(env, metadataSquareIds(session), session.id, session.payment_intent || null, metadataFeaturedDays(session), metadataTotalBidCents(session), metadataPurchaseLocation(session), metadataLogoUrl(session));
    }
  }

  if (event.type === "invoice.paid" && event.data?.object?.billing_reason !== "subscription_create") {
    await applyRecurringInvoice(env, event.data.object);
  }

  return json({ received: true });
}

async function applyRecurringInvoice(env, invoice) {
  const metadata = invoice.parent?.subscription_details?.metadata || {};
  if (metadata.promotion_type !== "monthly") return;
  const squareId = validateSquareId(Number(metadata.square_id));
  const monthlyAmountCents = Number(metadata.monthly_amount_cents);
  if (!invoice.id || !Number.isInteger(monthlyAmountCents) || monthlyAmountCents < 100 || monthlyAmountCents > 1_000_000) {
    throw new Error("Recurring rank invoice metadata is invalid.");
  }

  const listing = await env.DB.prepare("SELECT featured_amount_cents FROM squares WHERE square_id = ? AND status = 'paid'").bind(squareId).first();
  if (!listing) throw new Error("Recurring rank listing does not exist.");
  const paidAt = new Date().toISOString();
  const nextTotalBidCents = Number(listing.featured_amount_cents || 0) + monthlyAmountCents;
  const payment = await env.DB.prepare(
    `INSERT OR IGNORE INTO featured_payments (checkout_session_id, square_id, amount_cents, total_bid_cents, created_at)
      VALUES (?, ?, ?, ?, ?)`,
  ).bind(`invoice:${invoice.id}`, squareId, monthlyAmountCents, nextTotalBidCents, paidAt).run();
  if (!Number(payment.meta?.changes || 0)) return;

  await env.DB.prepare(
    `UPDATE squares
      SET featured_from = ?,
          featured_until = strftime('%Y-%m-%dT%H:%M:%fZ', max(unixepoch(?), COALESCE(unixepoch(featured_until), 0)), 'unixepoch', '+30 days'),
          featured_amount_cents = ?
      WHERE square_id = ?`,
  ).bind(paidAt, paidAt, nextTotalBidCents, squareId).run();
}

async function rebidContext(env, url) {
  const primary = await env.DB.prepare(
    `SELECT square_id, territory_key, featured_amount_cents FROM squares
      WHERE status = 'paid' AND url = ?
      ORDER BY featured_amount_cents DESC, square_id ASC LIMIT 1`,
  ).bind(url).first();
  const highest = await env.DB.prepare(
    `SELECT COALESCE(MAX(featured_amount_cents), 0) AS amount FROM squares
      WHERE status = 'paid' AND featured_until > ?`,
  ).bind(new Date().toISOString()).first();

  if (!primary) {
    return { squareIds: [], previousCents: 0, highestCents: Number(highest?.amount || 0) };
  }

  const territoryRows = primary.territory_key
    ? await env.DB.prepare(
        "SELECT square_id FROM squares WHERE status = 'paid' AND territory_key = ? ORDER BY square_id ASC",
      ).bind(primary.territory_key).all()
    : { results: [{ square_id: primary.square_id }] };

  return {
    squareIds: (territoryRows.results || []).map((row) => Number(row.square_id)),
    previousCents: Number(primary.featured_amount_cents || 0),
    highestCents: Number(highest?.amount || 0),
  };
}

async function reserveSquares(env, squareId, packSize, label, description, url, category, email, logoUrl = null) {
  const squareIds = adjacentSquareIds(squareId, packSize);
  const placeholders = squareIds.map(() => "?").join(",");
  const existing = await env.DB.prepare(`SELECT square_id FROM squares WHERE status = 'paid' AND square_id IN (${placeholders})`).bind(...squareIds).first();

  if (existing) {
    throw new Error("That listing position is no longer available.");
  }

  const territoryKey = crypto.randomUUID();
  const verifiedCompany = companyIsVerified(url, email) ? 1 : 0;
  const ownerHost = hostFromUrl(url);
  const createdAt = new Date().toISOString();
  const statement = env.DB.prepare(
    `INSERT INTO squares (square_id, label, description, url, owner_host, category, owner_email, verified_company, territory_key, territory_size, logo_url, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      ON CONFLICT(square_id) DO UPDATE SET
        label = excluded.label,
        description = excluded.description,
        url = excluded.url,
        owner_host = excluded.owner_host,
        category = excluded.category,
        owner_email = excluded.owner_email,
        verified_company = excluded.verified_company,
        territory_key = excluded.territory_key,
        territory_size = excluded.territory_size,
        logo_url = excluded.logo_url,
        status = 'pending',
        created_at = excluded.created_at`,
  );

  await env.DB.batch(squareIds.map((id) => statement.bind(id, label, description || null, url, ownerHost, category, email, verifiedCompany, territoryKey, squareIds.length, logoUrl, createdAt)));

  return squareIds;
}

async function reserveNextListing(env, label, description, url, category, email, logoUrl = null) {
  const row = await env.DB.prepare(
    `WITH RECURSIVE candidate(square_id) AS (
      SELECT 0
      UNION ALL
      SELECT square_id + 1 FROM candidate WHERE square_id < ${TOTAL_SQUARES - 1}
    )
    SELECT candidate.square_id FROM candidate
    LEFT JOIN squares ON squares.square_id = candidate.square_id
    WHERE squares.square_id IS NULL
    LIMIT 1`,
  ).first();
  const squareId = Number(row?.square_id);

  if (!Number.isInteger(squareId)) {
    throw new Error("The listing directory is full.");
  }

  const [reservedId] = await reserveSquares(env, squareId, 1, label, description, url, category, email, logoUrl);
  return reservedId;
}

async function releasePendingListing(env, squareId) {
  await env.DB.prepare("DELETE FROM squares WHERE square_id = ? AND status = 'pending'").bind(validateSquareId(squareId)).run();
}

async function markSquaresPaid(env, squareIds, checkoutSessionId, paymentIntentId, featuredDays = 0, totalBidCents = 0, purchaseLocation = null, logoUrl = null) {
  const paidAt = new Date().toISOString();
  const statement = env.DB.prepare(
    `UPDATE squares
      SET status = 'paid',
          checkout_session_id = ?,
          payment_intent_id = ?,
          paid_at = COALESCE(paid_at, ?)
      WHERE square_id = ?`,
  );

  await env.DB.batch(squareIds.map((squareId) => {
    const id = validateSquareId(squareId);
    const storedCheckoutSessionId = squareIds.length > 1 ? `${checkoutSessionId}:${id}` : checkoutSessionId;

    return statement.bind(storedCheckoutSessionId, paymentIntentId, paidAt, id);
  }));

  if (logoUrl && squareIds.length > 0) {
    await env.DB.prepare("UPDATE squares SET logo_url = ? WHERE square_id = ?").bind(logoUrl, validateSquareId(squareIds[0])).run();
  }

  if (purchaseLocation && squareIds.length > 0) {
    await env.DB.prepare(
      `UPDATE squares SET
        purchase_city = ?,
        purchase_country = ?,
        purchase_latitude = ?,
        purchase_longitude = ?,
        location_source = ?
      WHERE square_id = ?`,
    ).bind(purchaseLocation.city, purchaseLocation.country, purchaseLocation.latitude, purchaseLocation.longitude, purchaseLocation.source || "country_centroid", validateSquareId(squareIds[0])).run();
  }

  if (featuredDays > 0 && squareIds.length > 0) {
    const primaryId = validateSquareId(squareIds[0]);
    const payment = await env.DB.prepare(
      `INSERT OR IGNORE INTO featured_payments (checkout_session_id, square_id, amount_cents, total_bid_cents, created_at)
        VALUES (?, ?, ?, ?, ?)`,
    ).bind(checkoutSessionId, primaryId, featuredDays * 100, totalBidCents, paidAt).run();

    if (!Number(payment.meta?.changes || 0)) {
      return;
    }

    const schedule = env.DB.prepare(
      `UPDATE squares
        SET featured_from = ?,
            featured_until = strftime('%Y-%m-%dT%H:%M:%fZ', max(unixepoch(?), COALESCE(unixepoch(featured_until), 0)), 'unixepoch', '+' || ? || ' days'),
            featured_amount_cents = max(COALESCE(featured_amount_cents, 0), ?)
        WHERE square_id = ?`,
    );

    await schedule.bind(paidAt, paidAt, featuredDays, Math.max(totalBidCents, featuredDays * 100), primaryId).run();
  }
}

async function markSquarePaid(env, squareId, checkoutSessionId, paymentIntentId) {
  await markSquaresPaid(env, [squareId], checkoutSessionId, paymentIntentId);
}

function validateSquareId(squareId) {
  if (!Number.isInteger(squareId) || squareId < 0 || squareId >= TOTAL_SQUARES) {
    throw new Error("Choose a square between 1 and 1,000,000.");
  }

  return squareId;
}

function normalizeLabel(label) {
  const value = label.trim().slice(0, 80);

  if (!value) {
    throw new Error("Enter a label for the link.");
  }

  return value;
}

function normalizeDescription(description) {
  return description.trim().slice(0, 180);
}

function normalizeCategory(category) {
  const value = category.trim();

  return CATEGORIES.includes(value) ? value : "Other";
}

function categoryFromPath(value) {
  const normalized = value.trim().replace(/-/g, " ").replace(/\s+/g, " ").toLowerCase();
  return CATEGORIES.find((category) => category.toLowerCase() === normalized) || null;
}

function normalizePackSize(packSize) {
  return [1, 4, 10, 25].includes(packSize) ? packSize : 1;
}

function normalizePaymentLevel(paymentLevel, minimum) {
  if (!Number.isInteger(paymentLevel) || paymentLevel < minimum || paymentLevel > 10000) {
    throw new Error(`Choose a whole-dollar payment level between $${minimum} and $10,000.`);
  }

  return paymentLevel;
}

function adjacentSquareIds(squareId, packSize) {
  const width = packSize === 1 ? 1 : Math.ceil(Math.sqrt(packSize));
  const height = Math.ceil(packSize / width);
  const startX = Math.min(squareId % 1000, 1000 - width);
  const startY = Math.min(Math.floor(squareId / 1000), 1000 - height);
  const ids = [];

  for (let y = 0; y < height && ids.length < packSize; y += 1) {
    for (let x = 0; x < width && ids.length < packSize; x += 1) {
      ids.push((startY + y) * 1000 + startX + x);
    }
  }

  return ids;
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function companyIsVerified(url, email) {
  if (!email) {
    return false;
  }

  const emailDomain = email.split("@").pop().toLowerCase();
  const host = hostFromUrl(url);

  return emailDomain && (host === emailDomain || host.endsWith(`.${emailDomain}`));
}

function metadataSquareIds(session) {
  const squareIds = session.metadata?.square_ids;

  if (squareIds) {
    return String(squareIds).split(",").map((id) => Number(id));
  }

  return [Number(session.client_reference_id)];
}

function metadataFeaturedDays(session) {
  const value = Number(session.metadata?.featured_days || 0);
  return Number.isInteger(value) && value >= 1 && value <= 10000 ? value : 0;
}

function metadataTotalBidCents(session) {
  const value = Number(session.metadata?.total_bid_cents || 0);
  return Number.isInteger(value) && value >= 100 ? value : metadataFeaturedDays(session) * 100;
}

function purchaseLocationFromRequest(request) {
  const latitude = Number(request.cf?.latitude);
  const longitude = Number(request.cf?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return {
    city: String(request.cf?.city || "").slice(0, 80),
    country: String(request.cf?.country || "").slice(0, 2).toUpperCase(),
    latitude: Math.round(latitude * 100) / 100,
    longitude: Math.round(longitude * 100) / 100,
    source: "checkout",
  };
}

async function listingLocationFromRequest(request, countryInput) {
  const country = countryInput.trim().slice(0, 80);
  if (!country) return purchaseLocationFromRequest(request);

  const endpoint = `https://nominatim.openstreetmap.org/search?country=${encodeURIComponent(country)}&format=jsonv2&limit=1&featuretype=country&addressdetails=1`;

  try {
    const response = await fetch(endpoint, {
      headers: { "user-agent": "LinkForADollar/1.0 (https://linkforadollar.com)", "accept-language": "en" },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error("Country lookup failed");
    const payload = await response.json();
    const result = payload?.[0];
    const latitude = Number(result?.lat);
    const longitude = Number(result?.lon);
    const countryCode = String(result?.address?.country_code || (/^[a-z]{2}$/i.test(country) ? country : "")).toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Country lookup failed");
    return {
      city: String(result.name || result.display_name || country).slice(0, 80),
      country: countryCode,
      latitude,
      longitude,
      source: "country_centroid",
    };
  } catch {
    throw new Error("We could not find that country. Enter its full English name or two-letter country code.");
  }
}

function metadataPurchaseLocation(session) {
  const latitude = Number(session.metadata?.purchase_latitude);
  const longitude = Number(session.metadata?.purchase_longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return {
    city: String(session.metadata?.purchase_city || "").slice(0, 80),
    country: String(session.metadata?.purchase_country || "").slice(0, 2).toUpperCase(),
    latitude,
    longitude,
    source: String(session.metadata?.location_source || "checkout").slice(0, 40),
  };
}

function randomLetters(length) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function normalizeUrl(url) {
  const value = url.trim();
  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const parsed = new URL(normalized);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid protocol.");
    }

    return parsed.toString();
  } catch {
    throw new Error("Enter a valid URL.");
  }
}

function normalizeOptionalUrl(url) {
  const value = url.trim();
  if (!value) return null;
  const normalized = normalizeUrl(value);
  return normalized.slice(0, 500);
}

function metadataLogoUrl(session) {
  return normalizeOptionalUrl(String(session.metadata?.logo_url || ""));
}

function normalizeEmail(email) {
  const value = email.trim();

  if (!value) {
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("Enter a valid email receipt address.");
  }

  return value;
}

function piqoCookieValue(request, name) {
  const cookieHeader = request.headers.get("cookie") || "";

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;

    const encodedValue = part.slice(separator + 1).trim();
    let value;
    try {
      value = decodeURIComponent(encodedValue);
    } catch {
      return null;
    }

    return /^[A-Za-z0-9._~-]{1,128}$/.test(value) ? value : null;
  }

  return null;
}

function assertStripeSecret(env) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Set STRIPE_SECRET_KEY before creating a checkout session.");
  }
}

function appUrl(env) {
  return String(env.APP_URL || "https://linkforadollar.com").replace(/\/+$/, "");
}

async function verifyStripeSignature(payload, signature, secret) {
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.split("=", 2);
      return [key, value];
    }),
  );

  if (!parts.t || !parts.v1) {
    return false;
  }

  const data = new TextEncoder().encode(`${parts.t}.${payload}`);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, data);
  const expected = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return timingSafeEqual(expected, parts.v1);
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

function html(body, status = 200, cacheControl = "no-store", extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cacheControl,
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, { status, headers: { ...SECURITY_HEADERS, ...extraHeaders } });
}

function text(body, status = 200, cacheControl = "no-store") {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": cacheControl,
      ...SECURITY_HEADERS,
    },
  });
}

function xml(body, status = 200, cacheControl = "no-store") {
  return new Response(body, {
    status,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": cacheControl,
      ...SECURITY_HEADERS,
    },
  });
}

function rss(body, status = 200, cacheControl = "no-store", extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": cacheControl,
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

function base64ToBytes(value) {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function binaryImage(bytes, contentType) {
  return new Response(bytes, {
    headers: {
      "content-type": contentType,
      "cache-control": ASSET_CACHE,
      ...SECURITY_HEADERS,
    },
  });
}

function ogImagePng() {
  return base64ToBytes(OG_IMAGE_PNG_BASE64);
}

function appleTouchIconPng() {
  return base64ToBytes(APPLE_TOUCH_ICON_PNG_BASE64);
}

function siteManifest() {
  return JSON.stringify({
    name: "Link for a Dollar",
    short_name: "Link for a Dollar",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#0b6bcb",
    icons: [
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  });
}

function redirectResponse(location, status = 301) {
  return new Response(null, { status, headers: { Location: location, ...SECURITY_HEADERS } });
}

function canonicalRedirect(request, env) {
  if (!isRead(request)) {
    return null;
  }

  const current = new URL(request.url);
  const preferred = new URL(appUrl(env));
  const host = (request.headers.get("host") || current.host).split(":")[0];

  const hasTrailingSlash = current.pathname.length > 1 && current.pathname.endsWith("/");
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  const isLocalHost = localHosts.has(host) || localHosts.has(current.hostname) || localHosts.has(preferred.hostname);
  if (isLocalHost) {
    if (hasTrailingSlash) {
      current.pathname = current.pathname.replace(/\/+$/, "");
      return redirectResponse(current.toString(), 301);
    }
    return null;
  }
  if (host !== preferred.hostname || current.protocol !== preferred.protocol || hasTrailingSlash) {
    current.hostname = preferred.hostname;
    current.protocol = preferred.protocol;
    current.port = preferred.port;
    if (hasTrailingSlash) {
      current.pathname = current.pathname.replace(/\/+$/, "");
    }
    return redirectResponse(current.toString(), 301);
  }

  return null;
}

function pageHead({ title, description, path = "/", env, type = "website", imagePath = "/og-image.png", imageAlt = title, jsonLd = null, robots = "index, follow, max-image-preview:large" }) {
  const canonical = path ? absoluteUrl(env, path) : null;
  const image = absoluteUrl(env, imagePath);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = canonical ? escapeHtml(canonical) : null;

  return `<title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}">
    <meta name="robots" content="${escapeHtml(robots)}">
    ${safeCanonical ? `<link rel="canonical" href="${safeCanonical}">` : ""}
    <meta property="og:type" content="${escapeHtml(type)}">
    <meta property="og:site_name" content="Link for a Dollar">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    ${safeCanonical ? `<meta property="og:url" content="${safeCanonical}">` : ""}
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDescription}">
    <meta name="twitter:image" content="${escapeHtml(image)}">
    <meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}">
    <meta name="theme-color" content="#0b6bcb">
    <link rel="alternate" type="application/rss+xml" title="Recent Link for a Dollar claims" href="${escapeHtml(absoluteUrl(env, "/feed.xml"))}">
    <link rel="alternate" type="application/json" title="Recent Link for a Dollar claims" href="${escapeHtml(absoluteUrl(env, "/claims.json"))}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="stylesheet" href="/assets/app.css?v=${ASSET_VERSION}">
    ${datafastAnalyticsScript()}
    ${piqoAnalyticsScript()}${jsonLd ? `
    <script type="application/ld+json">${jsonLdScript(jsonLd)}</script>` : ""}`;
}

function datafastAnalyticsScript() {
  return `<script defer data-website-id="${DATAFAST_WEBSITE_ID}" data-domain="${DATAFAST_DOMAIN}" src="https://datafa.st/js/script.js"></script>`;
}

function piqoAnalyticsScript() {
  return `<script defer data-site="${PIQO_SITE_ID}" data-domain="${PIQO_DOMAIN}" src="https://piqo.app/piqo.js"></script>`;
}

function jsonLdScript(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function absoluteUrl(env, path) {
  return `${appUrl(env)}${path.startsWith("/") ? path : `/${path}`}`;
}

function siteHeader() {
  return `<header class="site-header">
      <a class="site-brand" href="/">Link for a Dollar</a>
      <nav aria-label="Primary navigation">
        <a href="/">Board</a>
        <a href="/stats">Stats</a>
        <a href="/leaderboards/newest-claims">Newest claims</a>
        <a href="/about">About</a>
      </nav>
    </header>`;
}

function breadcrumbs(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">
      <ol>${items.map((item, index) => `<li>${index === items.length - 1 ? `<span aria-current="page">${escapeHtml(item.name)}</span>` : `<a href="${escapeHtml(item.path)}">${escapeHtml(item.name)}</a>`}</li>`).join("")}</ol>
    </nav>`;
}

function pageStructuredData(primary, breadcrumbItems, env) {
  const { "@context": _context, ...entity } = primary;
  return {
    "@context": "https://schema.org",
    "@graph": [
      entity,
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: absoluteUrl(env, item.path),
        })),
      },
    ],
  };
}

function homeSquareRows(squares, metric = (square) => `#${Number(square.square_id) + 1}`) {
  return squares.map((square) => `<li>
      <span class="mini-logo" style="background:${escapeHtml(categoryColor(square.category))}">${escapeHtml(initialsFor(square.label, hostFromUrl(square.url)))}</span>
      <div><strong><a href="/squares/${Number(square.square_id) + 1}">${escapeHtml(square.label)}</a></strong><span>${escapeHtml(square.category || "Other")} · ${escapeHtml(hostFromUrl(square.url))}</span></div>
      <a class="proof-action" href="/squares/${Number(square.square_id) + 1}">${escapeHtml(metric(square))}</a>
    </li>`).join("");
}

function categoryColor(category) {
  const colors = { AI: "#6d3fd1", SaaS: "#17627d", Ecommerce: "#b92f20", Agency: "#0b776f", Media: "#a52d68", "Developer tools": "#48612f", Finance: "#6b4d2e", "Local business": "#8a5b00", Other: "#4f5968" };
  return colors[category] || colors.Other;
}

function homePage(paidSquares, selectedSquare, env) {
  const safeSelected = Math.max(1, Math.min(TOTAL_SQUARES, selectedSquare || 1));
  const squaresJson = JSON.stringify(paidSquares).replace(/</g, "\\u003c");
  const description = "Claim a permanent branded listing for $1, then compete for the #1 position on the live link leaderboard.";
  const newest = [...paidSquares].sort((a, b) => String(b.paid_at || "").localeCompare(String(a.paid_at || "")) || Number(b.square_id) - Number(a.square_id));
  const topClicked = [...paidSquares].sort((a, b) => Number(b.click_count || 0) - Number(a.click_count || 0) || Number(a.square_id) - Number(b.square_id));
  const featured = topClicked.filter((square) => Number(square.click_count || 0) > 0).concat(newest).filter((square, index, source) => source.findIndex((entry) => Number(entry.square_id) === Number(square.square_id)) === index).slice(0, 4);
  const categoryCounts = new Map();
  paidSquares.forEach((square) => categoryCounts.set(square.category || "Other", (categoryCounts.get(square.category || "Other") || 0) + 1));
  const categoryRows = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6).map(([category, count]) => `<li><div><strong><a href="/collections/${encodeURIComponent(category)}">${escapeHtml(category)}</a></strong><span>${count} claimed square${count === 1 ? "" : "s"}</span></div><a class="proof-action" href="/collections/${encodeURIComponent(category)}">View</a></li>`).join("");
  const trendingRows = newest.slice(0, 8).map((square) => `<a class="trending-card" href="/squares/${Number(square.square_id) + 1}"><span class="mini-logo" style="background:${escapeHtml(categoryColor(square.category))}">${escapeHtml(initialsFor(square.label, hostFromUrl(square.url)))}</span><span><strong>${escapeHtml(square.label)}</strong><span>${escapeHtml(square.category || "Other")} · ${escapeHtml(hostFromUrl(square.url))}</span></span><em>#${Number(square.square_id) + 1}</em></a>`).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${pageHead({
      title: "Link for a Dollar | The Permanent Link Leaderboard",
      description,
      path: "/",
      env,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Link for a Dollar",
        url: absoluteUrl(env, "/"),
        description,
      },
    })}
    <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css">
  </head>
  <body data-directory-mode="true">
    ${siteHeader()}
    <main class="page-shell">
      <section class="masthead">
        <a class="list-brand" href="/">Link for a Dollar</a>
        <div class="hero-copy">
          <p class="hero-kicker">Permanent listing. Live competition.</p>
          <h1>The link leaderboard. <em>The highest active bid takes #1.</em></h1>
          <p class="hero-subhead">No ads. No algorithms. Claim a permanent branded listing for $1, then promote it for as long as you choose. Every click lands on your site.</p>
          <button class="hero-claim-button" type="button" data-open-claim>Claim #1 →</button>
        </div>
        <div class="stats live-stats" aria-label="Live site activity" aria-live="polite">
          <span class="live-stats__status"><i aria-hidden="true"></i><strong id="activeNow">—</strong> active now</span>
          <span class="live-stats__divider" aria-hidden="true">·</span>
          <span><strong id="sessions24h">—</strong> sessions in 24h</span>
          <span class="sr-only" id="presenceStatus">Loading live activity</span>
          <a href="/stats">Stats</a>
        </div>
      </section>

      <section class="momentum-strip" aria-label="Live claim momentum">
        <div class="momentum-card">
          <span>Recently claimed</span>
          <strong id="latestClaim">Waiting for the first claim</strong>
        </div>
        <div class="momentum-card">
          <span>Today</span>
          <strong id="claimedToday">0 squares claimed today</strong>
        </div>
        <div class="momentum-card">
          <span>Fastest growing</span>
          <strong id="fastestCategory">Categories open</strong>
        </div>
        <div class="momentum-card activity-card">
          <span>Live activity</span>
          <strong id="liveActivity">Watching the grid</strong>
        </div>
      </section>

      <section class="workspace" aria-label="One million link squares">
        <div class="canvas-panel">
          <div class="board-toolbar" aria-label="Board controls">
            <div class="search-control">
              <label class="sr-only" for="companySearch">Search companies</label>
              <input id="companySearch" type="search" placeholder="Search brands or URLs">
              <div id="searchResults" class="search-results" hidden></div>
            </div>
            <select id="categoryFilter" aria-label="Filter board by category">
              <option value="All">All categories</option>
              <option value="AI">AI</option>
              <option value="SaaS">SaaS</option>
              <option value="Ecommerce">Ecommerce</option>
              <option value="Agency">Agency</option>
              <option value="Media">Media</option>
              <option value="Developer tools">Developer tools</option>
              <option value="Finance">Finance</option>
              <option value="Local business">Local business</option>
              <option value="Other">Other</option>
            </select>
            <div class="view-toggle" role="group" aria-label="Choose board view">
              <button class="view-toggle__button is-active" id="listViewButton" type="button" aria-pressed="true" aria-controls="directoryList">List</button>
              <button class="view-toggle__button" id="gridViewButton" type="button" aria-pressed="false" aria-controls="directoryList">Grid</button>
              <button class="view-toggle__button" id="mapViewButton" type="button" aria-pressed="false" aria-controls="purchaseMap">Map</button>
            </div>
            <div class="zoom-controls" aria-label="Zoom controls">
              <button class="tool-button" id="zoomOut" type="button" aria-label="Zoom out">-</button>
              <input id="zoomRange" class="zoom-range" type="range" min="1" max="32" step="1" value="4" aria-label="Zoom level">
              <button class="tool-button" id="zoomIn" type="button" aria-label="Zoom in">+</button>
              <button class="tool-button wide" id="zoomHome" type="button">Fit</button>
            </div>
          </div>
          <canvas id="grid" width="1000" height="1000" aria-label="One million selectable squares"></canvas>
          <div id="directoryList" class="directory-list" aria-label="Claimed link directory" hidden>
            <div class="directory-list__header">
              <div>
                <p class="eyebrow">Claimed links</p>
                <h2>Link leaderboard</h2>
              </div>
              <p id="directoryCount" class="directory-list__count"></p>
            </div>
            <ol id="directoryRows" class="directory-rows"></ol>
          </div>
          <section id="purchaseMapPanel" class="purchase-map-panel" aria-labelledby="purchase-map-title" hidden>
            <div class="directory-list__header">
              <div>
                <p class="eyebrow">Listing locations</p>
                <h2 id="purchase-map-title">Claimed links around the world</h2>
              </div>
              <p id="mapLocationCount" class="directory-list__count"></p>
            </div>
            <div id="purchaseMap" class="purchase-map" aria-label="World map of approximate listing locations"></div>
            <div id="mapEmptyState" class="map-empty-state" hidden>
              <strong>The map is ready for its first location</strong>
              <span>New claims appear here using an approximate headquarters or checkout location.</span>
              <button type="button" data-focus-claim>Claim the first mapped link</button>
            </div>
            <p class="map-privacy-note">Markers show buyer-selected country centres from OpenStreetMap or approximate legacy locations. We do not store IP addresses.</p>
          </section>
          <div class="hover-preview" id="hoverPreview" hidden></div>
        </div>

        <dialog class="claim-dialog" id="claimDialog" aria-labelledby="claim-dialog-title">
          <button class="claim-dialog__close" type="button" data-close-claim aria-label="Close claim form">×</button>
        <aside class="claim-panel">
          <div class="claim-copy">
            <p class="eyebrow">Featured placement</p>
            <h2 id="claim-dialog-title">Claim #1 for as long as you choose</h2>
            <ul class="claim-benefits">
              <li>Your listing stays permanently</li>
              <li>Bid for rank without choosing a square</li>
              <li>Choose a one-time bid or a recurring monthly rank boost</li>
            </ul>
            <p class="rebid-note"><strong>Outbid or be outbid.</strong> Enter the same URL again and your previous bid is credited. We automatically calculate the amount needed to return to #1.</p>
          </div>

          <form action="/checkout" method="post">
            <div class="field-row">
              <label for="label">Friendly title</label>
              <input id="label" name="label" maxlength="80" placeholder="What should we call you?" required>
            </div>
            <div class="field-row">
              <label for="url">Your website</label>
              <input id="url" name="url" type="url" placeholder="https://yourwebsite.com" required>
            </div>
            <div class="field-row logo-field">
              <label for="logo_url">Logo URL <span>(optional)</span></label>
              <input id="logo_url" name="logo_url" type="url" maxlength="500" placeholder="https://yourwebsite.com/logo.png">
            </div>
            <div class="field-row">
              <label for="country">Country <span>(optional)</span></label>
              <input id="country" name="country" maxlength="80" autocomplete="country-name" placeholder="Australia">
              <small>Used only to place your listing at the country centre on the public map.</small>
            </div>
            <div class="field-row description-field">
              <label for="description">Friendly description <span>(optional)</span></label>
              <textarea id="description" name="description" maxlength="180" rows="2" placeholder="A short, human introduction to what you do"></textarea>
            </div>
            <div class="field-row">
              <label for="category">Category</label>
              <select id="category" name="category">
                <option>AI</option>
                <option>SaaS</option>
                <option>Ecommerce</option>
                <option>Agency</option>
                <option>Media</option>
                <option>Developer tools</option>
                <option>Finance</option>
                <option>Local business</option>
                <option selected>Other</option>
              </select>
            </div>
            <div class="field-row">
              <label for="promotion_type">Placement</label>
              <select id="promotion_type" name="promotion_type">
                <option value="bid">Custom rank bid</option>
                <option value="monthly">Recurring monthly bid</option>
              </select>
            </div>
            <div class="field-row payment-level-field">
              <label for="payment_level">Promotion amount</label>
              <div class="money-input">
                <span aria-hidden="true">$</span>
                <input id="payment_level" name="payment_level" type="number" min="1" max="10000" step="1" value="1" required aria-describedby="placementPreview">
              </div>
              <small id="placementPreview">Your first $1 publishes the listing permanently. Additional dollars buy more time at #1.</small>
            </div>
            <div class="field-row">
              <label for="email">Ownership receipt</label>
              <input id="email" name="email" type="email" placeholder="you@example.com">
            </div>
            <p class="auto-brand-note">We’ll suggest a title from your website. Add your own logo and a short introduction to make the listing feel like you.</p>
            <button id="checkoutButton" type="submit">Claim my spot</button>
          </form>

          <div class="selection" hidden>
            <span>Listing</span>
            <strong id="selectedLabel">Ready</strong>
            <a id="selectedLink" href="#" target="_blank" rel="noopener">Open claimed link</a>
            <div class="selected-card" id="selectedCard"></div>
          </div>

          <div class="proof-panel" aria-labelledby="featured-title">
            <p class="eyebrow">Leaderboard</p>
            <h2 id="featured-title">Top performing</h2>
            <div class="proof-group">
              <ul id="featuredSquares" class="proof-list">${homeSquareRows(featured, (square) => `${formatNumber(square.click_count)} clicks`) || emptyRankRow()}</ul>
            </div>
          </div>

          <div class="proof-panel" aria-labelledby="proof-title">
            <p class="eyebrow">Live board</p>
            <h2 id="proof-title">Activity and rankings</h2>
            <div class="proof-group">
              <h3>Recently claimed</h3>
              <ul id="newestSquares" class="proof-list">${homeSquareRows(newest.slice(0, 5)) || emptyRankRow()}</ul>
            </div>
            <div class="proof-group">
              <h3>Top categories</h3>
              <ul id="topCategories" class="proof-list compact">${categoryRows || '<li><div><strong>No categories yet</strong><span>First claims define the board</span></div></li>'}</ul>
            </div>
            <div class="proof-group">
              <h3>Leaderboards</h3>
              <ul id="mostClicked" class="proof-list">${homeSquareRows(topClicked.slice(0, 5), (square) => `${formatNumber(square.click_count)} clicks`) || emptyRankRow()}</ul>
            </div>
          </div>
        </aside>
        </dialog>
      </section>

      <section class="trending-section" aria-labelledby="trending-title">
        <div>
          <p class="eyebrow">Trending squares</p>
          <h2 id="trending-title">Fresh claims on the board</h2>
        </div>
        <div id="trendingSquares" class="trending-grid">${trendingRows || '<div class="trending-card"><span></span><strong>No claimed squares yet</strong><span>Fresh claims will land here.</span></div>'}</div>
      </section>

      <footer class="seo-footer" aria-labelledby="seo-footer-title">
        <div class="footer-about">
          <p class="eyebrow">About</p>
          <h2 id="seo-footer-title">Why teams buy a square</h2>
          <p>
            One dollar buys a permanent public profile, a sponsored outbound link, and a shareable place on a million-square board built for early adopters.
          </p>
        </div>
        <ul class="value-props" aria-label="Public claim value props">
          <li>
            <span>Permanent public profile</span>
            <button class="info-tip" type="button" aria-label="Permanent public profile information" title="Paid squares create a crawlable public claim page.">i</button>
          </li>
          <li>
            <span>Sponsored outbound link</span>
            <button class="info-tip" type="button" aria-label="Sponsored outbound link information" title="Paid outbound links are marked as sponsored while remaining useful for visitors.">i</button>
          </li>
          <li>
            <span>Crawlable brand label</span>
            <button class="info-tip" type="button" aria-label="Crawlable brand label information" title="Your label is rendered in the public page data next to your destination URL.">i</button>
          </li>
          <li>
            <span>Early adopter placement</span>
            <button class="info-tip" type="button" aria-label="Early adopter placement information" title="Lower square numbers and early claims are visibly scarce as the grid fills.">i</button>
          </li>
          <li>
            <span>Referral visibility</span>
            <button class="info-tip" type="button" aria-label="Referral visibility information" title="Your claim gives visitors another discoverable path to your site.">i</button>
          </li>
          <li>
            <span>Shareable owner badge</span>
            <button class="info-tip" type="button" aria-label="Shareable owner badge information" title="Every claim gets a badge snippet that links back to the public square page.">i</button>
          </li>
        </ul>
      </footer>
    </main>

    <script>window.__PAID_SQUARES__ = ${squaresJson};</script>
    <script src="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js" defer></script>
    <script src="/assets/app.js?v=${ASSET_VERSION}" defer></script>
  </body>
</html>`;
}

function aboutPage(env) {
  const description = "How Link for a Dollar verifies paid claims, labels sponsored outbound links, records click totals, and publishes public owner pages.";
  const crumbs = [{ name: "Home", path: "/" }, { name: "About", path: "/about" }];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${pageHead({
      title: "About and listing methodology | Link for a Dollar",
      description,
      path: "/about",
      env,
      jsonLd: pageStructuredData({
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "About Link for a Dollar",
        url: absoluteUrl(env, "/about"),
        description,
      }, crumbs, env),
    })}
    <style>${trafficStyles()}</style>
  </head>
  <body>
    ${siteHeader()}
    <main class="page-shell traffic-page">
      ${breadcrumbs(crumbs)}
      <article class="profile-panel methodology-page">
        <p class="eyebrow">Methodology</p>
        <h1>How public claims work</h1>
        <p>Every indexed square and owner profile represents a completed one-dollar purchase. Demo and editorial seed records are kept out of public pages, feeds, statistics, and sitemaps.</p>
        <h2>Ownership and verification</h2>
        <p>Purchasers choose the public label, destination URL, and category. A company is marked verified only when the receipt email domain matches the submitted website domain. A paid claim is a purchaser-submitted listing, not an endorsement by the destination company.</p>
        <h2>Sponsored links and click totals</h2>
        <p>Outbound website links are marked sponsored. Click totals count visits sent through the tracked redirect and are shown as directional activity data, not audited traffic or ranking guarantees.</p>
        <h2>Corrections</h2>
        <p>If a label, destination, or ownership statement is inaccurate, contact the site operator with the square number and supporting details so the public record can be corrected.</p>
      </article>
    </main>
  </body>
</html>`;
}

function successPage(claimedSquares, env, conversion = null) {
  const primary = claimedSquares[0];
  const title = primary ? `${primary.label} claimed square #${Number(primary.square_id) + 1}` : "Square claimed";
  const description = primary
    ? `Share ${primary.label}'s public claim page and add the owner badge to their site.`
    : "Your link is now live on the public board.";
  const claimRows = claimedSquares.map((square) => {
    const squarePath = `/squares/${Number(square.square_id) + 1}`;
    const share = shareLinks({
      title: `${square.label} claimed square #${Number(square.square_id) + 1} on Link for a Dollar`,
      url: absoluteUrl(env, squarePath),
    });

    return `<article class="traffic-card success-claim-card">
        <span class="claim-mark">${escapeHtml(initialsFor(square.label, hostFromUrl(square.url)))}</span>
        <div>
          <p class="eyebrow">Your live listing</p>
          <h2>${escapeHtml(square.label)} · square #${formatNumber(Number(square.square_id) + 1)}</h2>
          <p>${escapeHtml(hostFromUrl(square.url))} is now published on the board and ready to share.</p>
          <div class="traffic-actions">
            <a class="button-link" href="${squarePath}">View live listing</a>
            <a class="button-link secondary" href="/?square=${Number(square.square_id) + 1}">See it on the board</a>
          </div>
          <div class="success-share-row" aria-label="Share your new listing">
            <strong>Share your claim</strong>
            <a href="${share.x}" rel="noopener">X</a>
            <a href="${share.linkedin}" rel="noopener">LinkedIn</a>
            <a href="${share.email}">Email</a>
          </div>
        </div>
      </article>`;
  }).join("");
  const purchaseProps = conversion ? JSON.stringify({
    order_id: String(conversion.id || "").slice(0, 120),
    value: (Math.max(0, Number(conversion.amountTotal || 0)) / 100).toFixed(2),
    currency: String(conversion.currency || "usd").toUpperCase().slice(0, 3),
    square_count: String(claimedSquares.length),
  }).replace(/</g, "\\u003c") : "null";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${pageHead({
      title: `${title} | Link for a Dollar`,
      description,
      path: primary ? `/squares/${Number(primary.square_id) + 1}` : "/success",
      env,
      robots: "noindex, follow",
    })}
    <style>${trafficStyles()}</style>
  </head>
  <body>
    ${siteHeader()}
    <main class="page-shell traffic-page success-page">
      <header class="success-hero">
        <span class="success-check" aria-hidden="true">✓</span>
        <div>
          <p class="eyebrow">Payment confirmed</p>
          <h1>Square claimed</h1>
          <p>Your listing is live. View the public page, find it on the board, or share it with your audience.</p>
        </div>
      </header>
      <section class="traffic-stack">${claimRows || '<article class="traffic-card"><div><h2>Claim recorded</h2><p>Open the grid to view the newest square.</p><a class="button-link" href="/">Back to the grid</a></div></article>'}</section>
      <p class="success-footnote">Need the owner badge? It is available on your public listing page.</p>
    </main>
    <script>
      window.addEventListener("load", function () {
        var props = ${purchaseProps};
        if (!props || !window.piqo) return;
        var storageKey = "piqo:purchase:" + props.order_id;
        try {
          if (sessionStorage.getItem(storageKey)) return;
          sessionStorage.setItem(storageKey, "1");
        } catch (_) {}
        window.piqo("purchase", { props: props });
      }, { once: true });
    </script>
  </body>
</html>`;
}

function statsPage(squares, env) {
  const stats = statsPageData(squares);
  const summary = stats.summary;
  const measuredAt = new Date().toISOString();
  const squareHref = (square) => `/squares/${Number(square.square_id) + 1}`;
  const profileHref = (owner) => `/profile/${encodeURIComponent(owner.host)}`;
  const description = `See the Link for a Dollar leaderboard across ${formatNumber(summary.claimed)} claimed squares, owners, categories, and tracked visits.`;
  const crumbs = [{ name: "Home", path: "/" }, { name: "Stats", path: "/stats" }];
  const paidDate = (value) => {
    if (!value) {
      return "First wave";
    }

    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) {
      return "First wave";
    }

    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
  };
  const squareRows = (items, metric) => items.map((square) => `
              <li>
                <a href="${squareHref(square)}">${escapeHtml(square.label)}</a>
                <span>${escapeHtml(metric.meta(square))}</span>
                <strong>${escapeHtml(metric.value(square))}</strong>
              </li>`).join("") || emptyRankRow();
  const ownerRows = stats.largestOwners.map((owner) => `
              <li>
                <a href="${profileHref(owner)}">${escapeHtml(owner.label)}</a>
                <span>${escapeHtml(owner.host)}</span>
                <strong>${formatNumber(owner.square_count)} squares</strong>
              </li>`).join("") || emptyRankRow();
  const categoryRows = stats.categories.map((category) => `
              <li>
                <a href="/collections/${encodeURIComponent(category.category)}">${escapeHtml(category.category)}</a>
                <span>${formatNumber(category.click_count)} clicks</span>
                <strong>${formatNumber(category.square_count)} squares</strong>
              </li>`).join("") || emptyRankRow();
  const maxClicks = Math.max(1, ...stats.topPerforming.map((square) => Number(square.click_count || 0)));
  const maxCategoryCount = Math.max(1, ...stats.categories.map((category) => Number(category.square_count || 0)));
  const clickChartRows = stats.topPerforming.slice(0, 8).map((square) => {
    const clicks = Number(square.click_count || 0);
    const size = clicks > 0 ? Math.max(5, Math.round((clicks / maxClicks) * 100)) : 0;
    return `<li>
                <a href="${squareHref(square)}">${escapeHtml(square.label)}</a>
                <span class="stats-chart__track" aria-hidden="true"><i style="--bar-size:${size}%"></i></span>
                <strong>${formatNumber(clicks)}</strong>
              </li>`;
  }).join("") || emptyChartRow("No outbound clicks yet");
  const categoryChartRows = stats.categories.slice(0, 8).map((category) => {
    const count = Number(category.square_count || 0);
    const size = count > 0 ? Math.max(5, Math.round((count / maxCategoryCount) * 100)) : 0;
    return `<li>
                <a href="/collections/${encodeURIComponent(category.category)}">${escapeHtml(category.category)}</a>
                <span class="stats-chart__track" aria-hidden="true"><i style="--bar-size:${size}%"></i></span>
                <strong>${formatNumber(count)}</strong>
              </li>`;
  }).join("") || emptyChartRow("No categories yet");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${pageHead({
      title: "Stats | Link for a Dollar",
      description,
      path: "/stats",
      env,
      jsonLd: pageStructuredData({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Link for a Dollar statistics",
        url: absoluteUrl(env, "/stats"),
        description,
      }, crumbs, env),
    })}
    <style>${trafficStyles()}</style>
  </head>
  <body data-stats-mode="true">
    ${siteHeader()}
    <main class="page-shell stats-page">
      ${breadcrumbs(crumbs)}
      <header class="stats-hero">
        <div>
          <p class="eyebrow"><span class="stats-live-dot" aria-hidden="true"></span>Live board data</p>
          <h1>Every claim.<br><span>Clearly measured.</span></h1>
          <p>See which permanent listings are earning attention and how the board is growing.</p>
          <p class="stats-freshness" id="statsFreshness" role="status">Board totals loaded · live audience connecting…</p>
          <nav class="leaderboard-nav" aria-label="Leaderboard pages">
            <a class="button-link secondary" href="/leaderboards/most-clicked">Most clicked</a>
            <a class="button-link secondary" href="/leaderboards/founding-squares">Founding squares</a>
            <a class="button-link secondary" href="/leaderboards/newest-claims">Newest claims</a>
            <a class="button-link secondary" href="/leaderboards/largest-territories">Largest territories</a>
          </nav>
        </div>
        <a class="button-link" href="/">Explore the leaderboard</a>
      </header>

      <section class="stats-summary" aria-label="Board summary">
        <div class="stats-summary__live"><span>Online now</span><strong id="statsActiveNow" aria-label="Loading online visitors">—</strong><small>Active in the last 5 minutes</small></div>
        <div class="stats-summary__live"><span>Visitors · 24h</span><strong id="statsSessions24h" aria-label="Loading 24 hour visitors">—</strong><small>Anonymous browser sessions</small></div>
        <div><span>Live listings</span><strong>${formatNumber(summary.claimed)}</strong><small>${formatNumber(summary.claimedToday)} claimed in the last 24 hours</small></div>
        <div><span>Brands</span><strong>${formatNumber(summary.owners)}</strong><small>Unique sites represented</small></div>
        <div><span>Outbound clicks</span><strong>${formatNumber(summary.clicks)}</strong><small>Visits sent to listed sites</small></div>
        <div><span>Board filled</span><strong>${summary.fillRate.toFixed(3)}%</strong><small>${formatNumber(TOTAL_SQUARES - summary.claimed)} permanent spots open</small></div>
      </section>

      <p class="stats-method"><strong>How live counting works:</strong> active visitors use an anonymous session ID stored in this browser tab. No personal data is collected. Audience totals refresh every 60 seconds; claims and clicks refresh when the page reloads.</p>

      <section class="stats-charts" aria-label="Board charts">
        <figure class="stats-board stats-chart">
          <figcaption>
            <p class="eyebrow">Traffic</p>
            <h2>Clicks by listing</h2>
            <p>Tracked visits sent from the board. Longer bars mean more visitors reached that site.</p>
          </figcaption>
          <ol class="stats-chart__rows" aria-label="Outbound clicks by listing">${clickChartRows}</ol>
          <div class="stats-chart__axis" aria-hidden="true"><span>0</span><span>${formatNumber(maxClicks)} clicks</span></div>
        </figure>

        <figure class="stats-board stats-chart">
          <figcaption>
            <p class="eyebrow">Board mix</p>
            <h2>Listings by category</h2>
            <p>How the claimed listings are distributed. Each value is the number of permanent spots.</p>
          </figcaption>
          <ol class="stats-chart__rows" aria-label="Listings by category">${categoryChartRows}</ol>
          <div class="stats-chart__axis" aria-hidden="true"><span>0</span><span>${formatNumber(maxCategoryCount)} listings</span></div>
        </figure>
      </section>

      <section class="stats-grid" aria-label="Rankings">
        <article class="stats-board">
          <p class="eyebrow">Territory</p>
          <h2>Top Landholders</h2>
          <ol class="rank-list">${ownerRows}</ol>
        </article>

        <article class="stats-board">
          <p class="eyebrow">Momentum</p>
          <h2>Recently Claimed</h2>
          <ol class="rank-list">${squareRows(stats.recent, {
            meta: (square) => paidDate(square.paid_at),
            value: (square) => `#${formatNumber(Number(square.square_id) + 1)}`,
          })}</ol>
        </article>

        <article class="stats-board">
          <p class="eyebrow">Provenance</p>
          <h2>Founding Squares</h2>
          <ol class="rank-list">${squareRows(stats.founding, {
            meta: (square) => hostFromUrl(square.url),
            value: (square) => `#${formatNumber(Number(square.square_id) + 1)}`,
          })}</ol>
        </article>

        <article class="stats-board">
          <p class="eyebrow">Categories</p>
          <h2>Category Leaders</h2>
          <ol class="rank-list category-rank-list">${categoryRows}</ol>
        </article>
      </section>
    </main>
    <script>
      (() => {
        const active = document.getElementById("statsActiveNow");
        const sessions = document.getElementById("statsSessions24h");
        const freshness = document.getElementById("statsFreshness");
        const initialMeasuredAt = ${JSON.stringify(measuredAt)};
        const number = new Intl.NumberFormat();
        let timer;

        function relativeTime(value) {
          const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1000));
          if (seconds < 10) return "just now";
          if (seconds < 60) return seconds + " seconds ago";
          return Math.floor(seconds / 60) + " minute" + (seconds < 120 ? "" : "s") + " ago";
        }

        async function refreshLiveStats() {
          if (document.hidden) return;
          let sessionId = sessionStorage.getItem("linkforadollar:presence");
          if (!sessionId) {
            sessionId = crypto.randomUUID();
            sessionStorage.setItem("linkforadollar:presence", sessionId);
          }

          try {
            const response = await fetch("/api/presence", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ session_id: sessionId }),
              cache: "no-store",
            });
            if (!response.ok) throw new Error("Live audience unavailable");
            const data = await response.json();
            active.textContent = number.format(data.active_now);
            sessions.textContent = number.format(data.sessions_24h);
            active.removeAttribute("aria-label");
            sessions.removeAttribute("aria-label");
            freshness.textContent = "Live audience updated " + relativeTime(data.measured_at);
            freshness.classList.remove("is-stale");
          } catch {
            freshness.textContent = "Board totals updated " + relativeTime(initialMeasuredAt) + " · live audience temporarily unavailable";
            freshness.classList.add("is-stale");
          }
        }

        refreshLiveStats();
        timer = setInterval(refreshLiveStats, 60_000);
        document.addEventListener("visibilitychange", refreshLiveStats);
        window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
      })();
    </script>
  </body>
</html>`;
}

function statsPageData(squares) {
  const owners = new Map();
  const territories = new Set();
  let clicks = 0;
  const dayAgo = Date.now() - 86_400_000;

  for (const square of squares) {
    const host = hostFromUrl(square.url);
    const territoryKey = square.territory_key || `single:${square.square_id}`;
    const squareClicks = Number(square.click_count || 0);
    clicks += squareClicks;
    territories.add(territoryKey);

    if (!owners.has(host)) {
      owners.set(host, {
        host,
        label: square.label,
        url: square.url,
        category: square.category,
        square_count: 0,
        territories: new Set(),
        click_count: 0,
        first_square: Number(square.square_id) + 1,
      });
    }

    const owner = owners.get(host);
    owner.square_count += 1;
    owner.territories.add(territoryKey);
    owner.click_count += squareClicks;
    owner.first_square = Math.min(owner.first_square, Number(square.square_id) + 1);
  }

  const ownerRows = [...owners.values()].map((owner) => ({
    ...owner,
    territory_count: owner.territories.size,
  }));
  const topPerforming = [...squares].sort((a, b) => Number(b.click_count || 0) - Number(a.click_count || 0) || Number(a.square_id) - Number(b.square_id));
  const largestOwners = ownerRows.sort((a, b) => b.square_count - a.square_count || b.click_count - a.click_count);
  const recent = [...squares].sort((a, b) => String(b.paid_at || "").localeCompare(String(a.paid_at || "")) || Number(b.square_id) - Number(a.square_id));
  const founding = [...squares].sort((a, b) => String(a.paid_at || "").localeCompare(String(b.paid_at || "")) || Number(a.square_id) - Number(b.square_id));
  const categories = new Map();

  for (const square of squares) {
    const categoryName = square.category || "Other";
    const category = categories.get(categoryName) || { category: categoryName, square_count: 0, click_count: 0 };
    category.square_count += 1;
    category.click_count += Number(square.click_count || 0);
    categories.set(categoryName, category);
  }

  return {
    summary: {
      claimed: squares.length,
      claimedToday: squares.filter((square) => Date.parse(square.paid_at || "") >= dayAgo).length,
      owners: owners.size,
      territories: territories.size,
      clicks,
      fillRate: (squares.length / TOTAL_SQUARES) * 100,
    },
    topPerforming: topPerforming.slice(0, 12),
    largestOwners: largestOwners.slice(0, 12),
    recent: recent.slice(0, 12),
    founding: founding.slice(0, 12),
    categories: [...categories.values()].sort((a, b) => b.square_count - a.square_count || b.click_count - a.click_count).slice(0, 12),
  };
}

function emptyRankRow() {
  return '<li><a href="/">Claim the first square</a><span>Open board</span><strong>$1</strong></li>';
}

function emptyChartRow(label) {
  return `<li class="stats-chart__empty"><a href="/">${escapeHtml(label)} — claim the first listing</a></li>`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en").format(Number(value || 0));
}

function titleWithSite(label, suffix, maxLength = 60) {
  const safeLabel = String(label || "Listing").trim();
  const available = Math.max(12, maxLength - suffix.length);
  const shortened = safeLabel.length > available ? `${safeLabel.slice(0, Math.max(1, available - 1)).trimEnd()}…` : safeLabel;
  return `${shortened}${suffix}`;
}

function initialsFor(label, host = "") {
  const source = String(label || host || "?").trim();
  const words = source.split(/[\s.-]+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function paidDateLabel(value) {
  if (!value) {
    return "First wave";
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "First wave";
  }

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function withUtm(url, source, medium, campaign = "claim_share", content = "") {
  const tagged = new URL(url);
  tagged.searchParams.set("utm_source", source);
  tagged.searchParams.set("utm_medium", medium);
  tagged.searchParams.set("utm_campaign", campaign);

  if (content) {
    tagged.searchParams.set("utm_content", content);
  }

  return tagged.toString();
}

function shareLinks({ title, url }) {
  const encodedTitle = encodeURIComponent(title);
  const xUrl = withUtm(url, "x", "social", "claim_share");
  const linkedinUrl = withUtm(url, "linkedin", "social", "claim_share");
  const emailUrl = withUtm(url, "email", "email", "claim_share");

  return {
    x: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodeURIComponent(xUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(linkedinUrl)}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedTitle}%0A${encodeURIComponent(emailUrl)}`,
  };
}

function badgeSnippet(square, env) {
  const publicId = Number(square.square_id) + 1;
  const claimUrl = withUtm(absoluteUrl(env, `/squares/${publicId}`), "owner_badge", "referral", "claim_badge", `square_${publicId}`);
  const code = `<a href="${claimUrl}" style="display:inline-flex;align-items:center;gap:8px;border:1px solid #d5d9e2;border-radius:6px;padding:8px 10px;color:#084f96;text-decoration:none;font:700 14px system-ui,sans-serif"><span style="width:16px;height:16px;background:#0b6bcb;display:inline-block"></span>We own square #${publicId} on Link for a Dollar</a>`;

  return `<details class="badge-box">
      <summary>Embed the owner badge</summary>
      <p>Add this badge to your site to send visitors back to the public claim.</p>
      <pre><code>${escapeHtml(code)}</code></pre>
    </details>`;
}

function trafficStyles() {
  return `
    .traffic-page { max-width: 1120px; }
    .traffic-page > p { max-width: 48rem; color: var(--muted); font-weight: 750; line-height: 1.45; }
    .traffic-stack, .profile-layout, .leaderboard-layout { display: grid; gap: 14px; }
    .traffic-card, .profile-hero-card, .profile-panel, .badge-box, .share-panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      padding: 16px;
    }
    .traffic-card { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 16px; align-items: start; }
    .claim-mark {
      display: grid;
      width: 64px;
      height: 64px;
      place-items: center;
      border-radius: 8px;
      background: var(--accent);
      color: #fff;
      font-weight: 950;
      font-size: 1.2rem;
    }
    .traffic-card h2, .profile-panel h2, .share-panel h2 { margin: 0 0 8px; font-size: 1.12rem; text-wrap: balance; }
    .traffic-card p, .profile-panel p, .share-panel p, .badge-box p { margin: 0 0 12px; color: var(--muted); line-height: 1.45; }
    .traffic-actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0; }
    .badge-box { margin-top: 12px; background: var(--paper); }
    .badge-box summary { cursor: pointer; color: var(--accent-dark); font-weight: 900; }
    .badge-box[open] summary { margin-bottom: 10px; }
    .badge-box pre {
      overflow: auto;
      margin: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      padding: 10px;
      font-size: 0.78rem;
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .profile-hero-card { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 16px; align-items: center; }
    .profile-layout { grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr); align-items: start; }
    .profile-panel-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .profile-panel-list li { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--line); padding-top: 8px; }
    .profile-panel-list a { color: var(--accent-dark); font-weight: 900; }
    .share-panel { display: grid; gap: 10px; }
    .success-page { max-width: 880px; }
    .success-hero { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 16px; align-items: center; margin: 22px 0 18px; }
    .success-hero h1 { text-wrap: balance; }
    .success-hero p { max-width: 42rem; margin: 7px 0 0; color: var(--muted); line-height: 1.5; text-wrap: pretty; }
    .success-hero .eyebrow { margin: 0 0 5px; }
    .success-check { display: grid; width: 52px; height: 52px; place-items: center; border-radius: 50%; background: #e8f6ef; color: #177e6d; font-size: 1.45rem; font-weight: 950; }
    .success-claim-card { padding: 22px; }
    .success-share-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 18px; padding-top: 15px; border-top: 1px solid var(--line); }
    .success-share-row strong { margin-right: auto; font-size: 0.88rem; }
    .success-share-row a { color: var(--accent-dark); font-size: 0.88rem; font-weight: 850; }
    .success-footnote { margin: 14px 0 0; font-size: 0.88rem; }
    .category-sponsors { display: grid; gap: 14px; margin: 18px 0; padding: 20px; border: 1px solid #cfe0da; border-radius: 16px; background: #f7fbf9; }
    .category-sponsors__heading { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
    .category-sponsors__heading h2, .category-sponsors__heading p { margin: 0; }
    .category-sponsors__heading > span { padding: 5px 9px; border-radius: 999px; background: #dcefe9; color: #11695b; font-size: .75rem; font-weight: 900; }
    .sponsor-list { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
    .sponsor-list li { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 11px 12px; border: 1px solid #dce8e4; border-radius: 10px; background: #fff; }
    .sponsor-list li > div { display: grid; gap: 2px; min-width: 0; }
    .sponsor-list a { overflow: hidden; color: var(--ink); font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
    .sponsor-list div span { color: var(--muted); font-size: .76rem; font-weight: 700; }
    .sponsor-list strong, .sponsor-rank { color: #11695b; font-variant-numeric: tabular-nums; font-weight: 900; }
    .sponsor-list__empty { grid-template-columns: 1fr auto !important; }
    .sponsor-form { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(150px, .65fr) minmax(180px, .9fr) auto; align-items: end; gap: 10px; padding-top: 14px; border-top: 1px solid #dce8e4; }
    .sponsor-form label { display: grid; gap: 6px; color: var(--ink); font-size: .75rem; font-weight: 900; }
    .sponsor-form label > span { color: var(--muted); font-weight: 700; }
    .sponsor-form input, .sponsor-form select, .sponsor-form button { min-height: 44px; }
    .sponsor-form button { padding: 0 15px; border: 0; border-radius: 9px; background: #177e6d; color: #fff; font-weight: 900; }
    .sponsor-form .money-input { display: flex; align-items: center; min-height: 44px; padding-left: 12px; border: 1px solid var(--line); border-radius: 7px; background: #fff; }
    .sponsor-form .money-input input { width: 100%; border: 0; }
    .sponsor-form > p { grid-column: 1 / -1; margin: 0; color: var(--muted); font-size: .76rem; font-weight: 700; }
    .listing-support { margin-top: 14px; }
    .listing-description { font-size: 1rem; }
    .leaderboard-nav { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .leaderboard-nav a { min-height: 36px; padding: 0 12px; }
    @media (max-width: 760px) {
      .traffic-card, .profile-hero-card, .profile-layout { grid-template-columns: 1fr; }
      .sponsor-form { grid-template-columns: 1fr; }
      .claim-mark { width: 52px; height: 52px; }
      .success-hero { grid-template-columns: 42px minmax(0, 1fr); margin-top: 10px; }
      .success-check { width: 42px; height: 42px; }
      .success-claim-card { padding: 16px; }
      .success-share-row strong { width: 100%; }
    }
  `;
}

function messagePage(message, env, title = "Page not found") {
  const description = `${message} Return to the Link for a Dollar public discovery board.`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${pageHead({ title: `${title} | Link for a Dollar`, description, path: null, env, robots: "noindex, follow" })}
  </head>
  <body>
    ${siteHeader()}
    <main class="message-page">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <a class="button-link" href="/">Back to the grid</a>
    </main>
  </body>
</html>`;
}

function notFoundResponse(message, env) {
  return html(messagePage(message, env, "Page not found"), 404, "no-store", NOINDEX_HEADERS);
}

function squarePage(square, relatedSquares, env) {
  const publicId = Number(square.square_id) + 1;
  const host = hostFromUrl(square.url);
  const path = `/squares/${publicId}`;
  const title = `${square.label} – Square #${publicId}`;
  const seoTitle = titleWithSite(square.label, ` – Square #${publicId} | Link for a Dollar`);
  const description = `Explore ${square.label}'s paid listing on square #${formatNumber(publicId)}, including its ${square.category || "Other"} category, claim date, territory size, and tracked outbound visits.`;
  const share = shareLinks({ title: `${title} on Link for a Dollar`, url: absoluteUrl(env, path) });
  const categoryPath = `/collections/${encodeURIComponent(square.category || "Other")}`;
  const crumbs = [{ name: "Home", path: "/" }, { name: square.category || "Other", path: categoryPath }, { name: `Square #${publicId}`, path }];
  const relatedRows = relatedSquares.map((entry) => `<li><a href="/squares/${Number(entry.square_id) + 1}">${escapeHtml(entry.label)}</a><span>#${formatNumber(Number(entry.square_id) + 1)}</span></li>`).join("");
  const entity = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    url: absoluteUrl(env, path),
    description,
    ...(Number(square.verified_company || 0) ? {
      about: {
        "@type": "Organization",
        name: square.label,
        url: square.url,
      },
    } : {}),
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${pageHead({
      title: seoTitle,
      description,
      path,
      env,
      imagePath: `/og/squares/${publicId}.png`,
      imageAlt: `${square.label} on square #${publicId}`,
      jsonLd: pageStructuredData(entity, crumbs, env),
    })}
    <style>${trafficStyles()}</style>
  </head>
  <body>
    ${siteHeader()}
    <main class="page-shell traffic-page">
      ${breadcrumbs(crumbs)}
      <article class="traffic-card">
        <span class="claim-mark">${escapeHtml(initialsFor(square.label, host))}</span>
        <div>
          <p class="eyebrow">Claimed square</p>
          <h1>${escapeHtml(square.label)} — square #${formatNumber(publicId)}</h1>
          <p class="listing-description">${square.description ? escapeHtml(square.description) : `${escapeHtml(host)} holds a paid public spot in ${escapeHtml(square.category || "Other")}.`}</p>
          <p>A purchaser submitted <a href="/go/${publicId}">${escapeHtml(host)}</a> on ${escapeHtml(paidDateLabel(square.paid_at))}.</p>
          <dl class="profile-stats">
            <div><dt>Square</dt><dd>#${formatNumber(publicId)}</dd></div>
            <div><dt>Clicks</dt><dd>${formatNumber(square.click_count)}</dd></div>
            <div><dt>Territory</dt><dd>${formatNumber(square.territory_size || 1)}</dd></div>
            <div><dt>Category</dt><dd>${escapeHtml(square.category || "Other")}</dd></div>
          </dl>
          <div class="traffic-actions">
            <a class="button-link" href="/go/${publicId}" target="_blank" rel="noopener sponsored">Visit ${escapeHtml(host)}</a>
            <a class="button-link secondary" href="/?square=${publicId}">View on grid</a>
            <a class="button-link secondary" href="/profile/${encodeURIComponent(host)}">Owner profile</a>
          </div>
        </div>
      </article>

      <section class="profile-layout listing-support">
        <div class="share-panel">
          <h2>Share this claim</h2>
          <p>Send people to this public listing on your preferred channel.</p>
          <div class="traffic-actions">
            <a class="button-link secondary" href="${share.x}" rel="noopener">Share on X</a>
            <a class="button-link secondary" href="${share.linkedin}" rel="noopener">Share on LinkedIn</a>
            <a class="button-link secondary" href="${share.email}">Email</a>
          </div>
        </div>
        <aside class="profile-panel">
          <h2>Related ${escapeHtml(square.category || "Other")}</h2>
          <ul class="profile-panel-list">${relatedRows || `<li><a href="${categoryPath}">Browse the category</a><span>${escapeHtml(square.category || "Other")}</span></li>`}</ul>
        </aside>
      </section>
      ${badgeSnippet(square, env)}
      <section class="listing-support">
        <article class="profile-panel methodology-page">
          <h2>About this listing</h2>
          <p>This page records purchaser-submitted listing details and measured visits through the tracked outbound link. It does not imply endorsement by the destination company. See the <a href="/about">listing methodology</a> for verification and correction details.</p>
        </article>
      </section>
    </main>
  </body>
</html>`;
}

function leaderboardPage(slug, squares, env) {
  const stats = statsPageData(squares);
  const configs = {
    "most-clicked": {
      title: "Most Clicked Squares",
      description: "Compare the Link for a Dollar squares that have received the most tracked outbound visits from the public discovery board.",
      rows: stats.topPerforming,
      meta: (square) => `${hostFromUrl(square.url)} · ${square.category || "Other"}`,
      value: (square) => `${formatNumber(square.click_count)} clicks`,
    },
    "founding-squares": {
      title: "Founding Squares",
      description: "Browse the earliest genuine paid claims on the Link for a Dollar public million-square discovery board.",
      rows: stats.founding,
      meta: (square) => hostFromUrl(square.url),
      value: (square) => paidDateLabel(square.paid_at),
    },
    "newest-claims": {
      title: "Newest Claims",
      description: "See the newest genuine paid listings added to Link for a Dollar, ordered by their public claim date.",
      rows: stats.recent,
      meta: (square) => hostFromUrl(square.url),
      value: (square) => `#${formatNumber(Number(square.square_id) + 1)}`,
    },
    "largest-territories": {
      title: "Largest Territories",
      description: "Compare Link for a Dollar owners by their number of genuinely claimed squares and connected public territories.",
      rows: stats.largestOwners,
      meta: (owner) => owner.host,
      value: (owner) => `${formatNumber(owner.square_count)} squares`,
      href: (owner) => `/profile/${encodeURIComponent(owner.host)}`,
    },
  };
  const config = configs[slug];

  if (!config) {
    return null;
  }

  const href = config.href || ((square) => `/squares/${Number(square.square_id) + 1}`);
  const path = `/leaderboards/${slug}`;
  const crumbs = [{ name: "Home", path: "/" }, { name: "Stats", path: "/stats" }, { name: config.title, path }];
  const rows = config.rows.map((entry) => `
        <li>
          <a href="${href(entry)}">${escapeHtml(entry.label)}</a>
          <span>${escapeHtml(config.meta(entry))}</span>
          <strong>${escapeHtml(config.value(entry))}</strong>
        </li>`).join("") || emptyRankRow();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${pageHead({
      title: `${config.title} | Link for a Dollar`,
      description: config.description,
      path,
      env,
      jsonLd: pageStructuredData({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: config.title,
        url: absoluteUrl(env, path),
        description: config.description,
      }, crumbs, env),
    })}
    <style>${trafficStyles()}</style>
  </head>
  <body>
    ${siteHeader()}
    <main class="page-shell stats-page">
      ${breadcrumbs(crumbs)}
      <header class="stats-hero">
        <div>
          <p class="eyebrow">Leaderboard</p>
          <h1>${escapeHtml(config.title)}</h1>
          <p>${escapeHtml(config.description)}</p>
          <nav class="leaderboard-nav" aria-label="Leaderboard pages">
            <a class="button-link secondary" href="/leaderboards/most-clicked">Most clicked</a>
            <a class="button-link secondary" href="/leaderboards/founding-squares">Founding squares</a>
            <a class="button-link secondary" href="/leaderboards/newest-claims">Newest claims</a>
            <a class="button-link secondary" href="/leaderboards/largest-territories">Largest territories</a>
          </nav>
        </div>
        <a class="button-link secondary" href="/stats">Stats</a>
      </header>
      <section class="stats-board">
        <ol class="rank-list">${rows}</ol>
      </section>
    </main>
  </body>
</html>`;
}

function profilePage(profile, env) {
  const path = `/profile/${encodeURIComponent(profile.host)}`;
  const description = `View ${profile.label}'s purchaser-submitted Link for a Dollar profile, including ${formatNumber(profile.square_count)} paid ${profile.square_count === 1 ? "square" : "squares"}, territories, category, and tracked visits.`;
  const share = shareLinks({ title: `${profile.label} on Link for a Dollar`, url: absoluteUrl(env, path) });
  const categoryPath = `/collections/${encodeURIComponent(profile.category || "Other")}`;
  const crumbs = [{ name: "Home", path: "/" }, { name: profile.category || "Other", path: categoryPath }, { name: profile.label, path }];
  const squareRows = profile.squares.slice(0, 24).map((square) => `
            <li>
              <a href="/squares/${Number(square.square_id) + 1}">Square #${formatNumber(Number(square.square_id) + 1)}</a>
              <span>${formatNumber(square.click_count)} clicks</span>
            </li>`).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${pageHead({
      title: titleWithSite(profile.label, " profile | Link for a Dollar"),
      description,
      path,
      env,
      imagePath: `/og/profiles/${encodeURIComponent(profile.host)}.png`,
      imageAlt: `${profile.label} owner profile on Link for a Dollar`,
      jsonLd: pageStructuredData({
        "@context": "https://schema.org",
        "@type": profile.verified_company ? "Organization" : "ProfilePage",
        name: profile.label,
        url: profile.verified_company ? profile.url : absoluteUrl(env, path),
        ...(profile.verified_company ? { sameAs: [profile.url] } : {}),
        description,
        additionalProperty: [
          {
            "@type": "PropertyValue",
            name: "Claimed squares",
            value: String(profile.square_count),
          },
          {
            "@type": "PropertyValue",
            name: "Tracked clicks",
            value: String(profile.click_count),
          },
        ],
      }, crumbs, env),
    })}
    <style>${trafficStyles()}</style>
  </head>
  <body>
    ${siteHeader()}
    <main class="page-shell traffic-page">
      ${breadcrumbs(crumbs)}
      <section class="profile-hero-card">
        <span class="claim-mark">${escapeHtml(initialsFor(profile.label, profile.host))}</span>
        <div>
          <p class="eyebrow">Owner profile</p>
          <h1>${escapeHtml(profile.label)}</h1>
          <p>${escapeHtml(profile.host)} ${profile.verified_company ? '<span class="verified-badge">Verified company</span>' : ""}</p>
          ${profile.description ? `<p>${escapeHtml(profile.description)}</p>` : ""}
        </div>
      </section>

      <dl class="profile-stats">
        <div><dt>Squares</dt><dd>${formatNumber(profile.square_count)}</dd></div>
        <div><dt>Territories</dt><dd>${formatNumber(profile.territory_count)}</dd></div>
        <div><dt>Clicks</dt><dd>${formatNumber(profile.click_count)}</dd></div>
        <div><dt>Category</dt><dd>${escapeHtml(profile.category)}</dd></div>
      </dl>

      <section class="profile-layout">
        <article class="profile-panel">
          <h2>Public claim summary</h2>
          <p>A purchaser submitted ${escapeHtml(profile.label)} for ${formatNumber(profile.square_count)} paid ${profile.square_count === 1 ? "square" : "squares"} on the board. The first public claim is square #${formatNumber(profile.first_square)} in <a href="${categoryPath}">${escapeHtml(profile.category || "Other")}</a>.</p>
          <p>This public record reflects purchaser-submitted details and does not imply endorsement by ${escapeHtml(profile.host)}. Read the <a href="/about">listing methodology</a> for verification and corrections.</p>
          <ul class="profile-panel-list">${squareRows}</ul>
          <div class="traffic-actions">
            <a class="button-link" href="/?square=${profile.first_square}">View territory</a>
            <a class="button-link secondary" href="${escapeHtml(profile.url)}" target="_blank" rel="sponsored noopener">Visit site</a>
            <a class="button-link secondary" href="/go/${profile.first_square}">Tracked visit</a>
          </div>
        </article>

        <aside class="share-panel">
          <h2>Share this owner</h2>
          <p>Share the profile page or add the owner badge to create a referral path back to the public claim.</p>
          <div class="traffic-actions">
            <a class="button-link secondary" href="${share.x}" rel="noopener">Share on X</a>
            <a class="button-link secondary" href="${share.linkedin}" rel="noopener">Share on LinkedIn</a>
            <a class="button-link secondary" href="${share.email}">Email</a>
          </div>
          ${badgeSnippet(profile.squares[0], env)}
        </aside>
      </section>
    </main>
  </body>
</html>`;
}

function collectionPage(category, squares, sponsors, env) {
  const rows = squares.slice(0, 50).map((square) => `
        <li>
          <div>
            <a href="/squares/${Number(square.square_id) + 1}">${escapeHtml(square.label)}</a>
            <span>#${Number(square.square_id) + 1} · ${Number(square.click_count || 0)} tracked visits</span>
          </div>
          <div class="collection-actions">
            <a href="/profile/${encodeURIComponent(hostFromUrl(square.url))}">Profile</a>
            <a href="${escapeHtml(square.url)}" target="_blank" rel="sponsored noopener">Visit site</a>
          </div>
        </li>`).join("");
  const path = `/collections/${encodeURIComponent(category)}`;
  const highestSponsor = Math.max(0, ...sponsors.map((sponsor) => Number(sponsor.amount_cents || 0) / 100));
  const sponsorMinimum = Math.max(10, highestSponsor + 1);
  const sponsorRows = sponsors.map((sponsor, index) => `
        <li>
          <span class="sponsor-rank">#${index + 1}</span>
          <div>
            <a href="${escapeHtml(sponsor.url)}" target="_blank" rel="sponsored noopener">${escapeHtml(sponsor.label)}</a>
            <span>${escapeHtml(hostFromUrl(sponsor.url))} · sponsored placement</span>
          </div>
          <strong>$${formatNumber(Number(sponsor.amount_cents || 0) / 100)}</strong>
        </li>`).join("");
  const sponsorOptions = squares.filter((square, index, source) => source.findIndex((entry) => entry.url === square.url) === index).map((square) => {
    const existing = sponsors.find((sponsor) => sponsor.url === square.url);
    return `<option value="${escapeHtml(square.url)}" data-previous="${Number(existing?.amount_cents || 0) / 100}">${escapeHtml(square.label)} · ${escapeHtml(hostFromUrl(square.url))}</option>`;
  }).join("");
  const description = `Browse ${formatNumber(squares.length)} genuinely paid ${category} ${squares.length === 1 ? "listing" : "listings"} on Link for a Dollar, with public square pages, owner profiles, and tracked visits.`;
  const crumbs = [{ name: "Home", path: "/" }, { name: `${category} listings`, path }];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${pageHead({
      title: `${category} Links | Link for a Dollar`,
      description,
      path,
      env,
      jsonLd: pageStructuredData({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${category} listings`,
        url: absoluteUrl(env, path),
        description,
      }, crumbs, env),
    })}
    <style>${trafficStyles()}</style>
  </head>
  <body>
    ${siteHeader()}
    <main class="message-page collection-page">
      ${breadcrumbs(crumbs)}
      <p class="eyebrow">Collection</p>
      <h1>${escapeHtml(category)} listings</h1>
      <p>${squares.length} genuinely paid ${squares.length === 1 ? "square" : "squares"} in this category. Each listing links to its public claim record and owner profile.</p>
      <section class="category-sponsors" aria-labelledby="category-sponsors-title">
        <div class="category-sponsors__heading">
          <div><p class="eyebrow">Paid placement</p><h2 id="category-sponsors-title">${escapeHtml(category)} sponsors</h2></div>
          <span>${sponsors.length ? `${sponsors.length} active` : "Be the first"}</span>
        </div>
        <ol class="sponsor-list">${sponsorRows || '<li class="sponsor-list__empty"><span>No active sponsors yet.</span><strong>Open</strong></li>'}</ol>
        <form class="sponsor-form" action="/sponsor/checkout" method="post">
          <input type="hidden" name="category" value="${escapeHtml(category)}">
          <label>Paid listing<select id="sponsorUrl" name="url" required>${sponsorOptions}</select></label>
          <label>Your cumulative bid<span class="money-input"><span>$</span><input id="sponsorBid" name="sponsor_bid" type="number" min="${sponsorMinimum}" max="10000" step="1" value="${sponsorMinimum}" required></span></label>
          <label>Receipt email <span>(optional)</span><input name="email" type="email" autocomplete="email" maxlength="254"></label>
          <button type="submit">Sponsor this category</button>
          <p id="sponsorHelp">From $10. Highest cumulative bid ranks first for 30 days. Returning sponsors pay only the difference.</p>
        </form>
      </section>
      <ol class="collection-list">${rows || '<li><a href="/">Claim the first square</a><span>Open</span></li>'}</ol>
      <a class="button-link" href="/">Back to the grid</a>
    </main>
    <script>
      const sponsorUrl = document.getElementById("sponsorUrl");
      const sponsorBid = document.getElementById("sponsorBid");
      const sponsorHelp = document.getElementById("sponsorHelp");
      const highestSponsor = ${highestSponsor};
      function updateSponsorBid() {
        const previous = Number(sponsorUrl?.selectedOptions[0]?.dataset.previous || 0);
        const minimum = Math.max(10, highestSponsor + 1, previous + 1);
        sponsorBid.min = String(minimum);
        sponsorBid.value = String(Math.max(minimum, Number(sponsorBid.value || minimum)));
        const due = Number(sponsorBid.value) - previous;
        sponsorHelp.textContent = previous
          ? "Your previous $" + previous + " bid is credited. You pay the $" + due + " difference for another 30 days."
          : "From $10. Pay $" + due + " now; the highest cumulative bid ranks first for 30 days.";
      }
      sponsorUrl?.addEventListener("change", updateSponsorBid);
      sponsorBid?.addEventListener("input", updateSponsorBid);
      updateSponsorBid();
    </script>
  </body>
</html>`;
}

function robotsTxt(env) {
  return `User-agent: *
Allow: /
Disallow: /checkout
Disallow: /go/
Disallow: /stripe/

Sitemap: ${absoluteUrl(env, "/sitemap.xml")}
`;
}

function sitemapUrlsetXml(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>
    <changefreq>${escapeXml(entry.changefreq)}</changefreq>
    <priority>${escapeXml(entry.priority)}</priority>
  </url>`).join("\n")}
</urlset>
`;
}

function sitemapDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.valueOf()) ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

async function sitemapIndexXml(env) {
  const counts = await env.DB.prepare(
    "SELECT COUNT(*) AS square_count, COUNT(DISTINCT owner_host) AS profile_count, MAX(paid_at) AS lastmod FROM squares WHERE status = 'paid'",
  ).first();
  const lastmod = sitemapDate(counts?.lastmod);
  const entries = [{ loc: absoluteUrl(env, "/sitemaps/core.xml"), lastmod }];
  const squarePages = Math.ceil(Number(counts?.square_count || 0) / SITEMAP_PAGE_SIZE);
  const profilePages = Math.ceil(Number(counts?.profile_count || 0) / SITEMAP_PAGE_SIZE);

  for (let page = 1; page <= squarePages; page += 1) {
    entries.push({ loc: absoluteUrl(env, `/sitemaps/squares-${page}.xml`), lastmod });
  }
  for (let page = 1; page <= profilePages; page += 1) {
    entries.push({ loc: absoluteUrl(env, `/sitemaps/profiles-${page}.xml`), lastmod });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => `  <sitemap><loc>${escapeXml(entry.loc)}</loc><lastmod>${escapeXml(entry.lastmod)}</lastmod></sitemap>`).join("\n")}
</sitemapindex>
`;
}

async function coreSitemapXml(env) {
  const { results } = await env.DB.prepare(
    "SELECT category, MAX(paid_at) AS lastmod FROM squares WHERE status = 'paid' GROUP BY category ORDER BY category ASC",
  ).all();
  const categories = results || [];
  const latest = categories.map((entry) => entry.lastmod).filter(Boolean).sort().at(-1);
  const lastmod = sitemapDate(latest);
  const leaderboards = ["most-clicked", "founding-squares", "newest-claims", "largest-territories"];
  const urls = [
    { loc: absoluteUrl(env, "/"), changefreq: "daily", priority: "1.0", lastmod },
    { loc: absoluteUrl(env, "/about"), changefreq: "monthly", priority: "0.6", lastmod },
    { loc: absoluteUrl(env, "/stats"), changefreq: "daily", priority: "0.8", lastmod },
    ...leaderboards.map((slug) => ({ loc: absoluteUrl(env, `/leaderboards/${slug}`), changefreq: "daily", priority: "0.7", lastmod })),
    ...categories.map((entry) => ({
      loc: absoluteUrl(env, `/collections/${encodeURIComponent(entry.category || "Other")}`),
      changefreq: "daily",
      priority: "0.7",
      lastmod: sitemapDate(entry.lastmod),
    })),
  ];
  return sitemapUrlsetXml(urls);
}

async function squareSitemapXml(env, page) {
  if (!Number.isInteger(page) || page < 1) {
    return null;
  }
  const offset = (page - 1) * SITEMAP_PAGE_SIZE;
  const { results } = await env.DB.prepare(
    "SELECT square_id, paid_at FROM squares WHERE status = 'paid' ORDER BY square_id ASC LIMIT ? OFFSET ?",
  ).bind(SITEMAP_PAGE_SIZE, offset).all();
  if (!results?.length) {
    return null;
  }
  return sitemapUrlsetXml(results.map((square) => ({
    loc: absoluteUrl(env, `/squares/${Number(square.square_id) + 1}`),
    changefreq: "weekly",
    priority: "0.6",
    lastmod: sitemapDate(square.paid_at),
  })));
}

async function profileSitemapXml(env, page) {
  if (!Number.isInteger(page) || page < 1) {
    return null;
  }
  const offset = (page - 1) * SITEMAP_PAGE_SIZE;
  const { results } = await env.DB.prepare(
    "SELECT owner_host, MAX(paid_at) AS lastmod FROM squares WHERE status = 'paid' AND owner_host IS NOT NULL GROUP BY owner_host ORDER BY owner_host ASC LIMIT ? OFFSET ?",
  ).bind(SITEMAP_PAGE_SIZE, offset).all();
  if (!results?.length) {
    return null;
  }
  return sitemapUrlsetXml(results.map((profile) => ({
    loc: absoluteUrl(env, `/profile/${encodeURIComponent(profile.owner_host)}`),
    changefreq: "weekly",
    priority: "0.6",
    lastmod: sitemapDate(profile.lastmod),
  })));
}

function recentClaims(squares, limit = 50) {
  return [...squares]
    .sort((a, b) => String(b.paid_at || "").localeCompare(String(a.paid_at || "")) || Number(b.square_id) - Number(a.square_id))
    .slice(0, limit);
}

function claimFeedItem(square, env) {
  const publicId = Number(square.square_id) + 1;
  const host = hostFromUrl(square.url);
  const squareUrl = absoluteUrl(env, `/squares/${publicId}`);
  const profileUrl = absoluteUrl(env, `/profile/${encodeURIComponent(host)}`);
  const paidAt = new Date(square.paid_at || Date.now());

  return {
    id: publicId,
    guid: squareUrl,
    title: `${square.label} claimed square #${publicId}`,
    label: square.label,
    host,
    category: square.category || "Other",
    square_id: publicId,
    click_count: Number(square.click_count || 0),
    territory_size: Number(square.territory_size || 1),
    paid_at: Number.isNaN(paidAt.valueOf()) ? null : paidAt.toISOString(),
    url: squareUrl,
    profile_url: profileUrl,
    owner_url: square.url,
  };
}

function recentClaimsJson(squares, env) {
  const claims = recentClaims(squares).map((square) => claimFeedItem(square, env));

  return {
    title: "Recent Link for a Dollar claims",
    home_url: absoluteUrl(env, "/"),
    feed_url: absoluteUrl(env, "/claims.json"),
    rss_url: absoluteUrl(env, "/feed.xml"),
    updated_at: claims[0]?.paid_at || new Date().toISOString(),
    claims,
  };
}

function rssXml(squares, env) {
  const claims = recentClaims(squares).map((square) => claimFeedItem(square, env));
  const updatedAt = claims[0]?.paid_at || new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Recent Link for a Dollar claims</title>
    <link>${escapeXml(absoluteUrl(env, "/"))}</link>
    <description>Recently claimed squares on the public million-square discovery board.</description>
    <language>en</language>
    <lastBuildDate>${escapeXml(new Date(updatedAt).toUTCString())}</lastBuildDate>
    <atom:link href="${escapeXml(absoluteUrl(env, "/feed.xml"))}" rel="self" type="application/rss+xml"/>
${claims.map((claim) => `    <item>
      <title>${escapeXml(claim.title)}</title>
      <link>${escapeXml(claim.url)}</link>
      <guid isPermaLink="true">${escapeXml(claim.guid)}</guid>
      <pubDate>${escapeXml(new Date(claim.paid_at || Date.now()).toUTCString())}</pubDate>
      <category>${escapeXml(claim.category)}</category>
      <description>${escapeXml(`${claim.label} claimed square #${claim.square_id} in ${claim.category}. Public profile: ${claim.profile_url}`)}</description>
    </item>`).join("\n")}
  </channel>
</rss>
`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function css() {
  return ":root {\n  color-scheme: light;\n  --ink: #14161a;\n  --muted: #667085;\n  --line: #d5d9e2;\n  --paper: #f5f7fb;\n  --panel: #ffffff;\n  --soft: #eef2f7;\n  --accent: #0b6bcb;\n  --accent-dark: #084f96;\n  --claimed: #e44c36;\n  --gold: #c8861a;\n}\n\n* {\n  box-sizing: border-box;\n}\n\nbody {\n  margin: 0;\n  min-height: 100vh;\n  background: var(--paper);\n  color: var(--ink);\n  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n}\n\n.site-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 18px;\n  width: min(1680px, calc(100vw - 28px));\n  margin: 0 auto;\n  padding: 14px 0 0;\n}\n\n.site-brand {\n  color: var(--accent-dark);\n  font-weight: 950;\n  text-decoration: none;\n}\n\n.site-header nav {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 14px;\n}\n\n.site-header nav a,\n.breadcrumbs a {\n  color: var(--accent-dark);\n  font-weight: 850;\n}\n\n.breadcrumbs {\n  margin-bottom: 12px;\n}\n\n.breadcrumbs ol {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 7px;\n  margin: 0;\n  padding: 0;\n  color: var(--muted);\n  font-size: 0.82rem;\n  list-style: none;\n}\n\n.breadcrumbs li:not(:last-child)::after {\n  margin-left: 7px;\n  content: \"/\";\n}\n\n.page-shell {\n  width: min(1680px, calc(100vw - 28px));\n  margin: 0 auto;\n  padding: 18px 0 82px;\n}\n\n.masthead {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 24px;\n  margin-bottom: 12px;\n}\n\n.list-brand {\n  display: none;\n}\n\n.hero-copy {\n  display: grid;\n  gap: 8px;\n}\n\n.hero-kicker {\n  margin: 0;\n  max-width: 18ch;\n  color: var(--ink);\n  font-size: clamp(1.65rem, 3.4vw, 4.2rem);\n  font-weight: 950;\n  line-height: 0.98;\n  text-transform: uppercase;\n}\n\n.hero-subhead {\n  margin: 4px 0 0;\n  max-width: 38rem;\n  color: var(--muted);\n  font-size: clamp(1rem, 1.4vw, 1.35rem);\n  font-weight: 800;\n  line-height: 1.25;\n}\n\n.eyebrow {\n  margin: 0 0 6px;\n  color: var(--muted);\n  font-size: 0.76rem;\n  font-weight: 850;\n  text-transform: uppercase;\n}\n\nh1 {\n  margin: 0;\n  color: var(--accent);\n  font-size: clamp(1.6rem, 2.4vw, 3rem);\n  line-height: 0.96;\n}\n\n.stats,\n.momentum-card,\n.canvas-panel,\n.claim-panel,\n.proof-panel,\n.trending-section,\n.seo-footer,\n.selected-card,\n.value-props li {\n  border: 1px solid var(--line);\n  border-radius: 8px;\n  background: var(--panel);\n}\n\n.stats {\n  display: grid;\n  gap: 2px;\n  min-width: 120px;\n  padding: 14px 16px;\n}\n\n.stats strong {\n  font-size: 1.8rem;\n}\n\n.stats span {\n  color: var(--muted);\n}\n\n.stats a {\n  color: var(--accent-dark);\n  font-size: 0.78rem;\n  font-weight: 900;\n  text-decoration: none;\n  text-transform: uppercase;\n}\n\n.momentum-strip {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: 10px;\n  margin-bottom: 12px;\n}\n\n.momentum-card {\n  min-width: 0;\n  padding: 12px 14px;\n}\n\n.momentum-card span {\n  display: block;\n  margin-bottom: 4px;\n  color: var(--muted);\n  font-size: 0.75rem;\n  font-weight: 850;\n  text-transform: uppercase;\n}\n\n.momentum-card strong {\n  display: block;\n  overflow: hidden;\n  font-size: 0.95rem;\n  line-height: 1.25;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.workspace {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) 380px;\n  gap: 14px;\n  align-items: start;\n}\n\n.canvas-panel {\n  position: relative;\n  display: grid;\n  grid-template-rows: auto minmax(560px, 1fr);\n  overflow: hidden;\n  min-height: calc(100vh - 152px);\n}\n\n.board-toolbar {\n  display: grid;\n  grid-template-columns: minmax(260px, 1fr) 190px auto auto;\n  align-items: center;\n  gap: 10px;\n  padding: 10px;\n  border-bottom: 1px solid var(--line);\n  background: #fff;\n}\n\n.view-toggle {\n  display: inline-flex;\n  align-items: center;\n  padding: 3px;\n  border: 1px solid var(--line);\n  border-radius: 6px;\n  background: var(--soft);\n}\n\n.view-toggle__button {\n  min-height: 34px;\n  padding: 0 12px;\n  background: transparent;\n  color: var(--muted);\n}\n\n.view-toggle__button:hover,\n.view-toggle__button.is-active {\n  background: var(--panel);\n  color: var(--ink);\n}\n\n.view-toggle__button:focus-visible {\n  outline: 3px solid rgba(11, 107, 203, 0.2);\n  outline-offset: 2px;\n}\n\n.search-control {\n  position: relative;\n  min-width: 0;\n}\n\n.sr-only {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  overflow: hidden;\n  clip: rect(0, 0, 0, 0);\n  white-space: nowrap;\n}\n\ninput,\nselect,\ntextarea {\n  width: 100%;\n  min-height: 42px;\n  border: 1px solid var(--line);\n  border-radius: 6px;\n  background: #fff;\n  color: var(--ink);\n  font: inherit;\n  padding: 0 12px;\n}\n\ninput:focus,\nselect:focus,\ntextarea:focus {\n  border-color: var(--accent);\n  outline: 3px solid rgba(11, 107, 203, 0.14);\n}\n\n.search-results {\n  position: absolute;\n  z-index: 6;\n  top: calc(100% + 6px);\n  right: 0;\n  left: 0;\n  overflow: hidden;\n  border: 1px solid var(--line);\n  border-radius: 8px;\n  background: #fff;\n  box-shadow: 0 18px 45px rgba(20, 22, 26, 0.14);\n}\n\n.search-result,\n.proof-action,\nbutton,\n.button-link {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  border: 0;\n  border-radius: 6px;\n  background: var(--accent);\n  color: #fff;\n  font: inherit;\n  font-weight: 850;\n  min-height: 44px;\n  padding: 0 16px;\n  text-decoration: none;\n  cursor: pointer;\n}\n\nbutton:hover,\n.button-link:hover {\n  background: var(--accent-dark);\n}\n\n.search-result {\n  display: grid;\n  grid-template-columns: 34px minmax(0, 1fr) auto;\n  gap: 10px;\n  width: 100%;\n  min-height: 50px;\n  padding: 8px 10px;\n  border-bottom: 1px solid var(--line);\n  border-radius: 0;\n  background: #fff;\n  color: var(--ink);\n  text-align: left;\n  text-decoration: none;\n}\n\n.search-result:last-child {\n  border-bottom: 0;\n}\n\n.search-result:hover,\n.tool-button:hover {\n  background: var(--soft);\n  color: var(--ink);\n}\n\n.search-result strong,\n.search-result span,\n.search-result em,\n.proof-list strong,\n.proof-list span,\n.proof-list em,\n.trending-card strong,\n.trending-card span,\n.trending-card em,\n.selected-card strong,\n.selected-card span {\n  display: block;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.proof-list .mini-logo,\n.trending-card .mini-logo,\n.search-result .mini-logo,\n.selected-card .mini-logo {\n  color: #fff;\n}\n\n.search-result strong,\n.proof-list strong,\n.trending-card strong {\n  font-size: 0.84rem;\n}\n\n.search-result span,\n.search-result em,\n.proof-list span,\n.proof-list em,\n.trending-card span,\n.trending-card em {\n  color: var(--muted);\n  font-size: 0.74rem;\n  font-style: normal;\n}\n\n.zoom-controls {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n}\n\n.tool-button {\n  width: 36px;\n  min-height: 34px;\n  padding: 0;\n  border: 1px solid var(--line);\n  background: #fff;\n  color: var(--ink);\n  line-height: 1;\n}\n\n.tool-button.wide {\n  width: auto;\n  padding: 0 12px;\n}\n\n.zoom-range {\n  min-width: 160px;\n  padding: 0;\n  accent-color: var(--accent);\n}\n\n#grid {\n  display: block;\n  width: 100%;\n  height: 100%;\n  min-height: 560px;\n  image-rendering: pixelated;\n  cursor: grab;\n  touch-action: none;\n}\n\n#grid:active {\n  cursor: grabbing;\n}\n\n#grid[hidden],\n.directory-list[hidden],\n.purchase-map-panel[hidden],\n.zoom-controls[hidden] {\n  display: none;\n}\n\n.directory-list {\n  min-height: 560px;\n  padding: 18px;\n  background: var(--soft);\n}\n\n.directory-list__header {\n  display: flex;\n  align-items: end;\n  justify-content: space-between;\n  gap: 16px;\n  margin-bottom: 14px;\n}\n\n.directory-list__header h2,\n.directory-list__count {\n  margin: 0;\n}\n\n.directory-list__header h2 {\n  font-size: 1.25rem;\n  line-height: 1.15;\n}\n\n.directory-list__count {\n  color: var(--muted);\n  font-size: 0.82rem;\n  font-weight: 800;\n  font-variant-numeric: tabular-nums;\n}\n\n.directory-rows {\n  display: grid;\n  gap: 8px;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n\n.directory-row {\n  display: grid;\n  grid-template-columns: 48px 40px minmax(0, 1fr) 90px auto;\n  align-items: center;\n  gap: 12px;\n  min-width: 0;\n  padding: 13px 14px;\n  border: 1px solid var(--line);\n  border-radius: 8px;\n  background: var(--panel);\n}\n\n.directory-row__rank,\n.directory-row__metric strong {\n  font-variant-numeric: tabular-nums;\n}\n\n.directory-row__rank {\n  color: var(--muted);\n  font-size: 0.88rem;\n  font-weight: 900;\n}\n\n.directory-row__identity,\n.directory-row__metric {\n  display: grid;\n  min-width: 0;\n  gap: 2px;\n}\n\n.directory-row__identity strong,\n.directory-row__identity span {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.directory-row__identity a {\n  color: var(--ink);\n  text-decoration: none;\n}\n\n.directory-row__identity a:hover {\n  color: var(--accent-dark);\n  text-decoration: underline;\n}\n\n.directory-row__identity span,\n.directory-row__metric span {\n  color: var(--muted);\n  font-size: 0.76rem;\n}\n\n.directory-row__metric {\n  text-align: right;\n}\n\n.directory-row__visit {\n  color: var(--accent-dark);\n  font-size: 0.82rem;\n  font-weight: 900;\n  text-decoration: none;\n}\n\n.directory-row__visit:hover {\n  text-decoration: underline;\n}\n\n.directory-empty {\n  display: grid;\n  gap: 5px;\n  padding: 42px 18px;\n  border: 1px dashed var(--line);\n  border-radius: 8px;\n  background: var(--panel);\n  color: var(--muted);\n  text-align: center;\n}\n\n.directory-empty strong {\n  color: var(--ink);\n}\n\nbody[data-directory-mode=\"true\"] {\n  background: #edf7f3;\n  color: #10251f;\n}\n\nbody[data-directory-mode=\"true\"] .site-header,\nbody[data-directory-mode=\"true\"] .page-shell {\n  width: min(980px, calc(100vw - 32px));\n}\n\nbody[data-directory-mode=\"true\"] .site-header {\n  display: none;\n}\n\nbody[data-directory-mode=\"true\"] .site-brand {\n  color: #123f36;\n  font-size: 1.15rem;\n}\n\nbody[data-directory-mode=\"true\"] .site-header nav {\n  display: none;\n}\n\nbody[data-directory-mode=\"true\"] .page-shell {\n  padding-top: 18px;\n}\n\nbody[data-directory-mode=\"true\"] .masthead {\n  position: relative;\n  display: grid;\n  justify-items: center;\n  gap: 16px;\n  margin: 0 auto 30px;\n  padding: 48px 20px 10px;\n  text-align: center;\n}\n\nbody[data-directory-mode=\"true\"] .list-brand {\n  position: absolute;\n  top: 0;\n  left: 0;\n  display: inline-flex;\n  align-items: center;\n  min-height: 40px;\n  color: #123f36;\n  font-size: 1.05rem;\n  font-weight: 900;\n  text-decoration: none;\n}\n\nbody[data-directory-mode=\"true\"] .list-brand::before {\n  display: grid;\n  place-items: center;\n  width: 28px;\n  height: 28px;\n  margin-right: 9px;\n  border-radius: 8px;\n  background: #d8ebe5;\n  color: #177e6d;\n  content: \"↗\";\n}\n\nbody[data-directory-mode=\"true\"] .hero-copy {\n  justify-items: center;\n  gap: 16px;\n}\n\nbody[data-directory-mode=\"true\"] .hero-kicker {\n  max-width: none;\n  margin: 0;\n  padding: 7px 12px;\n  border-radius: 999px;\n  background: #dcece7;\n  color: #27685b;\n  font-size: 0.72rem;\n  font-weight: 850;\n  line-height: 1;\n  text-transform: none;\n}\n\nbody[data-directory-mode=\"true\"] h1 {\n  max-width: 780px;\n  color: #10251f;\n  font-size: clamp(3rem, 7vw, 5rem);\n  line-height: 0.94;\n  text-wrap: balance;\n}\n\nbody[data-directory-mode=\"true\"] .hero-subhead {\n  max-width: 620px;\n  margin: 0;\n  font-size: 1rem;\n  color: #60756f;\n  font-size: 1.04rem;\n  font-weight: 500;\n  line-height: 1.55;\n  text-wrap: pretty;\n}\n\nbody[data-directory-mode=\"true\"] .stats {\n  position: absolute;\n  top: 0;\n  right: 0;\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  min-width: 0;\n  padding: 10px 16px;\n  border-color: #d9e5e1;\n  border-radius: 999px;\n  box-shadow: 0 10px 28px rgba(16, 37, 31, 0.07);\n}\n\nbody[data-directory-mode=\"true\"] .stats::before {\n  content: none;\n}\n\nbody[data-directory-mode=\"true\"] .stats strong {\n  font-size: 0.88rem;\n  font-variant-numeric: tabular-nums;\n}\n\nbody[data-directory-mode=\"true\"] .live-stats__status {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  color: #285f4d;\n}\n\nbody[data-directory-mode=\"true\"] .live-stats__status i {\n  display: inline-block;\n  width: 8px;\n  height: 8px;\n  border-radius: 999px;\n  background: #4ca879;\n}\n\nbody[data-directory-mode=\"true\"] .live-stats__divider {\n  color: var(--line);\n}\n\nbody[data-directory-mode=\"true\"] .live-stats.is-stale .live-stats__status,\nbody[data-directory-mode=\"true\"] .live-stats.is-stale span {\n  color: var(--muted);\n}\n\nbody[data-directory-mode=\"true\"] .live-stats.is-stale .live-stats__status i {\n  background: var(--line);\n}\n\nbody[data-directory-mode=\"true\"] .stats span,\nbody[data-directory-mode=\"true\"] .stats a {\n  font-size: 0.78rem;\n}\n\nbody[data-directory-mode=\"true\"] .momentum-strip {\n  display: none;\n}\n\nbody[data-directory-mode=\"true\"] .workspace {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  gap: 32px;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel {\n  position: static;\n  grid-row: 1;\n  gap: 22px;\n  max-height: none;\n  overflow: visible;\n  padding: 34px;\n  border-color: #dbe5e1;\n  border-radius: 22px;\n  box-shadow: 0 22px 60px rgba(16, 37, 31, 0.1);\n}\n\nbody[data-directory-mode=\"true\"] .canvas-panel {\n  grid-row: 1;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel {\n  grid-row: 2;\n}\n\nbody[data-directory-mode=\"true\"] h1 em {\n  display: block;\n  color: #177e6d;\n  font-style: normal;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row {\n  display: none;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#url),\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#label),\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#logo_url),\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#description),\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#payment_level) {\n  display: grid;\n  grid-column: span 6;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#description) {\n  grid-column: 1 / -1;\n}\n\nbody[data-directory-mode=\"true\"] .auto-brand-note {\n  grid-column: 1 / -1;\n  margin: -4px 0 0;\n  color: #60756f;\n  font-size: 0.8rem;\n  text-align: center;\n}\n\nbody[data-directory-mode=\"true\"] .claim-copy {\n  justify-items: center;\n  text-align: center;\n}\n\nbody[data-directory-mode=\"true\"] .claim-copy h2 {\n  max-width: 680px;\n  color: #10251f;\n  font-size: clamp(1.65rem, 3vw, 2.2rem);\n  line-height: 1.12;\n  text-wrap: balance;\n}\n\nbody[data-directory-mode=\"true\"] .claim-copy .eyebrow {\n  margin-bottom: 0;\n  color: #27806e;\n}\n\nbody[data-directory-mode=\"true\"] .claim-benefits {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: center;\n  gap: 8px 24px;\n  padding: 0;\n  list-style-position: inside;\n  color: #60756f;\n  font-size: 0.84rem;\n  font-weight: 600;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel form {\n  grid-template-columns: repeat(12, minmax(0, 1fr));\n  gap: 14px 12px;\n  padding: 0;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row {\n  grid-column: span 6;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(1),\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(4),\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(5) {\n  grid-column: span 4;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(6) {\n  grid-column: span 8;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(2),\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(3),\nbody[data-directory-mode=\"true\"] .claim-panel form .logo-field,\nbody[data-directory-mode=\"true\"] #checkoutButton {\n  grid-column: 1 / -1;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(8),\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(9) {\n  display: none;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel label {\n  color: #5e726c;\n  font-size: 0.72rem;\n  text-transform: none;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel input,\nbody[data-directory-mode=\"true\"] .claim-panel select,\nbody[data-directory-mode=\"true\"] .money-input {\n  min-height: 52px;\n  border-color: #dce4e1;\n  border-radius: 12px;\n  background: #fbfcfc;\n}\n\nbody[data-directory-mode=\"true\"] .money-input input {\n  min-height: 50px;\n  background: transparent;\n}\n\nbody[data-directory-mode=\"true\"] .payment-level-field small {\n  color: #60756f;\n  font-weight: 550;\n}\n\nbody[data-directory-mode=\"true\"] #checkoutButton {\n  position: static;\n  width: 100%;\n  min-height: 56px;\n  margin-top: 4px;\n  border-radius: 12px;\n  background: #177e6d;\n  box-shadow: none;\n  font-size: 0.98rem;\n}\n\nbody[data-directory-mode=\"true\"] #checkoutButton:hover {\n  background: #11695b;\n}\n\nbody[data-directory-mode=\"true\"] .selection,\nbody[data-directory-mode=\"true\"] .claim-panel .proof-panel {\n  display: none;\n}\n\nbody[data-directory-mode=\"true\"] .canvas-panel {\n  grid-row: 2;\n  grid-template-rows: auto auto;\n  min-height: 0;\n  overflow: visible;\n  border: 0;\n  background: transparent;\n}\n\nbody[data-directory-mode=\"true\"] .board-toolbar {\n  grid-template-columns: minmax(240px, 1fr) 190px auto;\n  margin-bottom: 22px;\n  padding: 0;\n  border: 0;\n  background: transparent;\n}\n\nbody[data-directory-mode=\"true\"] .view-toggle {\n  border-color: #d7e3df;\n  border-radius: 10px;\n  background: #e4efeb;\n}\n\nbody[data-directory-mode=\"true\"] .view-toggle__button {\n  border-radius: 7px;\n}\n\nbody[data-directory-mode=\"true\"] .directory-list {\n  min-height: 0;\n  padding: 0;\n  background: transparent;\n}\n\nbody[data-directory-mode=\"true\"] .directory-list__header {\n  margin-bottom: 18px;\n}\n\nbody[data-directory-mode=\"true\"] .directory-list__header h2 {\n  color: #10251f;\n  font-size: 1.55rem;\n  text-wrap: balance;\n}\n\nbody[data-directory-mode=\"true\"] .directory-rows {\n  gap: 12px;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row {\n  grid-template-columns: 44px 42px minmax(0, 1fr) 140px 84px;\n  min-height: 112px;\n  padding: 18px 20px;\n  border-color: #dce5e1;\n  border-radius: 18px;\n  box-shadow: 0 8px 24px rgba(16, 37, 31, 0.035);\n}\n\nbody[data-directory-mode=\"true\"] .directory-row:nth-child(1) {\n  border-color: #e8c86c;\n  background: #fff1be;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row.is-featured {\n  border-color: #e8c86c;\n  background: #fff1be;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row:nth-child(2) {\n  background: #f3f5f6;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row:nth-child(3) {\n  border-color: #dfc4a4;\n  background: #f5e7d7;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row__rank {\n  font-size: 1rem;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row:nth-child(1) .directory-row__rank::before {\n  content: \"● \";\n  color: #c8861a;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row:nth-child(2) .directory-row__rank::before {\n  content: \"● \";\n  color: #8f98a5;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row:nth-child(3) .directory-row__rank::before {\n  content: \"● \";\n  color: #a9652e;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row .mini-logo {\n  width: 42px;\n  height: 42px;\n  border-radius: 10px;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row__identity {\n  gap: 4px;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row__identity strong {\n  font-size: 1.02rem;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row__metric strong {\n  color: #c75a2a;\n  font-size: 1.02rem;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row__metric span {\n  line-height: 1.25;\n  text-wrap: pretty;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row__visit {\n  text-align: right;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row__actions {\n  position: relative;\n  display: flex;\n  justify-content: flex-end;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row__share {\n  position: absolute;\n  z-index: 2;\n  top: calc(100% + 8px);\n  right: 0;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 7px;\n  border: 1px solid #dce5e1;\n  border-radius: 10px;\n  background: #fff;\n  box-shadow: 0 8px 24px rgba(16, 37, 31, 0.12);\n  opacity: 0;\n  visibility: hidden;\n  pointer-events: none;\n  transform: translateY(-4px);\n  transition: opacity 150ms ease-out, transform 150ms ease-out, visibility 150ms;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row:hover .directory-row__share,\nbody[data-directory-mode=\"true\"] .directory-row:focus-within .directory-row__share {\n  opacity: 1;\n  visibility: visible;\n  pointer-events: auto;\n  transform: translateY(0);\n}\n\nbody[data-directory-mode=\"true\"] .directory-row__share-label {\n  padding: 0 3px;\n  color: #5f6f69;\n  font-size: 0.72rem;\n  font-weight: 800;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row__share a {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 30px;\n  height: 30px;\n  border: 1px solid #dce5e1;\n  border-radius: 50%;\n  background: #fff;\n  color: #10251f;\n  font-size: 0.78rem;\n  font-weight: 900;\n  text-decoration: none;\n}\n\nbody[data-directory-mode=\"true\"] .directory-row__share a:hover,\nbody[data-directory-mode=\"true\"] .directory-row__share a:focus-visible {\n  border-color: #17627d;\n  background: #eaf3f1;\n  outline: none;\n}\n\nbody[data-directory-mode=\"true\"] .directory-rows.is-grid {\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 14px;\n}\n\nbody[data-directory-mode=\"true\"] .directory-rows.is-grid .directory-row {\n  grid-template-columns: 42px minmax(0, 1fr) auto;\n  grid-template-rows: auto 1fr auto;\n  align-items: start;\n  min-height: 192px;\n  padding: 20px;\n}\n\nbody[data-directory-mode=\"true\"] .directory-rows.is-grid .directory-row__rank {\n  grid-column: 1;\n  grid-row: 1;\n}\n\nbody[data-directory-mode=\"true\"] .directory-rows.is-grid .mini-logo {\n  grid-column: 1;\n  grid-row: 2;\n  margin-top: 8px;\n}\n\nbody[data-directory-mode=\"true\"] .directory-rows.is-grid .directory-row__identity {\n  grid-column: 2 / -1;\n  grid-row: 1 / 3;\n  align-self: stretch;\n  padding-right: 8px;\n}\n\nbody[data-directory-mode=\"true\"] .directory-rows.is-grid .directory-row__identity strong {\n  margin-bottom: 4px;\n  font-size: 1.12rem;\n}\n\nbody[data-directory-mode=\"true\"] .directory-rows.is-grid .directory-row__metric {\n  grid-column: 2;\n  grid-row: 3;\n  text-align: left;\n}\n\nbody[data-directory-mode=\"true\"] .directory-rows.is-grid .directory-row__actions {\n  grid-column: 3;\n  grid-row: 3;\n}\n\n@media (hover: none) {\n  body[data-directory-mode=\"true\"] .directory-row__actions {\n    align-items: center;\n    gap: 8px;\n  }\n\n  body[data-directory-mode=\"true\"] .directory-row__share {\n    position: static;\n    padding: 0;\n    border: 0;\n    background: transparent;\n    box-shadow: none;\n    opacity: 1;\n    visibility: visible;\n    pointer-events: auto;\n    transform: none;\n  }\n\n  body[data-directory-mode=\"true\"] .directory-row__share-label {\n    display: none;\n  }\n\n  body[data-directory-mode=\"true\"] .directory-row__share a {\n    width: 28px;\n    height: 28px;\n  }\n}\n\n.purchase-map-panel {\n  position: relative;\n  min-height: 0;\n}\n\n.purchase-map {\n  width: 100%;\n  min-height: 560px;\n  overflow: hidden;\n  border: 1px solid #d7e3df;\n  border-radius: 20px;\n  background: #dcece7;\n}\n\n.map-empty-state {\n  position: absolute;\n  z-index: 10;\n  top: 50%;\n  left: 50%;\n  display: grid;\n  justify-items: center;\n  gap: 8px;\n  width: min(420px, calc(100% - 40px));\n  padding: 24px;\n  border: 1px solid #d7e3df;\n  border-radius: 16px;\n  background: #ffffff;\n  box-shadow: 0 14px 36px rgba(16, 37, 31, 0.12);\n  text-align: center;\n  transform: translate(-50%, -45%);\n}\n\n.map-empty-state[hidden] {\n  display: none;\n}\n\n.map-empty-state span,\n.map-privacy-note {\n  color: #60756f;\n  font-size: 0.8rem;\n  line-height: 1.45;\n  text-wrap: pretty;\n}\n\n.map-empty-state button {\n  min-height: 40px;\n  margin-top: 4px;\n  background: #177e6d;\n}\n\n.map-privacy-note {\n  margin: 10px 2px 0;\n}\n\n.maplibregl-popup-content {\n  display: grid;\n  gap: 4px;\n  min-width: 180px;\n  padding: 14px;\n  border-radius: 12px;\n  color: #10251f;\n}\n\n.maplibregl-popup-content span,\n.maplibregl-popup-content a {\n  font-size: 0.78rem;\n}\n\n.maplibregl-popup-content span {\n  color: #60756f;\n}\n\n.maplibregl-popup-content a {\n  color: #177e6d;\n  font-weight: 800;\n}\n\nbody[data-directory-mode=\"true\"] .trending-section,\nbody[data-directory-mode=\"true\"] .seo-footer {\n  display: none;\n}\n\n.hover-preview {\n  position: absolute;\n  z-index: 10;\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr);\n  gap: 12px;\n  width: min(390px, calc(100% - 28px));\n  padding: 12px;\n  border: 1px solid rgba(20, 22, 26, 0.16);\n  border-radius: 8px;\n  background: rgba(255, 255, 255, 0.98);\n  box-shadow: 0 16px 40px rgba(20, 22, 26, 0.16);\n}\n\n.hover-preview[hidden] {\n  display: none;\n}\n\n.claim-panel {\n  position: sticky;\n  top: 18px;\n  display: grid;\n  gap: 12px;\n  min-width: 0;\n  max-height: calc(100vh - 36px);\n  overflow: auto;\n  padding: 14px;\n}\n\n.claim-panel > *,\n.claim-copy,\nform,\n.field-row,\n.proof-panel,\n.selected-card {\n  min-width: 0;\n}\n\n.claim-copy,\nform,\n.field-row,\n.proof-panel,\n.proof-group,\n.trending-section,\n.footer-about {\n  display: grid;\n}\n\n.claim-copy,\n.footer-about {\n  gap: 10px;\n}\n\nform {\n  gap: 12px;\n}\n\n.claim-panel form {\n  padding-bottom: 58px;\n}\n\n#checkoutButton {\n  position: fixed;\n  right: max(29px, calc((100vw - 1680px) / 2 + 29px));\n  bottom: 14px;\n  z-index: 30;\n  width: min(350px, calc(100vw - 58px));\n  box-shadow: 0 12px 34px rgba(20, 22, 26, 0.24);\n}\n\n.field-row,\n.proof-group {\n  gap: 7px;\n}\n\n.money-input {\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr);\n  align-items: center;\n  min-height: 42px;\n  border: 1px solid var(--line);\n  border-radius: 6px;\n  background: #fff;\n}\n\n.money-input:focus-within {\n  border-color: var(--accent);\n  outline: 3px solid rgba(11, 107, 203, 0.14);\n}\n\n.money-input > span {\n  padding-left: 12px;\n  color: var(--muted);\n  font-weight: 900;\n}\n\n.money-input input {\n  min-height: 40px;\n  border: 0;\n  outline: 0;\n}\n\n.payment-level-field small {\n  color: var(--muted);\n  font-size: 0.76rem;\n  font-weight: 750;\n  line-height: 1.35;\n  text-wrap: pretty;\n}\n\n.claim-copy h2,\n.proof-panel h2,\n.trending-section h2,\n.footer-about h2 {\n  margin: 0;\n  font-size: 1.18rem;\n  line-height: 1.1;\n}\n\n.claim-benefits {\n  display: grid;\n  gap: 6px;\n  margin: 0;\n  padding-left: 18px;\n  color: var(--muted);\n  font-weight: 750;\n}\n\n.rebid-note {\n  margin: 0;\n  padding: 11px 12px;\n  border: 1px solid #cfe3dc;\n  border-radius: 10px;\n  background: #eff8f5;\n  color: #48665e;\n  font-size: 0.78rem;\n  line-height: 1.45;\n  text-wrap: pretty;\n}\n\n.rebid-note strong {\n  color: #176f61;\n}\n\nlabel {\n  color: var(--muted);\n  font-size: 0.78rem;\n  font-weight: 850;\n  text-transform: uppercase;\n}\n\n.field-grid {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 8px;\n}\n\n.checkbox-field {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-height: 42px;\n  padding: 9px 10px;\n  border: 1px solid var(--line);\n  border-radius: 6px;\n  background: #fff;\n  color: var(--ink);\n  font-size: 0.78rem;\n  font-weight: 850;\n  text-transform: none;\n}\n\n.checkbox-field input {\n  width: 16px;\n  min-height: 16px;\n  height: 16px;\n  padding: 0;\n  accent-color: var(--accent);\n}\n\n.selection {\n  display: grid;\n  gap: 6px;\n  border-top: 1px solid var(--line);\n  padding-top: 12px;\n}\n\n.selection span {\n  color: var(--muted);\n}\n\n.selection strong {\n  font-size: 1.35rem;\n}\n\n.selection a {\n  color: var(--accent-dark);\n  font-weight: 800;\n}\n\n.selection a[hidden] {\n  display: none;\n}\n\n.selected-card {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  min-height: 52px;\n  padding: 10px;\n}\n\n.selected-card > div {\n  min-width: 0;\n}\n\n.selected-card strong {\n  color: var(--ink);\n  font-size: 0.94rem;\n}\n\n.selected-card span {\n  color: var(--muted);\n  font-size: 0.82rem;\n  font-weight: 750;\n}\n\n.selected-card a,\n.verified-badge {\n  display: inline-flex;\n  align-items: center;\n  width: fit-content;\n  margin-top: 5px;\n  border-radius: 999px;\n  font-size: 0.7rem;\n  font-weight: 900;\n  line-height: 1;\n  text-decoration: none;\n  text-transform: uppercase;\n}\n\n.selected-card a {\n  color: var(--accent-dark);\n}\n\n.verified-badge {\n  padding: 5px 7px;\n  background: rgba(200, 134, 26, 0.14);\n  color: #80520d;\n  font-style: normal;\n}\n\n.mini-logo,\n.hover-preview__media,\n.hover-preview__empty {\n  display: grid;\n  flex: 0 0 auto;\n  width: 34px;\n  height: 34px;\n  place-items: center;\n  border-radius: 6px;\n  background: var(--brand-color, var(--line));\n  color: #fff;\n  font-size: 0.76rem;\n  font-weight: 900;\n  letter-spacing: 0;\n}\n\n.mini-logo.empty,\n.hover-preview__empty {\n  border: 1px solid var(--line);\n  background:\n    linear-gradient(90deg, rgba(20, 22, 26, 0.08) 1px, transparent 1px),\n    linear-gradient(rgba(20, 22, 26, 0.08) 1px, transparent 1px),\n    #fff;\n}\n\n.mini-logo {\n  position: relative;\n  overflow: hidden;\n}\n\n.mini-logo img {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  padding: 6px;\n  background: #fff;\n  object-fit: contain;\n}\n\n.map-popup-logo {\n  display: block;\n  width: 42px;\n  height: 42px;\n  margin-bottom: 8px;\n  border-radius: 10px;\n  object-fit: contain;\n}\n\n.hover-preview__media,\n.hover-preview__empty {\n  position: relative;\n  width: 54px;\n  height: 54px;\n  border: 1px solid rgba(20, 22, 26, 0.12);\n  border-radius: 8px;\n}\n\n.hover-preview__media img {\n  grid-area: 1 / 1;\n  width: 38px;\n  height: 38px;\n  border-radius: 7px;\n  background: #fff;\n  object-fit: contain;\n}\n\n.hover-preview__media span {\n  position: absolute;\n  right: 4px;\n  bottom: 4px;\n  min-width: 20px;\n  border-radius: 4px;\n  background: var(--brand-color, var(--accent));\n  color: #fff;\n  font-size: 0.62rem;\n  line-height: 1;\n  padding: 4px;\n  text-align: center;\n}\n\n.hover-preview__body {\n  display: grid;\n  min-width: 0;\n  gap: 10px;\n}\n\n.hover-preview__header {\n  display: flex;\n  align-items: start;\n  justify-content: space-between;\n  gap: 12px;\n  min-width: 0;\n}\n\n.hover-preview__header > div {\n  min-width: 0;\n}\n\n.hover-preview__eyebrow,\n.hover-preview__summary {\n  margin: 0;\n  color: var(--muted);\n  font-size: 0.76rem;\n  font-weight: 800;\n}\n\n.hover-preview__eyebrow {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  text-transform: uppercase;\n  white-space: nowrap;\n}\n\n.hover-preview__title {\n  display: block;\n  overflow-wrap: anywhere;\n  font-size: 1rem;\n  line-height: 1.15;\n}\n\n.hover-preview__visit {\n  flex: 0 0 auto;\n  border: 1px solid var(--accent);\n  border-radius: 999px;\n  color: var(--accent-dark);\n  font-size: 0.74rem;\n  font-weight: 900;\n  line-height: 1;\n  padding: 7px 10px;\n  text-decoration: none;\n  text-transform: uppercase;\n}\n\n.hover-preview__visit:hover,\n.hover-preview__visit:focus-visible {\n  background: var(--accent);\n  color: #fff;\n  outline: none;\n}\n\n.hover-preview__meta {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 6px;\n  margin: 0;\n}\n\n.hover-preview__meta div {\n  min-width: 0;\n  border: 1px solid rgba(20, 22, 26, 0.1);\n  border-radius: 6px;\n  background: #fff;\n  padding: 6px 7px;\n}\n\n.hover-preview__meta dt {\n  color: var(--muted);\n  font-size: 0.64rem;\n  font-weight: 900;\n  text-transform: uppercase;\n}\n\n.hover-preview__meta dd {\n  margin: 1px 0 0;\n  font-size: 0.82rem;\n  font-weight: 900;\n  overflow-wrap: anywhere;\n}\n\n.hover-preview__card {\n  display: flex;\n  align-items: center;\n  min-width: 0;\n  gap: 10px;\n  border-top: 1px solid rgba(20, 22, 26, 0.1);\n  padding-top: 10px;\n}\n\n.hover-preview__card > div {\n  min-width: 0;\n}\n\n.hover-preview__card strong,\n.hover-preview__card span:not(.mini-logo) {\n  display: block;\n  max-width: 100%;\n  overflow-wrap: anywhere;\n}\n\n.proof-panel {\n  gap: 12px;\n  padding: 12px;\n}\n\n.proof-group h3 {\n  margin: 0;\n  color: var(--muted);\n  font-size: 0.72rem;\n  font-weight: 900;\n  text-transform: uppercase;\n}\n\n.proof-list {\n  display: grid;\n  gap: 7px;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n\n.proof-list li,\n.trending-card {\n  display: grid;\n  grid-template-columns: 34px minmax(0, 1fr) auto;\n  align-items: center;\n  gap: 10px;\n  min-height: 48px;\n  padding: 8px;\n  border: 1px solid var(--line);\n  border-radius: 7px;\n  background: var(--paper);\n  color: var(--ink);\n  text-align: left;\n  text-decoration: none;\n}\n\n.proof-list.compact li {\n  grid-template-columns: minmax(0, 1fr) auto;\n}\n\n.proof-action {\n  min-height: 32px;\n  padding: 0 9px;\n  border: 1px solid var(--line);\n  background: #fff;\n  color: var(--accent-dark);\n  font-size: 0.75rem;\n}\n\n.proof-action:hover {\n  background: var(--accent);\n  color: #fff;\n}\n\n.trending-section {\n  gap: 12px;\n  margin-top: 14px;\n  padding: 14px;\n}\n\n.trending-section > div:first-child {\n  display: flex;\n  align-items: end;\n  justify-content: space-between;\n  gap: 16px;\n}\n\n.trending-grid {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: 10px;\n}\n\n.seo-footer {\n  display: grid;\n  grid-template-columns: minmax(260px, 0.72fr) minmax(0, 1fr);\n  gap: 18px;\n  margin-top: 14px;\n  padding: 18px;\n}\n\n.footer-about {\n  align-content: start;\n}\n\n.footer-about p {\n  margin: 0;\n  color: var(--muted);\n  line-height: 1.45;\n}\n\n.value-props {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 10px;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n\n.value-props li {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 10px;\n  min-height: 46px;\n  padding: 10px 12px;\n  font-weight: 800;\n}\n\n.info-tip {\n  flex: 0 0 auto;\n  width: 22px;\n  min-height: 22px;\n  height: 22px;\n  border: 1px solid var(--line);\n  border-radius: 50%;\n  background: #fff;\n  color: var(--accent-dark);\n  font-size: 0.75rem;\n  font-weight: 900;\n  line-height: 1;\n  padding: 0;\n}\n\n.info-tip:hover,\n.info-tip:focus-visible {\n  background: var(--accent);\n  color: #fff;\n  outline: none;\n}\n\n.message-page {\n  display: grid;\n  gap: 16px;\n  width: min(560px, calc(100vw - 32px));\n  margin: 15vh auto;\n}\n\n.message-page p {\n  color: var(--muted);\n  font-size: 1.1rem;\n}\n\n.profile-page,\n.collection-page {\n  width: min(760px, calc(100vw - 32px));\n}\n\n.stats-page {\n  display: grid;\n  gap: 14px;\n}\n\n.stats-hero {\n  display: flex;\n  align-items: end;\n  justify-content: space-between;\n  gap: 18px;\n  padding: 18px;\n  border: 1px solid var(--line);\n  border-radius: 8px;\n  background: #fff;\n}\n\n.stats-hero h1,\n.stats-hero p {\n  margin: 0;\n}\n\n.stats-hero > div {\n  display: grid;\n  gap: 8px;\n}\n\n.stats-hero > div > p:last-child {\n  max-width: 52rem;\n  color: var(--muted);\n  font-size: 1rem;\n  font-weight: 750;\n  line-height: 1.35;\n}\n\n.stats-summary,\n.stats-grid {\n  display: grid;\n  gap: 10px;\n}\n\n.stats-summary {\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n}\n\n.stats-summary div,\n.stats-board {\n  border: 1px solid var(--line);\n  border-radius: 8px;\n  background: #fff;\n}\n\n.stats-summary div {\n  display: grid;\n  gap: 6px;\n  padding: 14px;\n}\n\n.stats-summary span {\n  color: var(--muted);\n  font-size: 0.74rem;\n  font-weight: 900;\n  text-transform: uppercase;\n}\n\n.stats-summary strong {\n  font-size: clamp(1.5rem, 3vw, 2.4rem);\n  line-height: 1;\n}\n\n.stats-grid {\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n\n.stats-board {\n  min-width: 0;\n  padding: 14px;\n}\n\n.stats-board--wide {\n  grid-column: 1 / -1;\n}\n\n.stats-board h2 {\n  margin: 0 0 12px;\n  font-size: 1.18rem;\n}\n\n/* Premium stats dashboard */\nbody[data-stats-mode=\"true\"] {\n  --stats-ink: #10251f;\n  --stats-accent: #177e6d;\n  --stats-accent-dark: #11695b;\n  --stats-soft: #dcefe9;\n  --stats-line: #cfe0da;\n  min-height: 100vh;\n  background: #edf7f3;\n  color: var(--stats-ink);\n}\n\nbody[data-stats-mode=\"true\"] .site-header,\nbody[data-stats-mode=\"true\"] .page-shell {\n  width: min(1080px, calc(100vw - 32px));\n}\n\nbody[data-stats-mode=\"true\"] .stats-page {\n  gap: 22px;\n  padding-bottom: 64px;\n}\n\nbody[data-stats-mode=\"true\"] .breadcrumbs {\n  color: #55716a;\n}\n\nbody[data-stats-mode=\"true\"] .site-header a,\nbody[data-stats-mode=\"true\"] .breadcrumbs a {\n  color: var(--stats-accent-dark);\n}\n\nbody[data-stats-mode=\"true\"] .stats-hero {\n  align-items: center;\n  padding: 38px 42px;\n  border-color: #bdd8cf;\n  border-radius: 22px;\n  background: #e2f2ed;\n  box-shadow: 0 18px 50px rgba(24, 77, 65, 0.08);\n}\n\nbody[data-stats-mode=\"true\"] .stats-hero > div {\n  gap: 12px;\n}\n\nbody[data-stats-mode=\"true\"] .eyebrow {\n  color: var(--stats-accent);\n  letter-spacing: 0.08em;\n}\n\nbody[data-stats-mode=\"true\"] .stats-hero h1 {\n  max-width: 720px;\n  color: var(--stats-ink);\n  font-size: clamp(2.35rem, 5.4vw, 4.8rem);\n  line-height: 0.96;\n  letter-spacing: -0.055em;\n  text-wrap: balance;\n}\n\nbody[data-stats-mode=\"true\"] .stats-hero h1 span {\n  color: var(--stats-accent);\n}\n\nbody[data-stats-mode=\"true\"] .stats-hero > div > p:last-of-type {\n  max-width: 620px;\n  color: #536d66;\n  font-size: 1.02rem;\n  font-weight: 650;\n}\n\nbody[data-stats-mode=\"true\"] .stats-hero .button-link {\n  flex: 0 0 auto;\n  min-height: 46px;\n  padding: 0 18px;\n  border-color: var(--stats-accent);\n  border-radius: 12px;\n  background: var(--stats-accent);\n  color: #fff;\n  white-space: nowrap;\n}\n\nbody[data-stats-mode=\"true\"] .leaderboard-nav {\n  margin-top: 4px;\n}\n\nbody[data-stats-mode=\"true\"] .leaderboard-nav .button-link.secondary {\n  min-height: 34px;\n  padding: 0 11px;\n  border-color: #bdd8cf;\n  background: rgba(255, 255, 255, 0.58);\n  color: #315e54;\n  font-size: 0.78rem;\n}\n\nbody[data-stats-mode=\"true\"] .stats-summary {\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 12px;\n}\n\nbody[data-stats-mode=\"true\"] .stats-summary div,\nbody[data-stats-mode=\"true\"] .stats-board {\n  border-color: var(--stats-line);\n  border-radius: 16px;\n  background: rgba(255, 255, 255, 0.86);\n  box-shadow: 0 10px 30px rgba(24, 77, 65, 0.05);\n}\n\nbody[data-stats-mode=\"true\"] .stats-summary div {\n  gap: 7px;\n  padding: 20px;\n}\n\nbody[data-stats-mode=\"true\"] .stats-summary span {\n  color: #5f766f;\n  letter-spacing: 0.04em;\n}\n\nbody[data-stats-mode=\"true\"] .stats-summary strong {\n  color: var(--stats-ink);\n  font-variant-numeric: tabular-nums;\n}\n\nbody[data-stats-mode=\"true\"] .stats-summary small {\n  color: #71867f;\n  font-size: 0.76rem;\n  font-weight: 650;\n  line-height: 1.3;\n}\n\n.stats-live-dot {\n  display: inline-block;\n  width: 8px;\n  height: 8px;\n  margin-right: 7px;\n  border-radius: 50%;\n  background: var(--stats-accent);\n}\n\nbody[data-stats-mode=\"true\"] .stats-freshness {\n  color: #527069;\n  font-size: 0.78rem;\n  font-weight: 750;\n}\n\nbody[data-stats-mode=\"true\"] .stats-freshness.is-stale {\n  color: #8a5b00;\n}\n\nbody[data-stats-mode=\"true\"] .stats-summary__live {\n  border-color: #9fcabd;\n  background: #f7fcfa;\n}\n\n.stats-method {\n  margin: -8px 2px 0;\n  color: #607871;\n  font-size: 0.78rem;\n  line-height: 1.5;\n  text-wrap: pretty;\n}\n\n.stats-method strong {\n  color: var(--stats-ink);\n}\n\n.stats-charts {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 14px;\n}\n\nbody[data-stats-mode=\"true\"] .stats-board {\n  padding: 22px;\n}\n\n.stats-chart {\n  min-width: 0;\n  margin: 0;\n}\n\n.stats-chart figcaption {\n  margin-bottom: 22px;\n}\n\n.stats-chart figcaption h2 {\n  margin: 3px 0 7px;\n  color: var(--stats-ink);\n  font-size: 1.35rem;\n  letter-spacing: -0.025em;\n}\n\n.stats-chart figcaption > p:last-child {\n  max-width: 48ch;\n  margin: 0;\n  color: #647a74;\n  font-size: 0.88rem;\n  font-weight: 600;\n  line-height: 1.45;\n}\n\n.stats-chart__rows {\n  display: grid;\n  gap: 13px;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n\n.stats-chart__rows li {\n  display: grid;\n  grid-template-columns: minmax(96px, 0.7fr) minmax(110px, 1.4fr) 42px;\n  align-items: center;\n  gap: 10px;\n}\n\n.stats-chart__rows a {\n  overflow: hidden;\n  color: var(--stats-ink);\n  font-size: 0.82rem;\n  font-weight: 800;\n  text-decoration: none;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.stats-chart__rows strong {\n  color: #36564e;\n  font-size: 0.82rem;\n  font-variant-numeric: tabular-nums;\n  text-align: right;\n}\n\n.stats-chart__track {\n  display: block;\n  height: 12px;\n  overflow: hidden;\n  border-radius: 4px;\n  background: #e7f0ed;\n}\n\n.stats-chart__track i {\n  display: block;\n  width: var(--bar-size);\n  height: 100%;\n  border-radius: inherit;\n  background: var(--stats-accent);\n}\n\n.stats-chart__axis {\n  display: flex;\n  justify-content: space-between;\n  margin: 12px 52px 0 calc(0.7 / 2.1 * (100% - 172px) + 106px);\n  color: #83958f;\n  font-size: 0.67rem;\n  font-variant-numeric: tabular-nums;\n  font-weight: 700;\n}\n\n.stats-chart__empty {\n  grid-template-columns: 1fr !important;\n  padding: 18px;\n  border: 1px dashed var(--stats-line);\n  border-radius: 10px;\n  text-align: center;\n}\n\nbody[data-stats-mode=\"true\"] .stats-grid {\n  gap: 14px;\n}\n\nbody[data-stats-mode=\"true\"] .stats-board h2 {\n  color: var(--stats-ink);\n}\n\nbody[data-stats-mode=\"true\"] .rank-list li {\n  border-color: #dce8e4;\n  border-radius: 10px;\n  background: #f7fbf9;\n}\n\nbody[data-stats-mode=\"true\"] .rank-list a {\n  color: var(--stats-ink);\n}\n\nbody[data-stats-mode=\"true\"] .rank-list strong {\n  color: var(--stats-accent-dark);\n  font-variant-numeric: tabular-nums;\n}\n\n.rank-list {\n  display: grid;\n  gap: 8px;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n\n.rank-list li {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) minmax(120px, 0.45fr) auto;\n  align-items: center;\n  gap: 10px;\n  min-height: 48px;\n  padding: 9px 10px;\n  border: 1px solid var(--line);\n  border-radius: 7px;\n  background: var(--paper);\n}\n\n.rank-list a,\n.rank-list span,\n.rank-list strong {\n  display: block;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.rank-list a {\n  color: var(--ink);\n  font-weight: 900;\n  text-decoration: none;\n}\n\n.rank-list span {\n  color: var(--muted);\n  font-size: 0.82rem;\n  font-weight: 750;\n}\n\n.rank-list strong {\n  color: var(--accent-dark);\n  font-size: 0.82rem;\n  text-align: right;\n}\n\n.category-rank-list {\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n\n.category-rank-list li {\n  grid-template-columns: minmax(0, 1fr) auto auto;\n}\n\n.profile-stats {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: 10px;\n  margin: 0;\n}\n\n.profile-stats div,\n.collection-list li {\n  border: 1px solid var(--line);\n  border-radius: 8px;\n  background: #fff;\n  padding: 12px;\n}\n\n.collection-list li > div:first-child {\n  display: grid;\n  min-width: 0;\n  gap: 4px;\n}\n\n.collection-actions {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: end;\n  gap: 10px;\n}\n\n.methodology-page {\n  display: grid;\n  gap: 10px;\n}\n\n.methodology-page h1,\n.methodology-page h2,\n.methodology-page p {\n  margin: 0;\n}\n\n.methodology-page h2 {\n  margin-top: 12px;\n}\n\na:focus-visible,\nbutton:focus-visible,\ninput:focus-visible,\nselect:focus-visible {\n  outline: 3px solid rgba(11, 107, 203, 0.32);\n  outline-offset: 2px;\n}\n\n.profile-stats dt {\n  color: var(--muted);\n  font-size: 0.72rem;\n  font-weight: 900;\n  text-transform: uppercase;\n}\n\n.profile-stats dd {\n  margin: 4px 0 0;\n  font-size: 1.4rem;\n  font-weight: 950;\n}\n\n.profile-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px;\n}\n\n.button-link.secondary {\n  border: 1px solid var(--line);\n  background: #fff;\n  color: var(--accent-dark);\n}\n\n.collection-list {\n  display: grid;\n  gap: 8px;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n\n.collection-list li {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.collection-list a {\n  color: var(--accent-dark);\n  font-weight: 900;\n}\n\n.collection-list span {\n  color: var(--muted);\n  font-size: 0.82rem;\n  font-weight: 800;\n}\n\n@media (max-width: 1100px) {\n  .workspace {\n    grid-template-columns: minmax(0, 1fr) 340px;\n  }\n\n  .board-toolbar {\n    grid-template-columns: 1fr;\n  }\n\n  .zoom-controls {\n    justify-content: space-between;\n  }\n}\n\n@media (max-width: 900px) {\n  .site-header {\n    align-items: flex-start;\n    display: grid;\n  }\n  .masthead,\n  .workspace,\n  .momentum-strip,\n  .trending-grid,\n  .seo-footer,\n  .value-props,\n  .profile-stats,\n  .stats-summary,\n  .stats-grid,\n  .category-rank-list {\n    display: grid;\n    grid-template-columns: 1fr;\n  }\n\n  .stats-hero {\n    align-items: start;\n    display: grid;\n  }\n\n  .rank-list li,\n  .category-rank-list li {\n    grid-template-columns: minmax(0, 1fr) auto;\n  }\n\n  .rank-list span {\n    grid-column: 1 / -1;\n  }\n\n  .claim-panel {\n    position: static;\n    max-height: none;\n  }\n\n  .board-toolbar {\n    padding: 8px;\n  }\n\n  .zoom-controls {\n    display: grid;\n    grid-template-columns: 34px minmax(0, 1fr) 34px auto;\n    width: 100%;\n  }\n\n  .zoom-range {\n    width: 100%;\n    min-width: 0;\n  }\n\n  .canvas-panel,\n  #grid {\n    min-height: 62vh;\n  }\n\n  .directory-list {\n    min-height: 62vh;\n    padding: 10px;\n  }\n\n  .directory-list__header {\n    align-items: start;\n  }\n\n  .directory-row {\n    grid-template-columns: 38px 34px minmax(0, 1fr) auto;\n    gap: 9px;\n    padding: 11px 10px;\n  }\n\n  .directory-row__metric {\n    display: none;\n  }\n\n  .directory-row__visit {\n    grid-column: 3 / -1;\n    width: fit-content;\n  }\n\n  body[data-directory-mode=\"true\"] .page-shell {\n    padding-top: 16px;\n  }\n\n  body[data-directory-mode=\"true\"] .masthead {\n    padding: 58px 0 0;\n  }\n\n  body[data-directory-mode=\"true\"] .stats {\n    position: static;\n    justify-self: center;\n  }\n\n  body[data-directory-mode=\"true\"] .list-brand {\n    right: 0;\n    justify-content: center;\n  }\n\n  body[data-directory-mode=\"true\"] .claim-panel {\n    padding: 18px;\n  }\n\n  body[data-directory-mode=\"true\"] .claim-panel form,\n  body[data-directory-mode=\"true\"] .board-toolbar {\n    grid-template-columns: 1fr;\n  }\n\n  body[data-directory-mode=\"true\"] .claim-panel form .field-row,\n  body[data-directory-mode=\"true\"] #checkoutButton {\n    grid-column: 1 / -1;\n    width: 100%;\n  }\n\n  body[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(1),\n  body[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(2),\n  body[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(3),\n  body[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(4),\n  body[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(5),\n  body[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(6),\n  body[data-directory-mode=\"true\"] .claim-panel form .field-row:nth-child(7) {\n    grid-column: 1 / -1;\n  }\n\n  body[data-directory-mode=\"true\"] .directory-row {\n    grid-template-columns: 38px 42px minmax(0, 1fr) auto;\n    min-height: 94px;\n  }\n\n  body[data-directory-mode=\"true\"] .directory-row__metric {\n    display: grid;\n  }\n\n  body[data-directory-mode=\"true\"] .directory-row__visit {\n    grid-column: 3 / -1;\n  }\n\n  body[data-directory-mode=\"true\"] .directory-rows.is-grid {\n    grid-template-columns: 1fr;\n  }\n\n  body[data-directory-mode=\"true\"] .directory-rows.is-grid .directory-row {\n    min-height: 176px;\n  }\n\n  .purchase-map {\n    min-height: 480px;\n  }\n}\n\n@media (max-width: 360px) {\n  .page-shell {\n    width: min(1680px, calc(100vw - 16px));\n  }\n\n  .claim-panel,\n  .proof-panel,\n  .trending-section,\n  .seo-footer {\n    padding: 10px;\n  }\n\n  #checkoutButton {\n    right: 19px;\n    width: calc(100vw - 38px);\n  }\n\n  .tool-button.wide {\n    padding: 0 10px;\n  }\n\n  .directory-list__header {\n    display: grid;\n  }\n\n  .directory-row {\n    grid-template-columns: 30px 34px minmax(0, 1fr);\n  }\n\n  .directory-row__visit {\n    grid-column: 3;\n  }\n\n  body[data-directory-mode=\"true\"] .site-header,\n  body[data-directory-mode=\"true\"] .page-shell {\n    width: calc(100vw - 20px);\n  }\n\n  body[data-directory-mode=\"true\"] .hero-kicker {\n    font-size: 0.72rem;\n  }\n\nbody[data-directory-mode=\"true\"] .claim-benefits {\n    display: grid;\n    justify-content: start;\n    text-align: left;\n  }\n\n  body[data-directory-mode=\"true\"] .directory-list__header {\n    display: grid;\n  }\n\n  body[data-directory-mode=\"true\"] .directory-row {\n    grid-template-columns: 30px 38px minmax(0, 1fr);\n    padding: 13px 12px;\n  }\n\n  body[data-directory-mode=\"true\"] .directory-row .mini-logo {\n    width: 38px;\n    height: 38px;\n  }\n\n  body[data-directory-mode=\"true\"] .directory-row__metric {\n    display: none;\n  }\n}\n\nbody[data-directory-mode=\"true\"] .rebid-note {\n  width: min(680px, 100%);\n  padding: 12px 14px;\n  text-align: left;\n}\n\nbody[data-directory-mode=\"true\"] .canvas-panel {\n  grid-row: 1;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel {\n  grid-row: 2;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row {\n  display: none;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#url),\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#label),\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#logo_url),\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#description),\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#payment_level) {\n  display: grid;\n  grid-column: span 6;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#description) {\n  grid-column: 1 / -1;\n}\n\n@media (max-width: 760px) {\n  body[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#url),\n  body[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#label),\n  body[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#logo_url),\n  body[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#description),\n  body[data-directory-mode=\"true\"] .claim-panel form .field-row:has(#payment_level) {\n    grid-column: 1 / -1;\n  }\n}\n\n@media (max-width: 760px) {\n  body[data-stats-mode=\"true\"] .stats-page {\n    gap: 14px;\n  }\n\n  body[data-stats-mode=\"true\"] .stats-hero {\n    align-items: stretch;\n    padding: 26px 22px;\n    border-radius: 18px;\n  }\n\n  body[data-stats-mode=\"true\"] .stats-hero h1 {\n    font-size: clamp(2.25rem, 12vw, 3.25rem);\n  }\n\n  body[data-stats-mode=\"true\"] .stats-hero .button-link {\n    align-self: start;\n  }\n\n  body[data-stats-mode=\"true\"] .leaderboard-nav {\n    display: none;\n  }\n\n  body[data-stats-mode=\"true\"] .stats-summary {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n\n  body[data-stats-mode=\"true\"] .stats-summary div,\n  body[data-stats-mode=\"true\"] .stats-board {\n    padding: 17px;\n  }\n\n  .stats-charts {\n    grid-template-columns: 1fr;\n  }\n\n  .stats-chart__rows li {\n    grid-template-columns: minmax(82px, 0.7fr) minmax(80px, 1.4fr) 34px;\n    gap: 8px;\n  }\n\n  .stats-chart__axis {\n    display: none;\n  }\n}\n\n/* Centre hero copy against the full directory column, not its intrinsic text width. */\nbody[data-directory-mode=\"true\"] .hero-copy {\n  width: 100%;\n  justify-items: center;\n  text-align: center;\n}\n\nbody[data-directory-mode=\"true\"] .masthead {\n  grid-template-columns: minmax(0, 1fr);\n  justify-content: stretch;\n}\n\nbody[data-directory-mode=\"true\"] .hero-kicker,\nbody[data-directory-mode=\"true\"] h1,\nbody[data-directory-mode=\"true\"] .hero-subhead {\n  margin-right: auto;\n  margin-left: auto;\n}\n\nbody[data-directory-mode=\"true\"] .hero-claim-button {\n  min-width: 190px;\n  min-height: 50px;\n  margin-top: 4px;\n  border-radius: 12px;\n  background: #177e6d;\n  font-size: 0.95rem;\n}\n\nbody[data-directory-mode=\"true\"] .hero-claim-button:hover {\n  background: #11695b;\n}\n\n.claim-dialog {\n  width: min(920px, calc(100vw - 32px));\n  max-width: none;\n  max-height: min(90dvh, 760px);\n  padding: 0;\n  overflow: auto;\n  border: 0;\n  border-radius: 20px;\n  background: transparent;\n}\n\n.claim-dialog::backdrop {\n  background: rgba(16, 37, 31, 0.58);\n}\n\n.claim-dialog__close {\n  position: absolute;\n  z-index: 2;\n  top: 12px;\n  right: 12px;\n  width: 36px;\n  min-height: 36px;\n  padding: 0;\n  border: 1px solid #dbe5e1;\n  border-radius: 50%;\n  background: #fff;\n  color: #10251f;\n  font-size: 1.35rem;\n  line-height: 1;\n}\n\nbody[data-directory-mode=\"true\"] .claim-dialog .claim-panel {\n  width: 100%;\n  margin: 0;\n  box-shadow: none;\n}\n\n@media (max-width: 760px) {\n  body[data-directory-mode=\"true\"] .hero-claim-button {\n    min-width: 170px;\n    min-height: 46px;\n  }\n\n  .claim-dialog {\n    width: calc(100vw - 20px);\n    max-height: 92dvh;\n    border-radius: 16px;\n  }\n}\n\n/* Compact premium layout. Keep these final so legacy grid rules cannot override it. */\nbody[data-directory-mode=\"true\"] .masthead {\n  gap: 10px;\n  margin-bottom: 22px;\n  padding: 44px 20px 4px;\n}\n\nbody[data-directory-mode=\"true\"] .hero-copy {\n  gap: 10px;\n}\n\nbody[data-directory-mode=\"true\"] h1 {\n  max-width: 720px;\n  font-size: clamp(2.25rem, 5.2vw, 4.15rem);\n  line-height: 0.98;\n}\n\nbody[data-directory-mode=\"true\"] .hero-subhead {\n  max-width: 660px;\n  font-size: 0.95rem;\n  line-height: 1.45;\n}\n\nbody[data-directory-mode=\"true\"] .workspace {\n  gap: 24px;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel {\n  justify-self: center;\n  width: min(880px, 100%);\n  gap: 15px;\n  padding: 24px 28px;\n  border-radius: 18px;\n}\n\nbody[data-directory-mode=\"true\"] .claim-copy {\n  gap: 9px;\n}\n\nbody[data-directory-mode=\"true\"] .claim-copy h2 {\n  max-width: 560px;\n  font-size: clamp(1.4rem, 2.4vw, 1.85rem);\n  line-height: 1.1;\n}\n\nbody[data-directory-mode=\"true\"] .claim-benefits {\n  gap: 6px 18px;\n  margin: 0;\n  font-size: 0.78rem;\n  list-style: none;\n}\n\nbody[data-directory-mode=\"true\"] .claim-benefits li {\n  display: inline-flex;\n  align-items: center;\n  gap: 7px;\n}\n\nbody[data-directory-mode=\"true\"] .claim-benefits li::before {\n  width: 5px;\n  height: 5px;\n  flex: 0 0 5px;\n  border-radius: 50%;\n  background: #27806e;\n  content: \"\";\n}\n\nbody[data-directory-mode=\"true\"] .rebid-note {\n  width: min(620px, 100%);\n  margin: 0;\n  padding: 9px 12px;\n  font-size: 0.78rem;\n  line-height: 1.4;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel form {\n  width: min(760px, 100%);\n  margin: 0 auto;\n  gap: 10px 12px;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel input,\nbody[data-directory-mode=\"true\"] .claim-panel select,\nbody[data-directory-mode=\"true\"] .claim-panel textarea,\nbody[data-directory-mode=\"true\"] .money-input {\n  min-height: 46px;\n}\n\nbody[data-directory-mode=\"true\"] .claim-panel textarea {\n  min-height: 76px;\n  resize: vertical;\n}\n\nbody[data-directory-mode=\"true\"] .money-input input {\n  min-height: 44px;\n}\n\nbody[data-directory-mode=\"true\"] #checkoutButton {\n  min-height: 50px;\n  margin-top: 0;\n}\n\nbody[data-directory-mode=\"true\"] .auto-brand-note {\n  margin: -2px 0 0;\n  font-size: 0.75rem;\n}\n\n@media (max-width: 760px) {\n  body[data-directory-mode=\"true\"] .masthead {\n    gap: 12px;\n    margin-bottom: 18px;\n    padding: 52px 8px 0;\n  }\n\n  body[data-directory-mode=\"true\"] h1 {\n    max-width: 12ch;\n    font-size: clamp(1.9rem, 8.5vw, 2.3rem);\n    line-height: 1.02;\n  }\n\n  body[data-directory-mode=\"true\"] .hero-subhead {\n    max-width: 34ch;\n    font-size: 0.84rem;\n    line-height: 1.4;\n  }\n\n  body[data-directory-mode=\"true\"] .claim-panel {\n    gap: 14px;\n    padding: 20px 16px;\n  }\n\n  body[data-directory-mode=\"true\"] .claim-benefits {\n    display: none;\n  }\n\n  body[data-directory-mode=\"true\"] .claim-copy h2 {\n    font-size: 1.35rem;\n  }\n\n  body[data-directory-mode=\"true\"] .rebid-note {\n    display: none;\n  }\n}\n";
}

function clientJs() {
  return "const GRID_SIZE = 1000;\nconst TOTAL_SQUARES = GRID_SIZE * GRID_SIZE;\nconst MIN_ZOOM = 1;\nconst MAX_ZOOM = 32;\nconst START_ZOOM = 4;\nconst CLUSTER_SIZE = 20;\nconst CLAIM_COLORS = [\"#b92f20\", \"#17627d\", \"#8a5b00\", \"#48612f\", \"#6d3fd1\", \"#a52d68\", \"#084f96\", \"#6b4d2e\"];\nconst CATEGORY_COLORS = {\n  AI: \"#6d3fd1\",\n  SaaS: \"#17627d\",\n  Ecommerce: \"#b92f20\",\n  Agency: \"#0b776f\",\n  Media: \"#a52d68\",\n  \"Developer tools\": \"#48612f\",\n  Finance: \"#6b4d2e\",\n  \"Local business\": \"#8a5b00\",\n  Other: \"#4f5968\",\n};\n\nconst canvas = document.getElementById(\"grid\");\nconst context = canvas.getContext(\"2d\");\nconst squareInput = document.getElementById(\"square_id\");\nconst selectedLabel = document.getElementById(\"selectedLabel\");\nconst selectedLink = document.getElementById(\"selectedLink\");\nconst selectedCard = document.getElementById(\"selectedCard\");\nconst activeNow = document.getElementById(\"activeNow\");\nconst sessions24h = document.getElementById(\"sessions24h\");\nconst presenceStatus = document.getElementById(\"presenceStatus\");\nconst hoverPreview = document.getElementById(\"hoverPreview\");\nconst zoomRange = document.getElementById(\"zoomRange\");\nconst zoomOut = document.getElementById(\"zoomOut\");\nconst zoomIn = document.getElementById(\"zoomIn\");\nconst zoomHome = document.getElementById(\"zoomHome\");\nconst companySearch = document.getElementById(\"companySearch\");\nconst searchResults = document.getElementById(\"searchResults\");\nconst categoryFilter = document.getElementById(\"categoryFilter\");\nconst packSizeInput = document.getElementById(\"pack_size\");\nconst promotionTypeInput = document.getElementById(\"promotion_type\");\nconst paymentLevelInput = document.getElementById(\"payment_level\");\nconst paymentLevelLabel = document.querySelector('label[for=\"payment_level\"]');\nconst linkUrlInput = document.getElementById(\"url\");\nconst labelInput = document.getElementById(\"label\");\nconst placementPreview = document.getElementById(\"placementPreview\");\nconst checkoutButton = document.getElementById(\"checkoutButton\");\nconst gridViewButton = document.getElementById(\"gridViewButton\");\nconst listViewButton = document.getElementById(\"listViewButton\");\nconst mapViewButton = document.getElementById(\"mapViewButton\");\nconst directoryList = document.getElementById(\"directoryList\");\nconst directoryRows = document.getElementById(\"directoryRows\");\nconst directoryCount = document.getElementById(\"directoryCount\");\nconst purchaseMapPanel = document.getElementById(\"purchaseMapPanel\");\nconst mapLocationCount = document.getElementById(\"mapLocationCount\");\nconst mapEmptyState = document.getElementById(\"mapEmptyState\");\nconst zoomControls = document.querySelector(\".zoom-controls\");\nconst claimDialog = document.getElementById(\"claimDialog\");\nconst claimForm = claimDialog?.querySelector('form[action=\"/checkout\"]');\n\nfunction trackFunnelEvent(name, props = {}) {\n  if (typeof window.piqo === \"function\") {\n    window.piqo(name, { props });\n  }\n}\n\nconst rawSquares = window.__PAID_SQUARES__ || [];\nconst allSquares = rawSquares.map((square) => {\n  const id = Number(square.square_id);\n  const category = square.category || \"Other\";\n  const clickCount = Number(square.click_count || 0);\n  const paidAt = square.paid_at || \"\";\n  const host = toHost(square.url);\n\n  return {\n    id,\n    label: square.label,\n    description: square.description || \"\",\n    url: square.url,\n    host,\n    category,\n    clickCount,\n    verified: Boolean(Number(square.verified_company || 0)),\n    territoryKey: square.territory_key || \"\",\n    territorySize: Number(square.territory_size || 1),\n    featuredFrom: square.featured_from || \"\",\n    featuredUntil: square.featured_until || \"\",\n    featuredAmountCents: Number(square.featured_amount_cents || 0),\n    purchaseCity: square.purchase_city || \"\",\n    purchaseCountry: square.purchase_country || \"\",\n    purchaseLatitude: square.purchase_latitude == null ? Number.NaN : Number(square.purchase_latitude),\n    purchaseLongitude: square.purchase_longitude == null ? Number.NaN : Number(square.purchase_longitude),\n    locationSource: square.location_source || \"checkout\",\n    logoUrl: square.logo_url || \"\",\n    paidAt,\n    color: CATEGORY_COLORS[category] || CLAIM_COLORS[Math.abs(hashString(`${square.label}-${square.url}`)) % CLAIM_COLORS.length],\n  };\n});\nconst paidSquares = new Map(allSquares.map((square) => [square.id, square]));\nconst territories = buildTerritories(allSquares);\n\nlet visibleSquares = allSquares;\nlet visibleSquareIds = new Set(visibleSquares.map((square) => square.id));\nlet clusters = buildClusters(visibleSquares);\nlet selectedId = Number(squareInput?.value || 1) - 1;\nlet hoveredId = null;\nlet zoom = START_ZOOM;\nlet originX = 0;\nlet originY = 0;\nlet isPanning = false;\nlet panStart = null;\nlet purchaseMap = null;\nlet purchaseMapLoaded = false;\nconst requestedView = new URLSearchParams(window.location.search).get(\"view\");\nlet activeView = [\"list\", \"grid\", \"map\"].includes(requestedView)\n  ? requestedView\n  : [\"list\", \"grid\", \"map\"].includes(localStorage.getItem(\"linkforadollar:view\")) ? localStorage.getItem(\"linkforadollar:view\") : \"list\";\n\nfunction hashString(value) {\n  let hash = 0;\n\n  for (let index = 0; index < value.length; index += 1) {\n    hash = (hash << 5) - hash + value.charCodeAt(index);\n    hash |= 0;\n  }\n\n  return hash;\n}\n\nfunction toHost(url) {\n  try {\n    return new URL(url).hostname.replace(/^www\\./, \"\");\n  } catch {\n    return \"\";\n  }\n}\n\nfunction inferBrandFromUrl() {\n  if (!linkUrlInput || !labelInput) return;\n  try {\n    const host = new URL(/^https?:\\/\\//i.test(linkUrlInput.value) ? linkUrlInput.value : `https://${linkUrlInput.value}`).hostname.replace(/^www\\./, \"\");\n    const name = host.split(\".\")[0].replace(/[-_]+/g, \" \").replace(/\\b\\w/g, (letter) => letter.toUpperCase());\n    if (name) labelInput.value = name.slice(0, 80);\n  } catch {\n    // Leave the existing value until the URL is valid.\n  }\n}\n\nfunction initials(label, host) {\n  const source = (label || host || \"?\").trim();\n  const words = source.split(/[\\s.-]+/).filter(Boolean);\n\n  if (words.length >= 2) {\n    return `${words[0][0]}${words[1][0]}`.toUpperCase();\n  }\n\n  return source.slice(0, 2).toUpperCase();\n}\n\nfunction formatDate(value) {\n  if (!value) {\n    return \"New\";\n  }\n\n  const date = new Date(value);\n  if (Number.isNaN(date.valueOf())) {\n    return \"New\";\n  }\n\n  return new Intl.DateTimeFormat(undefined, { month: \"short\", day: \"numeric\" }).format(date);\n}\n\nfunction logoUrl(host) {\n  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : \"\";\n}\n\nfunction brandMark(square) {\n  const source = square.logoUrl || logoUrl(square.host);\n  return `<span class=\"mini-logo\" style=\"background:${square.color}\"><img src=\"${escapeHtml(source)}\" alt=\"\" loading=\"lazy\" referrerpolicy=\"no-referrer\" onerror=\"this.hidden=true\">${escapeHtml(initials(square.label, square.host))}</span>`;\n}\n\nfunction visitHref(squareId) {\n  return `/go/${squareId + 1}`;\n}\n\nfunction listingShareLinks(square) {\n  const publicUrl = new URL(`/squares/${square.id + 1}`, window.location.origin);\n  const title = `${square.label} on Link for a Dollar`;\n  const trackedUrl = (source) => {\n    const url = new URL(publicUrl);\n    url.searchParams.set(\"utm_source\", source);\n    url.searchParams.set(\"utm_medium\", \"social\");\n    url.searchParams.set(\"utm_campaign\", \"claim_share\");\n    url.searchParams.set(\"utm_content\", `directory_square_${square.id + 1}`);\n    return url.toString();\n  };\n\n  return {\n    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(trackedUrl(\"x\"))}`,\n    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(trackedUrl(\"linkedin\"))}`,\n    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(trackedUrl(\"facebook\"))}`,\n  };\n}\n\nfunction directoryActions(square) {\n  const share = listingShareLinks(square);\n  const label = escapeHtml(square.label);\n\n  return `<span class=\"directory-row__actions\">\n    <a class=\"directory-row__visit\" href=\"${escapeHtml(visitHref(square.id))}\" target=\"_blank\" rel=\"noopener\">Visit <span aria-hidden=\"true\">↗</span></a>\n    <span class=\"directory-row__share\" aria-label=\"Share ${label}\">\n      <span class=\"directory-row__share-label\" aria-hidden=\"true\">Share</span>\n      <a href=\"${escapeHtml(share.x)}\" target=\"_blank\" rel=\"noopener\" aria-label=\"Share ${label} on X\">X</a>\n      <a href=\"${escapeHtml(share.linkedin)}\" target=\"_blank\" rel=\"noopener\" aria-label=\"Share ${label} on LinkedIn\">in</a>\n      <a href=\"${escapeHtml(share.facebook)}\" target=\"_blank\" rel=\"noopener\" aria-label=\"Share ${label} on Facebook\">f</a>\n    </span>\n  </span>`;\n}\n\nfunction formattedClicks(clicks) {\n  return new Intl.NumberFormat(undefined, { notation: \"compact\", maximumFractionDigits: 1 }).format(clicks);\n}\n\nfunction featureState(square, now = Date.now()) {\n  const startsAt = Date.parse(square.featuredFrom || \"\");\n  const endsAt = Date.parse(square.featuredUntil || \"\");\n\n  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= now) {\n    return \"none\";\n  }\n\n  return startsAt <= now ? \"active\" : \"queued\";\n}\n\nfunction placementTimeLabel(square, now = Date.now(), isLeader = false) {\n  const state = featureState(square, now);\n  const target = state === \"active\" ? Date.parse(square.featuredUntil) : Date.parse(square.featuredFrom);\n  const hours = Math.max(1, Math.ceil((target - now) / 3_600_000));\n  const duration = hours >= 48 ? `${Math.ceil(hours / 24)} days` : `${hours} hour${hours === 1 ? \"\" : \"s\"}`;\n\n  return state === \"active\" ? `${duration} left${isLeader ? \" at #1\" : \"\"}` : state === \"queued\" ? `Starts in ${duration}` : \"\";\n}\n\nfunction buildClusters(squares) {\n  const clusterMap = new Map();\n\n  for (const square of squares) {\n    const x = square.id % GRID_SIZE;\n    const y = Math.floor(square.id / GRID_SIZE);\n    const key = `${Math.floor(x / CLUSTER_SIZE)}:${Math.floor(y / CLUSTER_SIZE)}`;\n    const cluster = clusterMap.get(key) || {\n      x: Math.floor(x / CLUSTER_SIZE) * CLUSTER_SIZE,\n      y: Math.floor(y / CLUSTER_SIZE) * CLUSTER_SIZE,\n      count: 0,\n      samples: [],\n    };\n\n    cluster.count += 1;\n    if (cluster.samples.length < 4) {\n      cluster.samples.push(square);\n    }\n    clusterMap.set(key, cluster);\n  }\n\n  return [...clusterMap.values()];\n}\n\nfunction buildTerritories(squares) {\n  const territoryMap = new Map();\n\n  for (const square of squares) {\n    const key = square.territoryKey || `single:${square.id}`;\n    const x = square.id % GRID_SIZE;\n    const y = Math.floor(square.id / GRID_SIZE);\n    const territory = territoryMap.get(key) || {\n      ids: [],\n      minX: x,\n      maxX: x,\n      minY: y,\n      maxY: y,\n      color: square.color,\n      verified: square.verified,\n    };\n\n    territory.ids.push(square.id);\n    territory.minX = Math.min(territory.minX, x);\n    territory.maxX = Math.max(territory.maxX, x);\n    territory.minY = Math.min(territory.minY, y);\n    territory.maxY = Math.max(territory.maxY, y);\n    territory.verified = territory.verified || square.verified;\n    territoryMap.set(key, territory);\n  }\n\n  return [...territoryMap.values()];\n}\n\nfunction resizeCanvas() {\n  const rect = canvas.getBoundingClientRect();\n  const scale = window.devicePixelRatio || 1;\n  canvas.width = Math.max(1, Math.floor(rect.width * scale));\n  canvas.height = Math.max(1, Math.floor(rect.height * scale));\n  context.setTransform(scale, 0, 0, scale, 0, 0);\n  clampOrigin();\n  drawGrid();\n}\n\nfunction viewport() {\n  return {\n    width: canvas.width / (window.devicePixelRatio || 1),\n    height: canvas.height / (window.devicePixelRatio || 1),\n  };\n}\n\nfunction clampOrigin() {\n  const view = viewport();\n  const maxX = Math.max(0, GRID_SIZE - view.width / zoom);\n  const maxY = Math.max(0, GRID_SIZE - view.height / zoom);\n  originX = Math.max(0, Math.min(maxX, originX));\n  originY = Math.max(0, Math.min(maxY, originY));\n}\n\nfunction screenToGrid(clientX, clientY) {\n  const rect = canvas.getBoundingClientRect();\n  const x = originX + (clientX - rect.left) / zoom;\n  const y = originY + (clientY - rect.top) / zoom;\n\n  return {\n    x: Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(x))),\n    y: Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(y))),\n  };\n}\n\nfunction squareIdFromEvent(event) {\n  const point = screenToGrid(event.clientX, event.clientY);\n  return point.y * GRID_SIZE + point.x;\n}\n\nfunction setZoom(nextZoom, anchorClientX, anchorClientY) {\n  const rect = canvas.getBoundingClientRect();\n  const oldZoom = zoom;\n  const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));\n  const anchorX = anchorClientX == null ? rect.left + rect.width / 2 : anchorClientX;\n  const anchorY = anchorClientY == null ? rect.top + rect.height / 2 : anchorClientY;\n  const gridX = originX + (anchorX - rect.left) / oldZoom;\n  const gridY = originY + (anchorY - rect.top) / oldZoom;\n\n  zoom = next;\n  originX = gridX - (anchorX - rect.left) / zoom;\n  originY = gridY - (anchorY - rect.top) / zoom;\n  zoomRange.value = String(zoom);\n  clampOrigin();\n  drawGrid();\n}\n\nfunction centerOnSquare(squareId, targetZoom = Math.max(zoom, 18)) {\n  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));\n  zoomRange.value = String(zoom);\n  const view = viewport();\n  originX = squareId % GRID_SIZE - view.width / zoom / 2;\n  originY = Math.floor(squareId / GRID_SIZE) - view.height / zoom / 2;\n  clampOrigin();\n  drawGrid();\n}\n\nfunction fitToOccupied() {\n  const source = visibleSquares.length ? visibleSquares : allSquares;\n\n  if (source.length === 0) {\n    originX = 0;\n    originY = 0;\n    setZoom(START_ZOOM);\n    return;\n  }\n\n  const xs = source.map((square) => square.id % GRID_SIZE);\n  const ys = source.map((square) => Math.floor(square.id / GRID_SIZE));\n  const minX = Math.max(0, Math.min(...xs) - 24);\n  const maxX = Math.min(GRID_SIZE, Math.max(...xs) + 24);\n  const minY = Math.max(0, Math.min(...ys) - 24);\n  const maxY = Math.min(GRID_SIZE, Math.max(...ys) + 24);\n  const view = viewport();\n  const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(Math.min(view.width / Math.max(1, maxX - minX), view.height / Math.max(1, maxY - minY)))));\n\n  zoom = Number.isFinite(targetZoom) ? targetZoom : START_ZOOM;\n  originX = minX;\n  originY = minY;\n  zoomRange.value = String(zoom);\n  clampOrigin();\n  drawGrid();\n}\n\nfunction focusFeaturedBlock() {\n  const source = visibleSquares.length ? visibleSquares : allSquares;\n\n  if (source.length === 0) {\n    originX = 0;\n    originY = 0;\n    setZoom(START_ZOOM);\n    return;\n  }\n\n  const featuredCluster = buildClusters(source).sort((left, right) => right.count - left.count || left.x - right.x)[0];\n  const view = viewport();\n  const centerX = featuredCluster.x + CLUSTER_SIZE / 2;\n  const centerY = featuredCluster.y + CLUSTER_SIZE / 2;\n\n  zoom = Math.min(MAX_ZOOM, Math.max(32, Math.floor(Math.min(view.width / 48, view.height / 48))));\n  originX = centerX - view.width / zoom / 2;\n  originY = centerY - view.height / zoom / 2;\n  zoomRange.value = String(zoom);\n  clampOrigin();\n  drawGrid();\n}\n\nfunction drawGrid() {\n  const view = viewport();\n  context.clearRect(0, 0, view.width, view.height);\n  context.fillStyle = \"#ffffff\";\n  context.fillRect(0, 0, view.width, view.height);\n\n  drawBoardTexture(view);\n  drawOccupiedBlocks();\n  drawHeatmap(view);\n  drawTerritoryOutlines();\n\n  if (hoveredId !== null && paidSquares.has(hoveredId)) {\n    drawSelection(hoveredId, \"#14161a\", 1.5);\n  }\n}\n\nfunction drawBoardTexture(view) {\n  const cellStep = zoom >= 10 ? zoom : Math.max(8, CLUSTER_SIZE * zoom);\n  const startX = Math.floor(originX / (cellStep / zoom)) * (cellStep / zoom);\n  const startY = Math.floor(originY / (cellStep / zoom)) * (cellStep / zoom);\n\n  context.strokeStyle = zoom >= 10 ? \"rgba(20, 22, 26, 0.08)\" : \"rgba(20, 22, 26, 0.05)\";\n  context.lineWidth = 1;\n\n  for (let x = startX; x <= originX + view.width / zoom; x += cellStep / zoom) {\n    const sx = Math.round((x - originX) * zoom) + 0.5;\n    context.beginPath();\n    context.moveTo(sx, 0);\n    context.lineTo(sx, view.height);\n    context.stroke();\n  }\n\n  for (let y = startY; y <= originY + view.height / zoom; y += cellStep / zoom) {\n    const sy = Math.round((y - originY) * zoom) + 0.5;\n    context.beginPath();\n    context.moveTo(0, sy);\n    context.lineTo(view.width, sy);\n    context.stroke();\n  }\n}\n\nfunction drawOccupiedBlocks() {\n  if (zoom < 7) {\n    drawClusters();\n    return;\n  }\n\n  for (const square of visibleSquares) {\n    drawClaim(square);\n  }\n}\n\nfunction drawClusters() {\n  for (const cluster of clusters) {\n    const sx = (cluster.x - originX) * zoom;\n    const sy = (cluster.y - originY) * zoom;\n    const size = Math.max(6, CLUSTER_SIZE * zoom);\n\n    if (sx > canvas.clientWidth || sy > canvas.clientHeight || sx + size < 0 || sy + size < 0) {\n      continue;\n    }\n\n    const intensity = Math.min(1, 0.24 + cluster.count / 8);\n    context.fillStyle = cluster.samples[0]?.color || \"#e44c36\";\n    context.globalAlpha = intensity;\n    context.fillRect(sx, sy, size, size);\n    context.globalAlpha = 1;\n    context.strokeStyle = \"rgba(20, 22, 26, 0.18)\";\n    context.lineWidth = 1;\n    context.strokeRect(sx + 0.5, sy + 0.5, size - 1, size - 1);\n\n    cluster.samples.forEach((sample, index) => {\n      const swatch = Math.max(5, Math.min(14, size / 5));\n      context.fillStyle = sample.color;\n      context.fillRect(sx + 4 + index * (swatch + 2), sy + 4, swatch, swatch);\n    });\n\n    if (size >= 28) {\n      context.fillStyle = \"#ffffff\";\n      context.font = \"800 11px Inter, sans-serif\";\n      context.textAlign = \"center\";\n      context.textBaseline = \"middle\";\n      context.fillText(String(cluster.count), sx + size / 2, sy + size / 2);\n    }\n  }\n}\n\nfunction drawHeatmap(view) {\n  const maxClicks = Math.max(1, ...visibleSquares.map((square) => square.clickCount));\n\n  for (const square of visibleSquares) {\n    if (square.clickCount <= 0) {\n      continue;\n    }\n\n    const x = square.id % GRID_SIZE;\n    const y = Math.floor(square.id / GRID_SIZE);\n    const sx = (x - originX) * zoom;\n    const sy = (y - originY) * zoom;\n    const radius = Math.max(8, Math.min(36, zoom * 2 + (square.clickCount / maxClicks) * 22));\n\n    if (sx > view.width || sy > view.height || sx + radius < 0 || sy + radius < 0) {\n      continue;\n    }\n\n    const gradient = context.createRadialGradient(sx, sy, 0, sx, sy, radius);\n    gradient.addColorStop(0, \"rgba(200, 134, 26, 0.28)\");\n    gradient.addColorStop(1, \"rgba(200, 134, 26, 0)\");\n    context.fillStyle = gradient;\n    context.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);\n  }\n}\n\nfunction drawClaim(square) {\n  const x = square.id % GRID_SIZE;\n  const y = Math.floor(square.id / GRID_SIZE);\n  const sx = (x - originX) * zoom;\n  const sy = (y - originY) * zoom;\n  const size = Math.max(zoom, 6);\n\n  if (sx > canvas.clientWidth || sy > canvas.clientHeight || sx + size < 0 || sy + size < 0) {\n    return;\n  }\n\n  context.fillStyle = square.color;\n  context.fillRect(sx, sy, size, size);\n\n  if (zoom >= 18) {\n    context.fillStyle = \"#ffffff\";\n    context.font = \"800 9px Inter, sans-serif\";\n    context.textAlign = \"center\";\n    context.textBaseline = \"middle\";\n    context.fillText(initials(square.label, square.host), sx + size / 2, sy + size / 2 + 0.5);\n  }\n}\n\nfunction drawTerritoryOutlines() {\n  for (const territory of territories) {\n    if (territory.ids.length < 2) {\n      continue;\n    }\n\n    const sx = (territory.minX - originX) * zoom;\n    const sy = (territory.minY - originY) * zoom;\n    const width = (territory.maxX - territory.minX + 1) * zoom;\n    const height = (territory.maxY - territory.minY + 1) * zoom;\n\n    if (sx > canvas.clientWidth || sy > canvas.clientHeight || sx + width < 0 || sy + height < 0) {\n      continue;\n    }\n\n    context.strokeStyle = territory.verified ? \"#14161a\" : territory.color;\n    context.lineWidth = territory.ids.length >= 10 ? 3 : 2;\n    context.strokeRect(sx - 2, sy - 2, Math.max(width, 8) + 4, Math.max(height, 8) + 4);\n  }\n}\n\nfunction selectedPackSize() {\n  return Number(packSizeInput?.value || 1);\n}\n\nfunction adjacentIds(squareId, packSize) {\n  const width = packSize === 1 ? 1 : Math.ceil(Math.sqrt(packSize));\n  const height = Math.ceil(packSize / width);\n  const startX = Math.min(squareId % GRID_SIZE, GRID_SIZE - width);\n  const startY = Math.min(Math.floor(squareId / GRID_SIZE), GRID_SIZE - height);\n  const ids = [];\n\n  for (let y = 0; y < height && ids.length < packSize; y += 1) {\n    for (let x = 0; x < width && ids.length < packSize; x += 1) {\n      ids.push((startY + y) * GRID_SIZE + startX + x);\n    }\n  }\n\n  return ids;\n}\n\nfunction drawExpansionPreview() {\n  const ids = adjacentIds(selectedId, selectedPackSize());\n\n  if (ids.length <= 1) {\n    return;\n  }\n\n  context.fillStyle = \"rgba(11, 107, 203, 0.15)\";\n  for (const id of ids) {\n    const sx = ((id % GRID_SIZE) - originX) * zoom;\n    const sy = (Math.floor(id / GRID_SIZE) - originY) * zoom;\n    context.fillRect(sx, sy, Math.max(zoom, 6), Math.max(zoom, 6));\n  }\n}\n\nfunction drawSelection(squareId, color, lineWidth) {\n  const x = squareId % GRID_SIZE;\n  const y = Math.floor(squareId / GRID_SIZE);\n  const sx = (x - originX) * zoom;\n  const sy = (y - originY) * zoom;\n  const size = Math.max(zoom, 8);\n\n  context.strokeStyle = color;\n  context.lineWidth = lineWidth;\n  context.strokeRect(sx - 4, sy - 4, size + 8, size + 8);\n}\n\nfunction selectSquare(squareId, shouldCenter = false) {\n  const boundedId = Math.max(0, Math.min(TOTAL_SQUARES - 1, squareId));\n  const claimed = paidSquares.get(boundedId);\n  selectedId = boundedId;\n\n  if (squareInput) squareInput.value = String(boundedId + 1);\n  selectedLabel.textContent = `#${boundedId + 1}${claimed ? ` · ${claimed.label}` : \"\"}`;\n  renderSelectedCard(claimed, boundedId);\n\n  if (claimed) {\n    selectedLink.href = visitHref(boundedId);\n    selectedLink.hidden = false;\n  } else {\n    selectedLink.hidden = true;\n  }\n\n  if (shouldCenter) {\n    centerOnSquare(boundedId);\n  } else {\n    drawGrid();\n  }\n}\n\nfunction renderSelectedCard(claimed, squareId) {\n  const title = claimed ? claimed.label : \"Open square\";\n  const packSize = selectedPackSize();\n  const rarity = rarityFor(squareId, claimed);\n  const meta = claimed ? `${claimed.host} · ${claimed.category} · ${rarity}` : `${packSize} connected ${packSize === 1 ? \"square\" : \"squares\"} · $${packSize}`;\n  const color = claimed ? claimed.color : \"#d5d9e2\";\n  const mark = claimed ? initials(claimed.label, claimed.host) : String((squareId % 9) + 1);\n  const profileLink = claimed ? `<a href=\"/profile/${encodeURIComponent(claimed.host)}\">Profile</a>` : \"\";\n\n  selectedCard.innerHTML = `\n    <div class=\"mini-logo\" style=\"background:${color}\">${escapeHtml(mark)}</div>\n    <div>\n      <strong>${escapeHtml(title)}</strong>\n      <span>${escapeHtml(meta)}</span>\n      ${claimed?.verified ? '<em class=\"verified-badge\">Verified company</em>' : \"\"}\n      ${profileLink}\n    </div>\n  `;\n}\n\nfunction rarityFor(squareId, claimed) {\n  if (claimed?.territorySize >= 25) {\n    return \"Legendary territory\";\n  }\n\n  if (claimed?.territorySize >= 10) {\n    return \"Epic territory\";\n  }\n\n  if (squareId < 1000) {\n    return \"Genesis row\";\n  }\n\n  if ((squareId + 1) % 1000 === 0 || squareId % 1111 === 0) {\n    return \"Pattern square\";\n  }\n\n  return claimed ? \"Claimed\" : \"Common\";\n}\n\nfunction showHoverPreview(event, squareId) {\n  const claimed = paidSquares.get(squareId);\n  const x = squareId % GRID_SIZE;\n  const y = Math.floor(squareId / GRID_SIZE);\n  const cluster = clusters.find((entry) => x >= entry.x && x < entry.x + CLUSTER_SIZE && y >= entry.y && y < entry.y + CLUSTER_SIZE);\n\n  hoveredId = squareId;\n\n  if (claimed) {\n    hoverPreview.innerHTML = `\n      <div class=\"hover-preview__media\" style=\"--brand-color:${claimed.color}\">\n        <img src=\"${escapeHtml(logoUrl(claimed.host))}\" alt=\"\" width=\"40\" height=\"40\" onerror=\"this.hidden=true;this.nextElementSibling.style.opacity=1\">\n        <span>${escapeHtml(initials(claimed.label, claimed.host))}</span>\n      </div>\n      <div class=\"hover-preview__body\">\n        <div class=\"hover-preview__header\">\n          <div>\n            <p class=\"hover-preview__eyebrow\">${escapeHtml(claimed.host || `#${squareId + 1}`)}</p>\n            <strong class=\"hover-preview__title\">${escapeHtml(claimed.label)}</strong>\n          </div>\n          <a class=\"hover-preview__visit\" href=\"${escapeHtml(visitHref(squareId))}\" target=\"_blank\" rel=\"noopener\">visit</a>\n        </div>\n        <dl class=\"hover-preview__meta\" aria-label=\"Link details\">\n          <div><dt>Category</dt><dd>${escapeHtml(claimed.category)}</dd></div>\n          <div><dt>Clicks</dt><dd>${formattedClicks(claimed.clickCount)}</dd></div>\n          <div><dt>Rarity</dt><dd>${escapeHtml(rarityFor(squareId, claimed))}</dd></div>\n        </dl>\n        <div class=\"hover-preview__card\">\n          <span class=\"mini-logo\" style=\"background:${claimed.color}\">${escapeHtml(initials(claimed.label, claimed.host))}</span>\n          <div>\n            <strong>${escapeHtml(claimed.label)}</strong>\n            <span>${escapeHtml(claimed.host || claimed.url)}</span>\n          </div>\n        </div>\n      </div>\n    `;\n  } else {\n    hoverPreview.innerHTML = `\n      <div class=\"hover-preview__empty\"></div>\n      <div class=\"hover-preview__body\">\n        <div>\n          <p class=\"hover-preview__eyebrow\">Available square</p>\n          <strong class=\"hover-preview__title\">Square #${squareId + 1}</strong>\n        </div>\n        <p class=\"hover-preview__summary\">${cluster?.count ? `${cluster.count} claimed nearby` : \"Open for a new public profile, claim page, and analytics trail.\"}</p>\n      </div>\n    `;\n  }\n\n  positionHoverPreview(event);\n  hoverPreview.hidden = false;\n  drawGrid();\n}\n\nfunction positionHoverPreview(event) {\n  const rect = canvas.getBoundingClientRect();\n  const previewWidth = 390;\n  const previewHeight = 240;\n  const left = Math.min(rect.width - previewWidth - 12, Math.max(12, event.clientX - rect.left + 14));\n  const top = Math.min(rect.height - previewHeight - 12, Math.max(12, event.clientY - rect.top + 14));\n  hoverPreview.style.left = `${left}px`;\n  hoverPreview.style.top = `${top}px`;\n}\n\nfunction applyFilters() {\n  const activeCategory = categoryFilter.value;\n  const query = companySearch.value.trim().toLowerCase();\n\n  visibleSquares = allSquares.filter((square) => {\n    const categoryMatches = activeCategory === \"All\" || square.category === activeCategory;\n    const queryMatches = !query || [square.label, square.host, square.category, square.url].some((value) => value.toLowerCase().includes(query));\n    return categoryMatches && queryMatches;\n  });\n  visibleSquareIds = new Set(visibleSquares.map((square) => square.id));\n  clusters = buildClusters(visibleSquares);\n  renderSearchResults(query);\n  renderDirectory();\n  updatePurchaseMap();\n  updateMomentum();\n  drawGrid();\n}\n\nfunction setActiveView(view) {\n  activeView = [\"list\", \"grid\", \"map\"].includes(view) ? view : \"list\";\n  const isList = activeView === \"list\";\n  const isGrid = activeView === \"grid\";\n  const isMap = activeView === \"map\";\n\n  canvas.hidden = true;\n  directoryList.hidden = isMap;\n  purchaseMapPanel.hidden = !isMap;\n  zoomControls.hidden = true;\n  directoryRows.classList.toggle(\"is-grid\", isGrid);\n  listViewButton.classList.toggle(\"is-active\", isList);\n  gridViewButton.classList.toggle(\"is-active\", isGrid);\n  mapViewButton.classList.toggle(\"is-active\", isMap);\n  listViewButton.setAttribute(\"aria-pressed\", String(isList));\n  gridViewButton.setAttribute(\"aria-pressed\", String(isGrid));\n  mapViewButton.setAttribute(\"aria-pressed\", String(isMap));\n  document.body.dataset.view = activeView;\n  document.body.dataset.directoryMode = \"true\";\n  localStorage.setItem(\"linkforadollar:view\", activeView);\n\n  if (isMap) {\n    initializePurchaseMap();\n    requestAnimationFrame(() => purchaseMap?.resize());\n  }\n}\n\nfunction purchaseLocations() {\n  return visibleSquares.filter((square) => Number.isFinite(square.purchaseLatitude)\n    && Number.isFinite(square.purchaseLongitude)\n    && square.purchaseLatitude >= -90\n    && square.purchaseLatitude <= 90\n    && square.purchaseLongitude >= -180\n    && square.purchaseLongitude <= 180);\n}\n\nfunction purchaseLocationGeoJson() {\n  return {\n    type: \"FeatureCollection\",\n    features: purchaseLocations().map((square) => ({\n      type: \"Feature\",\n      geometry: { type: \"Point\", coordinates: [square.purchaseLongitude, square.purchaseLatitude] },\n      properties: {\n        id: square.id,\n        label: square.label,\n        host: square.host,\n        location: [square.purchaseCity, square.purchaseCountry].filter(Boolean).join(\", \") || \"Approximate location\",\n        sourceLabel: square.locationSource === \"estimated_headquarters\" ? \"Estimated headquarters\" : square.locationSource === \"country_centroid\" ? \"Country selected by buyer\" : \"Checkout location\",\n        logo: square.logoUrl || logoUrl(square.host),\n        color: square.color,\n      },\n    })),\n  };\n}\n\nfunction fitPurchaseMapToLocations() {\n  if (!purchaseMapLoaded || !purchaseMap) return;\n  const locations = purchaseLocations();\n  if (locations.length === 0) {\n    purchaseMap.jumpTo({ center: [10, 20], zoom: 1.15 });\n    return;\n  }\n  if (locations.length === 1) {\n    purchaseMap.jumpTo({\n      center: [locations[0].purchaseLongitude, locations[0].purchaseLatitude],\n      zoom: window.matchMedia(\"(max-width: 640px)\").matches ? 2.5 : 3,\n    });\n    return;\n  }\n\n  const bounds = new window.maplibregl.LngLatBounds();\n  locations.forEach((location) => bounds.extend([location.purchaseLongitude, location.purchaseLatitude]));\n  purchaseMap.fitBounds(bounds, { padding: 64, maxZoom: 4, duration: 0 });\n}\n\nfunction initializePurchaseMap() {\n  const locations = purchaseLocations();\n  mapLocationCount.textContent = `${locations.length} mapped purchase${locations.length === 1 ? \"\" : \"s\"}`;\n  mapEmptyState.hidden = locations.length > 0;\n\n  if (purchaseMap || !window.maplibregl) {\n    if (!window.maplibregl) {\n      mapEmptyState.hidden = false;\n      mapEmptyState.querySelector(\"strong\").textContent = \"The world map could not load\";\n      mapEmptyState.querySelector(\"span\").textContent = \"The directory still works in List and Grid modes. Try Map again when your connection is restored.\";\n    }\n    return;\n  }\n\n  purchaseMap = new window.maplibregl.Map({\n    container: \"purchaseMap\",\n    style: \"https://tiles.openfreemap.org/styles/liberty\",\n    center: [10, 20],\n    zoom: 1.15,\n    minZoom: 1,\n    maplibreLogo: true,\n    attributionControl: false,\n  });\n  purchaseMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), \"top-right\");\n  purchaseMap.addControl(new window.maplibregl.AttributionControl({ compact: true }), \"bottom-right\");\n  purchaseMap.on(\"load\", () => {\n    purchaseMapLoaded = true;\n    purchaseMap.addSource(\"purchases\", { type: \"geojson\", data: purchaseLocationGeoJson(), cluster: true, clusterRadius: 42, clusterMaxZoom: 6 });\n    purchaseMap.addLayer({\n      id: \"purchase-clusters\",\n      type: \"circle\",\n      source: \"purchases\",\n      filter: [\"has\", \"point_count\"],\n      paint: { \"circle-color\": \"#177e6d\", \"circle-radius\": [\"step\", [\"get\", \"point_count\"], 18, 10, 24, 50, 31], \"circle-stroke-color\": \"#ffffff\", \"circle-stroke-width\": 2 },\n    });\n    purchaseMap.addLayer({\n      id: \"purchase-cluster-count\",\n      type: \"symbol\",\n      source: \"purchases\",\n      filter: [\"has\", \"point_count\"],\n      layout: { \"text-field\": [\"get\", \"point_count_abbreviated\"], \"text-size\": 12 },\n      paint: { \"text-color\": \"#ffffff\" },\n    });\n    purchaseMap.addLayer({\n      id: \"purchase-points\",\n      type: \"circle\",\n      source: \"purchases\",\n      filter: [\"!\", [\"has\", \"point_count\"]],\n      paint: { \"circle-color\": [\"get\", \"color\"], \"circle-radius\": 8, \"circle-stroke-color\": \"#ffffff\", \"circle-stroke-width\": 2 },\n    });\n    purchaseMap.on(\"click\", \"purchase-points\", (event) => {\n      const feature = event.features?.[0];\n      if (!feature) return;\n      const properties = feature.properties || {};\n      new window.maplibregl.Popup({ offset: 12 })\n        .setLngLat(feature.geometry.coordinates)\n        .setHTML(`<img class=\"map-popup-logo\" src=\"${escapeHtml(properties.logo || \"\")}\" alt=\"\" referrerpolicy=\"no-referrer\" onerror=\"this.hidden=true\"><strong>${escapeHtml(properties.label || \"Claimed link\")}</strong><span>${escapeHtml(properties.location || \"\")}</span><span>${escapeHtml(properties.sourceLabel || \"Approximate location\")}</span><a href=\"/squares/${Number(properties.id) + 1}\">View ${escapeHtml(properties.host || \"link\")}</a>`)\n        .addTo(purchaseMap);\n    });\n    purchaseMap.on(\"click\", \"purchase-clusters\", async (event) => {\n      const feature = event.features?.[0];\n      if (!feature) return;\n      const zoomLevel = await purchaseMap.getSource(\"purchases\").getClusterExpansionZoom(feature.properties.cluster_id);\n      purchaseMap.jumpTo({ center: feature.geometry.coordinates, zoom: zoomLevel });\n    });\n    fitPurchaseMapToLocations();\n  });\n}\n\nfunction updatePurchaseMap() {\n  const locations = purchaseLocations();\n  if (mapLocationCount) mapLocationCount.textContent = `${locations.length} mapped purchase${locations.length === 1 ? \"\" : \"s\"}`;\n  if (mapEmptyState) mapEmptyState.hidden = locations.length > 0;\n  if (purchaseMapLoaded) {\n    purchaseMap.getSource(\"purchases\")?.setData(purchaseLocationGeoJson());\n    if (activeView === \"map\") fitPurchaseMapToLocations();\n  }\n}\n\nfunction renderDirectory() {\n  const now = Date.now();\n  const ranked = [...visibleSquares].sort((left, right) => {\n    const leftActive = featureState(left, now) === \"active\" ? 1 : 0;\n    const rightActive = featureState(right, now) === \"active\" ? 1 : 0;\n\n    return rightActive - leftActive || right.featuredAmountCents - left.featuredAmountCents || right.clickCount - left.clickCount || String(right.paidAt).localeCompare(String(left.paidAt)) || left.id - right.id;\n  });\n  directoryCount.textContent = `${ranked.length.toLocaleString()} claimed link${ranked.length === 1 ? \"\" : \"s\"}`;\n\n  directoryRows.innerHTML = ranked.length ? ranked.map((square, index) => `\n    <li class=\"directory-row${featureState(square, now) === \"active\" ? \" is-featured\" : \"\"}\">\n      <span class=\"directory-row__rank\" aria-label=\"Rank ${index + 1}\">#${index + 1}</span>\n      ${brandMark(square)}\n      <span class=\"directory-row__identity\">\n        <strong><a href=\"/squares/${square.id + 1}\">${escapeHtml(square.label)}</a></strong>\n        <span>${escapeHtml(square.host || square.url)}</span>\n        <span class=\"directory-row__description\">${escapeHtml(square.description || `${square.category} · square #${square.id + 1}`)}</span>\n      </span>\n      <span class=\"directory-row__metric\">\n        <strong>${index === 0 && featureState(square, now) === \"active\" ? \"#1\" : square.featuredAmountCents > 0 ? `$${square.featuredAmountCents / 100}` : formattedClicks(square.clickCount)}</strong>\n        <span>${placementTimeLabel(square, now, index === 0) || `click${square.clickCount === 1 ? \"\" : \"s\"}`}</span>\n      </span>\n      ${directoryActions(square)}\n    </li>\n  `).join(\"\") : `\n    <li class=\"directory-empty\">\n      <strong>No claimed links match this view</strong>\n      <span>Try another search or category.</span>\n    </li>\n  `;\n}\n\nfunction renderSearchResults(query) {\n  if (!query) {\n    searchResults.hidden = true;\n    searchResults.innerHTML = \"\";\n    return;\n  }\n\n  const matches = visibleSquares.slice(0, 8);\n  if (matches.length === 0) {\n    searchResults.innerHTML = '<div class=\"search-result\"><span></span><strong>No claimed squares found</strong><em>Try another company or category</em></div>';\n    searchResults.hidden = false;\n    return;\n  }\n\n  searchResults.innerHTML = matches.map((square) => `\n    <a class=\"search-result\" href=\"/squares/${square.id + 1}\">\n      ${brandMark(square)}\n      <span>\n        <strong>${escapeHtml(square.label)}</strong>\n        <span>${escapeHtml(square.host)} · ${escapeHtml(square.category)}</span>\n      </span>\n      <em>#${square.id + 1}</em>\n    </a>\n  `).join(\"\");\n  searchResults.hidden = false;\n}\n\nfunction updateMomentum() {\n  const newest = [...visibleSquares].sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));\n  const today = new Date().toISOString().slice(0, 10);\n  const claimedToday = visibleSquares.filter((square) => String(square.paidAt).startsWith(today)).length;\n  const categories = categoryCounts(visibleSquares);\n  const fastest = categories[0];\n\n  setText(\"latestClaim\", newest[0] ? `${newest[0].label} claimed #${newest[0].id + 1}` : \"Waiting for the first claim\");\n  setText(\"claimedToday\", `${claimedToday} square${claimedToday === 1 ? \"\" : \"s\"} claimed today`);\n  setText(\"fastestCategory\", fastest ? `${fastest.category}: ${fastest.count} claimed` : \"Categories open\");\n  setText(\"liveActivity\", `${visibleSquares.length} visible of ${allSquares.length} claimed`);\n}\n\nfunction renderPanels() {\n  const newest = [...allSquares].sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));\n  const topClicked = [...allSquares].sort((a, b) => b.clickCount - a.clickCount || a.id - b.id);\n  const featured = topClicked.filter((square) => square.clickCount > 0).concat(newest).filter(uniqueById).slice(0, 4);\n\n  renderSquareList(\"newestSquares\", newest.slice(0, 5), \"Claimed\");\n  renderSquareList(\"mostClicked\", topClicked.slice(0, 5), \"Clicks\", (square) => String(square.clickCount));\n  renderSquareList(\"featuredSquares\", featured.slice(0, 4), \"Clicks\", (square) => `${formattedClicks(square.clickCount)} clicks`);\n  renderCategories();\n  renderTrending(newest.slice(0, 8));\n}\n\nfunction uniqueById(square, index, source) {\n  return source.findIndex((candidate) => candidate.id === square.id) === index;\n}\n\nfunction categoryCounts(squares) {\n  const counts = new Map();\n\n  for (const square of squares) {\n    counts.set(square.category, (counts.get(square.category) || 0) + 1);\n  }\n\n  return [...counts.entries()]\n    .map(([category, count]) => ({ category, count }))\n    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));\n}\n\nfunction renderCategories() {\n  const target = document.getElementById(\"topCategories\");\n  const categories = categoryCounts(allSquares).slice(0, 6);\n\n  target.innerHTML = categories.length ? categories.map(({ category, count }) => `\n    <li>\n      <div>\n        <strong><a href=\"/collections/${encodeURIComponent(category)}\">${escapeHtml(category)}</a></strong>\n        <span>${count} claimed square${count === 1 ? \"\" : \"s\"}</span>\n      </div>\n      <a class=\"proof-action\" href=\"/collections/${encodeURIComponent(category)}\">View</a>\n    </li>\n  `).join(\"\") : \"<li><div><strong>No categories yet</strong><span>First claims define the board</span></div></li>\";\n}\n\nfunction renderSquareList(id, squares, label, metric = (square) => `#${square.id + 1}`) {\n  const target = document.getElementById(id);\n\n  target.innerHTML = squares.length ? squares.map((square, index) => `\n    <li>\n      ${brandMark(square)}\n      <div>\n        <strong>${escapeHtml(square.label)}</strong>\n        <span>${escapeHtml(square.category)} · ${escapeHtml(square.host)}</span>\n      </div>\n      <a class=\"proof-action\" href=\"/squares/${square.id + 1}\">${escapeHtml(metric(square, index) || label)}</a>\n    </li>\n  `).join(\"\") : `<li><div><strong>No claims yet</strong><span>${escapeHtml(label)} will appear here</span></div></li>`;\n}\n\nfunction renderTrending(squares) {\n  const target = document.getElementById(\"trendingSquares\");\n\n  target.innerHTML = squares.length ? squares.map((square) => `\n    <a class=\"trending-card\" href=\"/squares/${square.id + 1}\">\n      ${brandMark(square)}\n      <span>\n        <strong>${escapeHtml(square.label)}</strong>\n        <span>${escapeHtml(square.category)} · ${escapeHtml(square.host)}</span>\n      </span>\n      <em>#${square.id + 1}</em>\n    </a>\n  `).join(\"\") : '<div class=\"trending-card\"><span></span><strong>No claimed squares yet</strong><span>Fresh claims will land here.</span></div>';\n}\n\nfunction setText(id, value) {\n  const node = document.getElementById(id);\n  if (node) {\n    node.textContent = value;\n  }\n}\n\nfunction escapeHtml(value) {\n  return String(value)\n    .replace(/&/g, \"&amp;\")\n    .replace(/</g, \"&lt;\")\n    .replace(/>/g, \"&gt;\")\n    .replace(/\"/g, \"&quot;\");\n}\n\nfunction updateCheckoutButton() {\n  if (!checkoutButton) {\n    return;\n  }\n\n  const now = Date.now();\n  const highestBid = Math.max(0, ...allSquares.filter((square) => featureState(square, now) !== \"none\").map((square) => square.featuredAmountCents / 100));\n  let normalizedUrl = \"\";\n  try {\n    normalizedUrl = new URL(linkUrlInput?.value || \"\").toString();\n  } catch {\n    normalizedUrl = \"\";\n  }\n  const previousListing = normalizedUrl ? allSquares.find((square) => square.url === normalizedUrl) : null;\n  const previousBid = previousListing ? previousListing.featuredAmountCents / 100 : 0;\n  const monthly = promotionTypeInput?.value === \"monthly\";\n  const minimumBid = Math.max(1, highestBid + 1, previousBid + 1);\n  const monthlyAmount = Math.max(1, Math.min(10000, Number(paymentLevelInput?.value || 30)));\n  const currentLevel = monthly\n    ? previousBid + monthlyAmount\n    : Math.max(minimumBid, Math.min(10000, Number(paymentLevelInput?.value || minimumBid)));\n  const amountDue = monthly ? monthlyAmount : currentLevel - previousBid;\n\n  if (paymentLevelInput) {\n    paymentLevelInput.min = String(monthly ? 1 : minimumBid);\n    paymentLevelInput.max = \"10000\";\n    paymentLevelInput.value = String(monthly ? monthlyAmount : currentLevel);\n    paymentLevelInput.disabled = false;\n  }\n  if (paymentLevelLabel) paymentLevelLabel.textContent = monthly ? \"Monthly amount\" : \"One-time bid\";\n  if (placementPreview) {\n    placementPreview.textContent = monthly\n      ? `$${amountDue} is charged monthly until cancelled. Every successful renewal adds another $${amountDue} to your cumulative rank bid and extends placement by 30 days.`\n      : previousListing\n      ? `Your previous $${previousBid} bid is credited. Pay $${amountDue} to raise it to $${currentLevel} and return above the current $${highestBid} leader.`\n      : `$${currentLevel} puts you above the current $${highestBid} leader and includes ${amountDue} full day${amountDue === 1 ? \"\" : \"s\"} of featured time.`;\n  }\n  checkoutButton.disabled = false;\n  checkoutButton.textContent = monthly\n    ? `Start monthly · $${amountDue}/mo`\n    : previousListing\n    ? `Pay the $${amountDue} difference · reclaim #1 🚀`\n    : `Claim my spot · $${currentLevel}`;\n  renderSelectedCard(paidSquares.get(selectedId), selectedId);\n  drawGrid();\n}\n\nfunction openClaimDialog() {\n  if (!claimDialog) return;\n  claimDialog.showModal();\n  trackFunnelEvent(\"claim_started\", {\n    square: String(selectedId + 1),\n    source: \"claim_dialog\",\n  });\n  requestAnimationFrame(() => linkUrlInput?.focus());\n}\n\ncanvas.addEventListener(\"click\", (event) => {\n  if (isPanning) {\n    return;\n  }\n\n  const squareId = squareIdFromEvent(event);\n\n  if (paidSquares.has(squareId)) {\n    window.open(visitHref(squareId), \"_blank\", \"noopener\");\n    return;\n  }\n\n  openClaimDialog();\n});\n\ncanvas.addEventListener(\"pointerdown\", (event) => {\n  canvas.setPointerCapture(event.pointerId);\n  isPanning = false;\n  panStart = {\n    x: event.clientX,\n    y: event.clientY,\n    originX,\n    originY,\n  };\n});\n\ncanvas.addEventListener(\"pointermove\", (event) => {\n  if (panStart) {\n    const dx = event.clientX - panStart.x;\n    const dy = event.clientY - panStart.y;\n\n    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {\n      isPanning = true;\n      originX = panStart.originX - dx / zoom;\n      originY = panStart.originY - dy / zoom;\n      clampOrigin();\n      hoverPreview.hidden = true;\n      drawGrid();\n      return;\n    }\n  }\n\n  const squareId = squareIdFromEvent(event);\n  canvas.style.cursor = paidSquares.has(squareId) ? \"pointer\" : \"grab\";\n  showHoverPreview(event, squareId);\n});\n\ncanvas.addEventListener(\"pointerup\", () => {\n  setTimeout(() => {\n    isPanning = false;\n  }, 0);\n  panStart = null;\n});\n\ncanvas.addEventListener(\"pointerleave\", () => {\n  hoveredId = null;\n  panStart = null;\n  canvas.style.cursor = \"\";\n  hoverPreview.hidden = true;\n  drawGrid();\n});\n\ncanvas.addEventListener(\"wheel\", (event) => {\n  event.preventDefault();\n  setZoom(zoom + (event.deltaY > 0 ? -1 : 1), event.clientX, event.clientY);\n}, { passive: false });\n\ndocument.addEventListener(\"click\", (event) => {\n  const squareButton = event.target.closest(\"[data-square-id]\");\n  const categoryButton = event.target.closest(\"[data-category]\");\n\n  if (squareButton) {\n    const squareId = Number(squareButton.dataset.squareId);\n    selectSquare(squareId, true);\n    searchResults.hidden = true;\n  }\n\n  if (categoryButton) {\n    categoryFilter.value = categoryButton.dataset.category;\n    companySearch.value = \"\";\n    applyFilters();\n    fitToOccupied();\n  }\n\n  if (!event.target.closest(\".search-control\")) {\n    searchResults.hidden = true;\n  }\n});\n\nzoomRange.addEventListener(\"input\", () => setZoom(Number(zoomRange.value)));\nzoomOut.addEventListener(\"click\", () => setZoom(zoom - 1));\nzoomIn.addEventListener(\"click\", () => setZoom(zoom + 1));\nzoomHome.addEventListener(\"click\", fitToOccupied);\nsquareInput?.addEventListener(\"input\", () => selectSquare(Number(squareInput.value || 1) - 1, true));\npackSizeInput?.addEventListener(\"change\", updateCheckoutButton);\npromotionTypeInput?.addEventListener(\"change\", updateCheckoutButton);\npaymentLevelInput?.addEventListener(\"input\", updateCheckoutButton);\nlinkUrlInput?.addEventListener(\"input\", () => {\n  inferBrandFromUrl();\n  updateCheckoutButton();\n});\ncompanySearch.addEventListener(\"input\", applyFilters);\ncategoryFilter.addEventListener(\"change\", () => {\n  applyFilters();\n  fitToOccupied();\n});\nlistViewButton.addEventListener(\"click\", () => setActiveView(\"list\"));\ngridViewButton.addEventListener(\"click\", () => setActiveView(\"grid\"));\nmapViewButton.addEventListener(\"click\", () => setActiveView(\"map\"));\ndocument.querySelector(\"[data-focus-claim]\")?.addEventListener(\"click\", () => {\n  openClaimDialog();\n});\ndocument.querySelector(\"[data-open-claim]\")?.addEventListener(\"click\", openClaimDialog);\ndocument.querySelector(\"[data-close-claim]\")?.addEventListener(\"click\", () => claimDialog?.close());\nclaimDialog?.addEventListener(\"click\", (event) => {\n  if (event.target === claimDialog) claimDialog.close();\n});\nclaimForm?.addEventListener(\"submit\", () => {\n  trackFunnelEvent(\"checkout_started\", {\n    square: String(selectedId + 1),\n    pack_size: String(selectedPackSize()),\n    value: String(paymentLevelInput?.value || \"1\"),\n    currency: \"USD\",\n  });\n});\nwindow.addEventListener(\"resize\", resizeCanvas);\n\nzoomRange.value = String(zoom);\nresizeCanvas();\nrenderPanels();\napplyFilters();\nsetActiveView(activeView);\nconst initialSelection = Number(squareInput?.value || 1) - 1;\nif (allSquares.length > 0 && initialSelection <= 0) {\n  focusFeaturedBlock();\n}\nselectSquare(initialSelection, allSquares.length === 0 || initialSelection > 0);\nupdateCheckoutButton();\n\nasync function refreshPresence() {\n  if (!activeNow || !sessions24h || document.hidden) return;\n  const sessionId = sessionStorage.getItem(\"linkforadollar:presence\") || crypto.randomUUID();\n  sessionStorage.setItem(\"linkforadollar:presence\", sessionId);\n  try {\n    const response = await fetch(\"/api/presence\", {\n      method: \"POST\",\n      headers: { \"content-type\": \"application/json\" },\n      body: JSON.stringify({ session_id: sessionId }),\n      cache: \"no-store\",\n    });\n    if (!response.ok) throw new Error(\"Presence unavailable\");\n    const stats = await response.json();\n    activeNow.textContent = new Intl.NumberFormat().format(stats.active_now);\n    sessions24h.textContent = new Intl.NumberFormat().format(stats.sessions_24h);\n    presenceStatus.textContent = \"Live activity updated\";\n    document.querySelector(\".live-stats\")?.classList.remove(\"is-stale\");\n  } catch {\n    presenceStatus.textContent = \"Live activity temporarily unavailable\";\n    document.querySelector(\".live-stats\")?.classList.add(\"is-stale\");\n  }\n}\n\nrefreshPresence();\nsetInterval(refreshPresence, 60_000);\ndocument.addEventListener(\"visibilitychange\", refreshPresence);\n";
}

function svgEscape(value) {
  return escapeXml(String(value)).replace(/\n/g, " ");
}

async function renderSocialPng(svg, logoUrl = null) {
  await resvgReady;
  const renderer = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: {
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
      fontBuffers: [new Uint8Array(socialFont)],
    },
  });

  if (logoUrl) {
    for (const imageUrl of renderer.imagesToResolve()) {
      if (imageUrl !== logoUrl) continue;
      try {
        const response = await fetch(imageUrl, {
          headers: { accept: "image/png,image/jpeg,image/webp,image/svg+xml;q=0.8" },
          signal: AbortSignal.timeout(3_000),
        });
        const contentLength = Number(response.headers.get("content-length") || 0);
        if (response.ok && contentLength <= 2_000_000) {
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.byteLength <= 2_000_000) renderer.resolveImage(imageUrl, bytes);
        }
      } catch {
        // The initials remain visible when a remote customer logo cannot be loaded.
      }
    }
  }

  return renderer.render().asPng();
}

function ogImage() {
  const cells = Array.from({ length: 16 }, (_, y) => Array.from({ length: 28 }, (_, x) => {
    const fill = (x + y) % 7 === 0 ? "#e44c36" : (x + y) % 11 === 0 ? "#c8861a" : "#d5d9e2";
    return `<rect x="${40 + x * 40}" y="${36 + y * 32}" width="26" height="20" rx="3" fill="${fill}"/>`;
  }).join("")).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f5f7fb"/>
  <g opacity="0.28">${cells}</g>
  <rect x="72" y="132" width="720" height="366" rx="18" fill="#ffffff" stroke="#d5d9e2"/>
  <text x="112" y="238" fill="#0b6bcb" font-family="Inter, Arial, sans-serif" font-size="72" font-weight="900">Link for a Dollar</text>
  <text x="116" y="308" fill="#14161a" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="800">Public discovery board</text>
  <text x="116" y="374" fill="#667085" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="700">Claim a shareable square on the million-link board.</text>
  <text x="116" y="436" fill="#0b6bcb" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="900">linkforadollar.com</text>
</svg>`;
}

function squareOgImage(square) {
  const publicId = Number(square.square_id) + 1;
  const host = hostFromUrl(square.url);
  const label = svgEscape(square.label).slice(0, 42);
  const category = svgEscape(square.category || "Other");
  const initials = svgEscape(initialsFor(square.label, host));
  const logo = square.logo_url ? `<image href="${svgEscape(square.logo_url)}" x="112" y="112" width="160" height="160" preserveAspectRatio="xMidYMid meet"/>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f5f7fb"/>
  <rect x="54" y="54" width="1092" height="522" rx="28" fill="#ffffff" stroke="#d5d9e2" stroke-width="2"/>
  <rect x="88" y="88" width="208" height="208" rx="28" fill="#eef2f7"/>
  <rect x="112" y="112" width="160" height="160" rx="20" fill="#0b6bcb"/>
  <text x="192" y="211" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="54" font-weight="900">${initials}</text>
  ${logo}
  <text x="336" y="124" fill="#667085" font-family="Arial, sans-serif" font-size="25" font-weight="800">FEATURED ON LINK FOR A DOLLAR</text>
  <text x="336" y="213" fill="#14161a" font-family="Arial, sans-serif" font-size="72" font-weight="900">${label}</text>
  <text x="336" y="270" fill="#667085" font-family="Arial, sans-serif" font-size="31" font-weight="700">${svgEscape(host)}</text>
  <rect x="88" y="340" width="1024" height="2" fill="#eef2f7"/>
  <text x="88" y="425" fill="#14161a" font-family="Arial, sans-serif" font-size="42" font-weight="800">Square #${formatNumber(publicId)} · ${category}</text>
  <text x="88" y="503" fill="#0b6bcb" font-family="Arial, sans-serif" font-size="29" font-weight="900">LINKFORADOLLAR.COM</text>
  <text x="1112" y="503" text-anchor="end" fill="#667085" font-family="Arial, sans-serif" font-size="27" font-weight="700">${formatNumber(square.click_count)} tracked clicks</text>
</svg>`;
}

function profileOgImage(profile) {
  const label = svgEscape(profile.label).slice(0, 42);
  const initials = svgEscape(initialsFor(profile.label, profile.host));
  const logoUrl = profile.squares?.[0]?.logo_url || "";
  const logo = logoUrl ? `<image href="${svgEscape(logoUrl)}" x="112" y="112" width="160" height="160" preserveAspectRatio="xMidYMid meet"/>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f5f7fb"/>
  <rect x="72" y="86" width="1056" height="458" rx="20" fill="#ffffff" stroke="#d5d9e2"/>
  <rect x="112" y="112" width="160" height="160" rx="20" fill="#0b6bcb"/>
  <text x="192" y="211" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="54" font-weight="900">${initials}</text>
  ${logo}
  <text x="268" y="166" fill="#667085" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="800">OWNER PROFILE</text>
  <text x="268" y="238" fill="#14161a" font-family="Inter, Arial, sans-serif" font-size="64" font-weight="900">${label}</text>
  <text x="112" y="356" fill="#0b6bcb" font-family="Inter, Arial, sans-serif" font-size="64" font-weight="950">${formatNumber(profile.square_count)} squares</text>
  <text x="112" y="428" fill="#667085" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="800">${svgEscape(profile.host)} · ${formatNumber(profile.click_count)} tracked clicks</text>
  <text x="112" y="492" fill="#0b6bcb" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="900">linkforadollar.com/profile/${svgEscape(profile.host)}</text>
</svg>`;
}

function favicon() {
  return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\">\n  <rect width=\"64\" height=\"64\" fill=\"#f7f3ec\"/>\n  <g fill=\"#0b776f\">\n    <rect x=\"10\" y=\"10\" width=\"12\" height=\"12\"/>\n    <rect x=\"26\" y=\"10\" width=\"12\" height=\"12\"/>\n    <rect x=\"42\" y=\"10\" width=\"12\" height=\"12\"/>\n    <rect x=\"10\" y=\"26\" width=\"12\" height=\"12\"/>\n    <rect x=\"26\" y=\"26\" width=\"12\" height=\"12\"/>\n    <rect x=\"42\" y=\"26\" width=\"12\" height=\"12\"/>\n    <rect x=\"10\" y=\"42\" width=\"12\" height=\"12\"/>\n    <rect x=\"26\" y=\"42\" width=\"12\" height=\"12\"/>\n    <rect x=\"42\" y=\"42\" width=\"12\" height=\"12\"/>\n  </g>\n</svg>";
}
