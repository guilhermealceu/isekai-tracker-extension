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

async function getBaseUrl() {
  if (typeof chrome === 'undefined' || !chrome.storage) return "https://isekaitracker.runeprojects.com.br";
  const data = await chrome.storage.local.get(["apiType", "customUrl"]);
  const type = data.apiType || "production";
  if (type === "local") return "http://localhost:3005";
  if (type === "custom" && data.customUrl) return data.customUrl.replace(/\/$/, "");
  return "https://isekaitracker.runeprojects.com.br";
}

// Ping connectivity
async function runPing() {
  const el = document.getElementById("isekai-conn-status");
  if (!el) return;
  el.className = "isekai-ping-dot isekai-checking";
  el.textContent = "Verificando...";
  const base = await getBaseUrl();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    await fetch(base, { method: "GET", mode: "no-cors", signal: ctrl.signal });
    clearTimeout(t);
    el.className = "isekai-ping-dot isekai-online";
    el.textContent = "Online";
  } catch {
    el.className = "isekai-ping-dot isekai-offline";
    el.textContent = "Indisponível";
  }
}

// Queue handling
async function checkQueue() {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  try {
    const data = await chrome.storage.local.get("scrobble_queue");
    const count = (data.scrobble_queue || []).length;
    setQueueUI(count);
  } catch {}
}

function setQueueUI(count) {
  const box = document.getElementById("isekai-queue-box");
  const txt = document.getElementById("isekai-queue-text");
  if (!box || !txt) return;
  if (count > 0) {
    box.classList.add("show");
    txt.textContent = `${count} scrobble${count !== 1 ? "s" : ""} offline pendente${count !== 1 ? "s" : ""}`;
  } else {
    box.classList.remove("show");
  }
}

async function flushQueue() {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  const btn = document.getElementById("isekai-btn-flush");
  if (btn) { btn.textContent = "Enviando..."; btn.disabled = true; }
  try {
    const data = await chrome.storage.local.get("scrobble_queue");
    const queue = data.scrobble_queue || [];
    const base = await getBaseUrl();
    const url = `${base}/api/isekai/scrobble`;
    const remaining = [];
    for (const item of queue) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload)
        });
        if (!res.ok) remaining.push(item);
      } catch { remaining.push(item); }
    }
    await chrome.storage.local.set({ scrobble_queue: remaining });
    setQueueUI(remaining.length);
  } catch (e) {
    console.error("[Isekai] flush error", e);
  } finally {
    if (btn) { btn.textContent = "Sincronizar"; btn.disabled = false; }
  }
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

// Settings initialization
async function initIsekaiSettings() {
  if (typeof chrome === 'undefined' || !chrome.storage) return;

  const btn = document.getElementById("isekai-btn-settings");
  const drawer = document.getElementById("isekai-settings-panel");
  const seg = document.getElementById("isekai-server-selector");
  const input = document.getElementById("isekai-input-url");

  btn?.addEventListener("click", () => {
    const open = drawer.classList.toggle("open");
    btn.classList.toggle("is-open", open);
    if (open) runPing();
  });

  const data = await chrome.storage.local.get(["apiType", "customUrl"]);
  const saved = data.apiType || "production";
  if (input) {
    input.value = data.customUrl || "";
    input.style.display = saved === "custom" ? "block" : "none";
  }

  seg?.querySelectorAll("button").forEach(b => {
    b.classList.toggle("active", b.dataset.type === saved);
    b.addEventListener("click", async () => {
      seg.querySelectorAll("button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      await chrome.storage.local.set({ apiType: b.dataset.type });
      if (input) input.style.display = b.dataset.type === "custom" ? "block" : "none";
      runPing();
    });
  });

  if (input) {
    let debounce;
    input.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(async () => {
        await chrome.storage.local.set({ customUrl: input.value.trim() });
        runPing();
      }, 500);
    });
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

// Render Recently Watched History
async function loadIsekaiHistory() {
  if (typeof chrome === 'undefined' || !chrome.storage) return;

  const container = document.getElementById("isekai-history-container");
  const list = document.getElementById("isekai-history-list");
  if (!container || !list) return;

  try {
    const data = await chrome.storage.local.get("isekai_history");
    const history = data.isekai_history || [];

    if (history.length === 0) {
      container.style.display = "none";
      return;
    }

    container.style.display = "block";
    list.innerHTML = "";

    history.forEach(item => {
      const el = document.createElement("a");
      el.href = item.url || "#";
      el.target = "_blank";
      el.className = "isekai-history-item";

      const pct = item.durationSec > 0 ? Math.min(100, Math.floor(item.positionSec * 100 / item.durationSec)) : 0;

      el.innerHTML = `
        <div class="isekai-hist-header">
          <span class="isekai-hist-title">${item.seriesTitle}</span>
          <div class="isekai-hist-badges">
            ${item.seasonNumber != null ? `<span class="isekai-hist-badge">T${item.seasonNumber}</span>` : ""}
            ${item.episodeNumber != null ? `<span class="isekai-hist-badge">E${item.episodeNumber}</span>` : ""}
          </div>
        </div>
        <div class="isekai-hist-ep">${item.episodeTitle || "—"}</div>
        <div class="isekai-hist-progress">
          <div class="isekai-hist-track">
            <div class="isekai-hist-fill" style="width: ${pct}%"></div>
          </div>
          <div class="isekai-hist-labels">
            <span>Parou em: ${fmtSec(item.positionSec)}</span>
            <span>${pct}%</span>
          </div>
        </div>
      `;

      list.appendChild(el);
    });
  } catch (e) {
    console.error("[Isekai] Error loading history:", e);
  }
}

// Initialization and bindings
document.addEventListener("DOMContentLoaded", () => {
  if (typeof chrome !== 'undefined') {
    updateActiveTabId();
    initIsekaiSettings();
    checkQueue();
    loadIsekaiHistory(); // Load history on startup

    document.getElementById("isekai-btn-flush")?.addEventListener("click", flushQueue);

    // Listen to changes in chrome storage (offline queue, sessions and history)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        if (changes.scrobble_queue) {
          setQueueUI((changes.scrobble_queue.newValue || []).length);
        }
        if (changes.isekai_history) {
          loadIsekaiHistory();
        }
      }
      if (area === "session" && activeTabId) {
        if (changes["tab:" + activeTabId]) {
          loadIsekaiState();
        }
      }
    });

    // Listen to active tab shifts
    chrome.tabs.onActivated.addListener(() => {
      updateActiveTabId();
    });
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (tabId === activeTabId && changeInfo.status === 'complete') {
        loadIsekaiState();
      }
    });
  }
});
