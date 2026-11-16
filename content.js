(function () {
  // Tracking starts disabled and remains local until secure account pairing exists.
  let enabled = false;
  let contextValid = true;
  let routeTimer = null;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const L = () => {};
  const MIN_CHUNK = 5;
  const CHECKPOINT = 30;
  const BEAT_THROTTLE_MS = 15000;
  const POST_URL = "";
  const BEAT_URL = "";
  function post() {}
  function stopInvalidContext() {
    contextValid = false;
    enabled = false;
    if (videoTicker) clearInterval(videoTicker);
    if (routeTimer) clearInterval(routeTimer);
  }
  function emitBg(type, payload) {
    if (!enabled || !contextValid) return;
    try {
      if (!chrome.runtime?.id) { stopInvalidContext(); return; }
      chrome.runtime.sendMessage({ _isekai: true, type, payload }).catch(() => {
        if (!chrome.runtime?.id) stopInvalidContext();
      });
    } catch (_) {
      stopInvalidContext();
    }
  }
  function findVideo() {
    const direct = document.querySelector("video");
    if (direct) return direct;
    for (const el of document.querySelectorAll("*")) {
      const video = el.shadowRoot?.querySelector("video");
      if (video) return video;
    }
    return null;
  }

  function parseSeasonNumber(value) {
    const text = String(value || "");
    const patterns = [
      /\b(?:Temporada|Season)\s*[-:]?\s*(\d{1,2})\b/i,
      /\b(\d{1,2})\s*(?:\u00aa|\u00ba|a|o)?\s*(?:Temporada|Season)\b/i,
      /\b(\d{1,2})(?:st|nd|rd|th)\s+Season\b/i,
      /\b(?:T|S)\s*[-:]?\s*(\d{1,2})\b/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const season = match ? parseInt(match[1], 10) : null;
      if (season != null && season >= 1 && season <= 15) return season;
    }
    return null;
  }

  function extractSeasonFromPage() {
    const selectors = [
      '[aria-selected="true"]', '[aria-current="true"]', '[data-state="checked"]',
      '[data-testid*="season" i]', '[data-t*="season" i]',
      'button[aria-label*="temporada" i]', 'button[aria-label*="season" i]',
      'button', 'h1, h2, h3'
    ];
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        const text = [element.textContent, element.getAttribute('aria-label'), element.getAttribute('title')]
          .filter(Boolean).join(' ');
        const season = parseSeasonNumber(text);
        if (season != null) return season;
      }
    }
    return parseSeasonNumber(document.title);
  }

  // Helper para decodificar título da aba (Fallback 3)
  function parseDocumentTitle(docTitle) {
    if (!docTitle) return null;

    let clean = docTitle.replace(/\s*-\s*Assista na Crunchyroll\s*$/i, "")
                        .replace(/\s*-\s*Assista na Crunchyroll\s*$/i, "")
                        .replace(/\s*on Crunchyroll\s*$/i, "")
                        .replace(/^Watch\s+/i, "")
                        .trim();

    const match = clean.match(/(.*?)\s+(?:Season|Temporada)\s*(\d+)\s+(?:Episode|Episódio|Ep)\s*(\d+)(?:\s*-\s*(.*))?/i);
    if (match) {
      return {
        seriesTitle: match[1].trim(),
        seasonNumber: parseInt(match[2]),
        episodeNumber: parseInt(match[3]),
        episodeTitle: match[4] ? match[4].trim() : null
      };
    }

    const matchEpOnly = clean.match(/(.*?)\s+(?:Episode|Episódio|Ep)\s*(\d+)(?:\s*-\s*(.*))?/i);
    if (matchEpOnly) {
      return {
        seriesTitle: matchEpOnly[1].trim(),
        seasonNumber: null,
        episodeNumber: parseInt(matchEpOnly[2]),
        episodeTitle: matchEpOnly[3] ? matchEpOnly[3].trim() : null
      };
    }

    return null;
  }

  // =========================
  // 🧠 META (EXTRACTOR COM MULTIPLOS FALLBACKS)
  // =========================
  function extractMeta() {
    let seriesTitle = null;
    let episodeTitle = null;
    let episodeNumber = null;
    let seasonNumber = null;

    // --- NÍVEL 1: Seletores DOM Crunchyroll ---
    const seriesEl =
      document.querySelector('a[href*="/series/"]') ||
      document.querySelector('[data-testid="episode-series-title"]') ||
      document.querySelector('.show-title-link') ||
      document.querySelector('.rc-episode-details .title');

    if (seriesEl) seriesTitle = seriesEl.textContent.trim();

    const epEl =
      document.querySelector('[data-testid="content-title"]') ||
      document.querySelector('.episode-title') ||
      document.querySelector('h1.title') ||
      document.querySelector('.rc-episode-details .episode-title');

    if (epEl) episodeTitle = epEl.textContent.trim();

    // --- NÍVEL 2: Media Session API (Fallback Altamente Confiável) ---
    if ((!seriesTitle || !episodeTitle) && navigator.mediaSession?.metadata) {
      const meta = navigator.mediaSession.metadata;
      if (!seriesTitle && meta.artist && meta.artist !== "Crunchyroll") {
        seriesTitle = meta.artist;
      }
      if (!episodeTitle && meta.title) {
        episodeTitle = meta.title;
      }
      if (!seriesTitle && meta.album) {
        seriesTitle = meta.album;
      }
    }

    // --- NÍVEL 3: Parser do Título do Documento (Fallback Final) ---
    if (!seriesTitle || !episodeTitle) {
      const parsed = parseDocumentTitle(document.title);
      if (parsed) {
        if (!seriesTitle) seriesTitle = parsed.seriesTitle;
        if (!episodeTitle) episodeTitle = parsed.episodeTitle;
        if (parsed.episodeNumber != null) episodeNumber = parsed.episodeNumber;
        if (parsed.seasonNumber != null) seasonNumber = parsed.seasonNumber;
      }
    }

    if (!episodeTitle) return null;

    if (episodeNumber === null) {
      const epMatch = episodeTitle.match(/(?:T|S)(\d+)\s*(?:E|Ep)(\d+)/i) ||
                      episodeTitle.match(/(?:E|Ep|Episódio|Episode)\s*(\d+)/i) ||
                      episodeTitle.match(/\bE(\d+)\b/i);

      if (epMatch) {
        if (epMatch.length === 3) {
          seasonNumber = parseInt(epMatch[1]);
          episodeNumber = parseInt(epMatch[2]);
        } else {
          episodeNumber = parseInt(epMatch[1]);
        }
      }
    }

    episodeTitle = episodeTitle
      .replace(/^(?:T\d+\s*)?(?:E|Ep|Episódio|Episode)\s*\d+\s*[-–:]\s*/i, "")
      .trim();

    if (seasonNumber === null) {
      const seasonEl = document.querySelector('[data-testid="episode-season-title"]') ||
                       document.querySelector('.season-title') ||
                       document.querySelector('.show-season-title');
      if (seasonEl) {
        seasonNumber = parseSeasonNumber(seasonEl.textContent);
      }
    }

    if (seasonNumber === null) {
      seasonNumber = parseSeasonNumber(`${seriesTitle || ""} ${episodeTitle || ""}`) || extractSeasonFromPage();
    }

    return {
      seriesTitle: seriesTitle || "—",
      episodeTitle: episodeTitle,
      episodeNumber: episodeNumber,
      seasonNumber: seasonNumber,
      durationSec: null
    };
  }

  // =========================
  // 🎬 PLAYER CORE
  // =========================
  let video = null;
  let acc = 0;
  let lastCT = 0;
  let current = null;
  let videoTicker = null;

  const hb = {
    position: 0,
    duration: 0,
    status: "paused",
    accum: 0,
    lastBeat: 0
  };

  function start(meta){
    current = { meta, chunk:0, sent:0, cap:Infinity, remoteStarted:false };
    emitBg("start", { meta, ...hb });
  }

  function beginRemoteSession(){
    if(!current || current.remoteStarted || !video || video.paused || video.ended) return;
    current.remoteStarted = true;
    hb.status = "playing";
    hb.lastBeat = 0;
    post(POST_URL, { action:"start", meta:current.meta }, false);
  }

  function checkpoint(reason){
    if(!current || !current.remoteStarted) return;
    const sec = Math.floor(current.chunk);
    if(sec < MIN_CHUNK) return;

    post(POST_URL, {
      action:"end",
      duration: sec,
      meta: current.meta,
      reason
    }, false);

    current.chunk = 0;
  }

  function beat(reason){
    // Nunca acorda o backend apenas porque existe uma aba/player aberto.
    if(!current || !current.remoteStarted || !video || video.paused || video.ended || hb.status !== "playing") return;
    const now = Date.now();
    if(now - hb.lastBeat < BEAT_THROTTLE_MS) return;
    hb.lastBeat = now;

    post(BEAT_URL, {
      meta: current?.meta,
      positionSec: hb.position,
      durationSec: hb.duration,
      status: hb.status,
      accumSec: hb.accum,
      reason
    }, false);

    emitBg("beat", { ...hb, meta: current?.meta });
  }

  function bindVideo(v){
    video = v;
    lastCT = v.currentTime || 0;

    L("🎬 Video bindado");

    if(videoTicker) clearInterval(videoTicker);
    videoTicker = setInterval(()=>{
      if(!video) return;

      const ct = video.currentTime || 0;
      const dur = video.duration || 0;

      const delta = ct - lastCT;
      lastCT = ct;

      const isActuallyPlaying = !video.paused && !video.ended && video.readyState >= 2;

      if(isActuallyPlaying && delta > 0 && delta < 5){
        acc += delta;
        hb.accum += delta;
        hb.position = ct;
      }

      hb.duration = dur;
      hb.status = isActuallyPlaying ? "playing" : "paused";

      if(isActuallyPlaying) beginRemoteSession();

      if(current && current.remoteStarted && isActuallyPlaying && delta > 0 && delta < 5){
        current.chunk += delta;
        if(current.chunk >= CHECKPOINT) checkpoint("tick");
      }

      emitBg("state", {
        positionSec: hb.position,
        durationSec: hb.duration,
        status: hb.status,
        accumSec: hb.accum,
        meta: current?.meta
      });

      if(isActuallyPlaying) beat("tick");

    }, 500);

    video.addEventListener("play", ()=>{
      if (!enabled || video !== v) return;
      hb.status="playing";
      beginRemoteSession();
    });
    video.addEventListener("pause", ()=>{
      if (!enabled || video !== v) return;
      hb.status="paused";
      checkpoint("pause");
      if(current) current.remoteStarted=false;
    });
    video.addEventListener("ended", ()=>{
      if (!enabled || video !== v) return;
      hb.status="paused";
      checkpoint("ended");
      if(current) current.remoteStarted=false;
    });
  }

  // =========================
  // 🔁 WATCH LOOP
  // =========================
  async function init(){
    L("🚀 INIT");
    const settings = await chrome.storage.local.get("trackingConsentV2");
    enabled = settings.trackingConsentV2 === true;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.trackingConsentV2) {
        enabled = changes.trackingConsentV2.newValue === true;
        if (!enabled) {
          video = null;
          current = null;
          if (videoTicker) clearInterval(videoTicker);
          videoTicker = null;
        }
      }
    });

    while(contextValid){
      if (!enabled) { await sleep(1000); continue; }
      const v = findVideo();

      if(v && v !== video){
        bindVideo(v);

        const meta = extractMeta();
        if(meta){
          start(meta);
        }
      }

      await sleep(1000);
    }
  }

  // =========================
  // SPA DETECT
  // =========================
  let lastUrl = location.href;
  routeTimer = setInterval(()=>{
    if(location.href !== lastUrl){
      lastUrl = location.href;
      L("🔁 route change");

      video = null;
      current = null;
      if(videoTicker){ clearInterval(videoTicker); videoTicker=null; }
    }
  },1000);

  init().catch(() => stopInvalidContext());

})();
