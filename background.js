// Background service worker for Rune Projects Hub and Isekai Tracker

// Opens the side panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Set the side panel to open by default on all URLs
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ==========================================
// Isekai Tracker Integration
// ==========================================
const STATE = new Map(); // tabId -> last now-playing snapshot
const lastHistoryWrite = new Map(); // tabId -> ts

async function updateHistory(cur, tabId, now, force = false) {
  if (!cur.meta || !cur.meta.episodeTitle) return;

  const lastWrite = lastHistoryWrite.get(tabId) || 0;
  // Limit writing to history to once every 10 seconds to protect local storage quota
  if (!force && (now - lastWrite < 10000)) return;
  lastHistoryWrite.set(tabId, now);

  try {
    const data = await chrome.storage.local.get("isekai_history");
    let history = data.isekai_history || [];

    // Find index of matching episode
    const index = history.findIndex(item =>
      item.seriesTitle === cur.meta.seriesTitle &&
      item.seasonNumber === cur.meta.seasonNumber &&
      item.episodeNumber === cur.meta.episodeNumber
    );

    const historyItem = {
      seriesTitle: cur.meta.seriesTitle,
      episodeTitle: cur.meta.episodeTitle,
      seasonNumber: cur.meta.seasonNumber,
      episodeNumber: cur.meta.episodeNumber,
      positionSec: cur.positionSec || 0,
      durationSec: cur.durationSec || 0,
      url: cur.url,
      ts: now
    };

    if (index > -1) {
      history[index] = historyItem;
    } else {
      history.push(historyItem);
    }

    // Sort by timestamp descending and take top 5
    history.sort((a, b) => b.ts - a.ts);
    history = history.slice(0, 5);

    await chrome.storage.local.set({ isekai_history: history });
  } catch (e) {
    console.error("[Isekai] Error updating history:", e);
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!sender.tab || !sender.tab.id) return;
  if (!msg || msg._isekai !== true) return;

  const tabId = sender.tab.id;
  const now = Date.now();

  if (msg.type === "beat" || msg.type === "start" || msg.type === "state") {
    const prev = STATE.get(tabId) || {};
    const cur = { ...prev, ...msg.payload, ts: now, url: sender.tab.url };
    STATE.set(tabId, cur);
    chrome.storage.session.set({ ["tab:" + tabId]: cur });

    const playing = cur.status === "playing";
    chrome.action.setBadgeText({ tabId, text: playing ? "▶" : "⏸" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: playing ? "#7c3aed" : "#9d9ab4" }); // Purple for playing, grey for paused

    // Save to recently watched history
    updateHistory(cur, tabId, now);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const cur = STATE.get(tabId);
  if (cur) {
    // Perform one final update before removing
    await updateHistory(cur, tabId, Date.now(), true);
  }
  STATE.delete(tabId);
  chrome.storage.session.remove("tab:" + tabId);
  lastHistoryWrite.delete(tabId);
});

// Clean up memory for closed/missing tabs periodically
setInterval(async () => {
  const tabs = await chrome.tabs.query({});
  const alive = new Set(tabs.map(t => t.id));
  for (const [tabId] of STATE.entries()) {
    if (!alive.has(tabId)) {
      STATE.delete(tabId);
      chrome.storage.session.remove("tab:" + tabId);
    }
  }
}, 30000);
