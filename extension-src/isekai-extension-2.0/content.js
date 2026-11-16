// content.js — coleta no topo e no iframe do player; envia para o server e para o background
(function () {
  const POST_URL = "https://isekai-tracker.discloud.app/api/isekai/scrobble";
  const BEAT_URL = "https://isekai-tracker.discloud.app/api/isekai/beat";
  const PLAYER_ORIGIN = "https://static.crunchyroll.com";

  const MIN_CHUNK = 5;
  const CHECKPOINT = 30;
  const VIDEO_WAIT = 15000;
  const BEAT_THROTTLE_MS = 900;
  const isPlayer = location.origin === PLAYER_ORIGIN;

  const LOG = true;
  const L = (m,o)=>{ try{ (o!==undefined)?console.log("[Isekai/CR]",m,o):console.log("[Isekai/CR]",m);}catch(_){}};  
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  const toInt = (x)=>{ const n=parseInt(String(x),10); return Number.isNaN(n)?null:n; };
  function parseISODur(iso){
    if(!iso) return null;
    const m=String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
    if(!m) return null;
    const h=toInt(m[1])||0, mm=toInt(m[2])||0, s=toInt(m[3])||0;
    return h*3600+mm*60+s;
  }
  const epNum = t=>{ const m=String(t||"").match(/\bE(\d{1,4})\b/i); return m?toInt(m[1]):null; };
  const sNum = t=>{
    const value=String(t||"");
    const patterns=[
      /\bT(\d{1,3})\b/i,
      /\bS(?:eason)?\s*[-:]?\s*(\d{1,3})\b/i,
      /\b(?:temporada|season)\s*[-:]?\s*(\d{1,3})\b/i,
      /\b(\d{1,3})\s*(?:\u00aa|\u00ba|a|o)?\s*(?:temporada|season)\b/i,
      /\b(\d{1,3})(?:st|nd|rd|th)\s+season\b/i
    ];
    for(const pattern of patterns){
      const m=value.match(pattern), n=m?toInt(m[1]):null;
      if(n!=null && n>=1 && n<=15) return n;
    }
    return null;
  };

  function readDomSeason(){
    // Primeiro os elementos que normalmente representam a opção ativa.
    const selectors=[
      '[aria-selected="true"]', '[aria-current="true"]', '[data-state="checked"]',
      '[data-state="open"]', '[data-t*="season" i]', '[data-testid*="season" i]',
      'button[aria-label*="season" i]', 'button[aria-label*="temporada" i]',
      'button', 'h1', 'h2', 'h3'
    ];
    for(const selector of selectors){
      for(const el of document.querySelectorAll(selector)){
        const text=[el.textContent,el.getAttribute('aria-label'),el.getAttribute('title')].filter(Boolean).join(' ');
        const season=sNum(text);
        if(season!=null) return season;
      }
    }
    return sNum(document.title);
  }

  function withSeason(meta){
    if(!meta) return meta;
    if(meta.seasonNumber==null){
      meta.seasonNumber=sNum([meta.seriesTitle,meta.episodeTitle].filter(Boolean).join(' ')) || readDomSeason();
    }
    return meta;
  }

  function post(url,payload,urgent){
    if (LOG) L("POST → "+url, payload);
    try{
      if(urgent && navigator.sendBeacon){
        const ok=navigator.sendBeacon(url,new Blob([JSON.stringify(payload)],{type:"application/json"}));
        if (LOG) L("sendBeacon="+ok);
        if(ok) return;
      }
    }catch(_){}
    fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
      .then(r=>{ if (LOG) L("POST status "+r.status+" ← "+url); })
      .catch(err=>{ if (LOG) L("POST erro ← "+url, err); });
  }

  function emitBg(type, payload){
    try { chrome.runtime?.sendMessage({ _isekai:true, type, payload }); } catch(_){}
  }

  function readLd(){
    const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for(const n of nodes){
      try{
        const j = JSON.parse(n.textContent||"{}");
        const arr = Array.isArray(j)?j:[j];
        for(const o of arr){
          if(o && typeof o==="object" && (o["@type"]==="TVEpisode"||o["@type"]==="Episode"||o["@type"]==="VideoObject")){
            const seriesTitle = (o.partOfSeries && o.partOfSeries.name) ||
              (o.partOfSeason && o.partOfSeason.partOfSeries && o.partOfSeason.partOfSeries.name) ||
              o.seriesName || null;
            const episodeTitle = o.name || o.headline || null;
            const episodeNumber = (o.episodeNumber!=null)?toInt(o.episodeNumber):epNum(episodeTitle);
            const seasonNumber  = (o.partOfSeason && o.partOfSeason.seasonNumber!=null)?toInt(o.partOfSeason.seasonNumber):sNum(`${seriesTitle||""} ${episodeTitle||""}`);
            const durationSec   = parseISODur(o.duration);
            if (seriesTitle || episodeTitle) return { seriesTitle, episodeTitle, episodeNumber, seasonNumber, durationSec };
          }
        }
      }catch(_){}
    }
    return null;
  }
  function readOg(){
    const og = document.querySelector('meta[property="og:title"]');
    const val = og && og.getAttribute("content");
    if(!val) return null;
    const parts = val.split(" - ");
    let episodeTitle=null, seriesTitle=null, episodeNumber=null;
    if(parts.length>=2){
      seriesTitle = parts[parts.length-1].trim();
      episodeTitle = parts.slice(0,-1).join(" - ").trim();
      const n = epNum(episodeTitle); if(n!=null) episodeNumber = n;
      episodeTitle = episodeTitle.replace(/^\s*E\d{1,4}\s*[-–:]\s*/i,"").trim();
    }else{
      episodeTitle = val.trim();
    }
    return withSeason({ seriesTitle, episodeTitle, episodeNumber, seasonNumber:sNum(val), durationSec:null });
  }
  function readHead(){
    const el = document.querySelector('h1, h2, [data-t="episode-title"], [data-testid="content-title"]');
    const line = el && el.textContent && el.textContent.trim();
    if(!line) return null;
    const episodeNumber = epNum(line);
    const episodeTitle = line.replace(/^\s*E\d{1,4}\s*[-–:]\s*/i,"").trim();
    const sEl = document.querySelector('[data-t="show-title"], [data-testid="episode-series-title"], a[href*="/series/"]');
    const seriesTitle = (sEl && sEl.textContent && sEl.textContent.trim()) || null;
    return withSeason({ seriesTitle, episodeTitle, episodeNumber, seasonNumber:sNum(line), durationSec:null });
  }
  const isBadTitle = t=>{ if(!t) return true; const s=String(t).toLowerCase(); return s.indexOf("watch ")===0 || s==="explore"; };
  function isGoodMeta(m){
    if(!m) return false;
    if (isBadTitle(m.seriesTitle) && isBadTitle(m.episodeTitle)) return false;
    if (!/\/watch\//i.test(location.pathname)) return false;
    if (m.seriesTitle && m.seriesTitle.length>1) return true;
    if (m.episodeTitle && m.episodeNumber!=null) return true;
    return false;
  }
  async function extractReliable(){
    const t0 = Date.now();
    while (Date.now()-t0 < 12000){
      const j=withSeason(readLd()); if(isGoodMeta(j)) return j;
      const og=withSeason(readOg()); if(isGoodMeta(og)) return og;
      const hd=withSeason(readHead()); if(isGoodMeta(hd)) return hd;
      await sleep(250);
    }
    return null;
  }

  function runInPlayer(){
    L("BRANCH=PLAYER",{origin:location.origin, href:location.href});
    let v=null, acc=0, lastCT=0, ticker=0, pauseT=null, lastStateTs=0;

    function postState(){
      const now = Date.now();
      if(now - lastStateTs < 200) return;
      lastStateTs = now;
      try{
        const ct = Math.max(0, Math.floor((v&&v.currentTime)||0));
        const dur = Math.max(0, Math.floor((v&&v.duration)||0));
        window.top.postMessage({ _isekai:true, type:"state", playing:!(v&&v.paused), ct, dur }, "*");
      }catch(_){}
    }
    function flush(reason){
      const sec = Math.floor(acc);
      if (sec >= MIN_CHUNK){
        try{ window.top.postMessage({ _isekai:true, type:"progress", dt:sec, dur:Math.floor((v&&v.duration)||0), why:String(reason||"") }, "*"); }catch(_){}
        acc = 0;
      }
    }
    function bindVideo(x){
      v=x;
      lastCT = v.currentTime || 0;
      postState();
      if (ticker) clearInterval(ticker);
      ticker = setInterval(()=>{
        if(!v || v.paused || v.readyState<2) return;
        let ct = v.currentTime || 0;
        let d = ct - lastCT;
        lastCT = ct;
        if(!isFinite(d) || d<=0) return;
        if(d>5) d=5;
        acc += d;
        postState();
        if(acc>=CHECKPOINT) flush("tick");
      },500);
      v.addEventListener("loadedmetadata", postState, {passive:true});
      v.addEventListener("timeupdate",     postState, {passive:true});
      v.addEventListener("seeked",         postState, {passive:true});
      v.addEventListener("play",           postState, {passive:true});
      v.addEventListener("playing", ()=>{ postState(); if(pauseT){ clearTimeout(pauseT); pauseT=null; } }, {passive:true});
      v.addEventListener("pause",   ()=>{ postState(); if(pauseT) clearTimeout(pauseT); pauseT=setTimeout(()=>{ flush("pause"); },2000); }, {passive:true});
      document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="hidden"){ postState(); flush("hidden"); } });
      window.addEventListener("beforeunload", ()=>{ postState(); flush("unload"); if(ticker) clearInterval(ticker); });
    }
    const t0=Date.now();
    (function waitFirst(){
      const nv=document.querySelector("video");
      if(nv) bindVideo(nv);
      else if(Date.now()-t0 < VIDEO_WAIT) setTimeout(waitFirst,200);
      else L("player: sem <video>");
    })();
    new MutationObserver(()=>{ setTimeout(()=>{ const nv=document.querySelector("video"); if(nv && nv!==v) bindVideo(nv); },50); })
      .observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["src"]});
  }

  function runOnTop(){
    L("BRANCH=TOP",{href:location.href});
    let current=null, pending=0, handling=false;
    const hb = { position:0, duration:null, status:"paused", accum:0, lastBeat:0 };

    function start(meta){
      current = { meta, sentTotal:0, cap:(meta.durationSec && isFinite(meta.durationSec)) ? meta.durationSec : Infinity, chunk:0 };
      post(POST_URL, { action:"start", url:location.href, meta, ts:new Date().toISOString() }, false);
      emitBg("start", { meta, status: hb.status, positionSec: hb.position, durationSec: hb.duration, accumSec: hb.accum });
      beat("start-seed");
    }
    function checkpoint(reason, urgent){
      if(!current) return;
      const need0 = Math.floor(current.chunk);
      if(need0 < MIN_CHUNK) return;
      let rest = Math.max(0, Math.floor(current.cap - current.sentTotal));
      if(rest <= 0){ current.chunk = 0; return; }
      let need = need0 > rest ? rest : need0;
      post(POST_URL, { action:"end", reason:String(reason||"tick"), url:location.href, meta:current.meta, duration:need, ts:new Date().toISOString() }, urgent);
      current.sentTotal += need;
      current.chunk = 0;
      beat("checkpoint");
    }
    function end(reason, urgent){
      if(!current) return;
      checkpoint(reason||"navigate", urgent);
      current = null;
    }
    function beat(reason){
      if(!/\/watch\//i.test(location.pathname)) return;
      if(!current || !current.meta) return;
      const now = Date.now();
      if(now - (hb.lastBeat||0) < BEAT_THROTTLE_MS) return;
      hb.lastBeat = now;

      const durFromCap = (current && isFinite(current.cap)) ? Math.floor(current.cap) : null;
      const durFromHb  = (isFinite(hb.duration) && hb.duration > 0) ? Math.floor(hb.duration) : null;
      const durSec = (durFromCap != null) ? durFromCap : durFromHb;

      const payload = {
        source:"crunchyroll",
        url:location.href,
        meta:current.meta,
        status:hb.status,
        positionSec:Math.max(0, Math.floor(hb.position||0)),
        durationSec:durSec,
        accumSec:Math.max(0, Math.floor(hb.accum||0)),
        reason:String(reason||"tick")
      };
      post(BEAT_URL, payload, false);
      emitBg("beat", payload);
    }

    function onProgress(sec, dur){
      if (sec <= 0) return;
      hb.status = "playing";
      hb.position = (hb.position||0) + sec;
      hb.accum = (hb.accum||0) + sec;
      if(current && /\/watch\//i.test(location.pathname)){
        if(!current.cap && dur){ current.cap = parseInt(dur,10) || current.cap; if(current.meta) current.meta.durationSec = current.cap; }
        current.chunk += sec;
        if(current.chunk >= CHECKPOINT) checkpoint("tick", false);
      } else {
        pending += sec;
      }
    }
    function onState(playing, ct, dur){
      if (typeof playing === "boolean") hb.status = playing ? "playing" : "paused";
      if (typeof ct === "number") hb.position = ct;
      if (typeof dur === "number" && isFinite(dur) && dur > 0){
        hb.duration = Math.floor(dur);
        if (current && !isFinite(current.cap)){
          current.cap = hb.duration;
          if (current.meta) current.meta.durationSec = current.cap;
        }
      }
      emitBg("state", { status: hb.status, positionSec: hb.position, durationSec: hb.duration, accumSec: hb.accum, meta: current?.meta });
    }

    window.addEventListener("message", (ev)=>{
      if (ev.origin !== PLAYER_ORIGIN) return;
      const d = ev.data || {};
      if (!d || d._isekai !== true) return;
      if (d.type === "progress") onProgress(Math.max(0, parseInt(d.dt,10) || 0), d.dur);
      else if (d.type === "state") onState(!!d.playing, d.ct, d.dur);
    }, false);

    const _ps = history.pushState.bind(history);
    history.pushState = function(){ const r=_ps.apply(history, arguments); queueMicrotask(handle); return r; };
    const _rs = history.replaceState.bind(history);
    history.replaceState = function(){ const r=_rs.apply(history, arguments); queueMicrotask(handle); return r; };
    window.addEventListener("popstate", ()=>{ queueMicrotask(handle); });

    const mo = new MutationObserver(()=>{ clearTimeout(mo._t); mo._t = setTimeout(handle, 250); });
    mo.observe(document.documentElement, { childList:true, subtree:true });

    document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="hidden") checkpoint("hidden", true); });
    window.addEventListener("beforeunload", ()=>{ end("unload", true); });

    setInterval(()=>{ beat("interval"); }, 1500);

    async function handle(){
      if (handling) return;
      handling = true;
      try{
        if (!/\/watch\//i.test(location.pathname)) { end("left-watch", true); emitBg("state", { status:"paused" }); return; }
        const meta = await extractReliable();
        if (!isGoodMeta(meta)) return;
        if (current && JSON.stringify(current.meta) === JSON.stringify(meta)) return;
        end("route-change", true);
        start(meta);
      } finally {
        setTimeout(()=>{ handling = false; }, 120);
      }
    }
    handle();
  }

  if (isPlayer) runInPlayer(); else runOnTop();
})();
