// Pixel Galaxy — online mode client (v3.9.0).
// Talks to the Cloudflare Worker backend (shared galaxy, server-side
// empire). Single-player (game.js) is untouched; this module runs only
// when the saved mode is "online". The mode is picked once on the
// mode-select screen and saved in localStorage; switching clears it
// and reloads.
"use strict";

const ON_API = "https://pixel-galaxy-online.jaydenburnham.workers.dev";
// Galaxies (Jayden, Nov 17): two servers. "test-1" is the live beta
// galaxy people join; "staging-1" is where new features are pushed first
// to make sure they don't break the beta. The choice lives in
// localStorage (ON_GALAXY_KEY) and defaults to the beta. Tokens, players
// and recovery codes are per-galaxy, so switching galaxies signs you into
// a fresh guest on the other one.
const ON_GALAXIES = { "test-1": "Beta Galaxy", "staging-1": "Staging Galaxy" };
function onGalaxy() {
  try {
    const g = localStorage.getItem(ON_GALAXY_KEY);
    if (g && ON_GALAXIES[g]) return g;
  } catch (e) {}
  return "test-1";
}
function onGalaxyName() { return ON_GALAXIES[onGalaxy()] || onGalaxy(); }
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
    res = await fetch(ON_API + "/g/" + onGalaxy() + path, {
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

// Switch galaxies. Tokens/players/recovery codes are per-galaxy, so
// switching signs you into a fresh guest on the other galaxy. Your empire
// on the old galaxy is untouched (recover it with its recovery code).
function onSetGalaxy(id) {
  if (!ON_GALAXIES[id] || id === onGalaxy()) return;
  try {
    localStorage.setItem(ON_GALAXY_KEY, id);
    localStorage.removeItem(ON_TOKEN_KEY);
    localStorage.removeItem(ON_PLAYER_KEY);
    localStorage.removeItem(ON_RECOVERY_KEY);
  } catch (e) {}
  onToken = null; onPlayer = null;
  onEmpire = null; onSystems = null; onSysById = {}; onRaids = [];
  onSpawned = false; onSelected = null; onShowRecovery = false;
  onShowRecoverForm = false; onRecoverErr = "";
  onRenderPanel();
  onStartGame();
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

// Toast faction revolts (a conquered faction system flipped back to its
// original faction). The server includes them in /empire and /raids.
function onToastRevolts(revolts) {
  if (!Array.isArray(revolts)) return;
  for (const rv of revolts) {
    const fname = (typeof FAC_NAME !== "undefined" && FAC_NAME[rv.faction]) || rv.faction || "its faction";
    onToast((rv.systemName || "A system") + " revolted back to " + fname + ".");
  }
}

async function onLoadEmpire() {
  const r = await onApi("/empire", "GET");
  if (r.status === 200) { onEmpire = r.data; onSpawned = true; onToastRevolts(r.data.revolts); return true; }
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
  if (r.status !== 200 || !Array.isArray(r.data.raids)) return false;
  onToastRevolts(r.data.revolts);
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
  return true;
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
  await onLoadProgress();
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
    // v3.9.13: gold ring around systems you can attack right now (adjacent
    // neutral or faction systems — battle to take them, like single
    // player) so the next move is obvious at a glance.
    if (onSpawned && !mine && !isNexus && s.ownerType !== "player" && onIsAdjacent(s)) {
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
    // v3.9.13: zoomed in (zoom >= 3), also label systems you can attack now.
    const attackable = onSpawned && !mine && s.id !== 0 && s.ownerType !== "player" && onIsAdjacent(s);
    if (s.id !== 0 && !mine && s.id !== onSelected && !(onCam.zoom >= 3 && attackable)) return;
    const p = onWorldToScreen(s.x, s.y);
    if (p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40) return;
    q.fillStyle = (s.id === 0 || attackable) ? "#ffd84a" : "#6ee7f5";
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
    el.innerHTML = '<div class="ocard"><h2>Welcome to the shared galaxy</h2><p>One massive galaxy, 1,000 systems, every spawn exactly 15 jumps from the Dark Nexus. Battle to take systems, grow your empire, fight the five factions.</p><p><small>Galaxy:</small><br>'
      + '<button class="obtn' + (onGalaxy() === "test-1" ? '' : ' ghost') + '" data-oact="galaxy" data-galaxy="test-1">Beta Galaxy</button> '
      + '<button class="obtn' + (onGalaxy() === "staging-1" ? '' : ' ghost') + '" data-oact="galaxy" data-galaxy="staging-1">Staging Galaxy</button>'
      + '<br><small>Beta is the live galaxy. Staging is where new features land first — your empire there is separate.</small></p><button class="obtn" data-oact="spawn">Found your Home World</button><br><br><button class="obtn ghost" data-oact="recover">Recover an empire</button></div>';
    return;
  }
  const sel = onSelected != null ? onSysById[onSelected] : null;
  const banner = onRaidBanner();
  if (sel) { el.innerHTML = banner + onSystemCard(sel); return; }
  const e = onEmpire || {};
  const over = Math.max(0, (e.count || 0) - (e.softCap || 25));
  el.innerHTML = '<div class="ocard"><h2>Your empire</h2><small>' + esc(onGalaxyName()) + '</small>'
    + '<small>Credits <b>' + Math.floor(e.credits || 0) + '</b> · Power <b>' + Math.round(e.power || 0) + '</b> · Systems <b>' + (e.count || 0) + ' / ' + (e.softCap || 25) + '</b></small><br>'
    + '<small>Income <b>+' + (e.grossPerSec != null ? e.grossPerSec.toFixed(2) : "?") + '/s</b>'
    + (e.upkeepPerSec ? ' · Upkeep <b>−' + e.upkeepPerSec.toFixed(2) + '/s</b>' : '')
    + (e.garrisonUpkeepPerSec ? ' · Garrisons <b>−' + e.garrisonUpkeepPerSec.toFixed(2) + '/s</b>' : '')
    + ' · Net <b>' + (e.netPerSec != null ? (e.netPerSec >= 0 ? "+" : "") + e.netPerSec.toFixed(2) + '/s' : "?") + '</b></small>'
    + (over > 0 ? '<br><small>Over the soft cap by <b>' + over + '</b> — upkeep rises and rebellion risk is <b>' + Math.round((e.rebellionRisk || 0) * 100) + '%</b>.</small>' : '')
    + '<br><small><b>Next step:</b> ' + onNextStep() + '</small>'
    + '<br><button class="obtn ghost" data-oact="recovery">Recovery code</button> <button class="obtn" data-oact="station">Enter station</button> <button class="obtn" data-oact="fleet">Fleet</button> <button class="obtn" data-oact="research">Research</button> <button class="obtn" data-oact="crew">Crew</button></div>';
  el.innerHTML = banner + el.innerHTML;
}

// Next best step (single-player nextStep()): a Hangar, then ships, then
// attack a gold-ringed system.
function onNextStep() {
  const f = (onEmpire && onEmpire.fleet) || null;
  if (!f) return 'tap a system with a <b>gold ring</b> — those are next to your empire and ready to attack. Green dots are the outer rim, your spawn ground.';
  if ((f.hangarLv || 0) < 1) return 'build a <b>Hangar</b> at your station to start building ships.';
  const total = ((f.ships || {}).fighter || 0) + ((f.ships || {}).cruiser || 0) + ((f.ships || {}).capital || 0);
  if (total === 0) return 'build a <b>Fighter</b> in Fleet to start your fleet.';
  return 'tap a system with a <b>gold ring</b> — those are next to your empire and ready to attack. Green dots are the outer rim, your spawn ground.';
}

function onSystemCard(s) {
  const owned = onOwnedIds();
  const mine = owned.has(s.id);
  const isNexus = s.id === 0;
  const adj = onIsAdjacent(s);
  const e = onEmpire || {};
  const power = e.power || 0, credits = e.credits || 0;
  // Fleet power vs this system's type (single-player fpt): the ship type
  // that counters it hits for +50%. The /empire fleet summary carries
  // the ships and the Command level.
  const flPowerVs = (() => {
    const fl = (onEmpire && onEmpire.fleet) || null;
    if (!fl) return 0;
    const ships = fl.ships || {};
    const weak = { swarm: "fighter", armored: "cruiser", fortress: "capital" }[s.type];
    let base = 0;
    for (const k of ["fighter", "cruiser", "capital"]) {
      const pw = { fighter: 1, cruiser: 3, capital: 8 }[k];
      base += (ships[k] || 0) * pw * (k === weak ? 1.5 : 1);
    }
    return base * (1 + 0.2 * ((fl.commandLv || 1) - 1)) * onPowerMult();
  })();
  const flLine = adj && !mine
    ? '<br><small>Your fleet power vs this system: <b>' + Math.round(flPowerVs) + '</b> (defence ' + s.pw + ').'
      + (flPowerVs <= 0 ? ' You have no ships — build a Hangar and Fighters in Fleet first.' : '')
      + '</small>'
    : '';
  let owner = "Neutral";
  if (mine) owner = "Yours";
  else if (s.ownerType === "faction") owner = FAC_NAME[s.owner] || s.owner;
  else if (s.ownerType === "player") owner = "Another player";
  let html = '<div class="ocard"><h2>' + esc(s.name) + '</h2>'
    + '<small>Ring ' + s.ring + ' · ' + esc(s.type || "") + ' · Power <b>' + s.pw + '</b> · ' + esc(owner) + '</small><br>';
  if (isNexus) html += '<small>The Dark Nexus — power 5000, the endgame. Holding it is a tournament objective, not just a conquest.</small><br>';
  if (mine) {
    const garrison = s.garrison || 0;
    html += '<small>This system is yours. Defence comes from your empire power.</small>'
      + '<br><small>Garrison: <b>' + garrison + '</b>' + (garrison > 0 ? ' — cuts the revolt chance by <b>' + (garrison * 0.2).toFixed(1) + '%</b>.' : ' — a garrison suppresses revolt (each point cuts the chance by 0.2%).') + '</small><br>'
      + '<input id="o-garrison-amt" type="number" min="1" placeholder="Garrison points" style="width:130px"> '
      + '<button class="obtn" data-oact="garrison">Station garrison (2 cr/pt)</button>'
      + '<br><button class="obtn" data-oact="station">Enter station</button> <button class="obtn" data-oact="fleet">Fleet</button> <button class="obtn" data-oact="research">Research</button> <button class="obtn" data-oact="crew">Crew</button>';
  } else if (s.ownerType === "faction") {
    if (!adj) html += '<small>Not adjacent to your empire — take systems next to yours to reach them.</small>';
    else html += '<small>Adjacent to your empire. Attack to take it from ' + esc(owner) + '.</small>' + flLine + '<br>'
      + '<div class="bg"><button class="obtn" data-oact="attack" data-stance="allout">Attack · All-out</button> <button class="obtn" data-oact="attack" data-stance="balanced">Attack · Balanced</button> <button class="obtn" data-oact="attack" data-stance="cautious">Attack · Cautious</button></div>';
  } else if (s.ownerType === "player") {
    html += '<small>Owned by another player.</small>';
    if (!adj) html += '<br><small>Not adjacent to your empire — take systems next to yours to reach them.</small>';
    else html += '<br><small>Adjacent. Raiding gives the defender <b>90 seconds</b> to respond — they may offer tribute, and you can accept or decline it. A Home World cannot be taken, only raided for resources.</small><br>'
      + '<div class="bg"><button class="obtn" data-oact="raid" data-stance="allout">Raid · All-out</button> <button class="obtn" data-oact="raid" data-stance="balanced">Raid · Balanced</button> <button class="obtn" data-oact="raid" data-stance="cautious">Raid · Cautious</button></div>';
  } else {
    // Neutral — battle to take it, like single player (Jayden, Nov 17).
    // No credit cost, no power gate: the battle itself decides it.
    if (!adj) html += '<small>Not adjacent to your empire — take systems next to yours to reach them.</small>';
    else html += '<small>Neutral system, power <b>' + s.pw + '</b>. Attack to take it — win and it is yours, plus its loot.</small>' + flLine + '<br>'
      + '<div class="bg"><button class="obtn" data-oact="attack" data-stance="allout">Attack · All-out</button> <button class="obtn" data-oact="attack" data-stance="balanced">Attack · Balanced</button> <button class="obtn" data-oact="attack" data-stance="cautious">Attack · Cautious</button></div>';
  }
  html += '<br><button class="obtn ghost" data-oact="close">Close</button></div>';
  return html;
}

// ---------- actions ----------
async function onDoAttack(id, stance) {
  const pre = ((onEmpire && onEmpire.fleet && onEmpire.fleet.ships) || {});
  const r = await onApi("/attack", "POST", { systemId: id, stance: stance || "balanced" });
  if (r.status === 200) {
    // Ship losses (Phase 2, single-player resolveAttack): a win keeps
    // ceil(count x min(.95, .7 + stanceKeep)) of each type, a loss keeps
    // floor(count x (.4 + stanceKeep)). The response carries the surviving
    // ships; compare with the pre-battle fleet to name the losses.
    const post = r.data.ships || {};
    let lost = 0;
    for (const k of ["fighter", "cruiser", "capital"]) lost += Math.max(0, (pre[k] || 0) - (post[k] || 0));
    const lossNote = lost > 0 ? " Your fleet lost " + lost + " ship" + (lost > 1 ? "s" : "") + " in the battle." : "";
    onToast(r.data.win ? ("Victory! " + (r.data.system || "System") + " is yours." + lossNote) : ("Defeat — your fleet was repelled." + lossNote));
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

// Station a garrison on one of your systems (2 credits per point).
// A garrison suppresses revolt: each point cuts the revolt chance by 0.2%.
async function onDoGarrison(id) {
  const inp = onq("#o-garrison-amt");
  const amount = inp ? Math.floor(Number(inp.value) || 0) : 0;
  if (amount <= 0) { onToast("Enter how many garrison points to station."); return; }
  const r = await onApi("/garrison", "POST", { systemId: id, amount });
  if (r.status === 200) {
    onToast("Garrison of " + (r.data.garrison || amount) + " stationed on " + ((r.data.system || {}).name || "the system") + ".");
    await onRefresh();
  } else {
    onToast("Could not station a garrison: " + (r.data.error || r.status) + ".");
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


// ---------- station (home base) — Phase 1 (Jayden, Nov 17) ----------
// The station is the single-player home base, online: buildings produce
// resources on the server, and this client renders the iso base with
// art.js drawBase (via a shim for the global S it reads). v3.9.16 rebuilt
// the station UI to BE the single-player station view (Jayden: "it still
// doesn't look at all like the single player") — a full-screen canvas
// with chips, and building/plot popups in #o-st-pop that mirror the
// single-player #pop. The old list panel is gone; buildings are managed
// by tapping them, exactly like single player. Fleet/crew/research/
// quests land later.
// Building defs mirror data.js B + the single-player cost/duration
// formulas (cost = base x 1.4^level; duration = 45s x 1.6^level; a new
// copy costs 1.5x the last). The server is the authority — the client
// only uses these to enable/disable buttons; the server re-validates
// every build.
const ON_ST_B = {
  solar: { name: "Solar Array", desc: "Makes energy", dist: "Power District", cost: { metal: 10 }, prod: "energy", rate: 0.525 },
  foundry: { name: "Metal Foundry", desc: "Refines metal", dist: "Industrial District", cost: { energy: 10 }, prod: "metal", rate: 0.4125 },
  mine: { name: "Crystal Mine", desc: "Digs crystal", dist: "Industrial District", cost: { metal: 25, energy: 10 }, prod: "crystal", rate: 0.3 },
  hub: { name: "Trade Hub", desc: "Earns credits", dist: "Trade District", cost: { metal: 30, crystal: 20 }, prod: "credits", rate: 0.2625 },
  hangar: { name: "Hangar", desc: "Holds 5 ship slots per level (research adds more)", dist: "Military District", cost: { metal: 40, crystal: 30 }, prod: null },
  command: { name: "Command Station", desc: "Raises building cap, storage and fleet power", dist: "The Keep", cost: { metal: 60, crystal: 40, credits: 20 }, prod: null },
};
function onStCost(type, level) {
  const base = ON_ST_B[type].cost, out = {};
  for (const r in base) out[r] = Math.ceil(base[r] * Math.pow(1.4, level));
  return out;
}
function onStNewCost(type) {
  // Cost of a NEW copy (single-player newCost): base x 1.5^existing copies.
  const base = onStCost(type, 0);
  const n = (onStation.bl || []).filter((z) => z.t === type).length;
  const f = Math.pow(1.5, n);
  const out = {};
  for (const r in base) out[r] = Math.ceil(base[r] * f);
  return out;
}
function onStDur(level) { return 45 * Math.pow(1.6, level); }
function onStLeft(ms) {
  // Single-player left(): "1m 12s" / "45s" / "1h 2m 3s".
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return (h ? h + "h " : "") + (h || m ? m + "m " : "") + (s % 60) + "s";
}
function onStCostStr(cost) {
  return Object.keys(cost).map((r) => cost[r] + " " + r).join(", ");
}
function onStMaxCount(type, cmdLv) {
  if (type === "command") return 1;
  if (type === "hangar") return Math.min(4, 1 + Math.floor(cmdLv / 3));
  return Math.min(6, 1 + Math.floor(cmdLv / 2));
}
function onStLevelCap(type, cmdLv) {
  if (type === "command") return onCommandMax();
  return Math.min(15, cmdLv);
}
function onStPlotReq(x, y) {
  return Math.min(13, Math.max(1, Math.max(Math.abs(x - 2), Math.abs(y - 1))));
}
function onStCanAfford(cost) {
  if (!onStation) return false;
  const res = onStation.res || {};
  for (const r of ["energy", "metal", "crystal"]) {
    if ((cost[r] || 0) > (res[r] || 0)) return false;
  }
  if ((cost.credits || 0) > Math.floor(onStation.credits || 0)) return false;
  return true;
}
function onStUnlockedCount() {
  // Single-player unlockedCount(): plots that are not locked. An occupied
  // plot counts as unlocked (single-player plotLocked is false for a plot
  // with a building on it), so count every plot whose requirement the
  // Command Station meets — occupied or not. At Command Lv 1 that is the
  // 3x3 around the keep: 9 of 144. (v3.9.16 counted only EMPTY unlocked
  // plots, so it read 5 of 144 — the live check caught it.)
  let n = 0;
  const cmdLv = (onStation.b && onStation.b.command) || 1;
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
    if (onStPlotReq(i, j) <= cmdLv) n++;
  }
  return n;
}
function onStEffL(b) {
  // Effective level (single-player effL): level + 1 if an upgrade is queued.
  return b.l + ((onStation.bq || []).some((j) => j.u === b.u) ? 1 : 0);
}

let onStation = null;       // from GET /station
let onStationOpen = false;
let onStCam = { cx: 32, cy: 64, zoom: 2.2 }; // match single-player STCAM: centred on the keep, zoomed in on the cluster
let onStPop = null;         // null | {kind:"building", u} | {kind:"plot", x, y}
let onStPopKeyCache = "";
let onStPopOpenAt = 0;
let onStMove = null;        // uid of the building being moved, or null

async function onLoadStation() {
  const r = await onApi("/station", "GET");
  if (r.status === 200) { onStation = r.data; return true; }
  return false;
}

function onStCv() { return onq("#ostcv"); }

function onSizeStationCanvas() {
  const cv = onStCv();
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 360, h = cv.clientHeight || 360;
  const nw = Math.round(w * dpr), nh = Math.round(h * dpr);
  if (cv.width !== nw || cv.height !== nh) { cv.width = nw; cv.height = nh; }
}

// Render the iso base. drawBase reads the global single-player S (bl, b,
// bq, bsel, mv, place — b is read via plotLocked), so swap in a shim built
// from the online station state, draw, and restore S. game.js never runs
// its loop in online mode, so the swap cannot disturb single-player.
function onDrawStation() {
  const cv = onStCv();
  if (!cv || !onStation || typeof drawBase !== "function" || typeof S === "undefined") return;
  onSizeStationCanvas();
  const q = cv.getContext("2d");
  if (!q) return;
  const savedS = S;
  try {
    S = { bl: onStation.bl || [], b: onStation.b || {}, bq: onStation.bq || [], bsel: (onStPop && onStPop.kind === "building") ? onStPop.u : null, mv: onStMove, place: null };
    drawBase(q, onStCam, { sx: cv.width / 2, sy: cv.height / 2 });
  } catch (err) {
    // If drawBase throws, fall back to a plain background so the popup
    // and chips still work.
    q.fillStyle = "#c98a5a";
    q.fillRect(0, 0, cv.width, cv.height);
  } finally {
    S = savedS;
  }
}

function onStationResLine() {
  if (!onStation) return "";
  const res = onStation.res || {};
  const pr = onStation.productionPerSec || {};
  const fmt = (v) => Math.floor(v || 0);
  const rate = (r) => (pr[r] ? " +" + (pr[r] * 60).toFixed(0) + "/min" : "");
  return "Energy " + fmt(res.energy) + rate("energy")
    + " \u00b7 Metal " + fmt(res.metal) + rate("metal")
    + " \u00b7 Crystal " + fmt(res.crystal) + rate("crystal")
    + " \u00b7 " + fmt(onStation.credits) + " cr"
    + " \u00b7 cap " + (onStation.storageCap || 600);
}

// Chips overlaid on the station canvas (single-player #cap / #bq / hint /
// mvcancel). Called on every render.
function onStChips() {
  const top = onq("#o-st-res");
  if (top) top.textContent = onStationResLine();
  if (!onStation) return;
  const cap = onq("#o-st-cap");
  if (cap) cap.textContent = "Storage cap " + (onStation.storageCap || 600);
  const bq = onq("#o-st-bq");
  const busy = (onStation.bq || [])[0];
  if (bq) {
    if (busy) {
      const b = (onStation.bl || []).find((z) => z.u === busy.u);
      const name = b ? ON_ST_B[b.t].name : "Building";
      const secs = Math.max(0, Math.ceil((busy.end - Date.now()) / 1000));
      bq.textContent = "\uD83D\uDD28 " + name + " Lv " + (b ? b.l + 1 : "?") + " \u2014 done in " + onStLeft(secs * 1000) + ".";
      bq.hidden = false;
    } else bq.hidden = true;
  }
  const mv = onq("#o-st-mvcancel");
  if (mv) mv.hidden = onStMove == null;
  const hint = onq("#o-st-hint");
  if (hint) hint.textContent = onStMove != null ? "Tap a plot to move the building." : "Drag to pan \u00b7 pinch to zoom \u00b7 tap a building or open land";
}

// Popup render key (single-player popKey): identity + every value shown.
// The popup DOM is only rebuilt when the key changes, so a poll tick
// never rebuilds a button under the user's finger.
function onStPopKey() {
  if (!onStPop || !onStation) return "";
  const cmdLv = (onStation.b && onStation.b.command) || 1;
  if (onStPop.kind === "building") {
    const b = (onStation.bl || []).find((z) => z.u === onStPop.u);
    if (!b) return "gone";
    const e = onStEffL(b), c = onStCost(b.t, e);
    return "bld|" + b.u + "|" + b.l + "|" + e + "|" + (e >= onStLevelCap(b.t, cmdLv) ? 1 : 0) + "|" + onStCostStr(c) + "|" + (onStation.bq || []).length + "|" + onBuilderCap() + "|" + onProdMult().toFixed(2) + "|" + onTmul().toFixed(2) + "|" + onSlotBonus() + "|" + (onStCanAfford(c) ? 1 : 0) + "|" + (onStMove === b.u ? 1 : 0);
  }
  if (onStPop.kind === "plot") {
    const x = onStPop.x, y = onStPop.y;
    const locked = onStPlotReq(x, y) > cmdLv;
    return "plot|" + x + "|" + y + "|" + (locked ? 1 : 0) + "|" + onStPlotReq(x, y) + "|" + cmdLv + "|" + onStUnlockedCount() + "|" + (onStation.bq || []).length + "|" + onBuilderCap() + "|" + Object.keys(ON_ST_B).map((t) => (onStation.bl || []).filter((z) => z.t === t).length + "/" + onStMaxCount(t, cmdLv) + "/" + (onStCanAfford(onStNewCost(t)) ? 1 : 0)).join(",");
  }
  return "?";
}

// Render the station popup (#o-st-pop), mirroring single-player popupUI
// for a building or a plot. Only rebuilds when the render key changes.
function onRenderStPop() {
  const pop = onq("#o-st-pop");
  if (!pop) return;
  if (!onStPop || !onStation) { pop.hidden = true; onStPopKeyCache = ""; return; }
  pop.hidden = false;
  const key = onStPopKey();
  if (key === onStPopKeyCache) return;
  onStPopKeyCache = key;
  const title = onq("#o-st-pop-title"), hero = onq("#o-st-pop-hero"), body = onq("#o-st-pop-body"), acts = onq("#o-st-pop-actions");
  if (!title || !hero || !body || !acts) return;
  const cmdLv = (onStation.b && onStation.b.command) || 1;
  const hq = hero.getContext("2d");
  if (hq) { hq.imageSmoothingEnabled = false; hq.fillStyle = "#0a0e2a"; hq.fillRect(0, 0, 96, 96); }
  if (onStPop.kind === "building") {
    const b = (onStation.bl || []).find((z) => z.u === onStPop.u);
    if (!b) { onCloseStPop(); return; }
    const t = b.t, def = ON_ST_B[t], e = onStEffL(b), max = e >= onStLevelCap(t, cmdLv), c = onStCost(t, e);
    title.textContent = def.name + " Lv " + b.l;
    if (hq) {
      hq.fillStyle = "#c98a5a"; hq.fillRect(0, 0, 96, 96);
      if (typeof buildingSprite === "function") { const sp = buildingSprite(t, b.l); hq.drawImage(sp, 24, 24, 48, 48); }
    }
    let st = def.desc + ". ";
    if (b.l === 0) st = "Under construction. ";
    else if (def.prod) st += "Makes +" + (def.rate * b.l * onProdMult() * 60).toFixed(0) + " " + def.prod + "/min. ";
    else if (t === "hangar") st += "Holds " + (5 + onSlotBonus()) * b.l + " ship slots. ";
    else st += "Max building level " + onStLevelCap("hangar", cmdLv) + ", storage " + (onStation.storageCap || 600) + ". ";
    body.innerHTML = "<small><b>" + esc(def.dist) + "</b> \u2014 " + esc(st) + "</small><br><small>" + (max ? (t === "command" ? "Max level." : "Upgrade the Command Station to go higher.") : "Upgrade to Lv " + (e + 1) + ": " + esc(onStCostStr(c)) + ". Time: " + onStLeft(onStDur(e) * onTmul() * 1000)) + "</small>";
    acts.innerHTML = '<button data-oact="station-pop-upgrade" data-u="' + b.u + '"' + ((max || (onStation.bq || []).length >= onBuilderCap() || !onStCanAfford(c)) ? " disabled" : "") + '>Upgrade</button><button data-oact="station-pop-move" data-u="' + b.u + '">' + (onStMove === b.u ? "Cancel move" : "Move") + '</button><button data-oact="station-pop-close">Close</button>';
  } else if (onStPop.kind === "plot") {
    const x = onStPop.x, y = onStPop.y, lk = onStPlotReq(x, y) > cmdLv, un = onStUnlockedCount();
    const keep = (onStation.bl || []).find((z) => z.t === "command");
    const dn = keep ? (x < keep.x - 1 ? "West \u2014 near the Military quarter" : x > keep.x + 1 ? "East \u2014 near the Industrial quarter" : y < keep.y - 1 ? "North \u2014 near the Power fields" : "South \u2014 near the Trade quarter") : "Open land";
    title.textContent = lk ? "Locked land (" + (x + 1) + ", " + (y + 1) + ")" : "Open land (" + (x + 1) + ", " + (y + 1) + ")";
    if (hq) { hq.fillStyle = lk ? "#6b7590" : "#c98a5a"; hq.fillRect(0, 0, 96, 96); }
    if (lk) {
      body.innerHTML = "<small>\uD83D\uDD12 Locked \u2014 upgrade the Command Station to Lv " + onStPlotReq(x, y) + " to unlock this plot.</small><br><small>" + un + " of 144 plots unlocked \u2014 Command Station Lv " + cmdLv + ". The city grows outward from the keep.</small>";
      acts.innerHTML = '<button data-oact="station-pop-close" class="grow">Close</button>';
    } else {
      body.innerHTML = "<small>" + esc(dn) + ". " + un + " of 144 plots unlocked \u2014 Command Station Lv " + cmdLv + ". What can you build here? Each new copy costs 1.5x the last. Buildings produce at full rate wherever they stand. Build limits rise with your Command Station: most buildings max at 1 + half your Command level (Hangar: 1 + a third).</small>" + Object.keys(ON_ST_B).map((t) => {
        const def = ON_ST_B[t];
        const n = (onStation.bl || []).filter((z) => z.t === t).length, mx = onStMaxCount(t, cmdLv), c = onStNewCost(t);
        const ok = n < mx && (onStation.bq || []).length < onBuilderCap() && onStCanAfford(c);
        return '<div class="row"><div><b>' + esc(def.name) + '</b> ' + n + "/" + mx + '<br><small>' + esc(def.desc) + '<br>Cost: ' + esc(onStCostStr(c)) + '</small></div><button data-oact="station-pop-place" data-type="' + t + '"' + (ok ? "" : " disabled") + '>Place</button></div>';
      }).join("");
      acts.innerHTML = "";
    }
  }
}

function onOpenStBuilding(u) {
  onStPop = { kind: "building", u };
  onStPopKeyCache = "";
  onStPopOpenAt = Date.now();
  onRenderStPop();
}
function onOpenStPlot(x, y) {
  onStPop = { kind: "plot", x, y };
  onStPopKeyCache = "";
  onStPopOpenAt = Date.now();
  onRenderStPop();
}
function onCloseStPop() {
  onStPop = null;
  onStPopKeyCache = "";
  const pop = onq("#o-st-pop");
  if (pop) pop.hidden = true;
}

// The station's main render entry: chips + canvas + popup (if open).
function onRenderStation() {
  onStChips();
  onDrawStation();
  if (onStPop) onRenderStPop();
}

async function onDoStationBuild(type, x, y) {
  const r = await onApi("/station/build", "POST", { type, x, y });
  if (r.status === 200) {
    onStation = r.data;
    onToast(ON_ST_B[type].name + " construction started.");
    onCloseStPop();
    onRenderStation();
  } else {
    onToast("Could not build: " + (r.data.error || r.status) + ".");
    await onLoadStation();
    onRenderStation();
  }
}

async function onDoStationUpgrade(u) {
  const r = await onApi("/station/build", "POST", { u });
  if (r.status === 200) {
    onStation = r.data;
    onToast("Upgrade started.");
    onRenderStation();
  } else {
    onToast("Could not upgrade: " + (r.data.error || r.status) + ".");
    await onLoadStation();
    onRenderStation();
  }
}

async function onDoStationMove(u, x, y) {
  const r = await onApi("/station/move", "POST", { u, x, y });
  if (r.status === 200) {
    onStation = r.data;
    onStMove = null;
    onToast("Building moved.");
    onRenderStation();
  } else {
    const err = r.data.error || r.status;
    if (err === "plot_occupied") onToast("That spot is taken.");
    else if (err === "plot_locked") onToast("Locked \u2014 upgrade the Command Station to Lv " + (r.data.requiredCommand || "?") + " to unlock this plot.");
    else if (err === "would_strand") onToast("Can't move the Command Station there \u2014 your " + (ON_ST_B[r.data.type] ? ON_ST_B[r.data.type].name : "building") + " would be outside the unlocked area.");
    else onToast("Could not move: " + err + ".");
    await onLoadStation();
    onRenderStation();
  }
}

async function onOpenStation() {
  if (!onSpawned) { onToast("Found your Home World first."); return; }
  const ok = await onLoadStation();
  if (!ok) { onToast("Could not load your station \u2014 check your connection."); return; }
  onStationOpen = true;
  onStPop = null; onStPopKeyCache = ""; onStMove = null;
  const ov = onq("#o-station");
  if (ov) ov.hidden = false;
  onRenderStation();
}

function onCloseStation() {
  onStationOpen = false;
  onStPop = null; onStPopKeyCache = ""; onStMove = null;
  const ov = onq("#o-station");
  if (ov) ov.hidden = true;
  onCloseStPop();
  onRefresh();
}

// Pan / pinch / tap on the station canvas.
(function onStationInput() {
  const cv = onStCv();
  if (!cv) return;
  const pts = new Map();
  let pinchD = 0, pinchZoom = 1, moved = 0, downAt = 0;
  const stScale = () => ((cv.height || 384) / 480) * onStCam.zoom;
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0; downAt = Date.now();
    if (pts.size === 2) {
      const a = [...pts.values()];
      pinchD = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      pinchZoom = onStCam.zoom;
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
      const sc = stScale();
      onStCam.cx -= (dx * dpr) / sc;
      onStCam.cy -= (dy * dpr) / sc;
      onDrawStation();
    } else if (pts.size === 2) {
      const a = [...pts.values()];
      const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      if (pinchD > 0) {
        onStCam.zoom = Math.max(0.5, Math.min(4, pinchZoom * d / pinchD));
        onDrawStation();
      }
    }
  });
  const up = (e) => {
    const wasTap = pts.size === 1 && moved < 10 && (Date.now() - downAt) < 500;
    pts.delete(e.pointerId);
    if (wasTap) onTapStation(e);
    if (pts.size < 2) pinchD = 0;
  };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
})();

// Backdrop tap-to-close on the station popup (single-player #pop rule).
(function onStPopBackdrop() {
  const pop = onq("#o-st-pop");
  if (!pop) return;
  pop.addEventListener("pointerup", (e) => {
    if (e.target === pop) onCloseStPop();
  });
})();

function onTapStation(e) {
  // Mirrors single-player stEnd: tap a building -> its popup; tap an
  // empty plot -> the plot popup (or the move target while moving).
  const cv = onStCv();
  if (!cv || !onStation || onStPop) return;
  onSizeStationCanvas();
  const rect = cv.getBoundingClientRect();
  const dpr = cv.width / (rect.width || 1);
  const px = (e.clientX - rect.left) * dpr;
  const py = (e.clientY - rect.top) * dpr;
  // Canvas px -> iso world coords (inverse of drawBase's transform).
  const sc = ((cv.height || 384) / 480) * onStCam.zoom;
  const ox = cv.width / 2 - onStCam.cx * sc;
  const oy = cv.height / 2 - onStCam.cy * sc;
  const wx = (px - ox) / sc, wy = (py - oy) / sc;
  if (typeof isoCellFromPoint !== "function") return;
  const cell = isoCellFromPoint(wx, wy);
  const gx = cell.i, gy = cell.j;
  if (gx < 0 || gx > 11 || gy < 0 || gy > 11) return;
  const b = (onStation.bl || []).find((z) => z.x === gx && z.y === gy);
  if (b) {
    if (onStMove != null) { onToast("That spot is taken."); return; }
    onOpenStBuilding(b.u);
    return;
  }
  if (onStMove != null) {
    const u = onStMove;
    onDoStationMove(u, gx, gy);
    return;
  }
  onOpenStPlot(gx, gy);
}

// ---------- research + crew + commanders — Phase 3 (Jayden, Nov 17) ----------
// Mirrors the single-player Research tab (tree), Crew tab, and officer
// list. TECH/CM come from data.js (loaded before this file); the lane
// layout and icons mirror game.js TECHLANES/TECHICON — game.js loads
// after online.js, so this file keeps its own copies of those two.
let onProgress = null;      // from GET /progress
let onResearchOpen = false;
let onCrewOpen = false;
let onPrevCmdLevels = {};

const ON_TECHLANES = [{ k: "pw", n: "Weapons" }, { k: "eco", n: "Economy" }, { k: "cmax", n: "Command" }, { k: "bld", n: "Builders" }, { k: "slot", n: "Docks" }, { k: "keep", n: "Hull" }, { k: "jump", n: "Jump Drive" }];
const ON_TECHICON = { pw: "⚔", eco: "⚙", keep: "🛡", slot: "▲", cmax: "👑", bld: "🔨", jump: "🌀" };
const ON_TT = { fleet: "fleet power", econ: "production", build: "faster building and research" };

function onBonuses() { return (onProgress && onProgress.bonuses) || {}; }
function onProdMult() { return onBonuses().prod || 1; }
function onPowerMult() { return onBonuses().power || 1; }
function onTmul() { return onBonuses().tmul || 1; }
function onShipMul() { return onBonuses().shipMul || 1; }
function onResMul() { return onBonuses().resMul || 1; }
function onSlotBonus() { return onBonuses().slotBonus || 0; }
function onBuilderCap() { return onBonuses().builderCap || 1; }
function onCommandMax() { return onBonuses().commandMax || 5; }

// Set the progress state without toasting (used for our own actions —
// the action's own toast covers it). Completion/level-up toasts come
// from onLoadProgress comparing against the previous state.
function onSetProgress(data) {
  onProgress = data;
  onPrevCmdLevels = {};
  for (const c of data.commanders || []) if (c.hired) onPrevCmdLevels[c.id] = c.level;
}

async function onLoadProgress() {
  const r = await onApi("/progress", "GET");
  if (r.status !== 200) return false;
  const prev = onProgress;
  onProgress = r.data;
  // Research completions + officer level-ups (single-player done()/gain()
  // messages): toast once when they first appear in the state.
  if (prev) {
    const techs = (typeof TECH !== "undefined" ? TECH : []);
    for (const id of (onProgress.tech || [])) {
      if (!(prev.tech || []).includes(id)) {
        const t = techs.find((z) => z.id === id);
        onToast("Research complete: " + (t ? t.n : id) + ".");
      }
    }
    for (const c of onProgress.commanders || []) {
      if (c.hired && (onPrevCmdLevels[c.id] || 0) > 0 && c.level > (onPrevCmdLevels[c.id] || 0)) {
        onToast(c.name + " reached Lv " + c.level + "!");
      }
    }
  }
  onSetProgress(onProgress);
  return true;
}

// Research time for a tech (single-player: t seconds x tmul x crewResMul).
function onResearchTime(t) { return t.t * 1000 * onTmul() * onResMul(); }

function onRenderResearch() {
  const ov = onq("#o-research");
  if (!ov || ov.hidden) return;
  const resEl = onq("#o-res-res");
  if (resEl && onProgress) {
    const res = onProgress.res || {};
    resEl.textContent = "Energy " + Math.floor(res.energy || 0) + " · Metal " + Math.floor(res.metal || 0) + " · Crystal " + Math.floor(res.crystal || 0) + " · " + Math.floor(onProgress.credits || 0) + " cr";
  }
  const body = onq("#o-res-body");
  if (!body) return;
  const p = onProgress;
  if (!p) { body.innerHTML = '<div class="ocard"><p>Loading research…</p></div>'; return; }
  const techs = (typeof TECH !== "undefined" ? TECH : []);
  const done = new Set(p.tech || []);
  const rq = p.rq || null;
  const res = p.res || {};
  const depth = {};
  const dep = (id) => { if (depth[id]) return depth[id]; const t = techs.find((z) => z.id === id); return depth[id] = t && t.req ? dep(t.req) + 1 : 1; };
  techs.forEach((t) => dep(t.id));
  const costStr = (c) => Object.keys(c).map((r) => c[r] + " " + r).join(", ");
  const canAfford = (c) => Object.keys(c).every((r) => (r === "credits" ? Math.floor(p.credits || 0) : Math.floor(res[r] || 0)) >= c[r]);
  let html = '<div class="ocard"><h2>Research</h2><small id="o-rq">' + (rq ? "Researching: " + ((techs.find((z) => z.id === rq.id) || {}).n || rq.id) + ' (<span id="o-rq-left"></span>). ' : "Lab idle. ") + "Completed " + (p.tech || []).length + " of " + techs.length + '.</small><div class="pbar"><div id="o-pb-res" style="width:0%"></div></div></div>';
  html += '<div class="ocard"><div class="techtree-wrap"><div class="techtree" id="o-techtree"><svg id="o-techsvg"></svg>'
    + ON_TECHLANES.map((L, li) => '<div class="techlane" style="grid-column:' + (li + 1) + ';grid-row:1"><span class="techic">' + (ON_TECHICON[L.k] || "✦") + "</span>" + L.n + "</div>").join("")
    + techs.map((t) => {
      const lane = ON_TECHLANES.findIndex((L) => L.k === t.k) + 1;
      const dn = done.has(t.id);
      const req = t.req ? techs.find((z) => z.id === t.req) : null;
      const locked = !!req && !done.has(req.id);
      const ct = "Cost: " + costStr(t.c) + ". Time: " + onStLeft(onResearchTime(t));
      const status = dn ? "Researched." : locked ? "Requires " + req.n + ". " + ct : ct + (!canAfford(t.c) ? " Can't afford yet." : "");
      const dis = dn || locked || !!rq || !canAfford(t.c);
      return '<div class="row treenode' + (locked ? " locked" : "") + (dn ? " done" : "") + '" id="otr-' + t.id + '" style="grid-column:' + lane + ";grid-row:" + (depth[t.id] + 1) + '"><div class="tn-head"><span class="techic">' + (ON_TECHICON[t.k] || "✦") + "</span><b>" + esc(t.n) + "</b></div><small>" + esc(t.d) + "</small><small>" + esc(status) + '</small><button data-oact="research-start" data-tech="' + t.id + '"' + (dis ? " disabled" : "") + ">" + (dn ? "Researched" : "Research") + "</button></div>";
    }).join("")
    + "</div></div></div>";
  body.innerHTML = html;
  onDrawResearchTree();
  onResTick();
}

// Elbow connectors between a tech and its prerequisite (single-player
// drawTechTree), gold once the parent is researched.
function onDrawResearchTree() {
  try {
    const tree = onq("#o-techtree"), svg = onq("#o-techsvg");
    if (!tree || !svg) return;
    const W = tree.offsetWidth, H = tree.offsetHeight;
    if (!W || !H) return;
    if (svg.setAttribute) { svg.setAttribute("width", W); svg.setAttribute("height", H); }
    const techs = (typeof TECH !== "undefined" ? TECH : []);
    const done = new Set((onProgress && onProgress.tech) || []);
    let paths = "";
    techs.forEach((t) => {
      if (!t.req) return;
      const p = onq("#otr-" + t.req), c = onq("#otr-" + t.id);
      if (!p || !c) return;
      if (typeof p.offsetLeft !== "number" || typeof c.offsetLeft !== "number") return;
      const px = p.offsetLeft + p.offsetWidth / 2, py = p.offsetTop + p.offsetHeight, cx = c.offsetLeft + c.offsetWidth / 2, cy = c.offsetTop, my = (py + cy) / 2;
      paths += '<path class="techlink' + (done.has(t.req) ? " done" : "") + '" d="M ' + px + " " + py + " V " + my + " H " + cx + " V " + cy + '"/>';
    });
    svg.innerHTML = paths;
  } catch (e) {}
}

// Tick the research progress bar + countdown live while the Research
// view is open (the 15s poll reloads the progress; this only moves
// the bar/countdown).
function onResTick() {
  if (!onResearchOpen || !onProgress) return;
  const rq = onProgress.rq;
  const bar = onq("#o-pb-res"), left = onq("#o-rq-left");
  if (!rq) { if (bar) bar.style.width = "0%"; return; }
  const t = (typeof TECH !== "undefined" ? TECH : []).find((z) => z.id === rq.id);
  const total = t ? onResearchTime(t) : 0;
  const leftMs = Math.max(0, rq.end - Date.now());
  if (bar) bar.style.width = total ? (Math.max(0, Math.min(100, 100 * (1 - leftMs / total)))).toFixed(0) + "%" : "0%";
  if (left) left.textContent = onStLeft(leftMs);
  if (leftMs <= 0) { onLoadProgress().then(() => onRenderResearch()); }
}

function onRenderCrew() {
  const ov = onq("#o-crew");
  if (!ov || ov.hidden) return;
  const resEl = onq("#o-cr-res");
  if (resEl && onProgress) {
    const res = onProgress.res || {};
    resEl.textContent = "Energy " + Math.floor(res.energy || 0) + " · Metal " + Math.floor(res.metal || 0) + " · Crystal " + Math.floor(res.crystal || 0) + " · " + Math.floor(onProgress.credits || 0) + " cr";
  }
  const body = onq("#o-cr-body");
  if (!body) return;
  const p = onProgress;
  if (!p) { body.innerHTML = '<div class="ocard"><p>Loading crew…</p></div>'; return; }
  const c = p.crew || {}, cap = p.crewCap || 0, tot = p.crewTotal || 0;
  const desc = { mine: "Boosts building and colony production.", ship: "Ships finish faster.", res: "Research finishes faster." };
  const icon = { mine: "⛏", ship: "🚀", res: "⚙" };
  const row = (k, label, bonus) => {
    const n = c[k] || 0;
    return '<div class="row"><div><span class="crewic">' + icon[k] + "</span><b>" + label + ": " + n + " crew → +" + (n * 2) + "% " + bonus + " (+2% per crew)</b><br><small>" + desc[k] + '</small></div><div class="bg"><button data-oact="crew" data-crew="' + k + ':-1"' + (n <= 0 ? " disabled" : "") + '>−</button><button data-oact="crew" data-crew="' + k + ':+1"' + (tot >= cap ? " disabled" : "") + ">+</button></div></div>";
  };
  let html = '<div class="ocard"><h2>Crew</h2><small>Assign your crew to mining, shipbuilding or research. Crew grows with your Command Station.</small><br><small><b>Crew: ' + tot + " assigned / " + cap + " total (" + (cap - tot) + " idle)</b></small>"
    + row("mine", "Mining", "production") + row("ship", "Shipbuilding", "shipyard speed") + row("res", "Research", "research speed") + "</div>";
  // Commanders (single-player officer list): one assigned at a time.
  html += '<div class="ocard"><h2>Commanders</h2><small>One officer can be assigned at a time — their bonus applies while assigned, and they level up as you play.</small>';
  for (const cmd of p.commanders || []) {
    const h = cmd.hired, on = cmd.assigned;
    html += '<div class="row"><div><span class="cmdav cmdav-' + cmd.type + '">' + cmd.name.split(" ").pop()[0] + "</span><b>" + esc(cmd.name) + "</b> " + (h ? "Lv " + cmd.level + (on ? " (assigned)" : "") : "") + "<br><small>" + esc(cmd.desc) + "<br>" + (h ? "Bonus now: +" + cmd.bonus + "% " + ON_TT[cmd.type] + (on ? "" : " (not assigned)") : "Hire cost: " + cmd.cost + " credits") + '</small></div><button data-oact="commander" data-id="' + cmd.id + '"' + (!h && Math.floor(p.credits || 0) < cmd.cost ? " disabled" : "") + ">" + (!h ? "Hire" : on ? "Unassign" : "Assign") + "</button></div>";
  }
  html += "</div>";
  body.innerHTML = html;
}

async function onDoResearchStart(id) {
  const t = (typeof TECH !== "undefined" ? TECH : []).find((z) => z.id === id);
  const r = await onApi("/research/start", "POST", { id });
  if (r.status === 200) {
    onSetProgress(r.data);
    onToast("Research started: " + (t ? t.n : id) + ".");
    onRenderResearch();
    onRefresh();
  } else {
    const err = (r.data && r.data.error) || r.status;
    if (err === "missing_prereq") onToast("Requires " + (r.data.reqName || "another tech") + " first.");
    else if (err === "research_busy") onToast("Research is already in progress.");
    else if (err === "already_researched") onToast("Already researched.");
    else if (err === "not_enough_resources") onToast("Not enough resources.");
    else onToast("Could not start research: " + err + ".");
    await onLoadProgress();
    onRenderResearch();
  }
}

async function onDoCrewAssign(role, delta) {
  const r = await onApi("/crew/assign", "POST", { role, delta });
  if (r.status === 200) {
    onSetProgress(r.data);
    onRenderCrew();
  } else {
    const err = (r.data && r.data.error) || r.status;
    if (err === "crew_full") onToast("All your crew are assigned already.");
    else if (err === "none_assigned") onToast("No crew on that job.");
    else onToast("Could not assign crew: " + err + ".");
    await onLoadProgress();
    onRenderCrew();
  }
}

async function onDoCommander(id) {
  const wasHired = !!((onProgress && onProgress.commanders) || []).find((c) => c.id === id && c.hired);
  const r = await onApi("/commander", "POST", { id });
  if (r.status === 200) {
    onSetProgress(r.data);
    const cmd = (r.data.commanders || []).find((c) => c.id === id);
    if (cmd) onToast(!wasHired ? cmd.name + " joins your command." : cmd.assigned ? cmd.name + " assigned as your officer." : cmd.name + " unassigned.");
    onRenderCrew();
    onRefresh();
  } else {
    const err = (r.data && r.data.error) || r.status;
    if (err === "not_enough_credits") onToast("Not enough credits to hire.");
    else onToast("Could not change officer: " + err + ".");
    await onLoadProgress();
    onRenderCrew();
  }
}

async function onOpenResearch() {
  if (!onSpawned) { onToast("Found your Home World first."); return; }
  const ok = await onLoadProgress();
  if (!ok) { onToast("Could not load research — check your connection."); return; }
  onResearchOpen = true;
  const ov = onq("#o-research");
  if (ov) ov.hidden = false;
  onRenderResearch();
}
function onCloseResearch() { onResearchOpen = false; const ov = onq("#o-research"); if (ov) ov.hidden = true; }

async function onOpenCrew() {
  if (!onSpawned) { onToast("Found your Home World first."); return; }
  const ok = await onLoadProgress();
  if (!ok) { onToast("Could not load crew — check your connection."); return; }
  onCrewOpen = true;
  const ov = onq("#o-crew");
  if (ov) ov.hidden = false;
  onRenderCrew();
}
function onCloseCrew() { onCrewOpen = false; const ov = onq("#o-crew"); if (ov) ov.hidden = true; }

// ---------- fleet (ships) — Phase 2 (Jayden, Nov 17) ----------
// Mirrors the single-player Fleet tab (data.js U + DUR, fpt/dpower, the
// build rules, and the battle ship losses). The server owns the fleet
// state; this view renders it and posts builds/scraps.
let onFleet = null;         // from GET /fleet
let onFleetOpen = false;

// Ship defs (mirror FLEET_SHIPS in the backend's fleet.js). Cost is paid
// from the station resources (energy/metal/crystal) plus empire credits.
const ON_FL_SHIPS = {
  fighter: { name: "Fighter", pw: 1, sz: 1, hangar: 1, cost: { energy: 10, credits: 5 }, dur: 9, vs: "swarm" },
  cruiser: { name: "Cruiser", pw: 3, sz: 2, hangar: 2, cost: { metal: 25, crystal: 10, credits: 10 }, dur: 24, vs: "armored" },
  capital: { name: "Capital Ship", pw: 8, sz: 4, hangar: 4, cost: { metal: 80, crystal: 50, credits: 40 }, dur: 60, vs: "fortress" },
};

function onFlCostStr(cost) {
  return Object.keys(cost).map((r) => cost[r] + " " + r).join(", ");
}

function onFlCanAfford(cost) {
  if (!onFleet) return false;
  const res = onFleet.res || {};
  for (const r in cost) {
    const have = r === "credits" ? (onFleet.credits || 0) : (res[r] || 0);
    if (have < cost[r]) return false;
  }
  return true;
}

async function onLoadFleet() {
  const r = await onApi("/fleet", "GET");
  if (r.status === 200) { onFleet = r.data; return true; }
  return false;
}

async function onOpenFleet() {
  if (!onSpawned) { onToast("Found your Home World first."); return; }
  const ok = await onLoadFleet();
  if (!ok) { onToast("Could not load your fleet \u2014 check your connection."); return; }
  onFleetOpen = true;
  const ov = onq("#o-fleet");
  if (ov) ov.hidden = false;
  onRenderFleet();
}

function onCloseFleet() {
  onFleetOpen = false;
  const ov = onq("#o-fleet");
  if (ov) ov.hidden = true;
  onRefresh();
}

// Build n ships of a type (single-player d.build: one call per ship,
// each queued after the last). The server builds as many as fit and
// names the first blocker (no_hangar / slots_full / queue_full /
// not_enough_resources).
async function onDoFleetBuild(type, n) {
  const def = ON_FL_SHIPS[type];
  if (!def) return;
  const r = await onApi("/fleet/build", "POST", { type, n: n || 1 });
  if (r.status === 200 && r.data.built > 0) {
    onToast(r.data.built + "x " + def.name + " construction started.");
    await onLoadFleet(); onRenderFleet(); onRefresh();
  } else {
    const err = (r.data && r.data.error) || "failed";
    const why = err === "no_hangar" ? "Build a Hangar at your station first (needs Hangar Lv " + def.hangar + ")."
      : err === "slots_full" ? "Your Hangar is full — upgrade the Hangar for more ship slots."
      : err === "queue_full" ? "The shipyard queue is full — wait for a ship to launch."
      : err === "not_enough_resources" ? "Not enough resources — need " + onFlCostStr(def.cost) + "."
      : "Build failed: " + err + ".";
    onToast(why);
    await onLoadFleet(); onRenderFleet();
  }
}

// Scrap one ship (single-player d.scrap): half its cost is refunded.
async function onDoFleetScrap(type) {
  const def = ON_FL_SHIPS[type];
  if (!def) return;
  const r = await onApi("/fleet/scrap", "POST", { type });
  if (r.status === 200) {
    onToast(def.name + " scrapped. Half its cost was refunded.");
    await onLoadFleet(); onRenderFleet(); onRefresh();
  } else {
    onToast("Scrap failed: " + ((r.data && r.data.error) || r.status) + ".");
  }
}

function onRenderFleet() {
  const ov = onq("#o-fleet");
  if (!ov || ov.hidden) return;
  const f = onFleet;
  const resEl = onq("#o-fl-res");
  if (resEl && f) {
    const res = f.res || {};
    resEl.textContent = "Energy " + Math.floor(res.energy || 0) + " · Metal " + Math.floor(res.metal || 0) + " · Crystal " + Math.floor(res.crystal || 0) + " · " + Math.floor(f.credits || 0) + " cr";
  }
  const body = onq("#o-fl-body");
  if (!body) return;
  if (!f) { body.innerHTML = '<div class="ocard"><p>Loading your fleet…</p></div>'; return; }
  const hangarLv = f.hangarLv || 0, cmdLv = f.commandLv || 1;
  const ships = f.ships || {};
  const total = (ships.fighter || 0) + (ships.cruiser || 0) + (ships.capital || 0);
  const used = f.usedSlots || 0, slotCap = f.slotCap || 0;
  const q = f.sq || [];
  // Power breakdown (single-player #fpw-sub): raw base, then each bonus
  // that is actually active. The server's f.power is already multiplied.
  let _base = 0;
  for (const k of ["fighter", "cruiser", "capital"]) _base += (ships[k] || 0) * ON_FL_SHIPS[k].pw;
  const _cb0 = 0.2 * (cmdLv - 1), _pw0 = onBonuses().pw || 0, _fl0 = onBonuses().fleetOff || 0;
  const _parts = ["Base " + _base];
  if (_cb0 > 0) _parts.push("Command +" + Math.round(_cb0 * 100) + "%");
  if (_pw0 > 0) _parts.push("Research +" + Math.round(_pw0 * 100) + "%");
  if (_fl0 > 0) _parts.push("Officer +" + Math.round(_fl0 * 100) + "%");
  const _sub = _parts.join(" · ") + (_parts.length > 2 ? " (bonuses multiply)" : "");
  let html = '<div class="ocard"><h2>Fleet</h2>'
    + '<small>Fleet power: <b>' + Math.round(f.power || 0) + '</b>. Vs swarm <b>' + Math.round((f.powerVs || {}).swarm || 0) + '</b>, armored <b>' + Math.round((f.powerVs || {}).armored || 0) + '</b>, fortress <b>' + Math.round((f.powerVs || {}).fortress || 0) + '</b>. Home defence <b>' + Math.round(f.defence || 0) + '</b>.</small><br>'
    + '<small>' + _sub + '</small><br>'
    + '<small><b>Counters:</b> Fighters +50% vs swarm, Cruisers +50% vs armored, Capital ships +50% vs fortress.</small><br>'
    + '<small>Ship slots: <b>' + used + ' / ' + slotCap + '</b> (Hangar Lv ' + hangarLv + ' — ' + (5 + onSlotBonus()) + ' slots per level).</small>';
  if (hangarLv < 1) html += '<br><small><b>No Hangar yet</b> — build one at your station to start building ships.</small>';
  if (total === 0 && hangarLv >= 1) html += '<br><small>No ships yet — build a Fighter to start your fleet.</small>';
  html += '</div>';
  // One row per ship type (single-player Fleet tab rows).
  html += '<div class="ocard">';
  for (const k of Object.keys(ON_FL_SHIPS)) {
    const d = ON_FL_SHIPS[k];
    const n = ships[k] || 0;
    const needsHangar = hangarLv < d.hangar;
    const afford = onFlCanAfford(d.cost);
    const slotsFit = used + d.sz <= slotCap;
    const canBuild = !needsHangar && afford && slotsFit && q.length < (f.queueCap || 0);
    html += '<div class="shiprow"><div><b>' + d.name + '</b> x' + n + '<br><small>Power ' + d.pw + ', ' + d.sz + ' slot' + (d.sz > 1 ? "s" : "") + ', ' + Math.ceil(d.dur * onTmul() * onShipMul()) + 's. Strong vs ' + d.vs + ' (+50%).<br>Cost: ' + onFlCostStr(d.cost) + '<br>'
      + (needsHangar ? 'Needs Hangar Lv ' + d.hangar + '.' : '')
      + (!needsHangar && !afford ? 'Not enough resources.' : '')
      + (!needsHangar && afford && !slotsFit ? 'No free ship slots.' : '')
      + '</small></div><div class="bg">'
      + '<button class="obtn" data-oact="fleet-build" data-type="' + k + '" data-n="1"' + (canBuild ? '' : ' disabled') + '>Build</button>'
      + '<button class="obtn" data-oact="fleet-build" data-type="' + k + '" data-n="5"' + (canBuild ? '' : ' disabled') + '>x5</button>'
      + '<button class="obtn ghost" data-oact="fleet-scrap" data-type="' + k + '"' + (n > 0 ? '' : ' disabled') + '>Scrap</button>'
      + '</div></div>';
  }
  html += '</div>';
  // Shipyard queue with a progress bar on the first job. The job's total
  // time is end - start (the server already applied the build-time and
  // crew multipliers when it queued the ship), so the bar stays exact
  // even if the multipliers change while it builds.
  if (q.length) {
    const first = q[0];
    const now = Date.now();
    const dur = Math.max(1, (first.end - first.s) / 1000);
    const leftMs = Math.max(0, first.end - now);
    const done = Math.max(0, Math.min(100, 100 * (1 - leftMs / (dur * 1000))));
    html += '<div class="ocard"><small><b>Shipyard queue</b> (' + q.length + ')</small><br>'
      + '<small>' + (ON_FL_SHIPS[first.k] || {}).name + ' — done in <b id="o-fl-left">' + Math.ceil(leftMs / 1000) + 's</b></small>'
      + '<div class="pbar"><div id="o-fl-bar" style="width:' + done.toFixed(0) + '%"></div></div>'
      + '<small>' + q.map((j) => (ON_FL_SHIPS[j.k] || {}).name).join(", ") + '</small></div>';
  }
  body.innerHTML = html;
}

// Tick the shipyard progress bar live while the Fleet view is open
// (the 15s poll reloads the fleet; this only moves the bar/countdown).
// When a ship launches, refresh the empire too — otherwise the top
// header and empire panel keep showing the old power until the next
// 15s poll (v3.9.18 live-check note). The refresh only fires when the
// queue actually changed, so a failed reload never hammers the server.
function onFlTick() {
  if (!onFleetOpen || !onFleet) return;
  const q = onFleet.sq || [];
  if (!q.length) return;
  const first = q[0];
  const dur = Math.max(1, (first.end - first.s) / 1000);
  const leftMs = Math.max(0, first.end - Date.now());
  const left = onq("#o-fl-left");
  if (left) left.textContent = Math.ceil(leftMs / 1000) + "s";
  const bar = onq("#o-fl-bar");
  if (bar) bar.style.width = Math.max(0, Math.min(100, 100 * (1 - leftMs / (dur * 1000)))).toFixed(0) + "%";
  if (leftMs <= 0) {
    const key = first.k + ":" + first.end;
    onLoadFleet().then(() => {
      onRenderFleet();
      const nq = (onFleet.sq || [])[0];
      if (!nq || (nq.k + ":" + nq.end) !== key) onRefresh();
    });
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
  else if (act === "attack" && onSelected != null) onDoAttack(onSelected, b.dataset.stance || "balanced");
  else if (act === "raid" && onSelected != null) onDoRaid(onSelected, b.dataset.stance || "balanced");
  else if (act === "raid-tribute" && b.dataset.raid) onDoRaidTribute(b.dataset.raid);
  else if (act === "raid-tribute-accept" && b.dataset.raid) onDoRaidTributeAccept(b.dataset.raid);
  else if (act === "raid-tribute-decline" && b.dataset.raid) onDoRaidTributeDecline(b.dataset.raid);
  else if (act === "garrison" && onSelected != null) onDoGarrison(onSelected);
  else if (act === "station") onOpenStation();
  else if (act === "station-close") onCloseStation();
  else if (act === "fleet") onOpenFleet();
  else if (act === "fleet-close") onCloseFleet();
  else if (act === "research") onOpenResearch();
  else if (act === "research-close") onCloseResearch();
  else if (act === "research-start" && b.dataset.tech) onDoResearchStart(b.dataset.tech);
  else if (act === "crew" && b.dataset.crew) { const parts = b.dataset.crew.split(":"); onDoCrewAssign(parts[0], Number(parts[1]) || 0); }
  else if (act === "crew") onOpenCrew();
  else if (act === "crew-close") onCloseCrew();
  else if (act === "commander" && b.dataset.id) onDoCommander(b.dataset.id);
  else if (act === "fleet-build" && b.dataset.type) onDoFleetBuild(b.dataset.type, Number(b.dataset.n) || 1);
  else if (act === "fleet-scrap" && b.dataset.type) onDoFleetScrap(b.dataset.type);
  else if (act === "station-mv-cancel") { onStMove = null; onRenderStation(); }
  else if (act === "station-pop-close") { if (Date.now() - onStPopOpenAt >= 350) onCloseStPop(); }
  else if (act === "station-pop-upgrade" && b.dataset.u) { if (Date.now() - onStPopOpenAt >= 350) onDoStationUpgrade(Number(b.dataset.u)); }
  else if (act === "station-pop-move" && b.dataset.u) {
    // Single-player Move toggle (game.js d.bmv): tap Move to arm the
    // move, tap it again to cancel; arming closes the popup so you can
    // tap a plot. The 350ms guard swallows the ghost click from the tap
    // that opened the popup.
    if (Date.now() - onStPopOpenAt < 350) { /* ghost click — ignore */ }
    else {
      const u = Number(b.dataset.u);
      onStMove = onStMove === u ? null : u;
      if (onStMove != null) onCloseStPop();
      onRenderStation();
    }
  }
  else if (act === "station-pop-place" && b.dataset.type && onStPop && onStPop.kind === "plot") { if (Date.now() - onStPopOpenAt >= 350) onDoStationBuild(b.dataset.type, onStPop.x, onStPop.y); }
  else if (act === "galaxy" && b.dataset.galaxy) onSetGalaxy(b.dataset.galaxy);
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
  // Backoff: if the backend is down (poll failing), stop hammering it —
  // a dead backend still burns rows on every invocation, and a tight
  // retry loop is how a quota gets eaten right after a reset.
  let onPollFails = 0;
  const onPoll = setInterval(async () => {
    if (!onReady) return;
    const okE = await onLoadEmpire();
    const okR = await onLoadRaids();
    if (onStationOpen) { await onLoadStation(); onRenderStation(); }
    if (onFleetOpen) { await onLoadFleet(); onRenderFleet(); }
    if (onResearchOpen) { await onLoadProgress(); onRenderResearch(); }
    if (onCrewOpen) { await onLoadProgress(); onRenderCrew(); }
    if (okE || okR) { onPollFails = 0; }
    else {
      onPollFails++;
      if (onPollFails >= 3) {
        clearInterval(onPoll);
        onToast("Server unreachable — polling paused. Reload to retry.");
      }
    }
    onRenderTop();
    if (onSelected == null) onRenderPanel();
  }, 15000);
  // Tick the raid-warning countdown live (only the number, so an open
  // tribute input never loses focus). Also the shipyard + research bars.
  setInterval(() => {
    if (!onReady) return;
    onFlTick();
    onResTick();
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
