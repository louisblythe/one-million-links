const GRID_SIZE = 1000;
const TOTAL_SQUARES = GRID_SIZE * GRID_SIZE;
const MIN_ZOOM = 1;
const MAX_ZOOM = 32;
const START_ZOOM = 4;
const CLUSTER_SIZE = 20;
const CLAIM_COLORS = ["#b92f20", "#17627d", "#8a5b00", "#48612f", "#6d3fd1", "#a52d68", "#084f96", "#6b4d2e"];
const CATEGORY_COLORS = {
  AI: "#6d3fd1",
  SaaS: "#17627d",
  Ecommerce: "#b92f20",
  Agency: "#0b776f",
  Media: "#a52d68",
  "Developer tools": "#48612f",
  Finance: "#6b4d2e",
  "Local business": "#8a5b00",
  Other: "#4f5968",
};

const canvas = document.getElementById("grid");
const context = canvas.getContext("2d");
const squareInput = document.getElementById("square_id");
const selectedLabel = document.getElementById("selectedLabel");
const selectedLink = document.getElementById("selectedLink");
const selectedCard = document.getElementById("selectedCard");
const claimedCount = document.getElementById("claimedCount");
const hoverPreview = document.getElementById("hoverPreview");
const zoomRange = document.getElementById("zoomRange");
const zoomOut = document.getElementById("zoomOut");
const zoomIn = document.getElementById("zoomIn");
const zoomHome = document.getElementById("zoomHome");
const companySearch = document.getElementById("companySearch");
const searchResults = document.getElementById("searchResults");
const categoryFilter = document.getElementById("categoryFilter");
const packSizeInput = document.getElementById("pack_size");
const checkoutButton = document.getElementById("checkoutButton");

const rawSquares = window.__PAID_SQUARES__ || [];
const allSquares = rawSquares.map((square) => {
  const id = Number(square.square_id);
  const category = square.category || "Other";
  const clickCount = Number(square.click_count || 0);
  const paidAt = square.paid_at || "";
  const host = toHost(square.url);

  return {
    id,
    label: square.label,
    url: square.url,
    host,
    category,
    clickCount,
    verified: Boolean(Number(square.verified_company || 0)),
    territoryKey: square.territory_key || "",
    territorySize: Number(square.territory_size || 1),
    paidAt,
    color: CATEGORY_COLORS[category] || CLAIM_COLORS[Math.abs(hashString(`${square.label}-${square.url}`)) % CLAIM_COLORS.length],
  };
});
const paidSquares = new Map(allSquares.map((square) => [square.id, square]));
const territories = buildTerritories(allSquares);

let visibleSquares = allSquares;
let visibleSquareIds = new Set(visibleSquares.map((square) => square.id));
let clusters = buildClusters(visibleSquares);
let selectedId = Number(squareInput.value || 1) - 1;
let hoveredId = null;
let zoom = START_ZOOM;
let originX = 0;
let originY = 0;
let isPanning = false;
let panStart = null;

function hashString(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return hash;
}

function toHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function initials(label, host) {
  const source = (label || host || "?").trim();
  const words = source.split(/[\s.-]+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function formatDate(value) {
  if (!value) {
    return "New";
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "New";
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function logoUrl(host) {
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : "";
}

function visitHref(squareId) {
  return `/go/${squareId + 1}`;
}

function formattedClicks(clicks) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(clicks);
}

function buildClusters(squares) {
  const clusterMap = new Map();

  for (const square of squares) {
    const x = square.id % GRID_SIZE;
    const y = Math.floor(square.id / GRID_SIZE);
    const key = `${Math.floor(x / CLUSTER_SIZE)}:${Math.floor(y / CLUSTER_SIZE)}`;
    const cluster = clusterMap.get(key) || {
      x: Math.floor(x / CLUSTER_SIZE) * CLUSTER_SIZE,
      y: Math.floor(y / CLUSTER_SIZE) * CLUSTER_SIZE,
      count: 0,
      samples: [],
    };

    cluster.count += 1;
    if (cluster.samples.length < 4) {
      cluster.samples.push(square);
    }
    clusterMap.set(key, cluster);
  }

  return [...clusterMap.values()];
}

function buildTerritories(squares) {
  const territoryMap = new Map();

  for (const square of squares) {
    const key = square.territoryKey || `single:${square.id}`;
    const x = square.id % GRID_SIZE;
    const y = Math.floor(square.id / GRID_SIZE);
    const territory = territoryMap.get(key) || {
      ids: [],
      minX: x,
      maxX: x,
      minY: y,
      maxY: y,
      color: square.color,
      verified: square.verified,
    };

    territory.ids.push(square.id);
    territory.minX = Math.min(territory.minX, x);
    territory.maxX = Math.max(territory.maxX, x);
    territory.minY = Math.min(territory.minY, y);
    territory.maxY = Math.max(territory.maxY, y);
    territory.verified = territory.verified || square.verified;
    territoryMap.set(key, territory);
  }

  return [...territoryMap.values()];
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  context.setTransform(scale, 0, 0, scale, 0, 0);
  clampOrigin();
  drawGrid();
}

function viewport() {
  return {
    width: canvas.width / (window.devicePixelRatio || 1),
    height: canvas.height / (window.devicePixelRatio || 1),
  };
}

function clampOrigin() {
  const view = viewport();
  const maxX = Math.max(0, GRID_SIZE - view.width / zoom);
  const maxY = Math.max(0, GRID_SIZE - view.height / zoom);
  originX = Math.max(0, Math.min(maxX, originX));
  originY = Math.max(0, Math.min(maxY, originY));
}

function screenToGrid(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = originX + (clientX - rect.left) / zoom;
  const y = originY + (clientY - rect.top) / zoom;

  return {
    x: Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(x))),
    y: Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(y))),
  };
}

function squareIdFromEvent(event) {
  const point = screenToGrid(event.clientX, event.clientY);
  return point.y * GRID_SIZE + point.x;
}

function setZoom(nextZoom, anchorClientX, anchorClientY) {
  const rect = canvas.getBoundingClientRect();
  const oldZoom = zoom;
  const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
  const anchorX = anchorClientX == null ? rect.left + rect.width / 2 : anchorClientX;
  const anchorY = anchorClientY == null ? rect.top + rect.height / 2 : anchorClientY;
  const gridX = originX + (anchorX - rect.left) / oldZoom;
  const gridY = originY + (anchorY - rect.top) / oldZoom;

  zoom = next;
  originX = gridX - (anchorX - rect.left) / zoom;
  originY = gridY - (anchorY - rect.top) / zoom;
  zoomRange.value = String(zoom);
  clampOrigin();
  drawGrid();
}

function centerOnSquare(squareId, targetZoom = Math.max(zoom, 18)) {
  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
  zoomRange.value = String(zoom);
  const view = viewport();
  originX = squareId % GRID_SIZE - view.width / zoom / 2;
  originY = Math.floor(squareId / GRID_SIZE) - view.height / zoom / 2;
  clampOrigin();
  drawGrid();
}

function fitToOccupied() {
  const source = visibleSquares.length ? visibleSquares : allSquares;

  if (source.length === 0) {
    originX = 0;
    originY = 0;
    setZoom(START_ZOOM);
    return;
  }

  const xs = source.map((square) => square.id % GRID_SIZE);
  const ys = source.map((square) => Math.floor(square.id / GRID_SIZE));
  const minX = Math.max(0, Math.min(...xs) - 24);
  const maxX = Math.min(GRID_SIZE, Math.max(...xs) + 24);
  const minY = Math.max(0, Math.min(...ys) - 24);
  const maxY = Math.min(GRID_SIZE, Math.max(...ys) + 24);
  const view = viewport();
  const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(Math.min(view.width / Math.max(1, maxX - minX), view.height / Math.max(1, maxY - minY)))));

  zoom = Number.isFinite(targetZoom) ? targetZoom : START_ZOOM;
  originX = minX;
  originY = minY;
  zoomRange.value = String(zoom);
  clampOrigin();
  drawGrid();
}

function focusFeaturedBlock() {
  const source = visibleSquares.length ? visibleSquares : allSquares;

  if (source.length === 0) {
    originX = 0;
    originY = 0;
    setZoom(START_ZOOM);
    return;
  }

  const featuredCluster = buildClusters(source).sort((left, right) => right.count - left.count || left.x - right.x)[0];
  const view = viewport();
  const centerX = featuredCluster.x + CLUSTER_SIZE / 2;
  const centerY = featuredCluster.y + CLUSTER_SIZE / 2;

  zoom = Math.min(MAX_ZOOM, Math.max(32, Math.floor(Math.min(view.width / 48, view.height / 48))));
  originX = centerX - view.width / zoom / 2;
  originY = centerY - view.height / zoom / 2;
  zoomRange.value = String(zoom);
  clampOrigin();
  drawGrid();
}

