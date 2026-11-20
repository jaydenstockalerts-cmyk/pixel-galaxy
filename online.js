// Pixel Galaxy — online mode client (v3.9.0).
// Talks to the Cloudflare Worker backend (shared galaxy, server-side
// empire). Single-player (game.js) is untouched; this module runs only
// when the saved mode is "online". The mode is picked once on the
// mode-select screen and saved in localStorage; switching clears it
// and reloads.
"use strict";

const ON_API = "https://pixel-galaxy-online.jaydenburnham.workers.dev";
// Galaxy (Jayden, Nov 18): one shared galaxy, "test-1" (the Beta).
// Staging ("staging-1") was removed the same day — it guarded a Beta
// with no real players yet and doubled every verification step, while
// both galaxies shared the same rows-read quota anyway. Its DO data is
// untouched on the backend, so it can come back as the picker entry
// when the beta gate lifts and real players join. Tokens, players and
// recovery codes are per-galaxy; onGalaxy() falls back to the Beta for
// any stored value no longer in the map (e.g. a saved "staging-1").
const ON_GALAXIES = { "test-1": "Beta Galaxy" };
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
let onAttackProd = "credits"; // v3.9.27: the production choice for the
// next conquest — picked on the attack card, reset when the selection
// changes (a stale choice from another system must never carry over).
const ON_PROD_LABEL = { credits: "Credits", energy: "Energy", metal: "Metal", crystal: "Crystal" };
// Four toggle buttons for a production choice. act "prod" picks the
// conquest production (local state, re-renders the card); act
// "setprod" changes an owned system's production immediately.
function onProdPickerHtml(cur, act, label) {
  // v3.9.38: compact 2x2 grid of small buttons (the old full-width obtns
  // pushed Crystal off the bottom of the sheet) — the label spans the
  // full row, the four resource buttons fill the 2x2 below it.
  return '<div class="prodpick"><small class="prodpick-label">' + (label || "Produces:") + '</small>' + ["credits", "energy", "metal", "crystal"].map((r) =>
    '<button class="obtn' + (cur === r ? ' sel' : '') + '" data-oact="' + act + '" data-prod="' + r + '">' + ON_PROD_LABEL[r] + '</button>'
  ).join("") + '</div>';
}
// Colonies (v3.9.42, Jayden: conquered systems ARE colonies now — the
// production choice is the colony's focus). Costs/durations mirror
// single-player colUpCost/colDur exactly: Lv L -> L+1 costs 50L metal,
// 30L crystal, 100L credits and takes 60L seconds. Max Lv 5.
const ON_COLONY_MAX = 5;
function onColUpCost(lv) { return { metal: 50 * lv, crystal: 30 * lv, credits: 100 * lv }; }
function onColUpDur(lv) { return 60 * lv; } // seconds
function onColCanAfford(cost) {
  const res = (onStation && onStation.res) || {};
  for (const r in cost) {
    const have = r === "credits" ? ((onEmpire && onEmpire.credits) || 0) : (res[r] || 0);
    if (have < cost[r]) return false;
  }
  return true;
}
// The colony upgrade row on an owned system's card: cost + time + button,
// an in-progress state while the timer runs, and a maxed-out state at Lv 5.
function onColonyUpgradeHtml(s) {
  const lv = s.colonyLevel || 1;
  if (lv >= ON_COLONY_MAX) return '<br><small>Colony Lv ' + ON_COLONY_MAX + ' — fully upgraded.</small>';
  if (s.colonyUpgradeTo != null) {
    return '<br><small>Upgrading to Lv ' + s.colonyUpgradeTo + ' — done in ' + onStLeft(Math.max(0, (s.colonyUpgradeDoneAt || 0) - Date.now())) + '.</small>';
  }
  const cost = onColUpCost(lv), dur = onColUpDur(lv);
  return '<div class="row"><div><b>Upgrade colony</b><br><small>Cost: ' + onFlCostStr(cost) + ' · ' + onStLeft(dur * 1000) + '</small></div><button class="obtn" data-oact="colony-upgrade"' + (onColCanAfford(cost) ? '' : ' disabled') + '>Upgrade</button></div>';
}
let onSpawned = false;
let onRaids = [];        // from /raids (pending/tribute_offered/resolved)
let onPrevRaidStatus = {}; // raid id -> status, to toast on resolution
let onLastRaidOutcome = null; // last resolved raid, kept visible until dismissed (v3.9.22: a 3.5s toast is invisible — raid 1's lost battle was never seen)
let onLastTransitOutcome = null; // last resolved attack transit, kept visible until dismissed (v3.9.26 — mirrors the raid report)
let onLastTransitReportAt = null; // newest transit report already shown (null until the first /empire load, so a stale report never pops on login)
let onLastBannerSig = null; // banner + selected-system signatures, so the
let onLastSelSig = null;    // 15s poll re-renders the panel when a raid or
                            // the selected system changed — even with a
                            // system card open (v3.9.22: the tribute popup
                            // never appeared while the card was open)
let onLastPanelKey = null; // card identity, so the panel scrolls to the
                            // top when the card changes (v3.9.26)
let onGalaxyVersion = null; // server galaxy version (v3.9.22): the map
                            // refetches only when ownership changed
let onEmpireAt = 0; // when the empire/station snapshots were fetched —
let onStationAt = 0; // the 1s ticker accrues from them so the ribbon
                     // ticks live between polls (v3.9.22)
let onPrevStation = null; // previous station/fleet snapshots, to toast
let onPrevFleet = null;   // build/ship completions once (v3.9.22)
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
function onHasJumpDrive() { return ((onProgress && onProgress.tech) || []).includes("j1"); }
// v3.9.37: Jump Drive extends attack/raid reach to 2 jumps from your
// empire; without it, only adjacent (1-jump) systems are attackable.
// A 2-jump target must go through a linked intermediate — a neighbour
// whose own links touch an owned system.
function onIsTwoJumps(sys) {
  if (onIsAdjacent(sys)) return false;
  const owned = onOwnedIds();
  return (sys.links || []).some((nb) => {
    const mid = onSysById[nb];
    return mid && (mid.links || []).some((x) => owned.has(x));
  });
}
function onIsInReach(sys) {
  if (onIsAdjacent(sys)) return true;
  return onHasJumpDrive() && onIsTwoJumps(sys);
}

// v3.9.47: next-target finder — the attackable systems from the player's
// current position, weakest first. Same rule as the gold rings and the
// Attack button: adjacent to an owned system, or 2 jumps away with the
// Jump Drive researched (onIsInReach); player-held systems are raids,
// not attacks, so they are excluded. The Dark Nexus is listed when in
// reach — it is attackable, unlike the gold rings which skip it because
// it is always visible. Capped at the weakest 8 to stay compact.
function onTargets() {
  const owned = onOwnedIds();
  return onSystems
    .filter((s) => !owned.has(s.id) && s.ownerType !== "player" && onIsInReach(s))
    .map((s) => ({ s, dist: onIsAdjacent(s) ? 1 : 2 }))
    .sort((a, b) => a.s.pw - b.s.pw);
}
function onTargetsCard() {
  if (!onSpawned) return "";
  const all = onTargets();
  const list = all.slice(0, 8);
  const rows = list.map(({ s, dist }) =>
    '<div class="tgt-row" data-oact="target-jump" data-sys="' + s.id + '"><span><b>' + esc(s.name) + '</b> · ' + esc(s.type || "") + '</span><small>' + s.pw + ' power · ' + dist + ' jump' + (dist > 1 ? "s" : "") + '</small></div>').join("");
  return '<div class="ocard"><h2>Next targets</h2><small>Weakest systems you can attack first — tap one to open it.</small>'
    + (rows || '<br><small>No systems in reach — take systems next to yours to expand.</small>')
    + (all.length > list.length ? '<br><small>…and ' + (all.length - list.length) + ' more in reach.</small>' : '')
    + '</div>';
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
let onShowResetConfirm = false; // show the "reset credits to 10" confirm card (v3.9.26)
let onSpawnName = "";   // custom Home World name typed on the welcome card
let onShowRename = false; // show the "rename Home World" input in the empire card
let onRenameName = "";  // rename input value, kept while typing (v3.9.23)

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
let onAuthPromise = null; // in-flight guest creation (v3.9.22): two
// concurrent onEnsureAuth calls used to mint two guests — the spawn
// could land on the orphaned one while the UI kept the other.
async function onEnsureAuth() {
  if (onToken && onPlayer) return true;
  if (onAuthPromise) return onAuthPromise;
  onAuthPromise = (async () => {
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
  })();
  try { return await onAuthPromise; }
  finally { onAuthPromise = null; }
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
  if (r.status === 200) {
    onEmpire = r.data; onEmpireAt = Date.now(); onSpawned = true; onToastRevolts(r.data.revolts);
    // v3.9.26: a transit report newer than the last one shown means an
    // attack resolved — surface it as a Battle report card (a 3.5s toast
    // is invisible). The first load only arms the watermark, so a stale
    // report never pops on login.
    const rep = (r.data.transitReports || [])[0];
    if (rep && rep.resolvedAt) {
      if (onLastTransitReportAt == null) { onLastTransitReportAt = rep.resolvedAt; }
      else if (rep.resolvedAt > onLastTransitReportAt) {
        onLastTransitReportAt = rep.resolvedAt;
        const sys = rep.systemName || "a system";
        let msg = "";
        if (rep.outcome === "attacker_won") msg = "Victory! " + sys + " is yours.";
        else if (rep.outcome === "attacker_lost") msg = "Defeat — your fleet was repelled at " + sys + ".";
        else if (rep.outcome === "cancelled") msg = "The attack on " + sys + " was called off — the fleet came home.";
        // v3.9.18 invariant: ship losses are always named, never "Nothing lost".
        if (msg && (rep.shipsLost || 0) > 0) msg += " Your fleet lost " + rep.shipsLost + " ship" + (rep.shipsLost > 1 ? "s" : "") + " in the battle.";
        if (msg) { onToast(msg); onLastTransitOutcome = { msg, at: Date.now(), transitId: rep.id }; }
      }
    }
    onMaybeTut();
    return true;
  }
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
      if (msg) {
        onToast(msg);
        // v3.9.22: keep the outcome visible until dismissed — the 3.5s
        // toast was the whole raid report, and the playtest's lost
        // battle was never seen at all. onRenderPanel shows it.
        onLastRaidOutcome = { msg, at: Date.now(), raidId: raid.id };
      }
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

// Travel time for an attack (v3.9.26, Jayden: attacks take time like
// single player): 10s + 5s per jump from the Home World, cap 60s.
// BFS over the client-side system graph — the same formula the server
// uses (travelMsForJumps in empire.js).
function onJumpsTo(id) {
  if (!onEmpire || onEmpire.homeSystem == null) return -1;
  const home = onEmpire.homeSystem;
  if (home === id) return 0;
  const seen = new Set([home]);
  let frontier = [home], d = 0;
  while (frontier.length) {
    d++;
    const next = [];
    for (const n of frontier) {
      const sys = onSysById[n];
      for (const nb of (sys && sys.links) || []) {
        if (nb === id) return d;
        if (!seen.has(nb)) { seen.add(nb); next.push(nb); }
      }
    }
    frontier = next;
  }
  return -1;
}
function onTravelMs(id) {
  const j = onJumpsTo(id);
  return Math.min(60000, (10 + 5 * Math.max(0, j)) * 1000);
}
function onTransitSecs() {
  const t = onEmpire && onEmpire.transit;
  return t ? Math.max(0, Math.ceil((t.arriveAt - Date.now()) / 1000)) : 0;
}

// The last resolved raid, kept visible until the player dismisses it
// (v3.9.22 — see onLoadRaids). A 3.5s toast was the whole report.
function onRaidOutcomeCard() {
  if (!onLastRaidOutcome) return "";
  return '<div class="ocard" style="border-color:#6ee7f5"><h2>Raid report</h2><p>'
    + esc(onLastRaidOutcome.msg) + '</p><button class="obtn ghost" data-oact="raid-outcome-dismiss">Dismiss</button></div>';
}

// The last resolved attack transit, kept visible until the player
// dismisses it (v3.9.26 — mirrors the raid report card).
function onTransitOutcomeCard() {
  if (!onLastTransitOutcome) return "";
  return '<div class="ocard" style="border-color:#6ee7f5"><h2>Battle report</h2><p>'
    + esc(onLastTransitOutcome.msg) + '</p><button class="obtn ghost" data-oact="transit-outcome-dismiss">Dismiss</button></div>';
}

// Signatures for the banner + selected system (v3.9.22): the poll
// re-renders the panel when either changed, even with a system card
// open — the tribute popup only appears on a re-render, and the poll
// used to skip it while a system was selected.
function onBannerSig() {
  return onRaids
    .filter((r) => (r.status === "pending" || r.status === "tribute_offered") && (r.defenderId === onPlayer || r.attackerId === onPlayer))
    .map((r) => [r.id, r.status, r.tributeAmount, r.systemName, r.isHomeWorld].join(":")).join("|");
}
function onSelSig() {
  if (onSelected == null) return "none";
  const s = onSysById[onSelected];
  const tr = onEmpire && onEmpire.transit ? onEmpire.transit.id : "-";
  return s ? [s.id, s.owner, s.ownerType, s.pw, JSON.stringify(s.garrison || {}), JSON.stringify(s.defence || {}), s.type, s.prod || "", s.colonyLevel || 0, s.colonyUpgradeTo || 0, s.colonyUpgradeDoneAt || 0, "tr:" + tr].join(":") : "gone:" + onSelected;
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
        + (raid.defence ? 'Your defence here: <b>' + raid.defence.total + '</b> (garrison ' + raid.defence.garrison + ((raid.defence.colony || 0) > 0 ? ' + colony ' + raid.defence.colony : '') + ' + fleet ' + raid.defence.fleet + '). ' : '')
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
  await onLoadStation();
  await onLoadProgress();
  await onLoadSystems();
  await onLoadRaids();
  await onLoadQuests();
  onRenderTop();
  onRenderPanel();
  onRenderActivity();
  onDrawGalaxy();
  onTutCheck();
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
    // v3.9.26: another real player's systems get their own colour —
    // vivid orange, distinct from every faction, neutral, and ring
    // colour — so a human empire is obvious at a glance.
    else if (s.ownerType === "player") { col = "#ff7a29"; r = 3; }
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
    // player) so the next move is obvious at a glance. v3.9.37: with Jump
    // Drive researched, 2-jump systems ring too.
    if (onSpawned && !mine && !isNexus && s.ownerType !== "player" && onIsInReach(s)) {
      q.strokeStyle = "#ffd84a";
      q.lineWidth = 2;
      q.beginPath();
      q.arc(p.x, p.y, Math.max(1.5, r * Math.min(3, onCam.zoom)) + 7, 0, Math.PI * 2);
      q.stroke();
    }
  });
  // Labels: Dark Nexus + your systems + selected system. Ported from
  // single-player drawBase (art.js): topmost label first; a label
  // overlapping one already placed lifts in jumps until clear (max 12,
  // capped 180px); a lifted label gets a leader line down to its dot.
  // v3.9.22 — labels used to pile on each other at spawn zoom, with no
  // backing, so they were unreadable.
  const fs = Math.max(11, Math.round(11 * Math.min(3, onCam.zoom)));
  q.font = "bold " + fs + "px sans-serif";
  q.textAlign = "center"; q.textBaseline = "middle";
  const hh = fs * 1.3;
  const cands = [];
  onSystems.forEach(s => {
    const mine = owned.has(s.id);
    // v3.9.26: zoomed in (zoom >= 4), also label systems you can attack
    // now — adjacent neutrals/factions (gold) and adjacent player
    // empires (orange: another real player's systems, raid targets).
    const attackable = onSpawned && !mine && s.id !== 0 && onIsInReach(s);
    if (s.id !== 0 && !mine && s.id !== onSelected && !(onCam.zoom >= 4 && attackable)) return;
    const p = onWorldToScreen(s.x, s.y);
    if (p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40) return;
    cands.push({ s, p, color: s.ownerType === "player" ? "#ff7a29" : (s.id === 0 || attackable) ? "#ffd84a" : "#6ee7f5" });
  });
  cands.sort((a, b) => a.p.y - b.p.y);
  const placed = [];
  const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  for (const c of cands) {
    const tw = q.measureText(c.s.name).width;
    const cx = Math.max(tw / 2 + 4, Math.min(w - tw / 2 - 4, c.p.x));
    // Label sits just above its dot when unlifted (baseline was p.y-10
    // before the middle-baseline switch — same look, now centred).
    let cy = c.p.y - 10 - hh / 2;
    const cy0 = cy;
    let jumps = 0;
    while (jumps < 12) {
      const r = { x0: cx - tw / 2 - 3, y0: cy - hh / 2, x1: cx + tw / 2 + 3, y1: cy + hh / 2 };
      const hit = placed.find((o) => overlap(r, o));
      if (!hit) break;
      const ny = hit.y0 - 2 - hh / 2;
      if (ny < cy0 - 180) break;
      cy = ny; jumps++;
    }
    // v3.9.26: keep the label inside the canvas — the old pass only
    // lifted up, so a dot near the top pushed its label off-screen
    // (it looked like the ribbon was covering it), and a crowded
    // frontier could still overlap once the 180px lift cap was hit.
    // If it can't fit above, drop it below its dot instead.
    const rectAt = (y) => ({ x0: cx - tw / 2 - 3, y0: y - hh / 2, x1: cx + tw / 2 + 3, y1: y + hh / 2 });
    const clearAt = (y) => y - hh / 2 >= 2 && y + hh / 2 <= h - 2 && !placed.some((o) => overlap(rectAt(y), o));
    if (!clearAt(cy)) {
      let below = c.p.y + 10 + hh / 2, bj = 0;
      while (bj < 12 && !clearAt(below)) {
        const hit = placed.find((o) => overlap(rectAt(below), o));
        if (!hit) break;
        below = hit.y1 + 2 + hh / 2; bj++;
      }
      if (clearAt(below)) cy = below;
      else cy = Math.max(hh / 2 + 2, Math.min(h - hh / 2 - 2, cy));
    }
    placed.push({ x0: cx - tw / 2 - 3, y0: cy - hh / 2, x1: cx + tw / 2 + 3, y1: cy + hh / 2 });
    if (Math.abs(cy0 - cy) > 30) {
      q.strokeStyle = "rgba(255,255,255,0.35)"; q.lineWidth = 1;
      q.beginPath(); q.moveTo(cx, cy < c.p.y ? cy + hh / 2 : cy - hh / 2); q.lineTo(c.p.x, c.p.y); q.stroke();
    }
    q.fillStyle = "#161628";
    q.fillRect(cx - tw / 2 - 3, cy - hh / 2, tw + 6, hh);
    q.fillStyle = c.color;
    q.fillText(c.s.name, cx, cy);
  }
}

