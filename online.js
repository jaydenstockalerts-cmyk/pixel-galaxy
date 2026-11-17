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
const ON_RECOVERY_KEY = "pixelgalaxy-online-recovery";
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
  let res;
  try {
    res = await fetch(ON_API + "/g/" + ON_GALAXY + path, {
      method: method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(onToken ? { "Authorization": "Bearer " + onToken } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    // Network failure (offline, DNS, CORS) — never throw; the caller
    // shows an error instead of hanging silently (v3.9.0 live-check).
    return { status: 0, data: { error: "network" } };
  }
  let data = {};
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
}

async function onBeta(password) {
  let res;
  try {
    res = await fetch(ON_API + "/auth/beta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
  } catch (e) {
    return null; // network failure — caller shows a connection error
  }
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
let onRaids = [];        // from /raids (pending/tribute_offered/resolved)
let onPrevRaidStatus = {}; // raid id -> status, to toast on resolution
let onReady = false;

// Camera for the galaxy canvas: world coords are x,y in [-1,1].
// cam = {cx, cy, zoom} — centre in world coords, zoom scales world->screen.
let onCam = { cx: 0, cy: 0, zoom: 1 };

const FAC_COL = { c: "#e0584a", v: "#b07cf0", k: "#ffb02e", a: "#4fc3f7", m: "#ff7ad9" };
const FAC_NAME = { c: "Crimson Pact", v: "Vael Collective", k: "Keth Dominion", a: "Aurelian Combine", m: "Vortex Marauders" };

function onq(s) { return document.querySelector(s); }
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
  const el = onq("#o-toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(onToast._t);
  onToast._t = setTimeout(() => { el.hidden = true; }, 3500);
}

// ---------- recovery codes (v3.9.6) ----------
// The server returns a recovery code ONCE at guest creation; only its hash
// is stored server-side. The client keeps the code in localStorage so the
// player can grab it from the menu at any time — but the player must ALSO
// save it somewhere safe (screenshot / password manager / written down),
// because if this browser's data is lost, the localStorage copy goes with
// it. New players are told to copy it right after spawning, or they lose
// their progress if the device is lost.
let onShowRecovery = false;    // show the recovery card (after spawn, or from the menu)
let onShowRecoverForm = false; // show the "recover an empire" input on the welcome card
let onRecoverErr = "";

function onSaveRecoveryCode(code) {
  if (!code) return;
  try { localStorage.setItem(ON_RECOVERY_KEY, code); } catch (e) {}
}
function onGetRecoveryCode() {
  try { return localStorage.getItem(ON_RECOVERY_KEY) || ""; } catch (e) { return ""; }
}
function onFormatCode(code) {
  const c = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length !== 12) return String(code || "");
  return c.slice(0, 4) + "-" + c.slice(4, 8) + "-" + c.slice(8, 12);
}
async function onCopyText(text, btn) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch (e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e2) {}
  }
  if (btn) {
    btn.textContent = ok ? "Copied!" : "Copy failed — select it manually";
    setTimeout(() => { btn.textContent = "Copy code"; }, 2500);
  }
  return ok;
}
// The recovery card: the code in large type, a Copy button, and the
// save-it-or-lose-it warning. Shown right after spawning (first thing a
// new player sees) and any time from the empire panel.
function onRecoveryCard() {
  const code = onGetRecoveryCode();
  let html = '<div class="ocard"><h2>Your recovery code</h2>';
  if (code) {
    html += '<p>Save this code somewhere safe — screenshot it, put it in a password manager, or write it down. <b>If you lose this device and this code, your empire is gone.</b></p>'
      + '<p style="font-size:22px;letter-spacing:2px;text-align:center"><b>' + esc(code) + '</b></p>'
      + '<div class="bg"><button class="obtn" data-oact="recovery-copy">Copy code</button> <button class="obtn ghost" data-oact="recovery-new">Get a new code</button></div>'
      + '<p><small>Getting a new code replaces this one — the old code stops working.</small></p>';
  } else {
    html += '<p>No recovery code saved on this device yet. Get one now and save it somewhere safe.</p>'
      + '<div class="bg"><button class="obtn" data-oact="recovery-new">Get a recovery code</button></div>';
  }
  html += '<br><button class="obtn ghost" data-oact="recovery-done">Done</button></div>';
  return html;
}

// ---------- data loading ----------
async function onEnsureAuth() {
  if (onToken && onPlayer) return true;
  const r = await onApi("/auth/guest", "POST", {});
  if (r.status === 201 && r.data.token) {
    onToken = r.data.token;
    onPlayer = r.data.playerId;
    if (r.data.recoveryCode) onSaveRecoveryCode(r.data.recoveryCode);
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

// ---------- PvP raids (Jayden's rules, Nov 16) ----------
// Load raids involving the player (as attacker or defender). When a raid
// flips to resolved, toast the outcome once.
async function onLoadRaids() {
  const r = await onApi("/raids", "GET");
  if (r.status !== 200 || !Array.isArray(r.data.raids)) return;
  const prev = onPrevRaidStatus;
  for (const raid of r.data.raids) {
    const was = prev[raid.id];
    if (raid.status === "resolved" && was && was !== "resolved") {
      const mine = raid.attackerId === onPlayer;
      const sys = raid.systemName || "a system";
      let msg = "";
      if (raid.outcome === "tribute_accepted") msg = mine ? ("Tribute accepted — you took " + raid.tributeAmount + " credits. The raid is off.") : ("Your tribute was accepted — the raid is off.");
      else if (raid.outcome === "attacker_won") msg = mine ? ("Raid won — " + sys + " is yours.") : ("You lost " + sys + " to a raid.");
      else if (raid.outcome === "attacker_won_home_raid") msg = mine ? ("Home World raid — you stole resources from " + sys + ". It was not taken.") : ("Your Home World was raided for resources — it was not taken.");
      else if (raid.outcome === "attacker_lost") msg = mine ? ("Raid repelled — " + sys + " held.") : ("A raid on your " + sys + " was repelled.");
      if (msg) onToast(msg);
    }
    prev[raid.id] = raid.status;
  }
  onRaids = r.data.raids;
}

// Seconds left on a raid warning (resolvesAt is a server timestamp).
function onRaidSecs(raid) {
  return Math.max(0, Math.ceil(((raid.resolvesAt || 0) - Date.now()) / 1000));
}

// The raid banner: a defender warning (with tribute offer) and/or an
// attacker tribute decision. Prepended to the panel when spawned.
function onRaidBanner() {
  if (!onSpawned) return "";
  let html = "";
  for (const raid of onRaids) {
    if (raid.status !== "pending" && raid.status !== "tribute_offered") continue;
    const secs = onRaidSecs(raid);
    if (raid.defenderId === onPlayer) {
      // Incoming raid — warn + let the defender offer tribute.
      const isHome = raid.isHomeWorld;
      html += '<div class="ocard" style="border-color:#ff8a80"><h2>⚠ Raid incoming!</h2>'
        + '<p>Another player is raiding <b>' + esc(raid.systemName || "your system") + '</b>. '
        + (isHome ? 'Your Home World <b>cannot be taken</b>, but they can steal resources. ' : '')
        + 'You have <b id="o-raid-count">' + secs + 's</b> to respond.</p>'
        + (raid.status === "tribute_offered"
          ? '<small>Tribute of <b>' + raid.tributeAmount + ' credits</b> offered — waiting for the attacker to accept or decline.</small>'
          : '<small>Offer tribute to call it off — the attacker can accept or decline.</small><br>'
            + '<input id="o-tribute-amt" type="number" min="1" placeholder="Tribute (credits)" style="width:130px"> '
            + '<button class="obtn" data-oact="raid-tribute" data-raid="' + raid.id + '">Offer tribute</button>')
        + '</div>';
    } else if (raid.attackerId === onPlayer && raid.status === "tribute_offered" && raid.tributeAmount != null) {
      // The defender offered tribute — the attacker accepts or declines.
      html += '<div class="ocard" style="border-color:#ffd84a"><h2>Tribute offered</h2>'
        + '<p>The defender offers <b>' + raid.tributeAmount + ' credits</b> to call off your raid on <b>' + esc(raid.systemName || "their system") + '</b>.</p>'
        + '<button class="obtn" data-oact="raid-tribute-accept" data-raid="' + raid.id + '">Accept tribute</button> '
        + '<button class="obtn ghost" data-oact="raid-tribute-decline" data-raid="' + raid.id + '">Decline — raid on</button></div>';
    }
  }
  return html;
}

async function onRefresh() {
  await onLoadEmpire();
  await onLoadSystems();
  await onLoadRaids();
  onRenderTop();
  onRenderPanel();
  onDrawGalaxy();
}

// ---------- galaxy canvas ----------
function onCv() { return onq("#ocv"); }

function onSizeCanvas() {
  const cv = onCv();
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 360, h = cv.clientHeight || 360;
  const nw = Math.round(w * dpr), nh = Math.round(h * dpr);
  // v3.9.4: only resize when the size actually changed (resizing clears the
  // canvas). Called before every draw/tap so the backing store never goes
  // stale when the panel height changes — a stale store made taps land
  // ~40px above the dot they hit.
  if (cv.width !== nw || cv.height !== nh) { cv.width = nw; cv.height = nh; }
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
  onSizeCanvas();
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
    q.arc(p.x, p.y, Math.max(1.5, r * Math.min(3, onCam.zoom)), 0, Math.PI * 2);
    q.fill();
    if (s.id === onSelected) {
      q.strokeStyle = "#ffffff";
      q.lineWidth = 2;
      q.beginPath();
      q.arc(p.x, p.y, Math.max(1.5, r * Math.min(3, onCam.zoom)) + 5, 0, Math.PI * 2);
      q.stroke();
    }
    // v3.9.3: gold ring around systems you can claim right now (neutral +
    // adjacent to your empire) so the next move is obvious at a glance.
    if (onSpawned && !mine && !isNexus && !s.ownerType && onIsAdjacent(s)) {
      q.strokeStyle = "#ffd84a";
      q.lineWidth = 2;
      q.beginPath();
      q.arc(p.x, p.y, Math.max(1.5, r * Math.min(3, onCam.zoom)) + 7, 0, Math.PI * 2);
      q.stroke();
    }
  });
  // Labels: Dark Nexus + your systems + selected system.
  const fs = Math.max(11, Math.round(11 * Math.min(3, onCam.zoom)));
  q.font = "bold " + fs + "px sans-serif";
  q.textAlign = "center";
  onSystems.forEach(s => {
    const mine = owned.has(s.id);
    // v3.9.3: zoomed in (zoom >= 3), also label systems you can claim now.
    const claimable = onSpawned && !mine && s.id !== 0 && !s.ownerType && onIsAdjacent(s);
    if (s.id !== 0 && !mine && s.id !== onSelected && !(onCam.zoom >= 3 && claimable)) return;
    const p = onWorldToScreen(s.x, s.y);
    if (p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40) return;
    q.fillStyle = (s.id === 0 || claimable) ? "#ffd84a" : "#6ee7f5";
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
        onCam.zoom = Math.max(0.5, Math.min(20, pinchZoom * d / pinchD));
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
  onSizeCanvas();
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
  const el = onq("#o-res");
  if (!el) return;
  if (!onSpawned || !onEmpire) { el.textContent = ""; return; }
  const c = Math.floor(onEmpire.credits || 0);
  el.textContent = "⚡ " + c + " cr  ·  PWR " + Math.round(onEmpire.power || 0) + "  ·  " + (onEmpire.count || 0) + "/" + (onEmpire.softCap || 25) + " systems";
}

function onRenderPanel() {
  const el = onq("#o-panel");
  if (!el) return;
  if (onShowRecovery) { el.innerHTML = onRecoveryCard(); return; }
  if (!onSpawned) {
    if (onShowRecoverForm) {
      el.innerHTML = '<div class="ocard"><h2>Recover your empire</h2><p>Enter the recovery code you saved when you started. It works on any device.</p><input id="o-rec-code" type="text" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters"><br><button class="obtn" data-oact="recover-go">Recover empire</button> <button class="obtn ghost" data-oact="recover-cancel">Cancel</button>' + (onRecoverErr ? '<br><small style="color:#ff8a80">' + esc(onRecoverErr) + '</small>' : '') + '</div>';
      return;
    }
    el.innerHTML = '<div class="ocard"><h2>Welcome to the shared galaxy</h2><p>One massive galaxy, 1,000 systems, every spawn exactly 15 jumps from the Dark Nexus. Claim systems, grow your empire, fight the five factions.</p><button class="obtn" data-oact="spawn">Found your Home World</button><br><br><button class="obtn ghost" data-oact="recover">Recover an empire</button></div>';
    return;
  }
  const sel = onSelected != null ? onSysById[onSelected] : null;
  const banner = onRaidBanner();
  if (sel) { el.innerHTML = banner + onSystemCard(sel); return; }
  const e = onEmpire || {};
  const over = Math.max(0, (e.count || 0) - (e.softCap || 25));
  el.innerHTML = '<div class="ocard"><h2>Your empire</h2>'
    + '<small>Credits <b>' + Math.floor(e.credits || 0) + '</b> · Power <b>' + Math.round(e.power || 0) + '</b> · Systems <b>' + (e.count || 0) + ' / ' + (e.softCap || 25) + '</b></small><br>'
    + '<small>Income <b>+' + (e.grossPerSec != null ? e.grossPerSec.toFixed(2) : "?") + '/s</b>'
    + (e.upkeepPerSec ? ' · Upkeep <b>−' + e.upkeepPerSec.toFixed(2) + '/s</b>' : '')
    + ' · Net <b>' + (e.netPerSec != null ? (e.netPerSec >= 0 ? "+" : "") + e.netPerSec.toFixed(2) + '/s' : "?") + '</b></small>'
    + (over > 0 ? '<br><small>Over the soft cap by <b>' + over + '</b> — upkeep rises and rebellion risk is <b>' + Math.round((e.rebellionRisk || 0) * 100) + '%</b>.</small>' : '')
    + '<br><small><b>Next step:</b> tap a system with a <b>gold ring</b> — those are next to your empire and ready to claim. Green dots are the outer rim, your spawn ground.</small>'
    + '<br><button class="obtn ghost" data-oact="recovery">Recovery code</button></div>';
  el.innerHTML = banner + el.innerHTML;
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
    if (!adj) html += '<br><small>Not adjacent to your empire — claim systems next to yours to reach it.</small>';
    else html += '<br><small>Adjacent. Raiding gives the defender <b>90 seconds</b> to respond — they may offer tribute, and you can accept or decline it. A Home World cannot be taken, only raided for resources.</small><br>'
      + '<div class="bg"><button class="obtn" data-oact="raid" data-stance="allout">Raid · All-out</button> <button class="obtn" data-oact="raid" data-stance="balanced">Raid · Balanced</button> <button class="obtn" data-oact="raid" data-stance="cautious">Raid · Cautious</button></div>';
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

// Launch a PvP raid on a player-owned system. The defender gets 90s to
// respond (tribute offer); the raid resolves as a battle at the deadline.
async function onDoRaid(id, stance) {
  const r = await onApi("/raid", "POST", { systemId: id, stance: stance || "balanced" });
  if (r.status === 201) {
    onToast("Raid launched — the defender has 90 seconds to respond.");
    await onRefresh();
  } else {
    onToast("Raid failed: " + (r.data.error || r.status) + ".");
    await onRefresh();
  }
}

// Defender offers tribute to call off a pending raid on their system.
async function onDoRaidTribute(raidId) {
  const inp = onq("#o-tribute-amt");
  const amount = inp ? Math.floor(Number(inp.value) || 0) : 0;
  if (amount <= 0) { onToast("Enter a tribute amount first."); return; }
  const r = await onApi("/raid-tribute", "POST", { raidId, amount });
  if (r.status === 200) {
    onToast("Tribute of " + amount + " credits offered — waiting on the attacker.");
    await onRefresh();
  } else {
    onToast("Tribute failed: " + (r.data.error || r.status) + ".");
    await onRefresh();
  }
}

// Attacker accepts the defender's tribute (raid called off, credits move).
async function onDoRaidTributeAccept(raidId) {
  const r = await onApi("/raid-tribute-accept", "POST", { raidId });
  if (r.status === 200) {
    onToast("Tribute accepted — you took " + (r.data.raid ? r.data.raid.tributeAmount : "") + " credits. The raid is off.");
    await onRefresh();
  } else {
    onToast("Could not accept: " + (r.data.error || r.status) + ".");
    await onRefresh();
  }
}

// Attacker declines the tribute — the raid proceeds to its 90s deadline.
async function onDoRaidTributeDecline(raidId) {
  const r = await onApi("/raid-tribute-decline", "POST", { raidId });
  if (r.status === 200) {
    onToast("Tribute declined — the raid goes ahead.");
    await onRefresh();
  } else {
    onToast("Could not decline: " + (r.data.error || r.status) + ".");
    await onRefresh();
  }
}

// Issue (or re-issue) a recovery code for the logged-in player. The
// server returns the code once and invalidates the old one.
async function onDoRecoveryNew() {
  const r = await onApi("/auth/recovery", "POST", {});
  if (r.status === 200 && r.data.recoveryCode) {
    onSaveRecoveryCode(r.data.recoveryCode);
    onToast("New recovery code issued — save it now.");
    onRenderPanel();
  } else {
    onToast("Could not issue a code: " + (r.data.error || r.status) + ".");
  }
}

// Recover an empire with a saved code. On success the code stays valid
// (only the token rotates), so save it locally for the menu copy.
async function onDoRecover() {
  const inp = onq("#o-rec-code");
  const code = inp ? inp.value.trim() : "";
  if (!code) { onRecoverErr = "Enter your recovery code."; onRenderPanel(); return; }
  const r = await onApi("/auth/recover", "POST", { recoveryCode: code });
  if (r.status === 200 && r.data.token) {
    onToken = r.data.token;
    onPlayer = r.data.playerId;
    onSaveRecoveryCode(onFormatCode(code));
    try {
      localStorage.setItem(ON_TOKEN_KEY, onToken);
      localStorage.setItem(ON_PLAYER_KEY, onPlayer);
    } catch (e) {}
    onShowRecoverForm = false; onRecoverErr = "";
    onToast("Empire recovered. Welcome back, Commander.");
    await onRefresh();
  } else {
    onRecoverErr = "That code did not match any empire — check it and try again.";
    onRenderPanel();
    const inp2 = onq("#o-rec-code");
    if (inp2) inp2.focus();
  }
}

async function onDoSpawn() {
  const r = await onApi("/spawn", "POST", {});
  if (r.status === 200 || r.status === 201) {
    const h = r.data.homeSystem || {};
    onToast("Home World founded: " + (h.name || "your system") + ".");
    // v3.9.6: the first thing a new player sees after spawning is the
    // recovery code — they must copy/save it now, or the empire is
    // unrecoverable if the device/browser data is lost.
    onShowRecovery = true;
    await onRefresh();
    // v3.9.3: drop the player onto their Home World zoomed in (zoom 4) so
    // the giant galaxy is not the first thing they see — the gold-ringed
    // neighbours are the next move.
    if (h.x != null && h.y != null) {
      onCam.cx = h.x; onCam.cy = h.y; onCam.zoom = 4;
      onSelected = h.id != null ? h.id : null;
      onRenderPanel(); onDrawGalaxy();
    }
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
  else if (act === "recovery") { onShowRecovery = true; onRenderPanel(); }
  else if (act === "recovery-done") { onShowRecovery = false; onRenderPanel(); }
  else if (act === "recovery-copy") { onCopyText(onGetRecoveryCode(), b); }
  else if (act === "recovery-new") { onDoRecoveryNew(); }
  else if (act === "recover") { onShowRecoverForm = true; onRecoverErr = ""; onRenderPanel(); }
  else if (act === "recover-cancel") { onShowRecoverForm = false; onRecoverErr = ""; onRenderPanel(); }
  else if (act === "recover-go") { onDoRecover(); }
  else if (act === "claim" && onSelected != null) onDoClaim(onSelected);
  else if (act === "attack" && onSelected != null) onDoAttack(onSelected, b.dataset.stance || "balanced");
  else if (act === "raid" && onSelected != null) onDoRaid(onSelected, b.dataset.stance || "balanced");
  else if (act === "raid-tribute" && b.dataset.raid) onDoRaidTribute(b.dataset.raid);
  else if (act === "raid-tribute-accept" && b.dataset.raid) onDoRaidTributeAccept(b.dataset.raid);
  else if (act === "raid-tribute-decline" && b.dataset.raid) onDoRaidTributeDecline(b.dataset.raid);
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
    const el = onq("#o-panel");
    if (el) el.innerHTML = '<div class="ocard"><h2>Online beta</h2><p>This mode is in closed beta. Enter the access password to continue.</p><input id="o-beta-pw" type="password" placeholder="Beta password" autocomplete="off"><br><button class="obtn" data-oact="beta">Enter</button> <small id="o-beta-err" hidden>Wrong password — try again.</small><br><br><button class="obtn ghost" data-oact="single">‹ Back to Single Player</button></div>';
    const go = async () => {
      const inp = onq("#o-beta-pw");
      const pw = inp ? inp.value : "";
      if (!pw) return;
      const ok = await onBeta(pw);
      if (ok === null) {
        const err = onq("#o-beta-err");
        if (err) { err.textContent = "Could not reach the server — check your connection and try again."; err.hidden = false; }
        return;
      }
      if (ok) {
        try { localStorage.setItem(ON_BETA_KEY, "1"); } catch (e) {}
        onStartGame();
      } else {
        const err = onq("#o-beta-err");
        if (err) { err.textContent = "Wrong password — try again."; err.hidden = false; }
        if (inp) { inp.value = ""; inp.focus(); }
      }
    };
    document.addEventListener("click", (e) => {
      const b = e.target.closest ? e.target.closest("[data-oact='beta']") : null;
      if (b) go();
    });
    const inp = onq("#o-beta-pw");
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
  // Poll the empire every 15s so credits/power tick up live. (v3.9.5: was
  // 5s — the 5s poll plus a per-call full galaxy scan burned the DO
  // free-tier rows-read limit; the server now caches the galaxy map, and
  // the slower poll is cheap insurance against hitting the limit again.)
  setInterval(async () => {
    if (!onReady) return;
    await onLoadEmpire();
    await onLoadRaids();
    onRenderTop();
    if (onSelected == null) onRenderPanel();
  }, 15000);
  // Tick the raid-warning countdown live (only the number, so an open
  // tribute input never loses focus).
  setInterval(() => {
    if (!onReady) return;
    const el = onq("#o-raid-count");
    if (!el) return;
    const raid = onRaids.find((r) => (r.status === "pending" || r.status === "tribute_offered") && r.defenderId === onPlayer);
    if (raid) el.textContent = onRaidSecs(raid) + "s";
  }, 1000);
}

// Boot the online mode when this is the saved mode.
if (window.PG_MODE === "online") {
  onInitOnline();
}