function drawGrid() {
  const view = viewport();
  context.clearRect(0, 0, view.width, view.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, view.width, view.height);

  drawBoardTexture(view);
  drawOccupiedBlocks();
  drawHeatmap(view);
  drawTerritoryOutlines();
  drawExpansionPreview();
  drawSelection(selectedId, "#0b6bcb", 2);

  if (hoveredId !== null && hoveredId !== selectedId) {
    drawSelection(hoveredId, "#14161a", 1.5);
  }
}

function drawBoardTexture(view) {
  const cellStep = zoom >= 10 ? zoom : Math.max(8, CLUSTER_SIZE * zoom);
  const startX = Math.floor(originX / (cellStep / zoom)) * (cellStep / zoom);
  const startY = Math.floor(originY / (cellStep / zoom)) * (cellStep / zoom);

  context.strokeStyle = zoom >= 10 ? "rgba(20, 22, 26, 0.08)" : "rgba(20, 22, 26, 0.05)";
  context.lineWidth = 1;

  for (let x = startX; x <= originX + view.width / zoom; x += cellStep / zoom) {
    const sx = Math.round((x - originX) * zoom) + 0.5;
    context.beginPath();
    context.moveTo(sx, 0);
    context.lineTo(sx, view.height);
    context.stroke();
  }

  for (let y = startY; y <= originY + view.height / zoom; y += cellStep / zoom) {
    const sy = Math.round((y - originY) * zoom) + 0.5;
    context.beginPath();
    context.moveTo(0, sy);
    context.lineTo(view.width, sy);
    context.stroke();
  }
}

function drawOccupiedBlocks() {
  if (zoom < 7) {
    drawClusters();
    return;
  }

  for (const square of visibleSquares) {
    drawClaim(square);
  }
}

function drawClusters() {
  for (const cluster of clusters) {
    const sx = (cluster.x - originX) * zoom;
    const sy = (cluster.y - originY) * zoom;
    const size = Math.max(6, CLUSTER_SIZE * zoom);

    if (sx > canvas.clientWidth || sy > canvas.clientHeight || sx + size < 0 || sy + size < 0) {
      continue;
    }

    const intensity = Math.min(1, 0.24 + cluster.count / 8);
    context.fillStyle = cluster.samples[0]?.color || "#e44c36";
    context.globalAlpha = intensity;
    context.fillRect(sx, sy, size, size);
    context.globalAlpha = 1;
    context.strokeStyle = "rgba(20, 22, 26, 0.18)";
    context.lineWidth = 1;
    context.strokeRect(sx + 0.5, sy + 0.5, size - 1, size - 1);

    cluster.samples.forEach((sample, index) => {
      const swatch = Math.max(5, Math.min(14, size / 5));
      context.fillStyle = sample.color;
      context.fillRect(sx + 4 + index * (swatch + 2), sy + 4, swatch, swatch);
    });

    if (size >= 28) {
      context.fillStyle = "#ffffff";
      context.font = "800 11px Inter, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(cluster.count), sx + size / 2, sy + size / 2);
    }
  }
}

function drawHeatmap(view) {
  const maxClicks = Math.max(1, ...visibleSquares.map((square) => square.clickCount));

  for (const square of visibleSquares) {
    if (square.clickCount <= 0) {
      continue;
    }

    const x = square.id % GRID_SIZE;
    const y = Math.floor(square.id / GRID_SIZE);
    const sx = (x - originX) * zoom;
    const sy = (y - originY) * zoom;
    const radius = Math.max(8, Math.min(36, zoom * 2 + (square.clickCount / maxClicks) * 22));

    if (sx > view.width || sy > view.height || sx + radius < 0 || sy + radius < 0) {
      continue;
    }

    const gradient = context.createRadialGradient(sx, sy, 0, sx, sy, radius);
    gradient.addColorStop(0, "rgba(200, 134, 26, 0.28)");
    gradient.addColorStop(1, "rgba(200, 134, 26, 0)");
    context.fillStyle = gradient;
    context.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
  }
}