// Zoom the galaxy map, keeping the world point under (px, py) fixed —
// mirrors single-player setZoom (game.js). Used by the mouse wheel.
function onSetZoom(z, px, py) {
  const cv = onCv();
  if (!cv) return;
  const wpt = (px !== undefined && py !== undefined) ? onScreenToWorld(px, py) : null;
  onCam.zoom = Math.max(0.5, Math.min(20, z));
  if (wpt) {
    const base = Math.min(cv.width, cv.height) / 2.3;
    const sc = base * onCam.zoom;
    onCam.cx = wpt.x - (px - cv.width / 2) / sc;
    onCam.cy = wpt.y - (py - cv.height / 2) / sc;
  }
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
    if (moved > 10 || pts.size === 2) onMarkGestureLearned(); // v3.9.35: pan/pinch dismisses the gesture hint (SP rule)
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
  // v3.9.22: mouse-wheel zoom toward the cursor, like single player —
  // the map had pinch only, so desktop players could not zoom at all.
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = cv.getBoundingClientRect();
    const dpr = cv.width / (rect.width || 1);
    const px = (e.clientX - rect.left) * dpr;
    const py = (e.clientY - rect.top) * dpr;
    onSetZoom(onCam.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), px, py);
    onDrawGalaxy();
  }, { passive: false });
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
    onSelected = best.id; onAttackProd = "credits";
    onRenderPanel();
    onDrawGalaxy();
  } else {
    onSelected = null;
    onRenderPanel();
    onDrawGalaxy();
  }
}

// ---------- top bar + empire panel ----------
// v3.9.20: the online ribbon is the single-player ribbon — the same four
// resource pills (.res/.pill, RICON copy: online.js cannot use game.js
// consts). onTab tracks the active tab in the bottom dock.
const ON_RICON = { energy: "⚡", metal: "▣", crystal: "◆", credits: "●" };
let onTab = "map";
function onRenderTop() {
  const el = onq("#o-res");
  if (!el) return;
  if (!onSpawned || !onEmpire) { el.innerHTML = ""; return; }
  const st = onStation, res = (st && st.res) || {}, pps = (st && st.productionPerSec) || {}, cap = (st && st.storageCap) || 0;
  // v3.9.22: accrue locally from the last fetch so the ribbon ticks live
  // between 15s polls (single player ticks every 250ms). The server
  // settles the same interval on the next read, so the display converges
  // instead of drifting; dt is capped at the 8h offline cap like the
  // server. Station resources pause at the cap, like single player.
  const dtE = onEmpireAt ? Math.max(0, Math.min(8 * 3600, (Date.now() - onEmpireAt) / 1000)) : 0;
  const dtS = onStationAt ? Math.max(0, Math.min(8 * 3600, (Date.now() - onStationAt) / 1000)) : 0;
  // v3.9.29: credits obey the storage cap too (server accrue caps them,
  // single player caps all four) — pause at/above the cap, never pull an
  // overflow down, and show the cap on the pill like the other three.
  const crBase = onEmpire.credits || 0, crNet = onEmpire.netPerSec || 0;
  const cr = Math.floor(cap > 0 && crNet >= 0 && crBase >= cap ? crBase : (cap > 0 ? Math.min(cap, Math.max(0, crBase + crNet * dtE)) : Math.max(0, crBase + crNet * dtE)));
  // v3.9.27: the station's productionPerSec does NOT include the
  // per-system production choices — those accrue server-side in
  // settleStation and arrive here as sysPerRes (per second). Fold them
  // into the local accrual and the pill rates so the ribbon ticks live.
  const sysR = (onEmpire && onEmpire.sysPerRes) || {};
  const acc = {};
  for (const k of ["energy", "metal", "crystal"]) {
    const v = (res[k] || 0) + ((pps[k] || 0) + (sysR[k] || 0)) * dtS;
    acc[k] = cap > 0 ? Math.min(cap, Math.max(0, v)) : Math.max(0, v);
  }
  const crRate = (onEmpire.netPerSec || 0) * 60;
  const pill = (key, val, rate, capV) => {
    const pct = capV > 0 ? Math.max(0, Math.min(1, val / capV)) : 0;
    return '<div class="pill"><span class="rlabel">' + key.toUpperCase() + '</span><span class="pline"><span class="ric dot-' + key + '">' + (ON_RICON[key] || "") + '</span><b>' + Math.floor(val) + '</b><span class="rate">' + (rate >= 0 ? "+" : "") + rate.toFixed(0) + '/min</span></span>'
      + (capV > 0 ? '<span class="sbar"><i style="width:' + Math.round(pct * 100) + '%"></i></span><span class="cap">of ' + Math.floor(capV) + '</span>' : '')
      + '</div>';
  };
  // v3.9.26: the expanded ribbon shows the income breakdown, like
  // single-player incomeParts — all per-minute, like the pills. The
  // tap handler toggles .expanded and the CSS shows #inc, but nothing
  // ever rendered the element, so the tap showed nothing.
  const pm = (v) => (v >= 0 ? "+" : "−") + Math.abs(v * 60).toFixed(1) + "/min";
  const e = onEmpire;
  const upkeep = (onStation && onStation.fleetEnergyUpkeepPerSec) || 0;
  let inc = '<div id="inc">';
  if (e.sysPerSec != null && e.hubPerSec != null) {
    inc += 'Credits: systems ' + pm(e.sysPerSec) + ' · Trade Hub ' + pm(e.hubPerSec);
    if ((e.upkeepPerSec || 0) > 0) inc += ' · upkeep −' + ((e.upkeepPerSec || 0) * 60).toFixed(1) + '/min';
    inc += ' · net ' + pm(e.netPerSec || 0);
  } else {
    inc += 'Credits: net ' + pm(e.netPerSec || 0);
  }
  inc += '<br>Energy: station ' + pm((pps.energy || 0) + upkeep);
  if ((sysR.energy || 0) > 0) inc += ' · systems ' + pm(sysR.energy);
  if (upkeep > 0) inc += ' · ship upkeep −' + (upkeep * 60).toFixed(1) + '/min';
  inc += '<br>Metal: station ' + pm(pps.metal || 0);
  if ((sysR.metal || 0) > 0) inc += ' · systems ' + pm(sysR.metal);
  inc += ' · Crystal: station ' + pm(pps.crystal || 0);
  if ((sysR.crystal || 0) > 0) inc += ' · systems ' + pm(sysR.crystal);
  // v3.9.46: upkeep warning — visible in the ribbon itself (not only in the expanded breakdown), whenever launched-ship upkeep exceeds energy production. pps.energy is NET (production minus upkeep), so net < 0 means upkeep wins.
  const eNet = (pps.energy || 0) + (sysR.energy || 0);
  const warn = upkeep > 0 && eNet < 0 ? '<div class="upkeep-warn">⚠ Ship upkeep exceeds energy production — build more Solar Arrays or scrap ships.</div>' : '';
  inc += '</div>';
  el.innerHTML = pill("energy", acc.energy, ((pps.energy || 0) + (sysR.energy || 0)) * 60, cap)
    + pill("metal", acc.metal, ((pps.metal || 0) + (sysR.metal || 0)) * 60, cap)
    + pill("crystal", acc.crystal, ((pps.crystal || 0) + (sysR.crystal || 0)) * 60, cap)
    + pill("credits", cr, crRate, cap) + inc + warn;
}

