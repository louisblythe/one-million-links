const GRID_SIZE = 1000;
const TOTAL_SQUARES = GRID_SIZE * GRID_SIZE;
const MIN_ZOOM = 1;
const MAX_ZOOM = 32;
const START_ZOOM = 4;
const CLUSTER_SIZE = 20;
const CLAIM_COLORS = ["#e44c36", "#227c9d", "#f2a541", "#5f7c3a", "#8a5cf6", "#d14f86", "#0b776f", "#6b4d2e"];

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

const rawSquares = window.__PAID_SQUARES__ || [];
const paidSquares = new Map(
  rawSquares.map((square) => {
    const id = Number(square.square_id);

    return [
      id,
      {
        id,
        label: square.label,
        url: square.url,
        host: toHost(square.url),
        color: CLAIM_COLORS[Math.abs(hashString(`${square.label}-${square.url}`)) % CLAIM_COLORS.length],
      },
    ];
  }),
);

const clusters = buildClusters([...paidSquares.values()]);
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

function fitToOccupied() {
  if (paidSquares.size === 0) {
    originX = 0;
    originY = 0;
    setZoom(START_ZOOM);
    return;
  }

  const ids = [...paidSquares.keys()];
  const xs = ids.map((id) => id % GRID_SIZE);
  const ys = ids.map((id) => Math.floor(id / GRID_SIZE));
  const minX = Math.max(0, Math.min(...xs) - 24);
  const maxX = Math.min(GRID_SIZE, Math.max(...xs) + 24);
  const minY = Math.max(0, Math.min(...ys) - 24);
  const maxY = Math.min(GRID_SIZE, Math.max(...ys) + 24);
  const view = viewport();
  const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(Math.min(view.width / (maxX - minX), view.height / (maxY - minY)))));

  zoom = Number.isFinite(targetZoom) ? targetZoom : START_ZOOM;
  originX = minX;
  originY = minY;
  zoomRange.value = String(zoom);
  clampOrigin();
  drawGrid();
}

function drawGrid() {
  const view = viewport();
  context.clearRect(0, 0, view.width, view.height);
  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, view.width, view.height);

  drawBoardTexture(view);
  drawOccupiedBlocks();
  drawSelection(selectedId, "#0b776f", 2);

  if (hoveredId !== null && hoveredId !== selectedId) {
    drawSelection(hoveredId, "#17140f", 1.5);
  }
}

function drawBoardTexture(view) {
  const cellStep = zoom >= 10 ? zoom : Math.max(8, CLUSTER_SIZE * zoom);
  const startX = Math.floor(originX / (cellStep / zoom)) * (cellStep / zoom);
  const startY = Math.floor(originY / (cellStep / zoom)) * (cellStep / zoom);

  context.strokeStyle = zoom >= 10 ? "rgba(23, 20, 15, 0.08)" : "rgba(23, 20, 15, 0.05)";
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

  for (const square of paidSquares.values()) {
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

    const intensity = Math.min(1, 0.2 + cluster.count / 8);
    context.fillStyle = `rgba(228, 76, 54, ${intensity})`;
    context.fillRect(sx, sy, size, size);

    if (size >= 28) {
      context.fillStyle = "#fffaf2";
      context.font = "700 11px Inter, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(cluster.count), sx + size / 2, sy + size / 2);
    }
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
    selectedLink.href = claimed.url;
    selectedLink.hidden = false;
  } else {
    selectedLink.hidden = true;
  }

  if (shouldCenter) {
    const view = viewport();
    originX = boundedId % GRID_SIZE - view.width / zoom / 2;
    originY = Math.floor(boundedId / GRID_SIZE) - view.height / zoom / 2;
    clampOrigin();
  }

  drawGrid();
}

function renderSelectedCard(claimed, squareId) {
  const title = claimed ? claimed.label : "Open square";
  const meta = claimed ? claimed.host : "Available for $1";
  const color = claimed ? claimed.color : "#d9d1c6";
  const mark = claimed ? initials(claimed.label, claimed.host) : String((squareId % 9) + 1);

  selectedCard.innerHTML = `
    <div class="mini-logo" style="background:${color}">${mark}</div>
    <div>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(meta)}</span>
    </div>
  `;
}

function showHoverPreview(event, squareId) {
  const claimed = paidSquares.get(squareId);
  const x = squareId % GRID_SIZE;
  const y = Math.floor(squareId / GRID_SIZE);
  const cluster = clusters.find((entry) => x >= entry.x && x < entry.x + CLUSTER_SIZE && y >= entry.y && y < entry.y + CLUSTER_SIZE);

  hoveredId = squareId;

  if (claimed) {
    hoverPreview.innerHTML = `
      <div class="mini-logo" style="background:${claimed.color}">${initials(claimed.label, claimed.host)}</div>
      <div>
        <strong>${escapeHtml(claimed.label)}</strong>
        <span>${escapeHtml(claimed.host)} · #${squareId + 1}</span>
      </div>
    `;
  } else {
    hoverPreview.innerHTML = `
      <div class="mini-logo empty"></div>
      <div>
        <strong>Square #${squareId + 1}</strong>
        <span>${cluster?.count ? `${cluster.count} claimed nearby` : "Available"}</span>
      </div>
    `;
  }

  hoverPreview.style.left = `${event.clientX - canvas.getBoundingClientRect().left + 14}px`;
  hoverPreview.style.top = `${event.clientY - canvas.getBoundingClientRect().top + 14}px`;
  hoverPreview.hidden = false;
  drawGrid();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

canvas.addEventListener("click", (event) => {
  if (isPanning) {
    return;
  }

  const point = screenToGrid(event.clientX, event.clientY);
  selectSquare(point.y * GRID_SIZE + point.x);
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

  const point = screenToGrid(event.clientX, event.clientY);
  showHoverPreview(event, point.y * GRID_SIZE + point.x);
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
  hoverPreview.hidden = true;
  drawGrid();
});

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  setZoom(zoom + (event.deltaY > 0 ? -1 : 1), event.clientX, event.clientY);
}, { passive: false });

zoomRange.addEventListener("input", () => {
  setZoom(Number(zoomRange.value));
});

zoomOut.addEventListener("click", () => setZoom(zoom - 1));
zoomIn.addEventListener("click", () => setZoom(zoom + 1));
zoomHome.addEventListener("click", fitToOccupied);

squareInput.addEventListener("input", () => {
  selectSquare(Number(squareInput.value || 1) - 1, true);
});

window.addEventListener("resize", resizeCanvas);

zoomRange.value = String(zoom);
resizeCanvas();
selectSquare(Number(squareInput.value || 1) - 1, true);
claimedCount.textContent = String(paidSquares.size);
