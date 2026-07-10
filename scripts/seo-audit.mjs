const base = (process.env.SEO_BASE_URL || process.argv[2] || "https://linkforadollar.com").replace(/\/+$/, "");
const failures = [];

function matches(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function get(path, options = {}) {
  return fetch(path.startsWith("http") ? path : `${base}${path}`, {
    redirect: options.redirect || "follow",
    headers: { "user-agent": "Link for a Dollar SEO regression audit" },
  });
}

const sitemapResponse = await get("/sitemap.xml");
assert(sitemapResponse.ok, `/sitemap.xml returned ${sitemapResponse.status}`);
const sitemapIndex = await sitemapResponse.text();
const sitemapUrls = matches(sitemapIndex, /<loc>([^<]+)<\/loc>/g);
assert(sitemapIndex.includes("<sitemapindex"), "/sitemap.xml is not a sitemap index");

const pageUrls = [];
for (const sitemapUrl of sitemapUrls) {
  const response = await get(sitemapUrl);
  assert(response.ok, `${sitemapUrl} returned ${response.status}`);
  const body = await response.text();
  pageUrls.push(...matches(body, /<loc>([^<]+)<\/loc>/g));
}

const uniqueUrls = [...new Set(pageUrls)];
assert(uniqueUrls.length === pageUrls.length, "Sitemap shards contain duplicate URLs");

const inbound = new Map(uniqueUrls.map((url) => [url, new Set()]));
let cursor = 0;
const workers = Array.from({ length: Math.min(10, uniqueUrls.length || 1) }, async () => {
  while (cursor < uniqueUrls.length) {
    const index = cursor++;
    const url = uniqueUrls[index];
    const response = await get(url);
    const html = await response.text();
    assert(response.status === 200, `${url} returned ${response.status}`);
    assert(matches(html, /<title>([^<]+)<\/title>/gi).length === 1, `${url} must have one title`);
    assert(matches(html, /<meta name="description" content="([^"]+)"/gi).length === 1, `${url} must have one description`);
    assert(matches(html, /<link rel="canonical" href="([^"]+)"/gi).length === 1, `${url} must have one canonical`);
    assert(matches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).length === 1, `${url} must have one H1`);
    assert(html.includes('<meta property="og:image:type" content="image/png">'), `${url} must use a PNG social image`);
    assert(html.includes('<meta name="robots" content="index, follow, max-image-preview:large">'), `${url} must be explicitly indexable`);

    for (const href of matches(html, /<a[^>]+href="([^"]+)"/gi)) {
      const destination = new URL(href, url);
      destination.hash = "";
      const normalized = destination.toString();
      if (inbound.has(normalized) && normalized !== url) inbound.get(normalized).add(url);
    }
  }
});
await Promise.all(workers);

const weakPages = [...inbound].filter(([url, sources]) => url !== `${base}/` && sources.size === 0);
assert(weakPages.length === 0, `Pages without internal inbound links: ${weakPages.map(([url]) => url).join(", ")}`);

const baseUrl = new URL(base);
const redirectChecks = [
  [`${base}/stats/`, `${base}/stats`],
  [`${base}/collections/agency`, `${base}/collections/Agency`],
  [`${base}/rss.xml`, `${base}/feed.xml`],
  [`${base}/recent.json`, `${base}/claims.json`],
];
if (!["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname)) {
  redirectChecks.unshift(
    [`http://${baseUrl.host}/`, `${base}/`],
    [`https://www.${baseUrl.host}/`, `${base}/`],
  );
}
for (const [from, to] of redirectChecks) {
  const response = await get(from, { redirect: "manual" });
  assert(response.status === 301 && response.headers.get("location") === to, `${from} must 301 to ${to}`);
}

for (const path of ["/not-found", "/squares/1000001", "/leaderboards/nope", "/collections/nonsense", "/success"]) {
  const response = await get(path, { redirect: "manual" });
  assert(response.status === 404, `${path} must return 404`);
  assert((response.headers.get("x-robots-tag") || "").includes("noindex"), `${path} must send X-Robots-Tag: noindex`);
}

const imageResponse = await get("/og-image.png");
const imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
assert(imageResponse.headers.get("content-type") === "image/png", "/og-image.png must return image/png");
assert(imageBytes[0] === 0x89 && imageBytes[1] === 0x50 && imageBytes[2] === 0x4e && imageBytes[3] === 0x47, "/og-image.png must contain PNG bytes");

if (failures.length) {
  console.error(`SEO audit failed with ${failures.length} issue(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`SEO audit passed for ${uniqueUrls.length} canonical pages across ${sitemapUrls.length} sitemap shards.`);