// ---------- activity tray (single-player #activity) ----------
// One line per timed job, visible on every view: building, shipyard,
// research. Data comes from the freshest state on hand (station queue,
// the /empire fleet summary, progress); the 1s ticker re-renders it so
// the countdowns tick.
// v3.9.50: the 1s ticker rebuilt the tray rows to tick the countdowns,
// so the tappable transit row was destroyed and recreated every second
// (same class as the panel rebuild above). Rebuild only when the job
// set changes; tick the countdowns in place.
let onActKey = null;
function onRenderActivity() {
  const el = onq("#o-activity");
  if (!el) return;
  const bq = (onStation && onStation.bq) || [];
  const sq = (onEmpire && onEmpire.fleet && onEmpire.fleet.sq) || [];
  const rq = (onProgress && onProgress.rq) || null;
  const tr = onEmpire && onEmpire.transit;
  const key = (bq.length ? bq[0].end : 0) + "|" + (sq.length ? sq[0].end : 0) + "|" + (rq ? rq.id + "@" + rq.end : 0) + "|" + (tr ? tr.arriveAt : 0);
  if (key !== onActKey) {
    onActKey = key;
    const rows = [];
    if (bq.length) {
      const j = bq[0];
      const bl = (onStation.bl || []).find((z) => z.u === j.u);
      const nm = bl ? ON_ST_B[bl.t].name : "Building";
      rows.push("🔨 " + nm + " Lv " + (bl ? bl.l + 1 : "?") + " — done in <span data-ocd=\"bq\"></span>");
    }
    if (sq.length) {
      const j = sq[0];
      const nm = (ON_FL_SHIPS[j.k] && ON_FL_SHIPS[j.k].name) || j.k;
      rows.push("🚀 " + nm + " — done in <span data-ocd=\"sq\"></span>");
    }
    if (rq) {
      const t = (typeof TECH !== "undefined" ? TECH : []).find((z) => z.id === rq.id);
      rows.push("⚙ " + (t ? t.n : rq.id) + " — done in <span data-ocd=\"rq\"></span>");
    }
    if (tr) {
      rows.push('<span data-oact="transit-jump" data-sys="' + tr.systemId + '" style="text-decoration:underline">🚀 Fleet en route — ' + esc(tr.systemName || "a system") + ' — arrives in <span data-ocd="tr"></span></span>');
    }
    if (!rows.length) { el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    el.innerHTML = rows.map((r) => '<div class="trayrow">' + r + '</div>').join("");
  }
  const tick = (k, end) => { const sp = el.querySelector('[data-ocd="' + k + '"]'); if (sp) sp.textContent = onStLeft(Math.max(0, end - Date.now())); };
  if (bq.length) tick("bq", bq[0].end);
  if (sq.length) tick("sq", sq[0].end);
  if (rq) tick("rq", rq.end);
  if (tr) tick("tr", tr.arriveAt);
}

// ---------- tab dock (single-player #tabs) ----------
// Galaxy / Station / Fleet / Research / Quests / Syndicate switch views
// (v3.9.27: Crew is gone — Jayden removed crew assignment; commanders
// live on Research now. v3.9.31: Quests opens its panel, like single
// player. v3.9.52: Syndicate opens its panel, online only.)
// v3.9.26: every view is a full-screen overlay at the same z-index, so
// the DOM order decides what paints on top — switching tabs used to
// leave the old view visible (research is last in the DOM, so
// research→anything never looked like it switched; fleet→station
// failed the same way).
// Close the other overlays FIRST, synchronously, then load and open.
// onTabGen guards the async race: if the player taps another tab while
// a load is in flight, the stale load's open is dropped.
let onTabGen = 0;
function onSetTab(t) {
  onTab = t;
  document.querySelectorAll("#o-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.otab === t));
}
function onCloseAllOverlays() {
  onCloseStation(); onCloseFleet(); onCloseResearch(); onCloseQuests(); onCloseSyndicate();
  onSetTab("map");
  onRefresh();
}
function onShowTab(t) {
  onTabGen++;
  if (t === "map") { onCloseAllOverlays(); return; }
  onCloseStation(); onCloseFleet(); onCloseResearch(); onCloseQuests(); onCloseSyndicate();
  onSetTab(t);
  const gen = onTabGen;
  if (t === "station") onOpenStation(gen);
  else if (t === "fleet") onOpenFleet(gen);
  else if (t === "research") onOpenResearch(gen);
  else if (t === "quests") onOpenQuests(gen);
  else if (t === "syndicate") onOpenSyndicate(gen);
}

// ---------- online menu (single-player #menu) ----------
function onOpenMenu() {
  const m = onq("#o-menu"), bk = onq("#o-menubk");
  if (!m) return;
  m.hidden = false; if (bk) bk.hidden = false;
  const g = onq("#o-menu-gal");
  if (g) g.textContent = onGalaxyName();
  requestAnimationFrame(() => m.classList.add("open"));
}
function onCloseMenu() {
  const m = onq("#o-menu"), bk = onq("#o-menubk");
  if (!m) return;
  m.classList.remove("open");
  setTimeout(() => { m.hidden = true; if (bk) bk.hidden = true; }, 220);
}

// v3.9.50: the 15s poll re-rendered the panel (and the outcome banner)
// unconditionally, so the Recovery/Rename buttons and the outcome
// Dismiss were destroyed and recreated every 15s — and a half-typed
// recovery code was wiped outright (o-rec-code has no synced var,
// unlike the name inputs, which only keep their VALUE, not focus).
// Assign only when the HTML actually changed, and if a panel input
// had focus, give it back (caret to end).
let onLastPanelHtml = null, onLastOutcomeHtml = null;
function onSetPanel(html) {
  const el = onq("#o-panel");
  if (!el || html === onLastPanelHtml) return;
  const foc = document.activeElement && document.activeElement.id;
  onLastPanelHtml = html;
  el.innerHTML = html;
  if (foc === "o-rename-name" || foc === "o-rec-code" || foc === "o-spawn-name") {
    const inp = onq("#" + foc);
    if (inp) { inp.focus(); try { const n = inp.value.length; inp.setSelectionRange(n, n); } catch (e) {} }
  }
}
function onRenderPanel() {
  const el = onq("#o-panel");
  if (!el) return;
  // v3.9.38: the Battle report lives in #o-outcome (a top banner above the
  // tab overlays), not in the panel — the Fleet/Research/Quests overlays
  // (z-index 15) covered the panel, so its Dismiss button was untappable
  // from any tab but Galaxy. Rendered here (before every early return)
  // so the report is always current, and hidden when there is none.
  const oc = onq("#o-outcome");
  if (oc) { const o = onRaidOutcomeCard() + onTransitOutcomeCard(); if (o !== onLastOutcomeHtml) { onLastOutcomeHtml = o; oc.innerHTML = o; } oc.hidden = !o; }
  // v3.9.38: the system card is a centered popup (#o-syspop), not a panel
  // card — hide it whenever nothing is selected.
  if (onSelected == null) { const p = onq("#o-syspop"); if (p) p.hidden = true; }
  // v3.9.26: the panel is a 38vh scroller and innerHTML swaps never
  // reset its scroll position — a new card opened mid-scroll, showing
  // its middle ("empire power." with the top cut off). Reset to the
  // top whenever the card identity changes.
  const panelKey = onShowRecovery ? "recovery" : onShowResetConfirm ? "reset" : !onSpawned ? (onShowRecoverForm ? "recover-form" : "welcome") : (onSelected != null ? "sys:" + onSelected : "empire");
  if (panelKey !== onLastPanelKey) { el.scrollTop = 0; onLastPanelKey = panelKey; const pb = onq("#o-syspop-body"); if (pb) pb.scrollTop = 0; }
  if (onShowRecovery) { onSetPanel(onRecoveryCard()); return; }
  if (onShowResetConfirm) { onSetPanel('<div class="ocard"><h2>Reset credits to 10?</h2><p>This sets your credits to 10 — the fresh-spawn amount. It wipes the balance you banked under the old economy, and it can\'t be undone.</p><button class="obtn" data-oact="reset-credits-go">Reset credits</button> <button class="obtn ghost" data-oact="reset-credits-cancel">Cancel</button></div>'); return; }
  if (!onSpawned) {
    if (onShowRecoverForm) {
      onSetPanel('<div class="ocard"><h2>Recover your empire</h2><p>Enter the recovery code you saved when you started. It works on any device.</p><input id="o-rec-code" type="text" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters"><br><button class="obtn" data-oact="recover-go">Recover empire</button> <button class="obtn ghost" data-oact="recover-cancel">Cancel</button>' + (onRecoverErr ? '<br><small style="color:#ff8a80">' + esc(onRecoverErr) + '</small>' : '') + '</div>');
      return;
    }
    onSetPanel('<div class="ocard"><h2>Welcome to the shared galaxy</h2><p>One massive galaxy, 1,000 systems, every spawn exactly 15 jumps from the Dark Nexus. Battle to take systems, grow your empire, fight the five factions.</p><p><small>Name your Home World (optional — leave blank to keep the galaxy\'s name):</small><br><input id="o-spawn-name" type="text" placeholder="e.g. New Terra" maxlength="24" autocomplete="off" value="' + esc(onSpawnName) + '"></p><button class="obtn" data-oact="spawn">Found your Home World</button><br><br><button class="obtn ghost" data-oact="recover">Recover an empire</button></div>');
    return;
  }
  const sel = onSelected != null ? onSysById[onSelected] : null;
  const banner = onRaidBanner();
  // v3.9.22: record what the panel currently shows, so the poll can
  // tell when a raid or the selected system changed underneath it.
  onLastBannerSig = onBannerSig();
  onLastSelSig = onSelSig();
  // v3.9.38: the selected system renders into the centered #o-syspop
  // popup (title + X in the pinned header, card content in the scrolling
  // body). The panel falls through to the empire card behind the dimming
  // overlay. The poll re-renders the popup body whenever the sig changes
  // (ownership flips to Yours after a victory without reopening), and
  // the 1s ticker ticks the transit countdown live.
  if (sel) {
    const pop = onq("#o-syspop");
    if (pop) {
      pop.hidden = false;
      const t = onq("#o-syspop-title"); if (t) t.textContent = sel.name;
      const b = onq("#o-syspop-body"); if (b) b.innerHTML = onSystemCard(sel);
    }
  }
  const e = onEmpire || {};
  const over = Math.max(0, (e.count || 0) - (e.softCap || 25));
  onSetPanel(banner + '<div class="ocard"><h2>Your empire</h2><small>' + esc(onGalaxyName()) + '</small>'
    + '<small>Credits <b>' + Math.floor(e.credits || 0) + '</b> · Power <b>' + Math.round(e.power || 0) + '</b> · Systems <b>' + (e.count || 0) + ' / ' + (e.softCap || 25) + '</b></small><br>'
    + '<small>Income <b>+' + (e.grossPerSec != null ? e.grossPerSec.toFixed(2) : "?") + '/s</b>'
    + (e.upkeepPerSec ? ' · Upkeep <b>−' + (e.upkeepPerSec * 60).toFixed(1) + '/min</b>' : '')
    + ' · Net <b>' + (e.netPerSec != null ? (e.netPerSec >= 0 ? "+" : "") + e.netPerSec.toFixed(2) + '/s' : "?") + '</b></small>'
    + (over > 0 ? '<br><small>Over the soft cap by <b>' + over + '</b> — upkeep <b>−' + ((e.upkeepPerSec || 0) * 60).toFixed(1) + ' credits/min</b> and rebellion risk is <b>' + Math.round((e.rebellionRisk || 0) * 100) + '%</b> (3% per extra system).</small>' : '')
    + '<br><small><b>Next step:</b> ' + onNextStep() + '</small>'
    + '<br><button class="obtn ghost" data-oact="recovery">Recovery code</button> <button class="obtn ghost" data-oact="rename">Rename Home World</button>'
    + '<br><small>Map: <span style="color:#ff7a29">orange dots</span> are other players\' empires; <span style="color:#ffd84a">gold rings</span> mark systems you can attack.</small>'
    + (onShowRename ? '<br><small>Rename your Home World (1–24 characters):</small><br><input id="o-rename-name" type="text" maxlength="24" autocomplete="off" value="' + esc(onRenameName) + '"> <button class="obtn" data-oact="rename-save">Save name</button> <button class="obtn ghost" data-oact="rename-cancel">Cancel</button>' : '')
    + '</div>' + onTargetsCard());
}

// Next best step (single-player nextStep(), corrected order — v3.9.35
// playtest fix): a Hangar needs 60 crystal (0/min income at spawn) and
// fighters need credits (0/min), so the real order is Mine, then Hub,
// then Hangar, then ships, then attack a gold-ringed system. The v3.9.35
// tutorial teaches this order, and this line matches it.
function onNextStep() {
  const f = (onEmpire && onEmpire.fleet) || null;
  if (!f) return 'tap a system with a <b>gold ring</b> — those are next to your empire and ready to attack. Green dots are the outer rim, your spawn ground.';
  if ((onQuests || []).some((q) => q.status === "claimable")) return 'a quest is ready to claim — check the <b>Quests</b> tab.';
  const b = (onStation && onStation.b) || {};
  if (!b.mine) return 'build a <b>Crystal Mine</b> to start earning crystal.';
  if (!b.hub) return 'build a <b>Trade Hub</b> to start earning credits.';
  if ((f.hangarLv || 0) < 1) return 'build a <b>Hangar</b> at your station to start building ships.';
  const total = ((f.ships || {}).fighter || 0) + ((f.ships || {}).cruiser || 0) + ((f.ships || {}).capital || 0);
  if (total === 0) return 'build a <b>Fighter</b> in Fleet to start your fleet.';
  return 'tap a system with a <b>gold ring</b> — those are next to your empire and ready to attack. Green dots are the outer rim, your spawn ground.';
}


// ---------- online tutorial (v3.9.35) ----------
// Adapts the single-player 16-step tutorial (game.js TUT_STEPS) for the
// shared galaxy. Same structure and step flow — welcome, resources,
// station, mine, quests, hub, hangar, fighters, conquest, command,
// research, commander, empire/rivals, colonies/garrison, raids/tribute,
// ready — with two deliberate differences:
//  - Order is Mine -> Hub -> Hangar (the v3.9.29 playtest proved the
//    old "Hangar first" guidance wrong: a Hangar needs 60 crystal at
//    0/min income, and fighters need credits at 0/min). onNextStep()
//    above teaches the same order once the tutorial is done.
//  - The diplomacy step is DROPPED (no online diplomacy) and replaced
//    with a raids/tribute step; "Conquer the Pirate Outpost" becomes
//    "Conquer your first system"; the colony-focus step is the planet
//    production choice picker at conquest.
// Completion is stored server-side (empires.tutorial_done, POST
// /tutorial/done) so a finished player never replays it on another
// device. Skip marks it done (single-player rule); Later hides it and
// resumes the saved step (localStorage, same as single player).
const ON_TUT_STEP_KEY = "pixelgalaxy-tutorial-online-v3-step";
const ON_TUT_COL_KEY = "pixelgalaxy-tut-online-collapsed";
const ON_TUT_STEPS = [
{t:"Welcome, Commander",tab:"map",b:"Your job: build up your home station, train a fleet, and conquer systems all the way to the Dark Nexus, the big boss at the far edge of the galaxy — one massive shared galaxy, 1,000 systems, every spawn exactly 15 jumps from the Nexus. This guide walks you through it, step by step. You can skip it any time, or tap Later to hide it and pick up where you left off."},
{t:"Your resources",tab:"map",hl:"#o-res",b:"Energy, metal, crystal and credits live at the top. Buildings make them every second — a Solar Array makes energy, a Metal Foundry makes metal, a Crystal Mine digs crystal, a Trade Hub earns credits. Each one has a storage limit: upgrade the Command Station to store more. Tap the bar to see the details."},
{t:"Your station",tab:"station",hl:"#o-station",b:"This is your home station. Tap a building to see what it does, or tap open land to build something new. Plots unlock as you upgrade the Command Station — the city grows outward from the keep in the middle."},
{t:"Build a Crystal Mine",tab:"station",hl:"#o-station",act:true,b:"Let's build. Tap any open plot, then tap Crystal Mine. It costs 50 metal and 20 energy and takes about half a minute — watch the tray while it builds. Crystal is what everything else needs, so the mine comes first.",done:()=>((onStation && onStation.b && onStation.b.mine) || 0) >= 1},
{t:"Quests pay you",tab:"quests",hl:"#o-quests",act:true,b:"Quests are jobs with rewards. You just earned one for the Crystal Mine — tap Claim to collect 40 metal. Free resources are the fastest way to grow early on.",bAlt:"Quests are jobs with rewards. Tap Claim on any quest you see to collect its reward — free resources are the fastest way to grow early on.",bAltWhen:()=>{const q=(onQuests||[]).find((z)=>z.id==="q1");return !q||q.status==="claimed"||q.status!=="claimable";},done:()=>onTutClaimed()>onTut.baseQ||(onTutClaimed()>0&&!(onQuests||[]).some((q)=>q.status==="claimable"))},
{t:"Build a Trade Hub",tab:"station",hl:"#o-station",act:true,b:"Credits are the slow resource — fighters cost credits, and a Hangar needs crystal. A Trade Hub earns about 4 credits a minute, forever. Tap open land and build one — it costs 60 metal and 40 crystal. Your mine is digging the crystal now.",done:()=>((onStation && onStation.b && onStation.b.hub) || 0) >= 1},
{t:"Build a Hangar",tab:"station",hl:"#o-station",act:true,b:"Fighters live in a Hangar, and a Hangar needs 60 crystal. Your mine digs about 4 or 5 crystal a minute — watch the crystal number at the top climb. When it hits 60, tap open land and build the Hangar.",done:()=>((onStation && onStation.b && onStation.b.hangar) || 0) >= 1},
{t:"Build 4 Fighters",tab:"fleet",hl:"#o-fleet",act:true,b:"A Fighter costs 20 energy and 10 credits, and counts as 1.5 power against swarm fleets — 4 of them give you 6 power against a rim system's 5. Build two first, then open Quests and claim 'Launch your first ship' (30 credits, 60 energy) and build two more.",done:()=>(((onEmpire && onEmpire.fleet && onEmpire.fleet.ships) || {}).fighter || 0) >= 4},
{t:"Conquer your first system",tab:"map",hl:"#ocv",act:true,b:"Go to the Galaxy tab, tap a system with a gold ring, and tap Attack. With 4 Fighters you should win — and you'll loot metal and credits. If you lose, rebuild and try again. Claim the 80-credit quest reward afterwards: you'll need it for research.",done:()=>((onEmpire && onEmpire.count) || 0) >= 2},
{t:"The Command Station",tab:"station",hl:"#o-station",act:true,b:"Tap the keep in the middle of your station. Upgrading it raises building limits and storage, and unlocks more plots. An upgrade is a timed job — it shows in the tray above the bottom bar, just like the mine did. It costs 168 metal, 112 crystal and 56 credits. If that's more than you have right now, that's normal — keep building and come back to it.",seen:()=>!!(onStPop && onStPop.kind === "building" && (((onStation && onStation.bl) || []).find((z)=>z.u===onStPop.u) || {}).t === "command"),done:()=>onTut.seen && !onStPop},
{t:"Research Laser Cannons",tab:"research",hl:"#o-research",act:true,b:"The Research tab lists all 18 technologies. Locked ones are greyed out and say what they need — Laser Cannons is ready now. It costs 300 credits and 120 crystal and takes three minutes. If the button is greyed out, wait for your Trade Hub to earn credits, or claim unclaimed quest rewards.",done:()=>((onProgress && onProgress.tech) || []).includes("w1") || (onProgress && onProgress.rq && onProgress.rq.id === "w1")},
{t:"Hire a commander",tab:"research",hl:"#o-research",act:true,b:"Commanders live on the Research tab, below the tech tree. Hiring one costs credits and boosts your whole empire — more fleet power, faster builds, or better research, depending on who you pick. Hire any commander to finish this step.",done:()=>((onProgress && onProgress.commanders) || []).some((c)=>c.hired)},
{t:"Your empire and your rivals",tab:"empire",b:"This is your Empire card — it is always on the Galaxy tab when nothing is selected. Five rival factions hold territory out there. They don't expand like they do in single player, but systems inside their areas can revolt and flip back, and other players can raid you. There is no win screen here — the galaxy is endless. Grow, conquer, and hold what you take."},
{t:"Colonies and garrisons",tab:"map",hl:"#ocv",b:"A system you conquer becomes a colony. Pick what it produces — credits, energy, metal or crystal — and it earns for you, more as its colony level grows. It also adds defence. Station ships there as a garrison: tap a system you own to see its Garrison section. Garrisons defend at full strength, and half your home fleet rushes to help."},
{t:"Raids and tribute",tab:"map",hl:"#ocv",b:"Other players can raid your systems, and you can raid theirs. A raid gives you a 90-second warning — you can offer tribute to buy it off, or fight it out. If you lose a system, it's theirs; if they raid your Home World, they loot 10% of your credits (capped at 500) but can never take it. A strong home fleet, plus garrisons on your systems, repels them."},
{t:"You're ready, Commander",tab:"map",b:"That's the whole loop: build, research, conquer, repeat — all the way to the Dark Nexus. If you ever forget something, 'How to play' in the menu brings this guide back. Good luck out there."}
];
function onTutClaimed() { return (onQuests || []).filter((q) => q.status === "claimed").length; }
let onTut = { i: 0, open: false, seen: false, manual: false, baseQ: 0, doneAtEntry: false };
let onTutShown = false; // shown once per session (onMaybeTut guard)
let onTutLift = -1;
function onTutSaveStep() { try { localStorage.setItem(ON_TUT_STEP_KEY, String(onTut.i)); } catch (e) {} }
function onTutLoadStep() { try { const n = parseInt(localStorage.getItem(ON_TUT_STEP_KEY) || "0", 10); return isFinite(n) ? Math.max(0, Math.min(ON_TUT_STEPS.length - 1, n)) : 0; } catch (e) { return 0; } }
function onTutClearHl() { try { document.querySelectorAll(".tut-hl").forEach((e) => e.classList.remove("tut-hl")); } catch (e) {} }
function onTutSetCollapsed(c) { const el = onq("#o-tut"); if (el) el.classList.toggle("collapsed", !!c); const b = onq("#o-tut-col"); if (b) b.textContent = c ? "⌃" : "⌄"; try { localStorage.setItem(ON_TUT_COL_KEY, c ? "1" : "0"); } catch (e) {} }
function onTutNarrow() { try { return (window.innerWidth || 999) <= 560; } catch (e) { return false; } }
function onTutLayout() {
  if (!onTut.open) return;
  // While a station popup or a system card is open, collapse the tutorial
  // card to a slim bar (single-player tutLayout) — the popup/card sits
  // above the card and used to cover its top half.
  const tp = onq("#o-tut"); if (tp) tp.classList.toggle("pop-open", !!onStPop || onSelected != null);
  const a = onq("#o-activity");
  const lift = (a && !a.hidden) ? Math.round(a.offsetHeight || 0) + 20 : 24;
  if (lift !== onTutLift) { onTutLift = lift; const el = onq("#o-tut"); if (el) el.style.bottom = "calc(var(--dock-h) + " + lift + "px)"; }
}
function onTutRender() {
  const el = onq("#o-tut"); if (!el) return;
  const stp = ON_TUT_STEPS[onTut.i];
  if (stp.tab === "empire") { if (onTab !== "map") onShowTab("map"); }
  else if (stp.tab && stp.tab !== onTab) onShowTab(stp.tab);
  onTutClearHl();
  if (stp.hl) { const h = onq(stp.hl); if (h) h.classList.add("tut-hl"); }
  const t = onq("#o-tut-title"), b = onq("#o-tut-body"), s = onq("#o-tut-step"), d = onq("#o-tut-dots"), nx = onq("#o-tut-next"), bk = onq("#o-tut-back");
  if (t) t.textContent = stp.t;
  if (b) b.textContent = (stp.bAlt && stp.bAltWhen && stp.bAltWhen()) ? stp.bAlt : stp.b;
  if (s) s.textContent = "Step " + (onTut.i + 1) + " of " + ON_TUT_STEPS.length + " · " + stp.t;
  // doneAtEntry: was this step already complete when we arrived?
  // Forward entry + already done => completes immediately (old saves
  // skip ahead). Backward entry + already done => stay put (the player
  // is re-reading; Next moves on). Same rule as single player.
  onTut.doneAtEntry = false; if (stp.done) { try { onTut.doneAtEntry = !!stp.done(); } catch (e) { onTut.doneAtEntry = false; } }
  if (d) d.innerHTML = ON_TUT_STEPS.map((_, k) => '<span class="dot' + (k === onTut.i ? " on" : "") + '"></span>').join("");
  if (nx) nx.textContent = onTut.i === ON_TUT_STEPS.length - 1 ? "Done" : (stp.act && !onTut.doneAtEntry) ? "Skip this step" : "Next ›";
  if (bk) bk.disabled = onTut.i === 0;
  el.classList.toggle("mini", !!stp.act);
  let col; try { const p = localStorage.getItem(ON_TUT_COL_KEY); col = p === "1" ? true : p === "0" ? false : onTutNarrow(); } catch (e) { col = onTutNarrow(); }
  el.classList.toggle("collapsed", col); const cb = onq("#o-tut-col"); if (cb) cb.textContent = col ? "⌃" : "⌄";
  onTutSaveStep();
  onTutLift = -1; onTutLayout();
}
function onTutAdvance() { if (onTut.i >= ON_TUT_STEPS.length - 1) { onCloseTut(true); return; } onTut.i++; onTut.seen = false; onTut.manual = false; onTut.baseQ = onTutClaimed(); onTutRender(); }
function onTutBack() { if (onTut.i > 0) { onTut.i--; onTut.seen = false; onTut.manual = true; onTut.baseQ = onTutClaimed(); onTutRender(); } }
let onTutSkipMsg = 0; // throttle the auto-skip notice (at most once per 4s)
function onTutCheck() {
  if (!onTut.open) return;
  onTutLayout();
  const stp = ON_TUT_STEPS[onTut.i];
  if (!stp || !stp.done) return;
  if (stp.seen && !onTut.seen) { try { if (stp.seen()) onTut.seen = true; } catch (e) {} }
  let d = false; try { d = !!stp.done(); } catch (e) { d = false; }
  if (d && !(onTut.manual && onTut.doneAtEntry)) { if (Date.now() - onTutSkipMsg > 4000) { onTutSkipMsg = Date.now(); onToast("Tutorial skipped ahead — those steps were already done."); } onTutAdvance(); }
}
function onShowTut(i) { onTut = { i: Math.max(0, Math.min(ON_TUT_STEPS.length - 1, i || 0)), open: true, seen: false, manual: false, baseQ: onTutClaimed(), doneAtEntry: false }; const el = onq("#o-tut"); if (el) el.hidden = false; onTutRender(); }
function onCloseTut(done) {
  onTut.open = false; onTut.seen = false;
  const el = onq("#o-tut"); if (el) { el.hidden = true; el.classList.remove("mini"); el.style.bottom = ""; }
  onTutClearHl(); onTutLift = -1;
  if (done) {
    // Server-side completion (a finished player never replays it on
    // another device). Fire-and-forget; set the local flag too so the
    // next poll can't re-show it before the round-trip lands.
    if (onEmpire) onEmpire.tutorialDone = 1;
    try { localStorage.removeItem(ON_TUT_STEP_KEY); } catch (e) {}
    onApi("/tutorial/done", "POST").catch(() => {});
  }
}
function onMaybeTut() {
  if (onTutShown || onTut.open || !onSpawned || !onEmpire) return;
  if ((onEmpire.tutorialDone || 0) === 1) return;
  onTutShown = true;
  onShowTut(onTutLoadStep());
}

// ---------- gesture hint (v3.9.35 amendment) ----------
// Single player dismisses the "Drag to pan · pinch to zoom" chips the
// first time the player actually pans or pinches on either map, and they
// stay gone (localStorage "pixelgalaxy-gesture-hint"). Online kept its
// station hint line up permanently. Mirror single player: panning or
// pinching on EITHER online map marks it learned, and the station hint
// hides (same key, same mechanism).
function onGestureHintDone() { try { return localStorage.getItem("pixelgalaxy-gesture-hint") === "1"; } catch (e) { return false; } }
function onMarkGestureLearned() {
  if (onGestureHintDone()) return;
  try { localStorage.setItem("pixelgalaxy-gesture-hint", "1"); } catch (e) {}
  const hg = onq("#o-st-hint"); if (hg) hg.hidden = true;
}

function onSystemCard(s) {
  const owned = onOwnedIds();
  const mine = owned.has(s.id);
  const isNexus = s.id === 0;
  const adj = onIsAdjacent(s);
  const inReach = onIsInReach(s);
  const reachNote = !inReach
    ? (onIsTwoJumps(s) ? '2 jumps away — research <b>Jump Drive</b> to reach it.' : 'Not adjacent to your empire — take systems next to yours to reach them.')
    : '';
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
  const flLine = inReach && !mine
    ? '<br><small>Your fleet power vs this system: <b>' + Math.round(flPowerVs) + '</b> (defence ' + s.pw + ').'
      + (flPowerVs <= 0 ? ' You have no ships — build a Hangar and Fighters in Fleet first.' : '')
      + '</small>'
    : '';
  let owner = "Neutral";
  if (mine) owner = "Yours";
  else if (s.ownerType === "faction") owner = FAC_NAME[s.owner] || s.owner;
  else if (s.ownerType === "player") owner = "Another player";
  // v3.9.38: the card renders into the centered #o-syspop popup — the
  // popup header carries the system name + X, so the card itself has no
  // outer ocard wrapper and no h2.
  let html = '<small>Ring ' + s.ring + ' · ' + esc(s.type || "") + ' · Power <b>' + s.pw + '</b> · ' + esc(owner) + '</small><br>';
  if (isNexus) html += '<small>The Dark Nexus — power 5000, the endgame. Holding it is a tournament objective, not just a conquest.</small><br>';
  if (mine) {
    // Single player: the station lives ONLY at the Home World — other
    // systems are colonies, not stations (Jayden, Nov 18). The station
    // button shows only on the Home World card.
    const isHome = onEmpire && onEmpire.homeSystem === s.id;
    // v3.9.30: garrisons are ships now (single-player style) — Send 1 /
    // Recall 1 per type, straight from the home fleet. No text box, no
    // credit cost, no upkeep. Each stationed ship cuts this system's
    // revolt chance: Fighter -1%, Cruiser -3%, Capital -8%.
    // v3.9.34: garrisons DO defend against raids now (SP sysDef) — the
    // Defence line below shows the number the battle resolves against.
    const gs = s.garrison || {};
    const homeShips = (onEmpire && onEmpire.fleet && onEmpire.fleet.ships) || {};
    const garRows = isHome ? "" : ["fighter", "cruiser", "capital"].map((k) => {
      const d = ON_FL_SHIPS[k], n = gs[k] || 0, home = homeShips[k] || 0;
      return '<div class="row"><div><b>' + d.name + '</b> ×' + n + ' stationed<br><small>Home fleet: ' + home + '</small></div><div class="bg">'
        + '<button class="obtn" data-oact="garrison-send" data-type="' + k + '"' + (home < 1 ? " disabled" : "") + '>Send 1</button>'
        + '<button class="obtn" data-oact="garrison-recall" data-type="' + k + '"' + (n < 1 ? " disabled" : "") + '>Recall 1</button>'
        + '</div></div>';
    }).join("");
    html += '<small>This system is yours.</small>'
      + (isHome ? '' : '<br><small>Your station is at your Home World — this system pays income and can be garrisoned.</small>')
      + (isHome ? '' : '<br><small><b>Colony Lv ' + (s.colonyLevel || 1) + '</b> — earns <b>+' + (ON_SYS_INC * 60 * (s.colonyLevel || 1)).toFixed(1) + ' ' + esc(ON_PROD_LABEL[s.prod] || "Credits") + '/min</b>, +15 defence per level.</small>' + onColonyUpgradeHtml(s) + onProdPickerHtml(s.prod || "credits", "setprod", "Colony focus:"))
      + (isHome ? '' : '<br><small><b>Garrison</b> — ships stationed here keep this system loyal: Fighter -1%, Cruiser -3%, Capital -8% revolt chance each.</small>' + garRows)
      + (s.defence ? (isHome
          ? '<br><small><b>Home defence: ' + s.defence.total + '</b> (your full fleet ×1.2).</small>'
          : '<br><small><b>Defence here: ' + s.defence.total + '</b> (garrison ' + s.defence.garrison + ((s.defence.colony || 0) > 0 ? ' + colony ' + s.defence.colony : '') + ' + fleet ' + s.defence.fleet + ').</small>')
        : '');
  } else if (s.ownerType === "faction") {
    if (!inReach) html += '<small>' + reachNote + '</small>';
    else html += '<small>' + (adj ? 'Adjacent to your empire.' : '2 jumps away — Jump Drive.') + ' Attack to take it from ' + esc(owner) + '.</small>' + flLine + '<br>'
      + '<small>Travel time: ' + Math.ceil(onTravelMs(s.id) / 1000) + 's from Home World.</small><br>'
      + ((onEmpire && onEmpire.transit) ? '<small>Your fleet is en route to <b>' + esc(onEmpire.transit.systemName || "") + '</b> — arrives in ' + '<span id="o-sys-transit-left">' + onTransitSecs() + 's</span>.</small>'
        : onProdPickerHtml(onAttackProd, "prod") + '<div class="bg"><button class="obtn" data-oact="attack" data-stance="allout">Attack · All-out</button> <button class="obtn" data-oact="attack" data-stance="balanced">Attack · Balanced</button> <button class="obtn" data-oact="attack" data-stance="cautious">Attack · Cautious</button></div>');
  } else if (s.ownerType === "player") {
    html += '<small>Owned by another player.</small>';
    if (!inReach) html += '<br><small>' + reachNote + '</small>';
    else html += '<br><small>' + (adj ? 'Adjacent.' : '2 jumps away — Jump Drive.') + ' Raiding gives the defender <b>90 seconds</b> to respond — they may offer tribute, and you can accept or decline it. A Home World cannot be taken, only raided for resources.</small><br>'
      + '<div class="bg"><button class="obtn" data-oact="raid" data-stance="allout">Raid · All-out</button> <button class="obtn" data-oact="raid" data-stance="balanced">Raid · Balanced</button> <button class="obtn" data-oact="raid" data-stance="cautious">Raid · Cautious</button></div>';
  } else {
    // Neutral — battle to take it, like single player (Jayden, Nov 17).
    // No credit cost, no power gate: the battle itself decides it.
    if (!inReach) html += '<small>' + reachNote + '</small>';
    else html += '<small>Neutral system, power <b>' + s.pw + '</b>.' + (adj ? '' : ' 2 jumps away — Jump Drive.') + ' Attack to take it — win and it is yours, plus its loot.</small>' + flLine + '<br>'
      + '<small>Travel time: ' + Math.ceil(onTravelMs(s.id) / 1000) + 's from Home World.</small><br>'
      + ((onEmpire && onEmpire.transit) ? '<small>Your fleet is en route to <b>' + esc(onEmpire.transit.systemName || "") + '</b> — arrives in ' + '<span id="o-sys-transit-left">' + onTransitSecs() + 's</span>.</small>'
        : onProdPickerHtml(onAttackProd, "prod") + '<div class="bg"><button class="obtn" data-oact="attack" data-stance="allout">Attack · All-out</button> <button class="obtn" data-oact="attack" data-stance="balanced">Attack · Balanced</button> <button class="obtn" data-oact="attack" data-stance="cautious">Attack · Cautious</button></div>');
  }
  html += '<br><button class="obtn ghost" data-oact="close">Close</button>';
  return html;
}

// ---------- actions ----------
// Launch an attack (v3.9.26): the fleet travels like single player
// (10s + 5s per jump, cap 60s) and the battle resolves on arrival —
// the outcome comes back as a Battle report card, not an instant toast.
async function onDoAttack(id, stance) {
  const r = await onApi("/attack", "POST", { systemId: id, stance: stance || "balanced", prod: onAttackProd || "credits" });
  if (r.status === 201 && r.data.launched) {
    const t = r.data.transit || {};
    onToast("Fleet en route to " + (t.systemName || "the system") + " — arrives in " + Math.ceil((t.travelMs || 0) / 1000) + "s.");
    await onRefresh();
  } else if (r.status === 409 && r.data.error === "fleet_in_transit") {
    onToast("Your fleet is already en route.");
    await onRefresh();
  } else {
    onToast("Attack failed: " + (r.data.error || r.status) + ".");
    await onRefresh();
  }
}

// Start a colony upgrade (v3.9.42). The server charges the cost and
// returns the updated system (upgrade pending); the level rises when
// the timer ends and the poll re-renders the card (onSelSig carries
// the upgrade state). Caches are patched like set-production so the
// card shows the pending upgrade at once.
async function onDoColonyUpgrade(id) {
  const r = await onApi("/colony/upgrade", "POST", { systemId: id });
  if (r.status === 200 && r.data.system) {
    const sys = r.data.system;
    if (onSysById[sys.id]) Object.assign(onSysById[sys.id], sys);
    const li = onSystems.findIndex((z) => z.id === sys.id);
    if (li >= 0) Object.assign(onSystems[li], sys);
    if (onEmpire && Array.isArray(onEmpire.systems)) {
      const ei = onEmpire.systems.findIndex((z) => z.id === sys.id);
      if (ei >= 0) Object.assign(onEmpire.systems[ei], sys);
    }
    onToast("Colony upgrade started — Lv " + (sys.colonyUpgradeTo || "?") + " in " + onStLeft((r.data.durationSec || 0) * 1000) + ".");
    onRenderPanel();
    await onRefreshCosts();
  } else {
    onToast("Could not upgrade the colony: " + (r.data.error || r.status) + ".");
  }
}

// Change what one of your systems produces (v3.9.27 — choose at
// conquest, changeable later). The new rate applies from the next
// settle; the server returns the updated system, patched into the
// local caches so the card and ribbon update without a /systems refetch.
async function onDoSetProduction(id, prod) {
  const r = await onApi("/set-production", "POST", { systemId: id, prod });
  if (r.status === 200 && r.data.system) {
    const sys = r.data.system;
    if (onSysById[sys.id]) Object.assign(onSysById[sys.id], sys);
    const li = onSystems.findIndex((z) => z.id === sys.id);
    if (li >= 0) Object.assign(onSystems[li], sys);
    if (onEmpire && Array.isArray(onEmpire.systems)) {
      const ei = onEmpire.systems.findIndex((z) => z.id === sys.id);
      if (ei >= 0) Object.assign(onEmpire.systems[ei], sys);
    }
    onToast(sys.name + " now produces " + (ON_PROD_LABEL[sys.prod] || sys.prod) + ".");
    // v3.9.27 fix (live-check find): the toast fires before onRefresh,
    // and onRefresh runs 4 sequential loads (~1-2s) before the panel
    // rebuilds — the open card sat on the old value until reopened.
    // The local caches above already hold the new choice, so re-render
    // the panel from them at once; onRefresh still converges the rest.
    onRenderPanel();
    await onRefresh();
  } else {
    onToast("Could not change production: " + (r.data.error || r.status) + ".");
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

// Move ONE ship between the home fleet and a system's garrison
// (v3.9.30: garrisons are ships, single-player style — Send 1 / Recall 1).
async function onDoGarrisonShip(id, type, action) {
  const r = await onApi("/garrison", "POST", { systemId: id, ship: type, action });
  if (r.status === 200) {
    const name = (ON_FL_SHIPS[type] && ON_FL_SHIPS[type].name) || type;
    onToast(action === "send"
      ? ("1 " + name + " sent to " + ((r.data.system || {}).name || "the system") + ".")
      : ("1 " + name + " recalled to your home fleet."));
    await onRefresh();
  } else {
    onToast("Could not " + (action === "send" ? "station" : "recall") + " that ship: " + (r.data.error || r.status) + ".");
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
  // v3.9.22: the spawn button is live before the guest account exists —
  // wait for auth first, or the POST goes out with no token and 401s
  // (the playtest needed 3 clicks). onEnsureAuth serialises, so a tap
  // racing the boot-time auth still mints exactly one guest.
  if (!(await onEnsureAuth())) { onToast("Still signing in — try again in a moment."); return; }
  // v3.9.23: a custom Home World name goes with the spawn — blank means
  // keep the galaxy's generated name. Read the live input first (the
  // module var lags only if the input event hasn't fired yet).
  const nameInp = onq("#o-spawn-name");
  const name = ((nameInp ? nameInp.value : onSpawnName) || "").trim();
  const r = await onApi("/spawn", "POST", name ? { name } : {});
  if (r.status === 200 || r.status === 201) {
    onSpawnName = "";
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
      onSelected = h.id != null ? h.id : null; onAttackProd = "credits";
      onRenderPanel(); onDrawGalaxy();
    }
  } else {
    onToast("Spawn failed: " + (r.data.error || r.status) + ".");
  }
}

// Rename the Home World (v3.9.23): the name is the system itself, so it
// shows on the map and in raid banners for everyone. Only the Home
// World can be renamed.
async function onDoRename() {
  const inp = onq("#o-rename-name");
  const name = ((inp ? inp.value : onRenameName) || "").trim();
  if (!name) { onToast("Enter a name first."); return; }
  const r = await onApi("/rename-home", "POST", { name });
  if (r.status === 200) {
    onShowRename = false; onRenameName = "";
    onToast("Home World renamed to " + ((r.data.system && r.data.system.name) || name) + ".");
    await onRefresh();
  } else if (r.data && r.data.error === "bad_name") {
    onToast("Names are 1–24 characters.");
  } else {
    onToast("Could not rename: " + ((r.data && r.data.error) || r.status) + ".");
  }
}

// v3.9.26: reset the caller's own credits to the 10-credit fresh-spawn
// amount (Jayden's pick — his balance was banked under the old economy).
async function onDoResetCredits() {
  const r = await onApi("/reset-credits", "POST", {});
  onShowResetConfirm = false;
  if (r.status === 200) {
    onToast("Credits reset to 10.");
    await onRefresh();
  } else {
    onToast("Could not reset credits — check your connection.");
  }
  onRenderPanel();
}


// ---------- station (home base) — Phase 1 (Jayden, Nov 17) ----------
// The station is the single-player home base, online: buildings produce
// resources on the server, and this client renders the iso base with
// art.js drawBase (via a shim for the global S it reads). v3.9.16 rebuilt
// the station UI to BE the single-player station view (Jayden: "it still
// doesn't look at all like the single player") — a full-screen canvas
// with chips, and building/plot popups in #o-st-pop that mirror the
// single-player #pop. The old list panel is gone; buildings are managed
// by tapping them, exactly like single player. Fleet/research/
// quests land later.
// Building defs mirror data.js B + the single-player cost/duration
// formulas (cost = base x 1.4^level; duration = 45s x 1.6^level; a new
// copy costs 1.5x the last). The server is the authority — the client
// only uses these to enable/disable buttons; the server re-validates
// every build.
const ON_ST_B = {
  solar: { name: "Solar Array", desc: "Makes energy", dist: "Power District", cost: { metal: 20 }, prod: "energy", rate: 0.13125 },
  foundry: { name: "Metal Foundry", desc: "Refines metal", dist: "Industrial District", cost: { energy: 20 }, prod: "metal", rate: 0.103125 },
  mine: { name: "Crystal Mine", desc: "Digs crystal", dist: "Industrial District", cost: { metal: 50, energy: 20 }, prod: "crystal", rate: 0.075 },
  hub: { name: "Trade Hub", desc: "Earns credits", dist: "Trade District", cost: { metal: 60, crystal: 40 }, prod: "credits", rate: 0.065625 },
  hangar: { name: "Hangar", desc: "Holds 7 ship slots per level (research adds more)", dist: "Military District", cost: { metal: 80, crystal: 60 }, prod: null },
  command: { name: "Command Station", desc: "Raises building cap, storage and fleet power", dist: "The Keep", cost: { metal: 120, crystal: 80, credits: 40 }, prod: null },
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

// Zoom the station canvas toward the cursor (v3.9.27, Jayden: the scroll
// wheel didn't zoom the desktop station tab). Mirrors single-player
// setStZoom (game.js) — the online station never got a wheel listener,
// only pinch + drag. Zoom clamps 0.5-4, matching the pinch handler.
function onSetStZoom(z, px, py) {
  const cv = onStCv();
  if (!cv) return;
  const sc0 = ((cv.height || 384) / 480) * onStCam.zoom;
  const w = (px === undefined || py === undefined) ? null : {
    x: onStCam.cx + (px - (cv.width || 384) / 2) / sc0,
    y: onStCam.cy + (py - (cv.height || 384) / 2) / sc0,
  };
  onStCam.zoom = Math.max(0.5, Math.min(4, z));
  if (w) {
    const sc1 = ((cv.height || 384) / 480) * onStCam.zoom;
    onStCam.cx = w.x - (px - (cv.width || 384) / 2) / sc1;
    onStCam.cy = w.y - (py - (cv.height || 384) / 2) / sc1;
  }
}
let onStPop = null;         // null | {kind:"building", u} | {kind:"plot", x, y}
let onStPopKeyCache = "";
let onStPopOpenAt = 0;
let onStMove = null;        // uid of the building being moved, or null

// v3.9.49: cost-display lag (playtest: deductions lagged a tick in the
// ribbon, empire-panel credits lagged after big spends). Diagnosis, from
// code: the ribbon and the empire panel both read the onEmpire/onStation
// snapshots, which only refreshed on the 15s poll or a full onRefresh —
// and the three station spend handlers never refreshed at all, so credits
// spent on a build stayed visible (pre-spend) for up to a full poll tick.
// Worse, those handlers assigned onStation = r.data without resetting
// onStationAt, so the 1s ticker accrued up to 15s of production on top of
// the already-settled snapshot — double-counting, so the ribbon
// overshot after a build and stepped down at the next poll. The server
// already returns settled post-spend balances in the spend responses
// (/station/build + /station/move: full station + credits; /fleet/build +
// /fleet/scrap: res + credits), so the fix is client-only: apply the
// settled balances to the same snapshots both displays read, reset the
// accrual clocks, and re-render in the same tick. Spends whose responses
// carry no balances (research, commander, colony, quest claim) converge
// through a light refresh of just empire + station — the full onRefresh
// also refetches /systems (1,000 rows), which a spend does not change.
// Single player has no equivalent bug: spends deduct in the same local
// state the ribbon reads, in the same tick.
function onSetStation(data) { onStation = data; onStationAt = Date.now(); }
function onSetStationRes(res) { if (onStation && res) { onStation.res = res; onStationAt = Date.now(); } }
function onSetEmpireCredits(credits) { if (onEmpire && credits != null) { onEmpire.credits = credits; onEmpireAt = Date.now(); } }
async function onRefreshCosts() {
  await onLoadEmpire();
  await onLoadStation();
  onRenderTop();
  onRenderPanel();
}

async function onLoadStation() {
  const r = await onApi("/station", "GET");
  if (r.status === 200) {
    const prev = onPrevStation;
    onSetStation(r.data);
    // v3.9.22: build completions were silent (single player announces
    // them). Toast once when a queued job disappears as a finished
    // building — same transition detection as research in onLoadProgress.
    if (prev && Array.isArray(prev.bq)) {
      for (const j of prev.bq) {
        const still = (onStation.bq || []).some((z) => z.u === j.u && z.end === j.end);
        if (still) continue;
        const b = (onStation.bl || []).find((z) => z.u === j.u);
        const pb = (prev.bl || []).find((z) => z.u === j.u);
        // New building (no previous entry) or an upgrade — either way
        // the job finished and the building stands at its new level.
        if (b && (!pb || b.l > pb.l)) onToast(ON_ST_B[b.t].name + " reaches level " + b.l + ".");
      }
    }
    onPrevStation = onStation;
    return true;
  }
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

// Chips overlaid on the station canvas (single-player #cap / #bq / hint /
// mvcancel). Called on every render.
function onStChips() {
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
  if (hint) hint.hidden = onGestureHintDone(); // v3.9.35: hint goes away permanently once the player has panned/pinched (SP rule)
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
  body.scrollTop = 0; // v3.9.26: a fresh popup always starts at the top (close button visible)
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
    else if (t === "hangar") st += "Holds " + (7 + onSlotBonus()) * b.l + " ship slots. ";
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
      // v3.9.38: the unlocked-plot popup gets a Close button — its only
      // close was the X, and the v3.9.26 pinning bug proved the X can go
      // missing behind the ribbon.
      acts.innerHTML = '<button data-oact="station-pop-close" class="grow">Close</button>';
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
  // v3.9.29: redraw the station the moment the popup closes. The canvas
  // is only repainted on open / poll / actions, and a resize (e.g. the
  // phone toolbar showing or hiding while the popup is up) clears it —
  // so closing the popup could leave a blank station until the next
  // 15s poll. Single player re-renders on popup close too (closePopup
  // calls update()).
  onRenderStation();
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
    onSetStation(r.data);
    onSetEmpireCredits(r.data.credits);
    onRenderTop(); onRenderPanel();
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
    onSetStation(r.data);
    onSetEmpireCredits(r.data.credits);
    onRenderTop(); onRenderPanel();
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
    onSetStation(r.data);
    onSetEmpireCredits(r.data.credits);
    onRenderTop(); onRenderPanel();
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

async function onOpenStation(gen) {
  if (!onSpawned) { onToast("Found your Home World first."); return; }
  // v3.9.29: open synchronously from cached data FIRST — the old shape
  // awaited the fetch before unhiding, so every tab switch flashed the
  // bare galaxy map for ~a second. The fresh load follows in the
  // background and re-renders when it lands.
  onStationOpen = true;
  onStPop = null; onStPopKeyCache = ""; onStMove = null;
  const ov = onq("#o-station");
  if (ov) ov.hidden = false;
  onSetTab("station");
  onRenderStation();
  const ok = await onLoadStation();
  if (gen !== undefined && gen !== onTabGen) return; // superseded by a newer tab tap
  if (!ok && !onStation) { onToast("Could not load your station \u2014 check your connection."); onCloseStation(); onSetTab("map"); return; }
  onRenderStation();
}

function onCloseStation() {
  onStationOpen = false;
  onStPop = null; onStPopKeyCache = ""; onStMove = null;
  const ov = onq("#o-station");
  if (ov) ov.hidden = true;
  onCloseStPop();
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
    if (moved > 10 || pts.size === 2) onMarkGestureLearned(); // v3.9.35: pan/pinch dismisses the gesture hint (SP rule)
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
  // v3.9.27: mouse-wheel zoom toward the cursor, like single player
  // (game.js station wheel) — the online station had pinch + drag only.
  cv.addEventListener("wheel", (e) => {
    if (e.preventDefault) e.preventDefault();
    const rect = cv.getBoundingClientRect();
    const dpr = cv.width / (rect.width || 1);
    onSetStZoom(onStCam.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), (e.clientX - rect.left) * dpr, (e.clientY - rect.top) * dpr);
    onDrawStation();
  }, { passive: false });
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
  // v3.9.43 (playtest v3.9.29 bug 9): hit-test buildings FRONT-TO-BACK
  // (highest x+y first — the draw order, so the last drawn, visually
  // topmost, building wins) against their iso silhouette
  // (isoBuildingHit), exactly like single-player stEnd, and only then
  // fall back to the ground cell. The old code mapped every tap
  // straight to its ground cell, so a tap on the keep's dome opened
  // the empty plot north of it, and a tap on the keep's visible body
  // where the Crystal Mine's tall sprite overlaps it opened the MINE
  // (the mine's ground cell sits under the keep's body) — the player
  // saw the keep, tapped the keep, and got the mine. The Hangar
  // dome's full height is tappable now too (art.js visTop fix).
  if (typeof isoBuildingHit === "function") {
    let hit = null;
    [...(onStation.bl || [])].sort((a, b) => (b.x + b.y) - (a.x + a.y)).some((b) => { if (isoBuildingHit(wx, wy, b, sc)) { hit = b; return true; } return false; });
    if (hit) {
      if (onStMove != null) { onToast("That spot is taken."); return; }
      onOpenStBuilding(hit.u);
      return;
    }
  }
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

// ---------- research + commanders — Phase 3 (Jayden, Nov 17) ----------
// Mirrors the single-player Research tab (tree) and officer list. TECH/CM come from data.js (loaded before this file); the lane
// layout and icons mirror game.js TECHLANES/TECHICON — game.js loads
// after online.js, so this file keeps its own copies of those two.
let onProgress = null;      // from GET /progress
let onResearchOpen = false;
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

// Research time for a tech (single-player: t seconds x tmul x resMul).
function onResearchTime(t) { return t.t * 1000 * onTmul() * onResMul(); }

function onRenderResearch() {
  const ov = onq("#o-research");
  if (!ov || ov.hidden) return;
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
  html += '<div class="ocard otree-card"><div class="techtree-wrap"><div class="techtree" id="o-techtree"><svg id="o-techsvg"></svg>'
    + ON_TECHLANES.map((L, li) => '<div class="techlane" style="grid-column:' + (li + 1) + ';grid-row:1"><span class="techic">' + (ON_TECHICON[L.k] || "✦") + "</span>" + L.n + "</div>").join("")
    + techs.map((t) => {
      const lane = ON_TECHLANES.findIndex((L) => L.k === t.k) + 1;
      const dn = done.has(t.id);
      const req = t.req ? techs.find((z) => z.id === t.req) : null;
      const locked = !!req && !done.has(req.id);
      const ct = "Cost: " + costStr(t.c) + ". Time: " + onStLeft(onResearchTime(t));
      const status = dn ? "Researched." : locked ? "Requires " + req.n + ". " + ct : ct + (!canAfford(t.c) ? " Can't afford yet." : "");
      const dis = dn || locked || !!rq || !canAfford(t.c);
      // v3.9.37: the online Jump Drive extends attack reach to 2 jumps —
      // data.js keeps its Sector 2 description for single player, so the
      // online tree overrides the description here (same text as the
      // backend progress.js j1).
      const desc = t.id === "j1" ? "Attack systems up to 2 jumps from your empire" : t.d;
      return '<div class="row treenode' + (locked ? " locked" : "") + (dn ? " done" : "") + '" id="otr-' + t.id + '" style="grid-column:' + lane + ";grid-row:" + (depth[t.id] + 1) + '"><div class="tn-head"><span class="techic">' + (ON_TECHICON[t.k] || "✦") + "</span><b>" + esc(t.n) + "</b></div><small>" + esc(desc) + "</small><small>" + esc(status) + '</small><button data-oact="research-start" data-tech="' + t.id + '"' + (dis ? " disabled" : "") + ">" + (dn ? "Researched" : "Research") + "</button></div>";
    }).join("")
    + "</div></div></div>";
  // Commanders (v3.9.27: crew is gone — the officer list moved here
  // from the old Crew tab, mirroring single player where #cmds now
  // lives in the Research section). One assigned at a time.
  html += '<div class="ocard"><h2>Commanders</h2><small>One officer can be assigned at a time — their bonus applies while assigned, and they level up as you play.</small>';
  for (const cmd of p.commanders || []) {
    const h = cmd.hired, on = cmd.assigned;
    html += '<div class="row"><div><span class="cmdav cmdav-' + cmd.type + '">' + cmd.name.split(" ").pop()[0] + "</span><b>" + esc(cmd.name) + "</b> " + (h ? "Lv " + cmd.level + (on ? " (assigned)" : "") : "") + "<br><small>" + esc(cmd.desc) + "<br>" + (h ? "Bonus now: +" + cmd.bonus + "% " + ON_TT[cmd.type] + (on ? "" : " (not assigned)") : "Hire cost: " + cmd.cost + " credits") + '</small></div><button data-oact="commander" data-id="' + cmd.id + '"' + (!h && Math.floor(p.credits || 0) < cmd.cost ? " disabled" : "") + ">" + (!h ? "Hire" : on ? "Unassign" : "Assign") + "</button></div>";
  }
  html += "</div>";
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

async function onDoResearchStart(id) {
  const t = (typeof TECH !== "undefined" ? TECH : []).find((z) => z.id === id);
  const r = await onApi("/research/start", "POST", { id });
  if (r.status === 200) {
    onSetProgress(r.data);
    onToast("Research started: " + (t ? t.n : id) + ".");
    onRenderResearch();
    await onRefreshCosts();
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

async function onDoCommander(id) {
  const wasHired = !!((onProgress && onProgress.commanders) || []).find((c) => c.id === id && c.hired);
  const r = await onApi("/commander", "POST", { id });
  if (r.status === 200) {
    onSetProgress(r.data);
    const cmd = (r.data.commanders || []).find((c) => c.id === id);
    if (cmd) onToast(!wasHired ? cmd.name + " joins your command." : cmd.assigned ? cmd.name + " assigned as your officer." : cmd.name + " unassigned.");
    onRenderResearch();
    await onRefreshCosts();
  } else {
    const err = (r.data && r.data.error) || r.status;
    if (err === "not_enough_credits") onToast("Not enough credits to hire.");
    else onToast("Could not change officer: " + err + ".");
    await onLoadProgress();
    onRenderResearch();
  }
}

async function onOpenResearch(gen) {
  if (!onSpawned) { onToast("Found your Home World first."); return; }
  // v3.9.29: open synchronously first (see onOpenStation) — the render
  // shows "Loading research…" from cached state until the fetch lands.
  onResearchOpen = true;
  const ov = onq("#o-research");
  if (ov) ov.hidden = false;
  onSetTab("research");
  onRenderResearch();
  const ok = await onLoadProgress();
  if (gen !== undefined && gen !== onTabGen) return; // superseded by a newer tab tap
  if (!ok && !onProgress) { onToast("Could not load research — check your connection."); onCloseResearch(); onSetTab("map"); return; }
  onRenderResearch();
}
function onCloseResearch() { onResearchOpen = false; const ov = onq("#o-research"); if (ov) ov.hidden = true; }

// ---------- fleet (ships) — Phase 2 (Jayden, Nov 17) ----------
// Mirrors the single-player Fleet tab (data.js U + DUR, fpt/dpower, the
// build rules, and the battle ship losses). The server owns the fleet
// state; this view renders it and posts builds/scraps.
let onFleet = null;         // from GET /fleet
let onFleetOpen = false;

// Ship defs (mirror FLEET_SHIPS in the backend's fleet.js). Cost is paid
// from the station resources (energy/metal/crystal) plus empire credits.
// Per-system production, per second (v3.9.30: the owned-system card
// hardcoded the old 2.3/min figure — the real rate is SYS_INC, 1.1/min).
const ON_SYS_INC = 0.01875;

const ON_FL_SHIPS = {
  fighter: { name: "Fighter", pw: 1, sz: 1, hangar: 1, cost: { energy: 20, credits: 10 }, dur: 9, vs: "swarm" },
  cruiser: { name: "Cruiser", pw: 3, sz: 2, hangar: 2, cost: { metal: 50, crystal: 20, credits: 20 }, dur: 24, vs: "armored" },
  capital: { name: "Capital Ship", pw: 8, sz: 4, hangar: 4, cost: { metal: 160, crystal: 100, credits: 80 }, dur: 60, vs: "fortress" },
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
  if (r.status === 200) {
    const prev = onPrevFleet;
    onFleet = r.data;
    // v3.9.22: ship launches were silent (single player announces
    // them). Toast once when the launched count grows — ships only ever
    // increase by launching (losses and scraps decrease them).
    if (prev && prev.ships) {
      for (const k of ["fighter", "cruiser", "capital"]) {
        const d = (onFleet.ships[k] || 0) - (prev.ships[k] || 0);
        if (d > 0) onToast((d > 1 ? d + "x " : "") + ON_FL_SHIPS[k].name + " launched.");
      }
    }
    onPrevFleet = onFleet;
    return true;
  }
  return false;
}

async function onOpenFleet(gen) {
  if (!onSpawned) { onToast("Found your Home World first."); return; }
  // v3.9.29: open synchronously first (see onOpenStation) — the render
  // shows "Loading your fleet…" from cached state until the fetch lands.
  onFleetOpen = true;
  const ov = onq("#o-fleet");
  if (ov) ov.hidden = false;
  onSetTab("fleet");
  onRenderFleet();
  const ok = await onLoadFleet();
  if (gen !== undefined && gen !== onTabGen) return; // superseded by a newer tab tap
  if (!ok && !onFleet) { onToast("Could not load your fleet \u2014 check your connection."); onCloseFleet(); onSetTab("map"); return; }
  onRenderFleet();
}

function onCloseFleet() {
  onFleetOpen = false;
  const ov = onq("#o-fleet");
  if (ov) ov.hidden = true;
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
    await onLoadFleet(); onRenderFleet();
    onSetStationRes(r.data.res); onSetEmpireCredits(r.data.credits);
    onRenderTop(); onRenderPanel();
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
    await onLoadFleet(); onRenderFleet();
    onSetStationRes(r.data.res); onSetEmpireCredits(r.data.credits);
    onRenderTop(); onRenderPanel();
  } else {
    onToast("Scrap failed: " + ((r.data && r.data.error) || r.status) + ".");
  }
}

function onRenderFleet() {
  const ov = onq("#o-fleet");
  if (!ov || ov.hidden) return;
  const f = onFleet;
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
  // v3.9.30: garrisoned ships are listed here — they used to vanish from
  // the Fleet tab entirely (single-player #gar).
  const _gar = [];
  for (const _s of ((onEmpire && onEmpire.systems) || [])) {
    if (_s.id === (onEmpire && onEmpire.homeSystem)) continue;
    const _gs = _s.garrison || {};
    const _parts = ["fighter", "cruiser", "capital"].filter((k) => (_gs[k] || 0) > 0).map((k) => (_gs[k] || 0) + "× " + ON_FL_SHIPS[k].name);
    if (_parts.length) _gar.push(_parts.join(", ") + " at " + _s.name + " (Colony Lv " + (_s.colonyLevel || 1) + ")");
  }
  let html = '<div class="ocard"><h2>Fleet</h2>'
    + '<small>Fleet power: <b>' + Math.round(f.power || 0) + '</b>. Vs swarm <b>' + Math.round((f.powerVs || {}).swarm || 0) + '</b>, armored <b>' + Math.round((f.powerVs || {}).armored || 0) + '</b>, fortress <b>' + Math.round((f.powerVs || {}).fortress || 0) + '</b>.</small><br>'
    + '<small>Home defence: <b>' + Math.round(f.defence || 0) + '</b> (fleet power ' + Math.round(f.power || 0) + ' ×1.2).</small><br>'
    + (_gar.length ? '<small>Garrisoned: ' + _gar.join("; ") + '.</small><br>' : '')
    + '<small>' + _sub + '</small><br>'
    + '<small><b>Counters:</b> Fighters +50% vs swarm, Cruisers +50% vs armored, Capital ships +50% vs fortress.</small><br>'
    + '<small>Ship slots: <b>' + used + ' / ' + slotCap + '</b> (Hangar Lv ' + hangarLv + ' — ' + (7 + onSlotBonus()) + ' slots per level).</small>'
    // v3.9.26: fleets drain energy like single player — 0.025/s per (v3.9.46: halved from 0.05/s)
    // occupied slot (launched ships only), read per minute.
    + (((f.energyUpkeepPerSec || 0) > 0) ? '<br><small>Ship upkeep: <b>−' + ((f.energyUpkeepPerSec || 0) * 60).toFixed(1) + ' energy/min</b> (0.025/s per ship slot).</small>' : '');
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
  // time is end - start (the server already applied the build-time
  // multipliers when it queued the ship), so the bar stays exact
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

// ---------- quests (Phase 4, v3.9.31) ----------
// Mirrors single-player #quests: all 18 quests with their reward and
// state; the server computes the state (GET /quests) and validates every
// claim (POST /quests/claim). The tab button carries a badge with the
// claimable count.
let onQuests = null;      // from GET /quests: [{id, title, reward, status}]
let onDaily = null;       // from GET /daily: {day, challenge, progress, done, claimed, darkMatter, credits}
let onQuestsOpen = false;
function onQuestRewardText(reward) {
  return Object.keys(reward || {}).map((r) => reward[r] + " " + r).join(" + ");
}
async function onLoadQuests() {
  if (!onSpawned) return false;
  const r = await onApi("/quests", "GET");
  if (r.status !== 200) return false;
  onQuests = r.data.quests || [];
  onQuestBadge();
  if (onQuestsOpen) onRenderQuests();
  return true;
}
// v3.9.51: today's daily challenge — same challenge for every player,
// from GET /daily. Loaded alongside quests when the Quests overlay opens.
async function onLoadDaily() {
  if (!onSpawned) return false;
  const r = await onApi("/daily", "GET");
  if (r.status !== 200) return false;
  onDaily = r.data.daily || null;
  if (onQuestsOpen) onRenderQuests();
  return true;
}
function onQuestBadge() {
  const badge = onq("#o-q-badge");
  if (!badge) return;
  const n = (onQuests || []).filter((q) => q.status === "claimable").length;
  badge.hidden = n < 1;
  badge.textContent = String(n);
}
async function onOpenQuests(gen) {
  if (!onSpawned) { onToast("Found your Home World first."); return; }
  onQuestsOpen = true;
  const ov = onq("#o-quests");
  if (ov) ov.hidden = false;
  onSetTab("quests");
  onRenderQuests();
  const ok = await onLoadQuests();
  await onLoadDaily();
  if (gen !== undefined && gen !== onTabGen) return; // superseded by a newer tab tap
  if (!ok && !onQuests) { onToast("Could not load your quests \u2014 check your connection."); onCloseQuests(); onSetTab("map"); return; }
  onRenderQuests();
}
function onCloseQuests() {
  onQuestsOpen = false;
  const ov = onq("#o-quests");
  if (ov) ov.hidden = true;
}
function onRenderQuests() {
  const ov = onq("#o-quests");
  if (!ov || ov.hidden) return;
  const body = onq("#o-q-body");
  if (!body) return;
  if (!onQuests) { body.innerHTML = '<div class="ocard"><p>Loading your quests\u2026</p></div>'; return; }
  const rows = onQuests.map((q) => {
    const reward = onQuestRewardText(q.reward);
    const state = q.status === "claimed"
      ? "<span>Claimed \u2713</span>"
      : q.status === "claimable"
        ? '<button class="obtn" data-oact="quest-claim" data-qid="' + q.id + '">Claim</button>'
        : "<span>Not yet</span>";
    return '<div class="row"><div><b>' + esc(q.title) + '</b><br><small>Reward: ' + esc(reward) + '</small></div>' + state + "</div>";
  }).join("");
  const d = onDaily;
  const dcard = !d
    ? '<div class="ocard"><h2>Daily Challenge</h2><p><small>Loading today\u2019s challenge\u2026</small></p></div>'
    : '<div class="ocard"><h2>Daily Challenge</h2><p><b>' + esc(d.challenge.title) + '</b><br><small>' + d.progress + ' / ' + d.challenge.target + ' · Reward: ' + esc(d.challenge.rewardText) + ' · You have ' + (d.darkMatter || 0) + ' Dark Matter</small></p>' + (d.claimed ? '<span>Claimed \u2713</span>' : d.done ? '<button class="obtn" data-oact="daily-claim">Claim</button>' : '<span>Not yet</span>') + '</div>';
  body.innerHTML = dcard + '<div class="ocard"><h2>Quests</h2><p><small>Complete a quest, then claim its reward here.</small></p>' + rows + "</div>";
}
async function onDoQuestClaim(id) {
  const r = await onApi("/quests/claim", "POST", { questId: id });
  if (r.status === 200 && r.data.quests) {
    onQuests = r.data.quests;
    onQuestBadge();
    onToast("Quest complete: +" + (r.data.rewardText || onQuestRewardText(r.data.reward)) + "!");
    onRenderQuests();
    await onRefreshCosts();
  } else {
    const err = (r.data && r.data.error) || "failed";
    onToast(err === "already_claimed" ? "Already claimed." : err === "not_complete" ? "Not complete yet." : "Claim failed: " + err + ".");
    await onLoadQuests();
  }
}
// v3.9.51: claim today's daily challenge. The server validates and pays
// exactly once; on success the Daily section re-renders from the
// response (which carries the new Dark Matter balance) and the ribbon
// costs refresh like a quest claim.
async function onDoDailyClaim() {
  const r = await onApi("/daily/claim", "POST", {});
  if (r.status === 200 && r.data.daily) {
    onDaily = r.data.daily;
    onToast("Daily challenge complete: +" + (r.data.rewardText || "") + "!");
    onRenderQuests();
    await onRefreshCosts();
  } else {
    const err = (r.data && r.data.error) || "failed";
    onToast(err === "already_claimed" ? "Already claimed." : err === "not_complete" ? "Not complete yet." : "Claim failed: " + err + ".");
    await onLoadDaily();
  }
}

// Syndicates (v3.9.52) — player groups, online only. A Syndicate
// holds up to 10 members; one Syndicate per player. The tab button
// carries a badge when this week's shared challenge is claimable.
let onSyn = null;        // from GET /syndicate: {syndicate, open}
let onSynOpen = false;
let onSynName = "";      // typed Syndicate name (poll rebuilds the panel)
let onSynChat = "";      // typed chat message (same)
function onClock(at) {
  const d = new Date(at || 0);
  const p2 = (n) => String(n).padStart(2, "0");
  return p2(d.getHours()) + ":" + p2(d.getMinutes());
}
function onSynBadge() {
  const badge = onq("#o-s-badge");
  if (!badge) return;
  const w = onSyn && onSyn.syndicate && onSyn.syndicate.weekly;
  const n = w && w.done && !w.claimed ? 1 : 0;
  badge.hidden = n < 1;
  badge.textContent = String(n);
}
async function onLoadSyndicate() {
  if (!onSpawned) return false;
  const r = await onApi("/syndicate", "GET");
  if (r.status !== 200) return false;
  onSyn = r.data || null;
  onSynBadge();
  if (onSynOpen) onRenderSyndicate();
  return true;
}
async function onOpenSyndicate(gen) {
  if (!onSpawned) { onToast("Found your Home World first."); return; }
  onSynOpen = true;
  const ov = onq("#o-syndicate");
  if (ov) ov.hidden = false;
  onSetTab("syndicate");
  onRenderSyndicate();
  const ok = await onLoadSyndicate();
  if (gen !== undefined && gen !== onTabGen) return; // superseded by a newer tab tap
  if (!ok && !onSyn) { onToast("Could not load Syndicates — check your connection."); onCloseSyndicate(); onSetTab("map"); return; }
  onRenderSyndicate();
}
function onCloseSyndicate() {
  onSynOpen = false;
  const ov = onq("#o-syndicate");
  if (ov) ov.hidden = true;
}
function onRenderSyndicate() {
  const ov = onq("#o-syndicate");
  if (!ov || ov.hidden) return;
  const body = onq("#o-syn-body");
  if (!body) return;
  if (!onSyn) { body.innerHTML = '<div class="ocard"><p>Loading Syndicates\u2026</p></div>'; return; }
  const syn = onSyn.syndicate;
  if (!syn) {
    const open = (onSyn.open || []).map((o) => {
      const full = o.memberCount >= 10;
      return '<div class="row"><div><b>' + esc(o.name) + '</b><br><small>' + o.memberCount + ' / 10 members \u00b7 Founded by ' + esc(o.founderName || "") + '</small></div>'
        + (full ? '<span>Full</span>' : '<button class="obtn" data-oact="syndicate-join" data-sid="' + esc(o.id) + '">Join</button>') + '</div>';
    }).join("");
    body.innerHTML = '<div class="ocard"><h2>Syndicates</h2><p><small>Team up with up to 10 players. A Syndicate shares one weekly challenge — finish it together and every member claims credits + Dark Matter.</small></p>'
      + '<input id="o-syn-name" type="text" placeholder="Name your Syndicate" maxlength="24" autocomplete="off" value="' + esc(onSynName) + '">'
      + '<button class="obtn" data-oact="syndicate-create">Create Syndicate</button></div>'
      + '<div class="ocard"><h2>Open Syndicates</h2>' + (open || '<p><small>No Syndicates yet — found the first one.</small></p>') + '</div>';
    return;
  }
  const w = syn.weekly || {};
  const ch = w.challenge || {};
  const wcard = !ch.id
    ? '<div class="ocard"><h2>Weekly Challenge</h2><p><small>Loading this week\u2019s challenge\u2026</small></p></div>'
    : '<div class="ocard"><h2>Weekly Challenge</h2><p><b>' + esc(ch.title) + '</b><br><small>' + (w.progress || 0) + ' / ' + ch.target + ' \u00b7 Reward: ' + esc(ch.rewardText || "") + ' \u00b7 Shared by the whole Syndicate</small></p>' + (w.claimed ? '<span>Claimed \u2713</span>' : w.done ? '<button class="obtn" data-oact="syndicate-claim">Claim</button>' : '<span>Not yet</span>') + '</div>';
  const mrows = (syn.members || []).map((m) => '<div class="row"><div><b>' + esc(m.name) + '</b>' + (m.isFounder ? ' <small>\u00b7 Founder</small>' : '') + '</div>' + (m.playerId === onPlayer ? '<span>You</span>' : '') + '</div>').join("");
  const chat = (syn.chat || []).map((m) => '<div><small>' + onClock(m.at) + ' <b>' + esc(m.name) + ':</b> ' + esc(m.message) + '</small></div>').join("");
  body.innerHTML = '<div class="ocard"><h2>Syndicate \u2014 ' + esc(syn.name) + '</h2><p><small>' + (syn.members || []).length + ' / 10 members</small></p></div>'
    + wcard
    + '<div class="ocard"><h2>Members</h2>' + mrows + '</div>'
    + '<div class="ocard"><h2>Chat</h2>' + (chat || '<p><small>No messages yet \u2014 say hello.</small></p>')
    + '<input id="o-syn-chat" type="text" placeholder="Message your Syndicate" maxlength="280" autocomplete="off" value="' + esc(onSynChat) + '">'
    + '<button class="obtn" data-oact="syndicate-chat">Send</button></div>'
    + '<div class="ocard"><button class="obtn ghost" data-oact="syndicate-leave">Leave Syndicate</button>'
    + (syn.isFounder ? ' <button class="obtn ghost" data-oact="syndicate-disband">Disband Syndicate</button>' : '') + '</div>';
}
async function onDoSynCreate() {
  const r = await onApi("/syndicate/create", "POST", { name: onSynName });
  if (r.status === 200 && r.data.syndicate) {
    onSyn = { syndicate: r.data.syndicate, open: [] };
    onSynName = "";
    onToast("Syndicate founded: " + r.data.syndicate.name + ".");
    onRenderSyndicate();
  } else {
    const err = (r.data && r.data.error) || "failed";
    onToast(err === "invalid_name" ? "Name must be 1\u201324 characters." : err === "name_taken" ? "That name is taken." : err === "already_in_syndicate" ? "You are already in a Syndicate." : "Could not create Syndicate: " + err + ".");
    await onLoadSyndicate();
  }
}
async function onDoSynJoin(id) {
  const r = await onApi("/syndicate/join", "POST", { syndicateId: id });
  if (r.status === 200 && r.data.syndicate) {
    onSyn = { syndicate: r.data.syndicate, open: [] };
    onToast("You joined the Syndicate.");
    onRenderSyndicate();
  } else {
    const err = (r.data && r.data.error) || "failed";
    onToast(err === "syndicate_full" ? "That Syndicate is full." : err === "not_found" ? "That Syndicate no longer exists." : err === "already_in_syndicate" ? "You are already in a Syndicate." : "Could not join: " + err + ".");
    await onLoadSyndicate();
  }
}
async function onDoSynLeave() {
  const r = await onApi("/syndicate/leave", "POST", {});
  if (r.status === 200) {
    onSyn = r.data || null;
    onToast("You left the Syndicate.");
    onRenderSyndicate();
  } else {
    const err = (r.data && r.data.error) || "failed";
    onToast("Could not leave: " + err + ".");
    await onLoadSyndicate();
  }
}
async function onDoSynDisband() {
  const r = await onApi("/syndicate/disband", "POST", {});
  if (r.status === 200) {
    onSyn = r.data || null;
    onToast("Syndicate disbanded.");
    onRenderSyndicate();
  } else {
    const err = (r.data && r.data.error) || "failed";
    onToast("Could not disband: " + err + ".");
    await onLoadSyndicate();
  }
}
async function onDoSynChat() {
  const msg = (onSynChat || "").trim();
  if (!msg) return;
  const r = await onApi("/syndicate/chat", "POST", { message: msg });
  if (r.status === 200 && r.data.chat) {
    if (onSyn && onSyn.syndicate) onSyn.syndicate.chat = r.data.chat;
    onSynChat = "";
    onRenderSyndicate();
  } else {
    const err = (r.data && r.data.error) || "failed";
    onToast(err === "invalid_message" ? "Message must be 1\u2013280 characters." : "Could not send: " + err + ".");
    await onLoadSyndicate();
  }
}
// v3.9.52: claim this week's shared challenge. The server validates
// and pays exactly once per member; on success the Syndicate panel
// re-renders from the response and the ribbon costs refresh like a
// quest or daily claim.
async function onDoSynClaim() {
  const r = await onApi("/syndicate/claim", "POST", {});
  if (r.status === 200 && r.data.syndicate) {
    onSyn = { syndicate: r.data.syndicate, open: [] };
    onToast("Weekly challenge complete: +" + (r.data.rewardText || "") + "!");
    onRenderSyndicate();
    await onRefreshCosts();
  } else {
    const err = (r.data && r.data.error) || "failed";
    onToast(err === "already_claimed" ? "Already claimed." : err === "not_complete" ? "Not complete yet." : "Claim failed: " + err + ".");
    await onLoadSyndicate();
  }
}

// Panel inputs (delegated): the 15s poll rebuilds the panel, which would
// wipe a half-typed name — keep the typed value in a module var and
// restore it on render (v3.9.23).
document.addEventListener("input", (e) => {
  const t = e.target;
  if (!t || !t.id) return;
  if (t.id === "o-spawn-name") onSpawnName = t.value;
  if (t.id === "o-rename-name") onRenameName = t.value;
  if (t.id === "o-syn-name") onSynName = t.value;
  if (t.id === "o-syn-chat") onSynChat = t.value;
});

// Panel + bar clicks (delegated).
document.addEventListener("click", (e) => {
  // v3.9.20: ribbon menu + tap-to-expand and the tab dock carry no
  // data-oact of their own — handle them before the action dispatch.
  const mb = e.target.closest ? e.target.closest("[data-omenu],[data-omclose]") : null;
  if (mb) { if (mb.dataset.omenu) onOpenMenu(); else onCloseMenu(); return; }
  const rb = e.target.closest ? e.target.closest("#o-res") : null;
  if (rb) { rb.classList.toggle("expanded"); return; }
  const tb = e.target.closest ? e.target.closest("[data-otab]") : null;
  if (tb) { onShowTab(tb.dataset.otab); return; }
  const tutb = e.target.closest ? e.target.closest("[data-otutnext],[data-otutback],[data-otutlater],[data-otutskip],[data-otutcol]") : null;
  if (tutb) {
    if (tutb.dataset.otutnext !== undefined) onTutAdvance();
    else if (tutb.dataset.otutback !== undefined) onTutBack();
    else if (tutb.dataset.otutlater !== undefined) onCloseTut(false);
    else if (tutb.dataset.otutskip !== undefined) onCloseTut(true);
    else if (tutb.dataset.otutcol !== undefined) onTutSetCollapsed(!(onq("#o-tut") && onq("#o-tut").classList.contains("collapsed")));
    return;
  }
  const b = e.target.closest ? e.target.closest("[data-oact]") : null;
  if (!b) return;
  const act = b.dataset.oact;
  if (act === "spawn") onDoSpawn();
  else if (act === "howto") { onCloseMenu(); onShowTut(0); }
  else if (act === "recovery") { onCloseMenu(); onShowRecovery = true; onRenderPanel(); }
  else if (act === "reset-credits") { onCloseMenu(); onShowResetConfirm = true; onRenderPanel(); }
  else if (act === "reset-credits-cancel") { onShowResetConfirm = false; onRenderPanel(); }
  else if (act === "reset-credits-go") onDoResetCredits();
  else if (act === "recovery-done") { onShowRecovery = false; onRenderPanel(); }
  else if (act === "recovery-copy") { onCopyText(onGetRecoveryCode(), b); }
  else if (act === "recovery-new") { onDoRecoveryNew(); }
  else if (act === "recover") { onShowRecoverForm = true; onRecoverErr = ""; onRenderPanel(); }
  else if (act === "recover-cancel") { onShowRecoverForm = false; onRecoverErr = ""; onRenderPanel(); }
  else if (act === "recover-go") { onDoRecover(); }
  else if (act === "attack" && onSelected != null) onDoAttack(onSelected, b.dataset.stance || "balanced");
  else if (act === "prod" && b.dataset.prod) { onAttackProd = b.dataset.prod; onRenderPanel(); }
  else if (act === "setprod" && onSelected != null && b.dataset.prod) onDoSetProduction(onSelected, b.dataset.prod);
  else if (act === "colony-upgrade" && onSelected != null) onDoColonyUpgrade(onSelected);
  else if (act === "raid" && onSelected != null) onDoRaid(onSelected, b.dataset.stance || "balanced");
  else if (act === "raid-tribute" && b.dataset.raid) onDoRaidTribute(b.dataset.raid);
  else if (act === "raid-tribute-accept" && b.dataset.raid) onDoRaidTributeAccept(b.dataset.raid);
  else if (act === "raid-tribute-decline" && b.dataset.raid) onDoRaidTributeDecline(b.dataset.raid);
  else if (act === "raid-outcome-dismiss") { onLastRaidOutcome = null; onRenderPanel(); }
  else if (act === "transit-outcome-dismiss") { onLastTransitOutcome = null; onRenderPanel(); }
  else if (act === "transit-jump" && b.dataset.sys) {
    const id = +b.dataset.sys, sys = onSysById[id];
    if (sys) { onSelected = id; onAttackProd = "credits"; if (sys.x != null && sys.y != null) { onCam.cx = sys.x; onCam.cy = sys.y; } onRenderPanel(); onDrawGalaxy(); }
  }
  else if (act === "target-jump" && b.dataset.sys) {
    const id = +b.dataset.sys, sys = onSysById[id];
    if (sys) { onSelected = id; onAttackProd = "credits"; if (sys.x != null && sys.y != null) { onCam.cx = sys.x; onCam.cy = sys.y; } onRenderPanel(); onDrawGalaxy(); }
  }
  else if (act === "rename") { const home = onEmpire && onEmpire.homeSystem != null ? onSysById[onEmpire.homeSystem] : null; onRenameName = home ? home.name : ""; onShowRename = true; onRenderPanel(); }
  else if (act === "rename-save") onDoRename();
  else if (act === "rename-cancel") { onShowRename = false; onRenameName = ""; onRenderPanel(); }
  else if (act === "garrison-send" && onSelected != null && b.dataset.type) onDoGarrisonShip(onSelected, b.dataset.type, "send");
  else if (act === "garrison-recall" && onSelected != null && b.dataset.type) onDoGarrisonShip(onSelected, b.dataset.type, "recall");
  else if (act === "station") onShowTab("station");
  else if (act === "fleet") onShowTab("fleet");
  else if (act === "research") onShowTab("research");
  else if (act === "research-start" && b.dataset.tech) onDoResearchStart(b.dataset.tech);
  else if (act === "commander" && b.dataset.id) onDoCommander(b.dataset.id);
  else if (act === "fleet-build" && b.dataset.type) onDoFleetBuild(b.dataset.type, Number(b.dataset.n) || 1);
  else if (act === "fleet-scrap" && b.dataset.type) onDoFleetScrap(b.dataset.type);
  else if (act === "quest-claim" && b.dataset.qid) onDoQuestClaim(b.dataset.qid);
  else if (act === "daily-claim") onDoDailyClaim();
  else if (act === "syndicate-create") onDoSynCreate();
  else if (act === "syndicate-join" && b.dataset.sid) onDoSynJoin(b.dataset.sid);
  else if (act === "syndicate-leave") onDoSynLeave();
  else if (act === "syndicate-disband") onDoSynDisband();
  else if (act === "syndicate-chat") onDoSynChat();
  else if (act === "syndicate-claim") onDoSynClaim();
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
    if (el) onSetPanel('<div class="ocard"><h2>Online beta</h2><p>This mode is in closed beta. Enter the access password to continue.</p><input id="o-beta-pw" type="password" placeholder="Beta password" autocomplete="off"><br><button class="obtn" data-oact="beta">Enter</button> <small id="o-beta-err" hidden>Wrong password — try again.</small><br><br><button class="obtn ghost" data-oact="single">‹ Back to Single Player</button></div>');
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
  // v3.9.22: a reload used to drop the camera on the full galaxy — drop
  // it on the Home World at zoom 4 instead, like right after spawn.
  if (onSpawned && onEmpire && onEmpire.homeSystem != null) {
    const home = onSysById[onEmpire.homeSystem];
    if (home && home.x != null) {
      onCam.cx = home.x; onCam.cy = home.y; onCam.zoom = 4;
      onDrawGalaxy();
    }
  }
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
    // v3.9.20: the ribbon (station resources) and the tray (research)
    // need fresh station/progress state on every poll, not just when
    // those views are open.
    await onLoadStation();
    await onLoadProgress();
    // v3.9.22: ship launches need onLoadFleet even when the Fleet view
    // is closed, or their completion toast never fires.
    await onLoadFleet();
    // v3.9.31: the Quests tab badge (claimable count) stays live.
    await onLoadQuests();
    // v3.9.52: the Syndicate tab badge (claimable weekly) stays live,
    // and the chat refreshes while the overlay is open.
    await onLoadSyndicate();
    // v3.9.22: the map is only refetched when ownership actually
    // changed — /systems is 1,000 rows, so polling it every 15s would
    // burn the shared DO rows-read quota (5.76M/day per player).
    if (onSpawned && onEmpire && onEmpire.galaxyVersion != null) {
      if (onGalaxyVersion === null) { onGalaxyVersion = onEmpire.galaxyVersion; }
      else if (onEmpire.galaxyVersion !== onGalaxyVersion) {
        onGalaxyVersion = onEmpire.galaxyVersion;
        await onLoadSystems();
        onDrawGalaxy();
      }
    }
    if (onStationOpen) { onRenderStation(); }
    if (onFleetOpen) { onRenderFleet(); }
    if (onResearchOpen) { onRenderResearch(); }
    if (okE || okR) { onPollFails = 0; }
    else {
      onPollFails++;
      if (onPollFails >= 3) {
        clearInterval(onPoll);
        onToast("Server unreachable — polling paused. Reload to retry.");
      }
    }
    onRenderTop();
    onRenderActivity();
    // v3.9.22: re-render the panel when a raid arrived or the selected
    // system changed — even with a system card open, or the tribute
    // popup never appears. With nothing selected it always re-renders.
    if (onSelected == null) onRenderPanel();
    else if (onBannerSig() !== onLastBannerSig || onSelSig() !== onLastSelSig) onRenderPanel();
  }, 15000);
  // Tick the raid-warning countdown live (only the number, so an open
  // tribute input never loses focus). Also the shipyard + research bars,
  // and the activity tray countdowns.
  setInterval(() => {
    if (!onReady) return;
    onFlTick();
    onResTick();
    onRenderActivity();
    onRenderTop(); // v3.9.22: the ribbon accrues live between polls
    onStChips();   // v3.9.22: the build countdown went stale off-ticker
    onTutCheck();  // v3.9.35: tutorial steps auto-advance off the 1s tick
    // v3.9.38: the transit countdown in the open system popup ticks live
    // (the playtest found it frozen at the render-time value — the poll
    // sig never changes while a transit is flying, so the card is not
    // re-rendered until it resolves).
    const tsl = onq("#o-sys-transit-left");
    if (tsl) tsl.textContent = onTransitSecs() + "s";
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
