// Pixel Galaxy — online mode client (v3.9.0).
// Talks to the Cloudflare Worker backend (shared galaxy, server-side
// empire). Single-player (game.js) is untouched; this module runs only
// when the saved mode is "online". The mode is picked once on the
// mode-select screen and saved in localStorage; switching clears it
// and reloads.
"use strict";

const ON_API = "https://pixel-galaxy-online.jaydenburnham.workers.dev";
const ON_GALAXY = "test-1";
const ON_MODE_KEY = "pixelgalaxy-mode";
const ON_BETA_KEY = "pixelgalaxy-beta-ok";
const ON_TOKEN_KEY = "pixelgalaxy-online-token";
const ON_PLAYER_KEY = "pixelgalaxy-online-player";
const ON_GALAXY_KEY = "pixelgalaxy-online-galaxy";

// ---------- boot: decide the mode before game.js loads ----------
(function boot() {
  let mode = null;
  try { mode = localStorage.getItem(ON_MODE_KEY); } catch (e) {}
  if (mode === "online") window.PG_MODE = "online";
  else if (mode === "single") window.PG_MODE = "single";
  else window.PG_MODE = "select";
  if (window.PG_MODE === "select") {
    const ms = document.getElementById("modesel");
    if (ms) ms.hidden = false;
  }
})();

// Mode-select buttons: save the pick and reload so the right mode boots.
document.addEventListener("click", (e) => {
  const b = e.target.closest ? e.target.closest("[data-msel]") : null;
  if (!b) return;
  try { localStorage.setItem(ON_MODE_KEY, b.dataset.msel); } catch (err) {}
  location.reload();
});

// ---------- API client ----------
let onToken = null;
try { onToken = localStorage.getItem(ON_TOKEN_KEY); } catch (e) {}
let onPlayer = null;
try { onPlayer = localStorage.getItem(ON_PLAYER_KEY); } catch (e) {}