function drawClaim(square) {
  const x = square.id % GRID_SIZE;
  const y = Math.floor(square.id / GRID_SIZE);
  const sx = (x - originX) * zoom;
  const sy = (y - originY) * zoom;
  const size = Math.max(zoom, 6);

  if (sx > canvas.clientWidth || sy > canvas.clientHeight || sx + size < 0 || sy + size < 0) {
    return;
  }

  context.fillStyle = square.color;
  context.fillRect(sx, sy, size, size);

  if (zoom >= 18) {
    context.fillStyle = "#ffffff";
    context.font = "800 9px Inter, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(initials(square.label, square.host), sx + size / 2, sy + size / 2 + 0.5);
  }
}

function drawTerritoryOutlines() {
  for (const territory of territories) {
    if (territory.ids.length < 2) {
      continue;
    }

    const sx = (territory.minX - originX) * zoom;
    const sy = (territory.minY - originY) * zoom;
    const width = (territory.maxX - territory.minX + 1) * zoom;
    const height = (territory.maxY - territory.minY + 1) * zoom;

    if (sx > canvas.clientWidth || sy > canvas.clientHeight || sx + width < 0 || sy + height < 0) {
      continue;
    }

    context.strokeStyle = territory.verified ? "#14161a" : territory.color;
    context.lineWidth = territory.ids.length >= 10 ? 3 : 2;
    context.strokeRect(sx - 2, sy - 2, Math.max(width, 8) + 4, Math.max(height, 8) + 4);
  }
}

function selectedPackSize() {
  return Number(packSizeInput?.value || 1);
}

function adjacentIds(squareId, packSize) {
  const width = packSize === 1 ? 1 : Math.ceil(Math.sqrt(packSize));
  const height = Math.ceil(packSize / width);
  const startX = Math.min(squareId % GRID_SIZE, GRID_SIZE - width);
  const startY = Math.min(Math.floor(squareId / GRID_SIZE), GRID_SIZE - height);
  const ids = [];

  for (let y = 0; y < height && ids.length < packSize; y += 1) {
    for (let x = 0; x < width && ids.length < packSize; x += 1) {
      ids.push((startY + y) * GRID_SIZE + startX + x);
    }
  }

  return ids;
}

function drawExpansionPreview() {
  const ids = adjacentIds(selectedId, selectedPackSize());

  if (ids.length <= 1) {
    return;
  }

  context.fillStyle = "rgba(11, 107, 203, 0.15)";
  for (const id of ids) {
    const sx = ((id % GRID_SIZE) - originX) * zoom;
    const sy = (Math.floor(id / GRID_SIZE) - originY) * zoom;
    context.fillRect(sx, sy, Math.max(zoom, 6), Math.max(zoom, 6));
  }
}

function drawSelection(squareId, color, lineWidth) {
  const x = squareId % GRID_SIZE;
  const y = Math.floor(squareId / GRID_SIZE);
  const sx = (x - originX) * zoom;
  const sy = (y - originY) * zoom;
  const size = Math.max(zoom, 8);

  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.strokeRect(sx - 4, sy - 4, size + 8, size + 8);
}

function selectSquare(squareId, shouldCenter = false) {
  const boundedId = Math.max(0, Math.min(TOTAL_SQUARES - 1, squareId));
  const claimed = paidSquares.get(boundedId);
  selectedId = boundedId;

  squareInput.value = String(boundedId + 1);
  selectedLabel.textContent = `#${boundedId + 1}${claimed ? ` · ${claimed.label}` : ""}`;
  renderSelectedCard(claimed, boundedId);

  if (claimed) {
    selectedLink.href = visitHref(boundedId);
    selectedLink.hidden = false;
  } else {
    selectedLink.hidden = true;
  }

  if (shouldCenter) {
    centerOnSquare(boundedId);
  } else {
    drawGrid();
  }
}

