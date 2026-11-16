chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

const historyWrites = new Map();
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!sender.tab?.id || !message?._isekai) return;
  if (!["start", "state", "beat"].includes(message.type)) return;
  const tabId = sender.tab.id;
  void (async () => {
    const { trackingConsentV2 } = await chrome.storage.local.get("trackingConsentV2");
    if (trackingConsentV2 !== true) return;
    const key = `tab:${tabId}`;
    const previous = (await chrome.storage.session.get(key))[key] || {};
    const current = { ...previous, ...message.payload, ts: Date.now() };
    await chrome.storage.session.set({ [key]: current });
    if (!current.meta?.episodeTitle || !(current.durationSec > 0) || Date.now() - (historyWrites.get(tabId) || 0) < 10000) return;
    historyWrites.set(tabId, Date.now());
    const { isekai_history = [] } = await chrome.storage.local.get("isekai_history");
    const item = { ...current.meta, positionSec: current.positionSec || 0, durationSec: current.durationSec || 0, ts: current.ts };
    const rest = isekai_history.filter(x => !(x.seriesTitle === item.seriesTitle && x.seasonNumber === item.seasonNumber && x.episodeNumber === item.episodeNumber));
    await chrome.storage.local.set({ isekai_history: [item, ...rest].slice(0, 5) });
  })();
});
chrome.tabs.onRemoved.addListener(tabId => { historyWrites.delete(tabId); void chrome.storage.session.remove(`tab:${tabId}`); });