async function onApi(path, method, body) {
  const res = await fetch(ON_API + "/g/" + ON_GALAXY + path, {
    method: method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(onToken ? { "Authorization": "Bearer " + onToken } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
}

async function onBeta(password) {
  const res = await fetch(ON_API + "/auth/beta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  return !!data.ok;
}

// ---------- online state ----------
let onSystems = [];      // full system list from /systems
let onSysById = {};
let onEmpire = null;     // from /empire
let onSelected = null;   // selected system id
let onSpawned = false;
let onReady = false;

// Camera for the galaxy canvas: world coords are x,y in [-1,1].
// cam = {cx, cy, zoom} — centre in world coords, zoom scales world->screen.
let onCam = { cx: 0, cy: 0, zoom: 1 };

const FAC_COL = { c: "#e0584a", v: "#b07cf0", k: "#ffb02e", a: "#4fc3f7", m: "#ff7ad9" };
const FAC_NAME = { c: "Crimson Pact", v: "Vael Collective", k: "Keth Dominion", a: "Aurelian Combine", m: "Vortex Marauders" };

function $(s) { return document.querySelector(s); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function onOwnedIds() {
  if (!onEmpire || !Array.isArray(onEmpire.systems)) return new Set();
  return new Set(onEmpire.systems.map(s => s.id));
}

function onIsAdjacent(sys) {
  const owned = onOwnedIds();
  return (sys.links || []).some(id => owned.has(id));
}

function onToast(msg) {
  const el = $("#o-toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(onToast._t);
  onToast._t = setTimeout(() => { el.hidden = true; }, 3500);
}

// ---------- data loading ----------
async function onEnsureAuth() {
  if (onToken && onPlayer) return true;
  const r = await onApi("/auth/guest", "POST", {});
  if (r.status === 201 && r.data.token) {
    onToken = r.data.token;
    onPlayer = r.data.playerId;
    try {
      localStorage.setItem(ON_TOKEN_KEY, onToken);
      localStorage.setItem(ON_PLAYER_KEY, onPlayer);
    } catch (e) {}
    return true;
  }
  return false;
}

async function onLoadEmpire() {
  const r = await onApi("/empire", "GET");
  if (r.status === 200) { onEmpire = r.data; onSpawned = true; return true; }
  if (r.status === 409 && r.data.error === "not_spawned") { onEmpire = null; onSpawned = false; return true; }
  if (r.status === 401) { // token dead — re-auth once
    try { localStorage.removeItem(ON_TOKEN_KEY); localStorage.removeItem(ON_PLAYER_KEY); } catch (e) {}
    onToken = null; onPlayer = null;
    if (await onEnsureAuth()) return onLoadEmpire();
  }
  return false;
}

async function onLoadSystems() {
  const r = await onApi("/systems", "GET");
  if (r.status === 200 && Array.isArray(r.data)) {
    onSystems = r.data;
    onSysById = {};
    onSystems.forEach(s => { onSysById[s.id] = s; });
    return true;
  }
  if (Array.isArray(r.data.systems)) {
    onSystems = r.data.systems;
    onSysById = {};
    onSystems.forEach(s => { onSysById[s.id] = s; });
    return true;
  }
  return false;
}

async function onRefresh() {
  await onLoadEmpire();
  await onLoadSystems();
  onRenderTop();
  onRenderPanel();
  onDrawGalaxy();
}

// ---------- galaxy canvas ----------
function onCv() { return $("#ocv"); }

function onSizeCanvas() {
  const cv = onCv();
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 360, h = cv.clientHeight || 360;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
}

// World (x,y in [-1.15,1.15]) -> screen px.
function onWorldToScreen(x, y) {
  const cv = onCv();
  const w = cv.width, h = cv.height;
  const base = Math.min(w, h) / 2.3;
  const sc = base * onCam.zoom;
  return { x: w / 2 + (x - onCam.cx) * sc, y: h / 2 + (y - onCam.cy) * sc };
}
function onScreenToWorld(px, py) {
  const cv = onCv();
  const w = cv.width, h = cv.height;
  const base = Math.min(w, h) / 2.3;
  const sc = base * onCam.zoom;
  return { x: (px - w / 2) / sc + onCam.cx, y: (py - h / 2) / sc + onCam.cy };
}

function onDrawGalaxy() {
  const cv = onCv();
  if (!cv) return;
  const q = cv.getContext("2d");
  if (!q) return;
  const w = cv.width, h = cv.height;
  q.fillStyle = "#0a0e2a";
  q.fillRect(0, 0, w, h);
  const owned = onOwnedIds();
  // Ring boundary circles (rings 1, 5, 10, 15) — faint dashed.
  q.strokeStyle = "rgba(120,140,220,.28)";
  q.setLineDash([4, 6]);
  q.lineWidth = 1;
  [1, 5, 10, 15].forEach(k => {
    const r = k / 15;
    const c = onWorldToScreen(0, 0);
    const edge = onWorldToScreen(r, 0);
    q.beginPath();
    q.arc(c.x, c.y, Math.abs(edge.x - c.x), 0, Math.PI * 2);
    q.stroke();
  });
  q.setLineDash([]);
  // Systems.
  onSystems.forEach(s => {
    const p = onWorldToScreen(s.x, s.y);
    if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) return;
    const mine = owned.has(s.id);
    const isNexus = s.id === 0;
    let col = "#7c849c";
    let r = 2.2;
    if (isNexus) { col = "#ffd84a"; r = 6; }
    else if (mine) { col = "#6ee7f5"; r = 3.4; }
    else if (s.ownerType === "faction" && FAC_COL[s.owner]) { col = FAC_COL[s.owner]; r = 3; }
    else if (s.ring >= 14) { col = "#4ade80"; r = 2.4; }
    q.fillStyle = col;
    q.beginPath();
    q.arc(p.x, p.y, Math.max(1.5, r * Math.min(1.6, onCam.zoom)), 0, Math.PI * 2);
    q.fill();
    if (s.id === onSelected) {
      q.strokeStyle = "#ffffff";
      q.lineWidth = 2;
      q.beginPath();
      q.arc(p.x, p.y, Math.max(1.5, r * Math.min(1.6, onCam.zoom)) + 5, 0, Math.PI * 2);
      q.stroke();
    }
  });
  // Labels: Dark Nexus + your systems + selected system.
  const fs = Math.max(11, Math.round(11 * Math.min(1.6, onCam.zoom)));
  q.font = "bold " + fs + "px sans-serif";
  q.textAlign = "center";
  onSystems.forEach(s => {
    const mine = owned.has(s.id);
    if (s.id !== 0 && !mine && s.id !== onSelected) return;
    const p = onWorldToScreen(s.x, s.y);
    if (p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40) return;
    q.fillStyle = s.id === 0 ? "#ffd84a" : "#6ee7f5";
    q.fillText(s.name, p.x, p.y - 10);
  });
}

// Pan / pinch / tap on the galaxy canvas.
(function onGalaxyInput() {
  const cv = onCv();
  if (!cv) return;
  const pts = new Map();
  let pinchD = 0, pinchZoom = 1, moved = 0, downAt = 0;
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0; downAt = Date.now();
    if (pts.size === 2) {
      const a = [...pts.values()];
      pinchD = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      pinchZoom = onCam.zoom;
    }
  });
  cv.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId);
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size === 1) {
      const rect = cv.getBoundingClientRect();
      const dpr = cv.width / (rect.width || 1);
      const base = Math.min(cv.width, cv.height) / 2.3;
      const sc = base * onCam.zoom;
      onCam.cx -= (dx * dpr) / sc;
      onCam.cy -= (dy * dpr) / sc;
      onDrawGalaxy();
    } else if (pts.size === 2) {
      const a = [...pts.values()];
      const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      if (pinchD > 0) {
        onCam.zoom = Math.max(0.5, Math.min(6, pinchZoom * d / pinchD));
        onDrawGalaxy();
      }
    }
  });
  const up = (e) => {
    const wasTap = pts.size === 1 && moved < 10 && (Date.now() - downAt) < 500;
    pts.delete(e.pointerId);
    if (wasTap) onTapGalaxy(e);
    if (pts.size < 2) pinchD = 0;
  };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
})();