function renderSelectedCard(claimed, squareId) {
  const title = claimed ? claimed.label : "Open square";
  const packSize = selectedPackSize();
  const rarity = rarityFor(squareId, claimed);
  const meta = claimed ? `${claimed.host} · ${claimed.category} · ${rarity}` : `${packSize} connected ${packSize === 1 ? "square" : "squares"} · $${packSize}`;
  const color = claimed ? claimed.color : "#d5d9e2";
  const mark = claimed ? initials(claimed.label, claimed.host) : String((squareId % 9) + 1);
  const profileLink = claimed ? `<a href="/profile/${encodeURIComponent(claimed.host)}">Profile</a>` : "";

  selectedCard.innerHTML = `
    <div class="mini-logo" style="background:${color}">${escapeHtml(mark)}</div>
    <div>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(meta)}</span>
      ${claimed?.verified ? '<em class="verified-badge">Verified company</em>' : ""}
      ${profileLink}
    </div>
  `;
}

function rarityFor(squareId, claimed) {
  if (claimed?.territorySize >= 25) {
    return "Legendary territory";
  }

  if (claimed?.territorySize >= 10) {
    return "Epic territory";
  }

  if (squareId < 1000) {
    return "Genesis row";
  }

  if ((squareId + 1) % 1000 === 0 || squareId % 1111 === 0) {
    return "Pattern square";
  }

  return claimed ? "Claimed" : "Common";
}

function showHoverPreview(event, squareId) {
  const claimed = paidSquares.get(squareId);
  const x = squareId % GRID_SIZE;
  const y = Math.floor(squareId / GRID_SIZE);
  const cluster = clusters.find((entry) => x >= entry.x && x < entry.x + CLUSTER_SIZE && y >= entry.y && y < entry.y + CLUSTER_SIZE);

  hoveredId = squareId;

  if (claimed) {
    hoverPreview.innerHTML = `
      <div class="hover-preview__media" style="--brand-color:${claimed.color}">
        <img src="${escapeHtml(logoUrl(claimed.host))}" alt="" width="40" height="40" onerror="this.hidden=true;this.nextElementSibling.style.opacity=1">
        <span>${escapeHtml(initials(claimed.label, claimed.host))}</span>
      </div>
      <div class="hover-preview__body">
        <div class="hover-preview__header">
          <div>
            <p class="hover-preview__eyebrow">${escapeHtml(claimed.host || `#${squareId + 1}`)}</p>
            <strong class="hover-preview__title">${escapeHtml(claimed.label)}</strong>
          </div>
          <a class="hover-preview__visit" href="${escapeHtml(visitHref(squareId))}" target="_blank" rel="noopener">visit</a>
        </div>
        <dl class="hover-preview__meta" aria-label="Link details">
          <div><dt>Category</dt><dd>${escapeHtml(claimed.category)}</dd></div>
          <div><dt>Clicks</dt><dd>${formattedClicks(claimed.clickCount)}</dd></div>
          <div><dt>Rarity</dt><dd>${escapeHtml(rarityFor(squareId, claimed))}</dd></div>
        </dl>
        <div class="hover-preview__card">
          <span class="mini-logo" style="background:${claimed.color}">${escapeHtml(initials(claimed.label, claimed.host))}</span>
          <div>
            <strong>${escapeHtml(claimed.label)}</strong>
            <span>${escapeHtml(claimed.host || claimed.url)}</span>
          </div>
        </div>
      </div>
    `;
  } else {
    hoverPreview.innerHTML = `
      <div class="hover-preview__empty"></div>
      <div class="hover-preview__body">
        <div>
          <p class="hover-preview__eyebrow">Available square</p>
          <strong class="hover-preview__title">Square #${squareId + 1}</strong>
        </div>
        <p class="hover-preview__summary">${cluster?.count ? `${cluster.count} claimed nearby` : "Open for a new public profile, claim page, and analytics trail."}</p>
      </div>
    `;
  }

  positionHoverPreview(event);
  hoverPreview.hidden = false;
  drawGrid();
}

function positionHoverPreview(event) {
  const rect = canvas.getBoundingClientRect();
  const previewWidth = 390;
  const previewHeight = 240;
  const left = Math.min(rect.width - previewWidth - 12, Math.max(12, event.clientX - rect.left + 14));
  const top = Math.min(rect.height - previewHeight - 12, Math.max(12, event.clientY - rect.top + 14));
  hoverPreview.style.left = `${left}px`;
  hoverPreview.style.top = `${top}px`;
}

function applyFilters() {
  const activeCategory = categoryFilter.value;
  const query = companySearch.value.trim().toLowerCase();

  visibleSquares = allSquares.filter((square) => {
    const categoryMatches = activeCategory === "All" || square.category === activeCategory;
    const queryMatches = !query || [square.label, square.host, square.category, square.url].some((value) => value.toLowerCase().includes(query));
    return categoryMatches && queryMatches;
  });
  visibleSquareIds = new Set(visibleSquares.map((square) => square.id));
  clusters = buildClusters(visibleSquares);
  renderSearchResults(query);
  updateMomentum();
  drawGrid();
}

function renderSearchResults(query) {
  if (!query) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
    return;
  }

  const matches = visibleSquares.slice(0, 8);
  if (matches.length === 0) {
    searchResults.innerHTML = '<div class="search-result"><span></span><strong>No claimed squares found</strong><em>Try another company or category</em></div>';
    searchResults.hidden = false;
    return;
  }

  searchResults.innerHTML = matches.map((square) => `
    <a class="search-result" href="/squares/${square.id + 1}">
      <span class="mini-logo" style="background:${square.color}">${escapeHtml(initials(square.label, square.host))}</span>
      <span>
        <strong>${escapeHtml(square.label)}</strong>
        <span>${escapeHtml(square.host)} · ${escapeHtml(square.category)}</span>
      </span>
      <em>#${square.id + 1}</em>
    </a>
  `).join("");
  searchResults.hidden = false;
}

function updateMomentum() {
  const newest = [...visibleSquares].sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));
  const today = new Date().toISOString().slice(0, 10);
  const claimedToday = visibleSquares.filter((square) => String(square.paidAt).startsWith(today)).length;
  const categories = categoryCounts(visibleSquares);
  const fastest = categories[0];

  setText("latestClaim", newest[0] ? `${newest[0].label} claimed #${newest[0].id + 1}` : "Waiting for the first claim");
  setText("claimedToday", `${claimedToday} square${claimedToday === 1 ? "" : "s"} claimed today`);
  setText("fastestCategory", fastest ? `${fastest.category}: ${fastest.count} claimed` : "Categories open");
  setText("liveActivity", `${visibleSquares.length} visible of ${allSquares.length} claimed`);
}

function renderPanels() {
  const newest = [...allSquares].sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));
  const topClicked = [...allSquares].sort((a, b) => b.clickCount - a.clickCount || a.id - b.id);
  const featured = topClicked.filter((square) => square.clickCount > 0).concat(newest).filter(uniqueById).slice(0, 4);

  renderSquareList("newestSquares", newest.slice(0, 5), "Claimed");
  renderSquareList("mostClicked", topClicked.slice(0, 5), "Clicks", (square) => String(square.clickCount));
  renderSquareList("featuredSquares", featured.slice(0, 4), "Clicks", (square) => `${formattedClicks(square.clickCount)} clicks`);
  renderCategories();
  renderTrending(newest.slice(0, 8));
}

