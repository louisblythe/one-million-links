import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [worker, phpView, phpData] = await Promise.all([
  readFile(resolve(root, "worker/index.js"), "utf8"),
  readFile(resolve(root, "views/stats.php"), "utf8"),
  readFile(resolve(root, "src/bootstrap.php"), "utf8"),
]);

const sharedContract = [
  "Big links.",
  "Traffic Titans",
  "The throne is open",
  "Click Magnets",
  "Category Clash",
  "Link Lords",
  "Fresh Drops",
  "The OG Club",
  "Scene Stealers",
  "Join the chaos",
  "categoriesByListings",
  "categoriesByClicks",
];

for (const term of sharedContract) {
  const phpSource = term.startsWith("categoriesBy") ? phpData + phpView : phpView;
  assert.ok(worker.includes(term), `Worker leaderboard is missing contract term: ${term}`);
  assert.ok(phpSource.includes(term), `PHP leaderboard is missing contract term: ${term}`);
}

assert.match(worker, /clickedListings\.slice\(0, 3\)/, "Worker podium must use positive-click listings.");
assert.match(phpView, /array_slice\(\$clickedListings, 0, 3\)/, "PHP podium must use positive-click listings.");
assert.match(worker, /LIVE_LEADERBOARD_CACHE = "no-store"/, "Worker leaderboard must bypass HTML caching.");

console.log("Leaderboard Worker/PHP contract passed.");