function onTapGalaxy(e) {
  const cv = onCv();
  const rect = cv.getBoundingClientRect();
  const dpr = cv.width / (rect.width || 1);
  const px = (e.clientX - rect.left) * dpr;
  const py = (e.clientY - rect.top) * dpr;
  const wpt = onScreenToWorld(px, py);
  let best = null, bestD = 1e9;
  onSystems.forEach(s => {
    const d = Math.hypot(s.x - wpt.x, s.y - wpt.y);
    if (d < bestD) { bestD = d; best = s; }
  });
  // Tap threshold in world units — generous at low zoom, tighter zoomed in.
  const thresh = 0.09 / onCam.zoom;
  if (best && bestD < thresh) {
    onSelected = best.id;
    onRenderPanel();
    onDrawGalaxy();
  } else {
    onSelected = null;
    onRenderPanel();
    onDrawGalaxy();
  }
}

// ---------- top bar + empire panel ----------
function onRenderTop() {
  const el = $("#o-res");
  if (!el) return;
  if (!onSpawned || !onEmpire) { el.textContent = ""; return; }
  const c = Math.floor(onEmpire.credits || 0);
  el.textContent = "⚡ " + c + " cr  ·  PWR " + Math.round(onEmpire.power || 0) + "  ·  " + (onEmpire.count || 0) + "/" + (onEmpire.softCap || 25) + " systems";
}

