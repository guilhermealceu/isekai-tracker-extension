// background.js (MV3 service worker)
const STATE = new Map(); // tabId -> last now-playing snapshot

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!sender.tab || !sender.tab.id) return;
  if (!msg || msg._isekai !== true) return;

  const tabId = sender.tab.id;
  const now = Date.now();

  if (msg.type === "beat" || msg.type === "start" || msg.type === "state") {
    const prev = STATE.get(tabId) || {};
    const cur = { ...prev, ...msg.payload, ts: now };
    STATE.set(tabId, cur);
    chrome.storage.session.set({ ["tab:" + tabId]: cur });

    const playing = cur.status === "playing";
    chrome.action.setBadgeText({ tabId, text: playing ? "▶" : "⏸" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: playing ? "#10b981" : "#94a3b8" });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  STATE.delete(tabId);
  chrome.storage.session.remove("tab:" + tabId);
});

// limpeza eventual de tabs que sumiram
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