function uniqueById(square, index, source) {
  return source.findIndex((candidate) => candidate.id === square.id) === index;
}

function categoryCounts(squares) {
  const counts = new Map();

  for (const square of squares) {
    counts.set(square.category, (counts.get(square.category) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

function renderCategories() {
  const target = document.getElementById("topCategories");
  const categories = categoryCounts(allSquares).slice(0, 6);

  target.innerHTML = categories.length ? categories.map(({ category, count }) => `
    <li>
      <div>
        <strong><a href="/collections/${encodeURIComponent(category)}">${escapeHtml(category)}</a></strong>
        <span>${count} claimed square${count === 1 ? "" : "s"}</span>
      </div>
      <a class="proof-action" href="/collections/${encodeURIComponent(category)}">View</a>
    </li>
  `).join("") : "<li><div><strong>No categories yet</strong><span>First claims define the board</span></div></li>";
}

function renderSquareList(id, squares, label, metric = (square) => `#${square.id + 1}`) {
  const target = document.getElementById(id);

  target.innerHTML = squares.length ? squares.map((square, index) => `
    <li>
      <span class="mini-logo" style="background:${square.color}">${escapeHtml(initials(square.label, square.host))}</span>
      <div>
        <strong>${escapeHtml(square.label)}</strong>
        <span>${escapeHtml(square.category)} · ${escapeHtml(square.host)}</span>
      </div>
      <a class="proof-action" href="/squares/${square.id + 1}">${escapeHtml(metric(square, index) || label)}</a>
    </li>
  `).join("") : `<li><div><strong>No claims yet</strong><span>${escapeHtml(label)} will appear here</span></div></li>`;
}

function renderTrending(squares) {
  const target = document.getElementById("trendingSquares");

  target.innerHTML = squares.length ? squares.map((square) => `
    <a class="trending-card" href="/squares/${square.id + 1}">
      <span class="mini-logo" style="background:${square.color}">${escapeHtml(initials(square.label, square.host))}</span>
      <span>
        <strong>${escapeHtml(square.label)}</strong>
        <span>${escapeHtml(square.category)} · ${escapeHtml(square.host)}</span>
      </span>
      <em>#${square.id + 1}</em>
    </a>
  `).join("") : '<div class="trending-card"><span></span><strong>No claimed squares yet</strong><span>Fresh claims will land here.</span></div>';
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function updateCheckoutButton() {
  if (!checkoutButton) {
    return;
  }

  const packSize = selectedPackSize();
  checkoutButton.textContent = `Claim ${packSize} ${packSize === 1 ? "square" : "connected squares"} for $${packSize}`;
  renderSelectedCard(paidSquares.get(selectedId), selectedId);
  drawGrid();
}

canvas.addEventListener("click", (event) => {
  if (isPanning) {
    return;
  }

  const squareId = squareIdFromEvent(event);

  if (paidSquares.has(squareId)) {
    window.open(visitHref(squareId), "_blank", "noopener");
    return;
  }

  selectSquare(squareId);
});

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  isPanning = false;
  panStart = {
    x: event.clientX,
    y: event.clientY,
    originX,
    originY,
  };
});

canvas.addEventListener("pointermove", (event) => {
  if (panStart) {
    const dx = event.clientX - panStart.x;
    const dy = event.clientY - panStart.y;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      isPanning = true;
      originX = panStart.originX - dx / zoom;
      originY = panStart.originY - dy / zoom;
      clampOrigin();
      hoverPreview.hidden = true;
      drawGrid();
      return;
    }
  }

  const squareId = squareIdFromEvent(event);
  canvas.style.cursor = paidSquares.has(squareId) ? "pointer" : "grab";
  showHoverPreview(event, squareId);
});

canvas.addEventListener("pointerup", () => {
  setTimeout(() => {
    isPanning = false;
  }, 0);
  panStart = null;
});

canvas.addEventListener("pointerleave", () => {
  hoveredId = null;
  panStart = null;
  canvas.style.cursor = "";
  hoverPreview.hidden = true;
  drawGrid();
});

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  setZoom(zoom + (event.deltaY > 0 ? -1 : 1), event.clientX, event.clientY);
}, { passive: false });