function onRenderPanel() {
  const el = $("#o-panel");
  if (!el) return;
  if (!onSpawned) {
    el.innerHTML = '<div class="ocard"><h2>Welcome to the shared galaxy</h2><p>One massive galaxy, 1,000 systems, every spawn exactly 15 jumps from the Dark Nexus. Claim systems, grow your empire, fight the five factions.</p><button class="obtn" data-oact="spawn">Found your Home World</button></div>';
    return;
  }
  const sel = onSelected != null ? onSysById[onSelected] : null;
  if (sel) { el.innerHTML = onSystemCard(sel); return; }
  const e = onEmpire || {};
  const over = Math.max(0, (e.count || 0) - (e.softCap || 25));
  el.innerHTML = '<div class="ocard"><h2>Your empire</h2>'
    + '<small>Credits <b>' + Math.floor(e.credits || 0) + '</b> · Power <b>' + Math.round(e.power || 0) + '</b> · Systems <b>' + (e.count || 0) + ' / ' + (e.softCap || 25) + '</b></small><br>'
    + '<small>Income <b>+' + (e.grossPerSec != null ? e.grossPerSec.toFixed(2) : "?") + '/s</b>'
    + (e.upkeepPerSec ? ' · Upkeep <b>−' + e.upkeepPerSec.toFixed(2) + '/s</b>' : '')
    + ' · Net <b>' + (e.netPerSec != null ? (e.netPerSec >= 0 ? "+" : "") + e.netPerSec.toFixed(2) + '/s' : "?") + '</b></small>'
    + (over > 0 ? '<br><small>Over the soft cap by <b>' + over + '</b> — upkeep rises and rebellion risk is <b>' + Math.round((e.rebellionRisk || 0) * 100) + '%</b>.</small>' : '')
    + '<br><small>Tap a system on the map to claim or attack it. Green dots are the outer rim — your spawn ground.</small></div>';
}

function onSystemCard(s) {
  const owned = onOwnedIds();
  const mine = owned.has(s.id);
  const isNexus = s.id === 0;
  const adj = onIsAdjacent(s);
  const e = onEmpire || {};
  const power = e.power || 0, credits = e.credits || 0;
  let owner = "Neutral";
  if (mine) owner = "Yours";
  else if (s.ownerType === "faction") owner = FAC_NAME[s.owner] || s.owner;
  else if (s.ownerType === "player") owner = "Another player";
  let html = '<div class="ocard"><h2>' + esc(s.name) + '</h2>'
    + '<small>Ring ' + s.ring + ' · ' + esc(s.type || "") + ' · Power <b>' + s.pw + '</b> · ' + esc(owner) + '</small><br>';
  if (isNexus) html += '<small>The Dark Nexus — power 5000, the endgame. Holding it is a tournament objective, not just a conquest.</small><br>';
  if (mine) {
    html += '<small>This system is yours. Defence comes from your empire power.</small>';
  } else if (s.ownerType === "faction") {
    if (!adj) html += '<small>Not adjacent to your empire — claim systems next to yours to reach it.</small>';
    else html += '<small>Adjacent to your empire. Attack to take it from ' + esc(owner) + '.</small><br>'
      + '<div class="bg"><button class="obtn" data-oact="attack" data-stance="allout">Attack · All-out</button> <button class="obtn" data-oact="attack" data-stance="balanced">Attack · Balanced</button> <button class="obtn" data-oact="attack" data-stance="cautious">Attack · Cautious</button></div>';
  } else if (s.ownerType === "player") {
    html += '<small>Owned by another player.</small>';
    if (adj) html += '<br><small>Adjacent — attacks on player systems are not enabled yet.</small>';
  } else {
    // Neutral — claimable.
    const cost = s.pw * 2;
    if (!adj) html += '<small>Not adjacent to your empire — claim systems next to yours to reach it.</small>';
    else if (power < s.pw) html += '<small>Too strong — your power ' + Math.round(power) + ' is below its ' + s.pw + '. Grow your empire first.</small>';
    else if (credits < cost) html += '<small>Claim costs <b>' + cost + ' credits</b> — you have ' + Math.floor(credits) + '.</small>';
    else html += '<small>Claimable — costs <b>' + cost + ' credits</b>.</small><br><button class="obtn" data-oact="claim">Claim for ' + cost + ' credits</button>';
  }
  html += '<br><button class="obtn ghost" data-oact="close">Close</button></div>';
  return html;
}

