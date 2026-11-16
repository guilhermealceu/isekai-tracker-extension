function fmtSec(s){
  if (!Number.isFinite(s) || s <= 0) return "0s";
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const sc = Math.floor(s%60);
  const parts = [];
  if (h) parts.push(h+"h");
  if (m || h) parts.push(m+"m");
  parts.push(sc+"s");
  return parts.join(" ");
}

async function load(){
  const tabs = await chrome.tabs.query({active:true, currentWindow:true});
  const tab = tabs[0];
  if (!tab) return;

  const key = "tab:"+tab.id;
  const obj = await chrome.storage.session.get(key);
  const cur = obj[key];

  const empty = document.getElementById("empty");
  const card = document.getElementById("card");
  const dot  = document.getElementById("statusDot");

  if (!cur){
    empty.style.display = "block";
    card.style.display = "none";
    dot.classList.remove("on");
    return;
  }

  empty.style.display = "none";
  card.style.display = "block";
  if (cur.status === "playing") dot.classList.add("on"); else dot.classList.remove("on");

  const series = document.getElementById("series");
  const episode = document.getElementById("episode");
  const meta = document.getElementById("meta");
  const pbar = document.getElementById("pbar");
  const pos = document.getElementById("pos");
  const dur = document.getElementById("dur");
  const acc = document.getElementById("acc");
  const st  = document.getElementById("st");

  series.textContent = cur.meta?.seriesTitle || "—";
  const epn = (cur.meta?.episodeNumber != null) ? `E${cur.meta.episodeNumber}` : "";
  const sn  = (cur.meta?.seasonNumber != null) ? `T${cur.meta.seasonNumber}` : "";
  meta.textContent = [sn, epn].filter(Boolean).join(" • ");
  episode.textContent = cur.meta?.episodeTitle || "—";

  const position = cur.positionSec || 0;
  const duration = cur.durationSec || 0;
  const prog = (duration > 0) ? Math.min(100, Math.floor(position*100/duration)) : 0;
  pbar.value = prog;

  pos.textContent = fmtSec(position);
  dur.textContent = duration ? fmtSec(duration) : "—";
  acc.textContent = fmtSec(cur.accumSec || 0);
  st.textContent  = cur.status || "—";
}

document.addEventListener("DOMContentLoaded", () => load());
