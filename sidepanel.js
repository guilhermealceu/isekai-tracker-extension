// ==========================================
// Tab switching
// ==========================================
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${target}`)?.classList.add('active');
  });
});

// ==========================================
// Open links in new tab via chrome.tabs (Event Delegation)
// ==========================================
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[target="_blank"]');
  if (link) {
    e.preventDefault();
    const url = link.href;
    if (url && url !== '#' && !url.startsWith('javascript:')) {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url });
      } else {
        window.open(url, '_blank');
      }
    }
  }
});

// ==========================================
// Logo error → emoji fallback
// ==========================================
document.querySelectorAll('img[data-fallback]').forEach(img => {
  img.addEventListener('error', () => {
    const span = document.createElement('span');
    span.textContent = img.dataset.fallback;
    span.style.cssText = 'font-size:20px;line-height:1;';
    img.replaceWith(span);
  });
});

// ==========================================
// Isekai Tracker Integration
// ==========================================
let activeTabId = null;
let lastSwitchedEpisode = null;

function fmtSec(s) {
  if (!Number.isFinite(s) || s <= 0) return "0s";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = Math.floor(s % 60);
  const parts = [];
  if (h) parts.push(h + "h");
  if (m || h) parts.push(m + "m");
  parts.push(sc + "s");
  return parts.join(" ");
}

// Load and render active tab now-playing data
async function loadIsekaiState() {
  if (typeof chrome === 'undefined' || !chrome.storage || !activeTabId) return;

  const obj = await chrome.storage.session.get("tab:" + activeTabId);
  const cur = obj["tab:" + activeTabId];

  const dot = document.getElementById("isekai-status-dot");
  const empty = document.getElementById("isekai-empty");
  const card = document.getElementById("isekai-card");

  if (!cur) {
    empty.style.display = "flex";
    card.style.display = "none";
    dot?.classList.remove("live");
    return;
  }

  empty.style.display = "none";
  card.style.display = "flex";

  const playing = cur.status === "playing";
  if (playing) {
    dot?.classList.add("live");
    handleAutoTabSwitch(cur);
  } else {
    dot?.classList.remove("live");
  }

  // Populate series details
  document.getElementById("isekai-series").textContent = cur.meta?.seriesTitle || "—";
  document.getElementById("isekai-episode").textContent = cur.meta?.episodeTitle || "—";

  // Badges
  const metaS = document.getElementById("isekai-meta-s");
  const metaE = document.getElementById("isekai-meta-e");
  const statusBadge = document.getElementById("isekai-status-badge");

  if (metaS) {
    metaS.style.display = cur.meta?.seasonNumber != null ? "inline-block" : "none";
    if (cur.meta?.seasonNumber != null) metaS.textContent = `T${cur.meta.seasonNumber}`;
  }
  if (metaE) {
    metaE.style.display = cur.meta?.episodeNumber != null ? "inline-block" : "none";
    if (cur.meta?.episodeNumber != null) metaE.textContent = `E${cur.meta.episodeNumber}`;
  }

  if (statusBadge) {
    statusBadge.textContent = playing ? "▶ Reproduzindo" : "⏸ Pausado";
    statusBadge.className = "isekai-badge isekai-badge-status " + (playing ? "" : "paused");
  }

  // Progress Bar
  const position = cur.positionSec || 0;
  const duration = cur.durationSec || 0;
  const pct = duration > 0 ? Math.min(100, Math.floor(position * 100 / duration)) : 0;

  const progFill = document.getElementById("isekai-progress-fill");
  if (progFill) progFill.style.width = pct + "%";

  const posEl = document.getElementById("isekai-pos");
  if (posEl) posEl.textContent = fmtSec(position);

  const durEl = document.getElementById("isekai-dur");
  if (durEl) durEl.textContent = duration ? fmtSec(duration) : "—";

  const pctEl = document.getElementById("isekai-pct");
  if (pctEl) pctEl.textContent = pct + "%";

  const accEl = document.getElementById("isekai-acc");
  if (accEl) accEl.textContent = fmtSec(cur.accumSec || 0);
}

function handleAutoTabSwitch(cur) {
  if (cur && cur.status === "playing") {
    const epKey = `${cur.meta?.seriesTitle}-S${cur.meta?.seasonNumber ?? "?"}-E${cur.meta?.episodeNumber ?? "?"}`;
    if (lastSwitchedEpisode !== epKey) {
      lastSwitchedEpisode = epKey;
      // Trigger click to active the Isekai tab
      document.getElementById('tab-isekai')?.click();
    }
  }
}

// Active Tab Tracking
async function updateActiveTabId() {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        activeTabId = tabs[0].id;
        loadIsekaiState();
      }
    } catch {}
  }
}

// Local history, with text inserted safely.
async function loadIsekaiHistory() {
  const container = document.getElementById("isekai-history-container");
  const list = document.getElementById("isekai-history-list");
  const { isekai_history = [] } = await chrome.storage.local.get("isekai_history");
  list.replaceChildren();
  container.style.display = isekai_history.length ? "block" : "none";
  for (const item of isekai_history) {
    const row = document.createElement("div"); row.className = "isekai-history-item";
    const header = document.createElement("div"); header.className = "isekai-hist-header";
    const title = document.createElement("span"); title.className = "isekai-hist-title"; title.textContent = item.seriesTitle || "Anime";
    const badges = document.createElement("div"); badges.className = "isekai-hist-badges";
    for (const label of [item.seasonNumber != null ? `T${item.seasonNumber}` : null, item.episodeNumber != null ? `E${item.episodeNumber}` : null]) {
      if (!label) continue; const badge = document.createElement("span"); badge.className = "isekai-hist-badge"; badge.textContent = label; badges.append(badge);
    }
    header.append(title, badges);
    const episode = document.createElement("div"); episode.className = "isekai-hist-ep"; episode.textContent = item.episodeTitle || "—";
    const progress = document.createElement("div"); progress.className = "isekai-hist-progress";
    const track = document.createElement("div"); track.className = "isekai-hist-track";
    const fill = document.createElement("div"); fill.className = "isekai-hist-fill";
    const pct = item.durationSec > 0 ? Math.min(100, Math.floor(item.positionSec * 100 / item.durationSec)) : 0; fill.style.width = `${pct}%`; track.append(fill);
    const labels = document.createElement("div"); labels.className = "isekai-hist-labels";
    const position = document.createElement("span"); position.textContent = `Parou em: ${fmtSec(item.positionSec)}`;
    const percent = document.createElement("span"); percent.textContent = `${pct}%`; labels.append(position, percent); progress.append(track, labels); row.append(header, episode, progress); list.append(row);
  }
}
async function refreshConsent() {
  const { trackingConsentV2 } = await chrome.storage.local.get("trackingConsentV2");
  document.getElementById("consent").hidden = trackingConsentV2 === true;
  if (trackingConsentV2 !== true) {
    document.getElementById("isekai-card").style.display = "none";
    document.getElementById("isekai-empty").style.display = "none";
    document.getElementById("isekai-status-dot").classList.remove("live");
  } else await updateActiveTabId();
}
document.getElementById("accept").addEventListener("click", async () => { await chrome.storage.local.set({ trackingConsentV2: true }); await refreshConsent(); });
document.getElementById("disable").addEventListener("click", async () => { await chrome.storage.local.set({ trackingConsentV2: false }); await chrome.storage.session.clear(); document.getElementById("privacy-controls").hidden = true; await refreshConsent(); });
document.getElementById("clear").addEventListener("click", async () => { await chrome.storage.local.remove(["isekai_history", "scrobble_queue"]); await chrome.storage.session.clear(); await loadIsekaiHistory(); await refreshConsent(); });
document.getElementById("isekai-btn-settings").addEventListener("click", () => { const panel = document.getElementById("privacy-controls"); panel.hidden = !panel.hidden; });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.isekai_history) void loadIsekaiHistory();
  if (area === "local" && changes.trackingConsentV2) void refreshConsent();
  if (area === "session" && activeTabId && changes[`tab:${activeTabId}`]) void refreshConsent();
});
chrome.tabs.onActivated.addListener(() => { void refreshConsent(); });
void loadIsekaiHistory(); void refreshConsent();