// ---------- actions ----------
async function onDoClaim(id) {
  const r = await onApi("/claim", "POST", { systemId: id });
  if (r.status === 200) {
    onToast("Claimed " + ((r.data.claimed || {}).name || "system") + ".");
    await onRefresh();
  } else {
    onToast("Claim failed: " + (r.data.error || r.status) + ".");
    await onRefresh();
  }
}

async function onDoAttack(id, stance) {
  const r = await onApi("/attack", "POST", { systemId: id, stance: stance || "balanced" });
  if (r.status === 200) {
    onToast(r.data.win ? ("Victory! " + (r.data.system || "System") + " is yours.") : "Defeat — your fleet was repelled. Nothing lost but the attempt.");
    await onRefresh();
  } else {
    onToast("Attack failed: " + (r.data.error || r.status) + ".");
    await onRefresh();
  }
}

async function onDoSpawn() {
  const r = await onApi("/spawn", "POST", {});
  if (r.status === 200 || r.status === 201) {
    const h = r.data.homeSystem || {};
    onToast("Home World founded: " + (h.name || "your system") + ".");
    await onRefresh();
  } else {
    onToast("Spawn failed: " + (r.data.error || r.status) + ".");
  }
}

// Panel + bar clicks (delegated).
document.addEventListener("click", (e) => {
  const b = e.target.closest ? e.target.closest("[data-oact]") : null;
  if (!b) return;
  const act = b.dataset.oact;
  if (act === "spawn") onDoSpawn();
  else if (act === "claim" && onSelected != null) onDoClaim(onSelected);
  else if (act === "attack" && onSelected != null) onDoAttack(onSelected, b.dataset.stance || "balanced");
  else if (act === "close") { onSelected = null; onRenderPanel(); onDrawGalaxy(); }
  else if (act === "single") {
    try { localStorage.removeItem(ON_MODE_KEY); } catch (err) {}
    location.reload();
  }
});

// ---------- beta gate + init ----------
async function onInitOnline() {
  const main = document.querySelector("main");
  const on = document.getElementById("online");
  if (main) main.style.display = "none";
  if (on) on.hidden = false;
  onSizeCanvas();
  window.addEventListener("resize", () => { onSizeCanvas(); onDrawGalaxy(); });

  // Beta gate: verify once, cache the flag.
  let betaOk = false;
  try { betaOk = localStorage.getItem(ON_BETA_KEY) === "1"; } catch (e) {}
  if (!betaOk) {
    const el = $("#o-panel");
    if (el) el.innerHTML = '<div class="ocard"><h2>Online beta</h2><p>This mode is in closed beta. Enter the access password to continue.</p><input id="o-beta-pw" type="password" placeholder="Beta password" autocomplete="off"><br><button class="obtn" data-oact="beta">Enter</button> <small id="o-beta-err" hidden>Wrong password — try again.</small></div>';
    const go = async () => {
      const inp = $("#o-beta-pw");
      const pw = inp ? inp.value : "";
      if (!pw) return;
      const ok = await onBeta(pw);
      if (ok) {
        try { localStorage.setItem(ON_BETA_KEY, "1"); } catch (e) {}
        onStartGame();
      } else {
        const err = $("#o-beta-err");
        if (err) err.hidden = false;
        if (inp) { inp.value = ""; inp.focus(); }
      }
    };
    document.addEventListener("click", (e) => {
      const b = e.target.closest ? e.target.closest("[data-oact='beta']") : null;
      if (b) go();
    });
    const inp = $("#o-beta-pw");
    if (inp) inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    return;
  }
  onStartGame();
}

async function onStartGame() {
  onRenderTop();
  onRenderPanel();
  onDrawGalaxy();
  const okAuth = await onEnsureAuth();
  if (!okAuth) { onToast("Could not create a guest account. Check your connection and reload."); return; }
  await onRefresh();
  onReady = true;
  // Poll the empire every 5s so credits/power tick up live.
  setInterval(async () => {
    if (!onReady) return;
    await onLoadEmpire();
    onRenderTop();
    if (onSelected == null) onRenderPanel();
  }, 5000);
}

// Boot the online mode when this is the saved mode.
if (window.PG_MODE === "online") {
  onInitOnline();
}