document.addEventListener("click", (event) => {
  const squareButton = event.target.closest("[data-square-id]");
  const categoryButton = event.target.closest("[data-category]");

  if (squareButton) {
    const squareId = Number(squareButton.dataset.squareId);
    selectSquare(squareId, true);
    searchResults.hidden = true;
  }

  if (categoryButton) {
    categoryFilter.value = categoryButton.dataset.category;
    companySearch.value = "";
    applyFilters();
    fitToOccupied();
  }

  if (!event.target.closest(".search-control")) {
    searchResults.hidden = true;
  }
});

zoomRange.addEventListener("input", () => setZoom(Number(zoomRange.value)));
zoomOut.addEventListener("click", () => setZoom(zoom - 1));
zoomIn.addEventListener("click", () => setZoom(zoom + 1));
zoomHome.addEventListener("click", fitToOccupied);
squareInput.addEventListener("input", () => selectSquare(Number(squareInput.value || 1) - 1, true));
packSizeInput?.addEventListener("change", updateCheckoutButton);
companySearch.addEventListener("input", applyFilters);
categoryFilter.addEventListener("change", () => {
  applyFilters();
  fitToOccupied();
});
window.addEventListener("resize", resizeCanvas);

zoomRange.value = String(zoom);
resizeCanvas();
renderPanels();
applyFilters();
const initialSelection = Number(squareInput.value || 1) - 1;
if (allSquares.length > 0 && initialSelection <= 0) {
  focusFeaturedBlock();
}
selectSquare(initialSelection, allSquares.length === 0 || initialSelection > 0);
claimedCount.textContent = String(paidSquares.size);
updateCheckoutButton();
