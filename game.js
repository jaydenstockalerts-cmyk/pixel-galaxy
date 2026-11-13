const $=s=>document.querySelector(s);
let AC=null;
function ac(){try{if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume()}catch(e){}return AC}
function tone(f,d,ty,v,t0,f2){const a=ac();if(!a||S.mute)return;const o=a.createOscillator(),g=a.createGain(),t=a.currentTime+(t0||0);o.type=ty||"square";o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);g.gain.setValueAtTime(v||.04,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+d+.02)}
function boom(){const a=ac();if(!a||S.mute)return;const n=Math.floor(a.sampleRate*.3),b=a.createBuffer(1,n,a.sampleRate),c=b.getChannelData(0);for(let i=0;i<n;i++)c[i]=(Math.random()*2-1)*(1-i/n);const s=a.createBufferSource(),g=a.createGain();s.buffer=b;g.gain.value=.08;s.connect(g);g.connect(a.destination);s.start()}
function sfx(k){const m={click:()=>tone(520,.04),ok:()=>{tone(660,.08);tone(880,.12,"square",.04,.08)},laser:()=>tone(900,.12,"sawtooth",.025,0,200),boom:boom,win:()=>[523,659,784,1047].forEach((f,i)=>tone(f,.15,"square",.045,i*.12)),lose:()=>[392,330,262,196].forEach((f,i)=>tone(f,.2,"triangle",.06,i*.15)),alert:()=>{tone(880,.1);tone(660,.1,"square",.05,.15);tone(880,.1,"square",.05,.3)},claim:()=>[784,988,1319].forEach((f,i)=>tone(f,.12,"square",.045,i*.09))};if(m[k])m[k]()}
const fresh=()=>({res:{energy:40,metal:40,crystal:10,credits:10},b:{solar:1,foundry:1,mine:0,hub:0,hangar:0,command:1},ships:{fighter:0,cruiser:0,capital:0},won:[0],sel:1,bl:[{u:1,t:"solar",x:1,y:2,l:1},{u:2,t:"foundry",x:2,y:2,l:1},{u:3,t:"command",x:2,y:1,l:1}],nu:4,bsel:null,place:null,mv:null,bq:[],sq:[],q:[],tech:[],rq:null,cmds:[],cx:{},slot:{fleet:null,station:null},crew:{mine:0,ship:0,res:0},own:{},rv:{c:{cy:Date.now()},v:{cy:Date.now()},k:{cy:Date.now()},a:{cy:Date.now()},m:{cy:Date.now()}},gar:{},col:{},war:{},dip:{},pair:{},end:{},stab:{},pairCy:Date.now(),stabCy:Date.now(),min:0,rvi:0,rep:0,cap:0,feed:[],tab:"map",t:Date.now()});
// v2.4: S.gar maps system id -> {fighter,cruiser,capital} stationed
// there; S.war maps faction id -> 1 once it has taken one of your
// systems (drives the standings board's "At war" status). S.rv clocks
// are now one shared 5-minute cycle clock per faction (cy).
// v2.6: S.col maps system id -> {l: level 1-5, spec: null | "mine" |
// "forge" | "trade"} — one colony per system you own (never Home
// World, never rival-held). Created on conquest, deleted when the
// system is lost, re-created fresh on re-conquest.
function load(){try{const j=JSON.parse(localStorage.getItem(KEY));if(j&&j.res&&j.b&&j.ships){const s=Object.assign(fresh(),j);
// v2.4 migration: old saves have no gar/war and an rv with only c/v
// keys using the old cl/rd clock fields. Normalise so every faction
// has a cycle clock (cy) — the old clock is carried forward, never
// reset, so no backlog is silently dropped.
if(!s.gar||typeof s.gar!=="object")s.gar={};
if(!s.war||typeof s.war!=="object")s.war={};
// v2.7 migration: diplomacy (S.dip per faction: {truceUntil, pact,
// ally}), rival-pair relations (S.pair "a-b" -> "pact"|"war"), end
// flags (S.end {v13, v2x, lost}) and colony stability (S.stab system
// id -> 0-100). Old saves get empty diplomacy, no end flags, and
// every existing colony starts at stability 100; stale stability
// records for systems without a colony are dropped.
if(!s.dip||typeof s.dip!=="object")s.dip={};
if(!s.pair||typeof s.pair!=="object")s.pair={};
if(!s.end||typeof s.end!=="object")s.end={};
if(!s.stab||typeof s.stab!=="object")s.stab={};
// v2.8 migration: crew (S.crew {mine,ship,res}) — old saves start
// with every crew member unassigned (no free bonuses). Counts are
// integers >= 0; a shrunken cap (lost colonies) trims the excess,
// research first, then shipbuilding, then mining.
if(!s.crew||typeof s.crew!=="object")s.crew={mine:0,ship:0,res:0};
for(const k of["mine","ship","res"])if(typeof s.crew[k]!=="number"||s.crew[k]<0)s.crew[k]=0;else s.crew[k]=Math.floor(s.crew[k]);
if(typeof s.pairCy!=="number")s.pairCy=Date.now();
if(typeof s.stabCy!=="number")s.stabCy=Date.now();
if(!s.rv||typeof s.rv!=="object")s.rv={};
for(const id in RV){const r=s.rv[id];if(!r||typeof r!=="object"){s.rv[id]={cy:Date.now()};continue}if(r.cy===undefined){r.cy=Math.min(r.cl||Date.now(),r.rd||Date.now());delete r.cl;delete r.rd}}
// v2.5 migration: k/a/m relocate from Sector 1 to Sector 2. An old
// (v2.4-era) save has no sec2 marker and may still have them holding
// Sector 1 systems. Those systems go back to neutral; each faction
// gets its first free Sector 2 home from its new list. Player systems
// (S.won), c/v territory, garrisons and cycle clocks are NEVER touched.
// NOTE: load() runs before RV_START / secOf are initialised (they are
// consts further down this file), so the home lists are literals here
// — they MUST match RV_START (k [16,20,17], a [31,27,30], m [19,18,23]).
// A fresh v2.5 save has no sec2 either; the migration then finds k/a/m
// already in Sector 2 and is a no-op that just sets the marker.
if(!j.sec2){s.sec2=1;if(!Array.isArray(s.feed))s.feed=[];const HOMES={k:[16,20,17],a:[31,27,30],m:[19,18,23]};for(const id of["k","a","m"]){const inS1=Object.keys(s.own||{}).filter(x=>s.own[x]===id&&(SYS[+x].sec||0)===0);if(inS1.length){inS1.forEach(x=>delete s.own[x]);const home=HOMES[id].find(i=>!s.won.includes(i)&&!s.own[i]);if(home!==undefined){s.own[home]=id;s.feed.push("The "+RV[id].n+" has relocated to Sector 2.");if(s.feed.length>30)s.feed.shift()}}}}
if(!j.bl){s.bl=[];s.nu=1;let n=0;for(const t in B)if(j.b[t]>0)s.bl.push({u:s.nu++,t,x:n%3+1,y:Math.floor(n++/3)+2,l:j.b[t]});
s.bq=(j.bq||[]).map(q=>{let b=s.bl.find(z=>z.t===q.id);if(!b){b={u:s.nu++,t:q.id,x:n%3+1,y:Math.floor(n++/3)+2,l:0};s.bl.push(b)}return{u:b.u,end:q.end}})}
// v2.6 migration: colonies. A v2.5-era save has no col field — every
// system the player owns (except Home World) gets a level-1 colony
// with no focus chosen yet. Garrisons are untouched. Stale colony
// records for systems no longer owned are dropped, and a save that
// already has some colonies keeps them (only missing ones are added).
if(!s.col||typeof s.col!=="object")s.col={};
for(const k in s.col)if(!(s.won||[]).includes(+k))delete s.col[k];
for(const i of s.won||[])if(i>0&&!s.col[i])s.col[i]={l:1,spec:null};
for(const i in s.col)if(s.stab[i]===undefined)s.stab[i]=100;
for(const i in s.stab)if(!s.col[i])delete s.stab[i];
{const _cap=5+2*(s.b?s.b.command:1)+Object.values(s.col||{}).reduce((a,c)=>a+(c.l||0),0);let _over=(s.crew.mine+s.crew.ship+s.crew.res)-_cap;for(const _k of["res","ship","mine"]){if(_over<=0)break;const _cut=Math.min(_over,s.crew[_k]);s.crew[_k]-=_cut;_over-=_cut}}
delete s.pos;delete s.selB;return s}}catch(e){}return fresh()}
function save(){try{S.t=Date.now();localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
let S=load();recalc();
// UI OVERHAUL v1.0 — camera, page and UI-hide state are VIEW-ONLY: they
// are never saved in S and never change the save format (still pixelgalaxy-v3).
// UI OVERHAUL v0.9 — camera and page state are VIEW-ONLY: they are never
// saved in S and never change the save format (still pixelgalaxy-v3).
const WORLD={w:640,h:800,px:5}; // galaxy world, SYS x/y * 5 (v0.9.1: bigger, detailed map)
let CAM={cx:320,cy:400,zoom:0.8}; // v1.5 default = fit view (whole galaxy in the safe area, bottom row visible). Home button still zooms to Home World at 1.8.
// v2.5 SECTORS: two sectors share ONE 640x800 world — each sector has
// its own x/y layout in SYS (sec:1 marks Sector 2, no sec field = 0),
// so fitCam/clampCam/minimap math is identical per sector. SEC is
// VIEW-ONLY like CAM (the sector you are looking at, never saved).
// drawGalaxy and the minimap draw ONLY the active sector; flyTo()
// sets SEC to the target system's sector first.
let SEC=0;
const secOf=i=>SYS[i].sec||0;
const hasJump=()=>S.tech.includes("j1");
// Jump gates (both directions): 9 Void Gate <-> 21 Wayfarer Gate,
// 13 Rift Armada <-> 27 Hollow Gate.
const GATE={9:21,13:27,21:9,27:13};
let camFitted=false; // v1.6: true while the camera is still in its default fit state — a resize refits it; any deliberate zoom/pan clears it.
let PAGE={kind:"tab"}; // tab | empire only — system/building/plot are popups now (v0.9.2)
// v0.9.2 popups: VIEW-ONLY, never saved. Map/station stay visible behind.
let POP=null; // null | {kind:"system",i} | {kind:"building",u} | {kind:"plot",x,y}
// v1.0 immersive mode + camera safe area: the HUD and dock are glass
// overlays, but map content must never sit under them. UIIN is the
// safe-area inset in CANVAS pixels (top = under the HUD, bottom =
// above the dock). UIHIDE hides all chrome for a clean full-screen map.
let UIHIDE=false;
let UIIN={top:64,bottom:88};
function measureUI(){
  if(UIHIDE){UIIN={top:0,bottom:0};return}
  let top=64,bottom=88;
  try{
    const t=$("#top");
    if(t&&t.offsetHeight) top=Math.round(t.offsetHeight*1.15);
    const d=$("#tabs");
    if(d&&d.offsetHeight) bottom=Math.round(d.offsetHeight+20);
    // v1.5 activity tray: when it is showing, map content must also
    // stay above it — it counts toward the bottom safe-area inset.
    const a=$("#activity");
    if(a&&!a.hidden&&a.offsetHeight) bottom+=Math.round(a.offsetHeight+8);
  }catch(e){}
  UIIN={top,bottom};
}
const safeTop=()=>UIIN.top, safeBottom=()=>UIIN.bottom;
const safeCyCv=()=>(UIIN.top+(cv.height-UIIN.bottom))/2;
const safeCySt=()=>(UIIN.top+(st.height-UIIN.bottom))/2;
function setUIHidden(h){
  UIHIDE=!!h;
  document.body.classList.toggle("ui-hidden",UIHIDE);
  const sh=$("#uishow"); if(sh) sh.hidden=!UIHIDE;
  measureUI(); sizeCanvases(); update();
}

// v1.3 guided tutorial — quick, skippable, first load only.
// Stored in its own key (pixelgalaxy-tutorial-done); the game save
// (pixelgalaxy-v3) is never touched. Overlay card only: the map stays
// visible behind it and Skip works from step 1.
const TUT_KEY="pixelgalaxy-tutorial-done";
const TUT_STEPS=[
{t:"Welcome, Commander",b:"Pixel Galaxy is yours to build: grow your home station, train a fleet, and conquer systems all the way to The Dark Nexus."},
{t:"Your station",b:"This is your home station. Tap a building to see it, or tap open land to build. A Solar Array is a good first build — it makes energy. Plots unlock as you upgrade the Command Station — the city grows outward from the keep."},
{t:"Resources",b:"Energy, metal, crystal and credits live at the top. Each has a storage cap — upgrade the Command Station to store more. Buildings produce at full rate wherever they stand — spread them out."},
{t:"The galaxy",b:"Switch to the Galaxy tab and tap a planet. Check the power it needs, then attack the Pirate Outpost when your fleet is ready. Fighters beat swarm fleets."},
{t:"Fleet, Research, Quests",b:"Train ships in Fleet, research in Research, hire commanders in Crew, and claim rewards in Quests. Good luck, Commander."}
];
let TUT={i:0,open:false};
function tutDone(){try{localStorage.setItem(TUT_KEY,"1")}catch(e){}}
function tutIsDone(){try{return !!localStorage.getItem(TUT_KEY)}catch(e){return false}}
function tutRender(){
  const el=$("#tut"); if(!el)return;
  const stp=TUT_STEPS[TUT.i];
  const t=$("#tut-title"),b=$("#tut-body"),d=$("#tut-dots"),nx=$("#tut-next"),bk=$("#tut-back");
  if(t)t.textContent=stp.t; if(b)b.textContent=stp.b;
  if(d)d.innerHTML=TUT_STEPS.map((_,k)=>'<span class="dot'+(k===TUT.i?" on":"")+'"></span>').join("");
  if(nx)nx.textContent=TUT.i===TUT_STEPS.length-1?"Done":"Next ›";
  if(bk)bk.disabled=TUT.i===0;
}
function showTut(i){TUT={i:Math.max(0,Math.min(TUT_STEPS.length-1,i||0)),open:true};const el=$("#tut");if(el)el.hidden=false;tutRender()}
function closeTut(done){TUT.open=false;const el=$("#tut");if(el)el.hidden=true;if(done)tutDone()}
function maybeTut(){if(!tutIsDone())showTut(0)}

function openMenu(){const m=$("#menu"),b=$("#menubk"); if(m){m.hidden=false; requestAnimationFrame(()=>m.classList.add("open"));} if(b)b.hidden=false;}
function closeMenu(){const m=$("#menu"),b=$("#menubk"); if(m){m.classList.remove("open"); setTimeout(()=>{if(!m.classList.contains("open"))m.hidden=true},230);} if(b)b.hidden=true;}
function syncMenuSound(){const el=$("#m-sound"); if(el) el.textContent=S.mute?"off":"on";}

// v1.2 ISOMETRIC station camera — VIEW-ONLY like the galaxy camera,
// never saved. The logical plots are still 12x12 (S.bl {u,t,x,y,l});
// but the camera now works in ISO world units:
//   isoX = (x - y) * 32,  isoY = (x + y) * 16   (2:1 dimetric, 26.57 deg)
// Iso world spans x -384..384, y 0..384; building height rises in -y.
// stScale matches art.js: sc = (canvasHeight / 480) * zoom.
const STWORLD={w:768,h:384,cell:48,plots:12};
let STCAM={cx:32,cy:64,zoom:2.2}; // centred on the keep: grid (2,1) -> iso (32,64)
let stFitted=false; // v1.5: fit the station cluster once, on first visit to the Station tab
// v1.7: stCamFitted mirrors camFitted for the station — true while the
// camera is still in its default fit state (Home on first visit, or
// Fit). A resize or a tray appearing/disappearing refits it (see
// sizeCanvases); any deliberate zoom/pan clears it, so a refit never
// yanks the camera away from where the player put it. stFitKind
// remembers WHICH fit is the default state ("home" or "fit").
let stCamFitted=false;
let stFitKind="home";
const stScale=()=>((st.height||384)/480)*STCAM.zoom;
// v1.0: station camera centres on the SAFE area (between HUD and dock),
// not the raw canvas centre, so buildings are never hidden under a bar.
const stWorldToScreen=(wx,wy)=>{const sc=stScale();return{x:(st.width||384)/2+(wx-STCAM.cx)*sc,y:safeCySt()+(wy-STCAM.cy)*sc}};
const stScreenToWorld=(sx,sy)=>{const sc=stScale();return{x:STCAM.cx+(sx-(st.width||384)/2)/sc,y:STCAM.cy+(sy-safeCySt())/sc}};
const stSafeH=()=>Math.max(1,(st.height||384)-UIIN.top-UIIN.bottom);
function clampStCam(){// v1.2: the keep sits near the top of the iso diamond (iso y=64
// for grid (2,1)), and a corner building can sit at any edge — so the
// camera must be able to centre on them. Like v1.1 (past the edge is
// just more terrain), the clamp lets the centre reach the world edges
// (with half a view of margin), and centres the world when the whole
// diamond fits in view.
const sc=stScale(),hw=(st.width||384)/(2*sc),hh=stSafeH()/(2*sc);if(hw>=384)STCAM.cx=0;else STCAM.cx=Math.max(-384+hw/2,Math.min(384-hw/2,STCAM.cx));if(hh>=192)STCAM.cy=Math.max(192-hh,Math.min(192+hh,STCAM.cy));else STCAM.cy=Math.max(-48+hh/2,Math.min(432-hh/2,STCAM.cy))}
function setStZoom(z,px,py){stCamFitted=false;const s0=stScale(),w=px===undefined?null:{x:STCAM.cx+(px-(st.width||384)/2)/s0,y:STCAM.cy+(py-safeCySt())/s0};STCAM.zoom=Math.max(1,Math.min(5,z)); /* v1.9: max station zoom is 5 (was 2.5) — at 2.5 the keep was only ~200-250px tall on a 1920px screen and the player could not get a proper close look (live v1.8, #14). */if(w){const s1=stScale();STCAM.cx=w.x-(px-(st.width||384)/2)/s1;STCAM.cy=w.y-(py-safeCySt())/s1}clampStCam()}
// v1.3: station cameras fit the OCCUPIED building cluster, not the
// whole 12x12 diamond (live bug: the map was ~80% empty in both Home
// and Fit, and the default view centred the clump in the upper third).
// v1.5: the bbox is the DRAWN extent of the buildings, not the plots
// plus a huge pad — the old pad (±48 x, -72/+24 y, +128 margin on Fit)
// made Fit show the base as a small patch in the centre quarter.
// Sprite top (plinth + sprite + shield + name) is ~88u above the plot
// centre; the ground diamond is ~18u below it; x is the plinth
// half-width (30u) either side.
function occupiedIsoBBox(margin){
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  S.bl.forEach(b=>{const c=isoC(b.x,b.y);x0=Math.min(x0,c.x-30);x1=Math.max(x1,c.x+30);y0=Math.min(y0,c.y-88);y1=Math.max(y1,c.y+18)});
  if(x1<x0){x0=-384;x1=384;y0=0;y1=384}
  const m=margin||0;
  return{cx:(x0+x1)/2,cy:(y0+y1)/2,w:(x1-x0)+m,h:(y1-y0)+m};
}
function stZoomForBox(bb,minZ,maxZ){
  const vw=st.width||384,vh=stSafeH();
  const sc=Math.min(vw*.92/bb.w,vh*.92/bb.h);
  return Math.max(minZ,Math.min(maxZ,sc*480/(st.height||384)));
}
// v1.4: NO high zoom floor — Home must FIT the whole occupied cluster
// (buildings + shields + labels) inside the safe area. A 1.8 floor
// cropped the cluster once it spread out (a building at (7,7) landed
// below the dock). The computed fit zoom is the zoom; it is ~1.0 for
// the fresh 3-building cluster and rises as the city fills in.
function homeStCam(){const bb=occupiedIsoBBox(24);STCAM.cx=bb.cx;STCAM.cy=bb.cy;STCAM.zoom=stZoomForBox(bb,1.0,2.5);clampStCam();stFitted=true;stCamFitted=true;stFitKind="home"}
function fitStCam(){const bb=occupiedIsoBBox(48);STCAM.cx=bb.cx;STCAM.cy=bb.cy;STCAM.zoom=stZoomForBox(bb,.4,2.5);clampStCam();stFitted=true;stCamFitted=true;stFitKind="fit"}
function openPlot(x,y){POP={kind:"plot",x,y};showPopup();update()}
const camScale=()=>((cv.height||480)/WORLD.h)*CAM.zoom;
// v1.0: galaxy camera centres on the SAFE area (between HUD and dock).
// Visible world height is the safe height, so nothing the camera shows
// is ever drawn under the top or bottom bar.
const safeH=()=>Math.max(1,(cv.height||480)-UIIN.top-UIIN.bottom);
// v1.6 GALAXY BOTTOM MARGIN: the galaxy camera must keep the lowest
// planet LABEL at least ~60px above the dock at full size. Live v1.5:
// at ~1100px wide the Dark Nexus label was clipped by the dock, and
// even at full size it sat only ~25px above it. fitCam/clampCam now
// work against a safe height 120 canvas px shorter, so the world
// bottom (and its labels) sit ~60px above the dock instead of on it.
const GAL_BOT_PAD=140; // ~60px+ above the dock at full size (see below)
const galSafeH=()=>Math.max(1,safeH()-GAL_BOT_PAD);
const worldToScreen=(wx,wy)=>{const sc=camScale();return{x:(cv.width||384)/2+(wx-CAM.cx)*sc,y:safeCyCv()+(wy-CAM.cy)*sc}};
const screenToWorld=(sx,sy)=>{const sc=camScale();return{x:CAM.cx+(sx-(cv.width||384)/2)/sc,y:CAM.cy+(sy-safeCyCv())/sc}};
function clampCam(){const sc=camScale(),hw=(cv.width||384)/(2*sc),hh=galSafeH()/(2*sc);if(hw>=WORLD.w/2)CAM.cx=WORLD.w/2;else CAM.cx=Math.max(hw,Math.min(WORLD.w-hw,CAM.cx));if(hh>=WORLD.h/2)CAM.cy=WORLD.h/2;else CAM.cy=Math.max(hh,Math.min(WORLD.h-hh,CAM.cy))}
function setZoom(z,px,py){camFitted=false;const s0=camScale(),w=px===undefined?null:{x:CAM.cx+(px-(cv.width||384)/2)/s0,y:CAM.cy+(py-safeCyCv())/s0};CAM.zoom=Math.max(1,Math.min(2.5,z));if(w){const s1=camScale();CAM.cx=w.x-(px-(cv.width||384)/2)/s1;CAM.cy=w.y-(py-safeCyCv())/s1}clampCam()}
function flyTo(i){camFitted=false;SEC=secOf(i);const s=SYS[i];CAM.cx=s.x*WORLD.px;CAM.cy=s.y*WORLD.px;CAM.zoom=Math.max(CAM.zoom,1.8);clampCam()}
function fitCam(){const vh=galSafeH(),vw=cv.width||384,ch=cv.height||480;
  const sc=Math.min(vw/WORLD.w,vh/WORLD.h); // world must fit the SAFE area
  CAM={cx:320,cy:400,zoom:Math.max(.3,Math.min(2.5,sc*WORLD.h/ch))};clampCam();camFitted=true}
function homeCam(){flyTo(0)}
function openSystem(i){S.sel=i;POP={kind:"system",i};flyTo(i);showPopup();update();save()}
function openBuilding(u){S.bsel=u;POP={kind:"building",u};showPopup();update();save()}
function openEmpire(){PAGE={kind:"empire"};update()}
function goBack(){PAGE={kind:"tab"};update()}
// v1.4 popup touch fixes (Jayden, phone): popup buttons often did not
// work on touch. Root causes found in this file:
//  (a) update() runs every 250ms and popupUI() rebuilt #pop-body /
//      #pop-actions innerHTML on EVERY tick, destroying the button
//      under the user's finger mid-tap (a phone tap dwells longer
//      than a desktop click). Now popupUI() caches a render key and
//      only rewrites the popup when its identity or displayed data
//      actually changes — ticks never touch the buttons.
//  (b) The tap that OPENS a popup (canvas pointerup) is followed by a
//      click event that lands on the newly opened popup, so it could
//      hit Close/Place/Attack by accident. Clicks on the popup within
//      350ms of it opening are now ignored (popOpenAt).
//  (c) Buttons only had a click handler. Popup buttons now also fire
//      on pointerup (tap = pointerdown+up with <12px movement), and
//      the following click is suppressed so nothing fires twice.
//  (d) While a popup is open, canvas pointerdown is ignored (no
//      setPointerCapture, no pan/tap) — the map cannot steal or
//      retarget a popup tap. Backdrop tap-to-close also fires on
//      pointerup, not just click.
let popOpenAt=0, popClickGuard=0, popKeyCache="";
function showPopup(){const p=$("#pop");if(p){const wasHidden=p.hidden;p.hidden=!POP;if(POP&&wasHidden)popOpenAt=Date.now()}}
function closePopup(){POP=null;const p=$("#pop");if(p)p.hidden=true;update()}
const tsum=k=>TECH.filter(x=>S.tech.includes(x.id)&&x.k===k).reduce((a,x)=>a+x.v,0);
const lv=id=>Math.min(10,1+Math.floor(Math.sqrt((S.cx[id]||0)/2)));
const cb=t=>{const id=S.slot[t==="fleet"?"fleet":"station"];return id&&CM[id].t===t?CM[id].b*lv(id):0};
const tmul=()=>1-Math.min(.5,cb("build"));
const scap=()=>(5+tsum("slot"))*S.b.hangar;
const qcap=()=>5+2*S.b.hangar;
function gain(s,n){const id=S.slot[s];if(id)S.cx[id]=(S.cx[id]||0)+n}
const cap=()=>100+500*S.b.command;
const lvlCap=id=>id==="command"?5+tsum("cmax"):Math.min(15,S.b.command*2+1);
const effL=b=>b.l+S.bq.filter(j=>j.u===b.u).length;
const cnt=t=>S.bl.filter(x=>x.t===t).length;
const MAXC=t=>t==="command"?1:t==="hangar"?Math.min(4,1+Math.floor(S.b.command/3)):Math.min(6,1+Math.floor(S.b.command/2));
const bqcap=()=>2+Math.floor(S.b.command/2);
const bAt=(x,y)=>S.bl.find(b=>b.x===x&&b.y===y);
// v1.5 PLOT LOCKING (Jayden, approved mechanics change, Hobbit-style):
// plots unlock by distance from the Command Station (the keep), nearest
// first, so the city grows outward as the Command Station levels up.
// Required level = max(1, chebyshev distance from the keep), capped at
// 13 (max Command level). From the fresh-save keep at (2,1): Lv1 9 plots
// (the 3x3 around the keep), Lv2 20, Lv3 30, Lv4 42, Lv5 56, Lv6 72,
// Lv7 90, Lv8 110, Lv9 132, Lv10 144 (all). Existing buildings are
// grandfathered: a plot with a building on it is never locked, so no
// save loses a building. Unlock is DERIVED from Command level + the
// building list — no new save field.
const keepCell=()=>S.bl.find(b=>b.t==="command");
const plotDist=(x,y)=>{const k=keepCell();if(!k)return 0;return Math.max(Math.abs(x-k.x),Math.abs(y-k.y))};
const plotReqLv=(x,y)=>Math.min(13,Math.max(1,plotDist(x,y)));
const plotLocked=(x,y)=>!bAt(x,y)&&S.b.command<plotReqLv(x,y);
const unlockedCount=()=>{let n=0;for(let i=0;i<12;i++)for(let j=0;j<12;j++)if(!plotLocked(i,j))n++;return n};
const newCost=t=>{const c=cost(t,0),f=Math.pow(1.5,cnt(t)),o={};for(const r in c)o[r]=Math.ceil(c[r]*f);return o};
const cost=(id,l)=>{const o={};for(const r in B[id].c)o[r]=Math.ceil(B[id].c[r]*Math.pow(1.4,l));return o};
const dur=l=>4*Math.pow(1.35,l)*tmul();
const can=c=>Object.keys(c).every(r=>S.res[r]>=c[r]);
const pay=c=>{for(const r in c)S.res[r]-=c[r]};
const fmt=n=>n>=1000?(n/1000).toFixed(1)+"k":String(Math.floor(n));
const cstr=c=>Object.keys(c).map(r=>fmt(c[r])+" "+r).join(", ");
const used=()=>Object.keys(U).reduce((a,k)=>a+S.ships[k]*U[k].sz,0);
const usedQ=()=>used()+S.sq.reduce((a,j)=>a+U[j.k].sz,0);
const total=()=>S.ships.fighter+S.ships.cruiser+S.ships.capital;
// v2.4 GARRISONS: ships stationed at a system defend it. They are NOT
// in the home fleet — battles, dpower() and total() use S.ships only —
// and they don't use hangar slots (they're deployed, not stored).
// Quests count every ship you own, home or garrisoned, so moving ships
// to a garrison can never un-complete q3/q7/q9. Recalling a ship never
// strands it: recall ignores the slot cap (new builds stay blocked
// while the home fleet is over its cap, as before).
const garAt=i=>{const g=(S.gar||{})[i]||{};return{fighter:g.fighter||0,cruiser:g.cruiser||0,capital:g.capital||0}};
const garTotal=()=>Object.keys(S.gar||{}).reduce((a,i)=>{const g=garAt(+i);return a+g.fighter+g.cruiser+g.capital},0);
const allShips=()=>total()+garTotal();
const shipCount=k=>S.ships[k]+Object.keys(S.gar||{}).reduce((a,i)=>a+garAt(+i)[k],0);
// Raw garrison power (no weakness bonus — a garrison defends at full
// strength) and the shared fleet multiplier, so sysDef() matches the
// number shown in the popup and on the Empire page exactly.
const garPow=i=>{const g=garAt(i);let p=0;for(const k in U)p+=g[k]*U[k].pw;return p};
const garMult=()=>(1+.2*(S.b.command-1))*(1+tsum("pw"))*(1+cb("fleet"))*1.2;
// v2.7: Home World defends with the FULL home fleet (dpower()), not
// half of it — the whole fleet is AT home. Every other system keeps
// the v2.4 rule (garrison + colony + half the home fleet).
const sysDef=i=>i===0?dpower():garPow(i)*garMult()+colDef(i)+.5*dpower();
// v2.6 COLONIES — one per owned system (never Home World, never
// rival-held; player-only in v2.6). A colony earns +0.2/s per level
// of its focused resource (Lv 1 = +0.2/s, Lv 5 = +1.0/s) once a focus
// is chosen — unchosen colonies earn nothing (only the flat +0.3
// credits/s per owned system still applies). A colony adds +15 raid
// defence power per level. Upgrades are timed jobs in the building
// queue (see done()/actJobs()): cost metal 50xlevel + crystal 30xlevel
// + credits 100xlevel to go from level to level+1, time 60s x level.
// Max colony level is 5.
const COLSPEC={mine:"metal",forge:"crystal",trade:"credits"};
const COLSPECNAME={mine:"Mining",forge:"Forge",trade:"Trade"};
const COL_MAX=5,COL_INC=.2,COL_DEF=15;
const colAt=i=>(S.col||{})[i]||null;
const colDef=i=>{const c=colAt(i);return c?COL_DEF*c.l:0};
const colUpCost=l=>({metal:50*l,crystal:30*l,credits:100*l});
const colDur=l=>60*l;
// v2.8 CREW — workers, NOT commanders (S.cmds/S.cx/S.slot are the
// officer system and are untouched). Cap = 5 + 2xCommand level +
// total colony levels, so a fresh empire has 7 crew and a big one
// ~30. Mining +2% production per crew (buildings AND colony income),
// shipbuilding +2% shipyard speed per crew, research +2% research
// speed per crew. Speed bonuses cap at -50%, same style as tmul().
const CREW_PCT=.02;
const crewAt=()=>{if(!S.crew||typeof S.crew!=="object")S.crew={mine:0,ship:0,res:0};return S.crew};
const crewCap=()=>5+2*S.b.command+Object.values(S.col||{}).reduce((a,c)=>a+(c.l||0),0);
const crewTotal=()=>{const c=crewAt();return (c.mine||0)+(c.ship||0)+(c.res||0)};
const crewMineMult=()=>1+CREW_PCT*(crewAt().mine||0);
const crewShipMul=()=>1-Math.min(.5,CREW_PCT*(crewAt().ship||0));
const crewResMul=()=>1-Math.min(.5,CREW_PCT*(crewAt().res||0));
// v2.8 TRADE ROUTES — a colony CONNECTED to Home World through
// systems you own (BFS from system 0 over S.won, hopsFromHome())
// earns +0.2 credits/s. An isolated colony earns nothing: connected
// territory pays, far-flung islands don't (and they are also the ones
// that lose stability). Derived from S.won + S.col — no new field.
const TRADE_INC=.2;
const tradeAt=i=>{const c=colAt(i);if(!c||i===0)return 0;return hopsFromHome()[i]!==undefined?TRADE_INC:0};
const tradeTotal=()=>S.won.reduce((a,i)=>a+tradeAt(i),0);
const adj=(i,j)=>SYS[i].l.includes(j)||SYS[j].l.includes(i);
const spw=i=>Math.round(SYS[i].pw*(S.own[i]?1.4:1));
// v2.5: Sector 2 needs Jump Drive research (TECH j1) — without it
// every Sector 2 system is out of reach, however adjacent it is.
// The systems stay VISIBLE (greyed/locked) so the player can see
// what is coming; the popup says so in one plain line.
const avail=i=>!S.won.includes(i)&&S.won.some(j=>adj(i,j))&&(secOf(i)===0||hasJump());
// v1.4: adjacency bonus REMOVED at Jayden's request (approved mechanics
// change). Production is base rate only (plus tech/commander effects),
// so spaced-out buildings produce at full rate — that is what makes
// the spaced-out city layout work. mult() stays as a stub returning 1
// so rates() and the popups need no other change.
const mult=b=>1;
function fpower(i){return fpt(SYS[i].t)}
function fpt(t){const w=WEAK[t];let p=0;for(const k in U)p+=S.ships[k]*U[k].pw*(k===w?1.5:1);return p*(1+.2*(S.b.command-1))*(1+tsum("pw"))*(1+cb("fleet"))}
function rates(){const o={energy:0,metal:0,crystal:0,credits:0};S.bl.forEach(b=>{if(b.l>0)for(const r in B[b.t].p)o[r]+=B[b.t].p[r]*b.l*mult(b)*(1+tsum("eco"))*(1+cb("econ"))*crewMineMult()});o.credits+=.3*(S.won.length-1);
// v2.6: colonies earn through rates() so the HUD +/s, offline
// earnings and storage caps all include them automatically. An
// unchosen colony earns nothing (only the flat +0.3 credits/s above).
for(const i of S.won){const c=colAt(i);if(c&&c.spec)o[COLSPEC[c.spec]]+=COL_INC*c.l*crewMineMult()}
o.credits+=tradeTotal();
o.energy-=.05*used();return o}
function step(dt){S.min+=dt/60;const r=rates();R.forEach(k=>{S.res[k]=Math.min(cap(),Math.max(0,S.res[k]+r[k]*dt))})}
function done(){const n=Date.now();
S.bq=S.bq.filter(j=>{if(j.end>n)return true;
// v2.6: a colony upgrade job ({col: system id}) raises that colony
// one level (capped at COL_MAX) instead of a building. Same queue,
// same tray, same station-commander XP as a finished build.
if(j.col!==undefined){const c=colAt(j.col);if(c){c.l=Math.min(COL_MAX,c.l+1);gain("station",1);msg("Colony on "+SYS[j.col].n+" reaches level "+c.l+".");sfx("ok")}return false}
const b=S.bl.find(z=>z.u===j.u);if(b){b.l++;gain("station",1);msg(B[b.t].n+" reaches level "+b.l+".");sfx("ok")}return false});recalc();
while(S.sq.length&&S.sq[0].end<=n){const k=S.sq.shift().k;S.ships[k]++;msg(U[k].n+" launched.");sfx("ok")}
if(S.rq&&S.rq.end<=n){const t=TECH.find(z=>z.id===S.rq.id);S.tech.push(t.id);S.rq=null;gain("station",1);msg("Research complete: "+t.n);sfx("claim")}}
let HOLD=false,HELD="";
function toast(t){const c=$("#toasts"),el=document.createElement("div");el.className="toast";el.textContent=t;c.appendChild(el);while(c.children.length>3)c.removeChild(c.firstChild);setTimeout(()=>el.remove(),5000)}
const msg=t=>{if(HOLD){HELD=t;return}S.feed.push(t);if(S.feed.length>30)S.feed.shift();toast(t)};
const left=ms=>{const s=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return(h?h+"h ":"")+(h||m?m+"m ":"")+(s%60)+"s"};

const RICON={energy:"⚡",metal:"▣",crystal:"◆",credits:"●"};
$("#res").innerHTML=R.map(r=>`<div class="pill"><span class="rlabel">${r[0].toUpperCase()+r.slice(1)}</span><span class="pline"><span class="ric dot-${r}">${RICON[r]||""}</span><b id="v-${r}"></b><span class="rate" id="r-${r}"></span></span><span class="sbar"><i id="sb-${r}"></i></span><span class="cap" id="c-${r}"></span></div>`).join("");
const resEl=$("#res");
if(resEl)resEl.addEventListener("click",()=>{resEl.classList.toggle("expanded")});
const _bm=$("#bmenu");if(_bm)_bm.innerHTML=Object.keys(B).map(t=>`<div class="row"><div><b>${B[t].n}</b> <span id="bmn-${t}"></span><br><small>${B[t].d}</small><br><small id="bmc-${t}"></small></div><button data-bnew="${t}" id="bmb-${t}">Place</button></div>`).join("");
$("#ships").innerHTML=Object.keys(U).map(k=>`<div class="row"><div><b>${U[k].n}</b> x<span id="n-${k}"></span><br><small>Power ${U[k].pw}, ${U[k].sz} slot${U[k].sz>1?"s":""}, ${DUR[k]}s. Strong vs ${Object.keys(WEAK).find(t=>WEAK[t]===k)} (+50%).<br>Cost: ${cstr(U[k].c)}</small></div><div class="bg"><button data-build="${k}" id="sb-${k}"></button><button data-build="${k}" data-n="5" id="s5-${k}">x5</button><button data-scrap="${k}" id="sc-${k}">Scrap</button><button data-build="${k}" data-n="10" id="s10-${k}">x10</button></div></div>`).join("");

$("#tech").innerHTML=TECH.map(t=>`<div class="row" id="tr-${t.id}"><div><b>${t.n}</b><br><small>${t.d}<br><span id="tc-${t.id}"></span></small></div><button data-tech="${t.id}" id="tb-${t.id}">Research</button></div>`).join("");
$("#cmds").innerHTML=Object.keys(CM).map(id=>`<div class="row"><div><b>${CM[id].n}</b> <span id="cl-${id}"></span><br><small>${CM[id].d}<br><span id="cc-${id}"></span></small></div><button data-cmd="${id}" id="cb-${id}"></button></div>`).join("");
let qKey="";
function update(){
done();
checkEnd(); // v2.7: victory is a state, not just an event — re-check every tick so no ownership change can slip past
const r=rates(),now=Date.now();
R.forEach(k=>{$("#v-"+k).textContent=fmt(S.res[k]);$("#r-"+k).textContent=(r[k]>=0?"+":"")+r[k].toFixed(1)+"/s";const c=$("#c-"+k);if(c)c.textContent="of "+fmt(cap());const sb=$("#sb-"+k);if(sb)sb.style.width=Math.round(Math.max(0,Math.min(1,S.res[k]/cap()))*100)+"%";});
const fe=$("#fleet-empty"); if(fe) fe.hidden=!(total()===0&&S.sq.length===0);
syncMenuSound();
$("#cap").textContent="Storage holds "+fmt(cap())+" of each. Upgrade the Command Station to store more.";
const slots=scap();
$("#slots").textContent="Slots used: "+usedQ()+" / "+slots+". Ships burn a little energy each.";
$("#sq").textContent=S.sq.length?"Shipyard: "+S.sq.map(j=>U[j.k].n+" ("+left(j.end-now)+")").join(", "):"Shipyard idle ("+qcap()+" ships can be queued).";
for(const k in U){$("#n-"+k).textContent=S.ships[k]+(S.sq.some(j=>j.k===k)?" (+"+S.sq.filter(j=>j.k===k).length+")":"");$("#sc-"+k).disabled=S.ships[k]<1;const b=$("#sb-"+k),ok=S.bx.hangar>=U[k].h;
b.textContent=ok?"Build":"Hangar Lv"+U[k].h;b.disabled=!ok||usedQ()+U[k].sz>slots||S.sq.length>=qcap()||!can(U[k].c);$("#s5-"+k).disabled=$("#s10-"+k).disabled=b.disabled}
const s=SYS[S.sel],a=$("#atk"),inf=$("#info");
if(a||inf){
if(S.sel===0){if(inf)inf.innerHTML="<b>Home World</b><br><small>Your base. Build your station and fleet here.</small>";if(a){a.disabled=true;a.textContent="Home"}}
else{
const own=S.won.includes(S.sel),av=avail(S.sel);
if(inf)inf.innerHTML=`<b>${s.n}</b><br><small>${s.t.toUpperCase()} fleet. Bring ${WEAK[s.t]}s (+50%). Needs ${spw(S.sel)} power.${S.own[S.sel]?" Held by "+RV[S.own[S.sel]].n+".":""} Your fleet: ${fpower(S.sel).toFixed(1)}.<br>Loot: ${cstr(s.r)}<br>${own?"You own this system.":av?"Ready to attack.":secOf(S.sel)===1&&!hasJump()?"Requires Jump Drive research — Sector 2 is beyond normal range.":"Out of reach. Claim a neighboring system first."}</small>`;
if(a){a.disabled=own||!av||total()<1;a.textContent=own?"Owned":"Attack"}}}
baseUI(now);
upd2();
// v1.6: show ALL quests. Live v1.5: only completed + the first 3
// incomplete were shown, so q14 "Repel a rival raid" was invisible
// on a fresh profile (only Build a Crystal Mine / Build a Hangar /
// Launch your first ship were listed). Display only — no quest
// condition or reward changes.
const all=Q.filter(q=>!S.q.includes(q.id)),open=all.filter(q=>q.ok()).concat(all.filter(q=>!q.ok())),key=open.map(q=>q.id+(q.ok()?1:0)).join();
if(key!==qKey){qKey=key;$("#quests").innerHTML=open.length?open.map(q=>`<div class="row"><div>${q.t}<br><small>Reward: ${cstr(q.r)}</small>${q.id==="q14"?'<br><small>Raids start after about 10 minutes — repel one with a stronger fleet. How raids work: see the Empire page.</small>':""}</div><button data-claim="${q.id}" ${q.ok()?"":"disabled"}>Claim</button></div>`).join(""):"<small>All quests complete. Nice work, Commander.</small>"}
popupUI();empireUI();activityUI();progressBars();
draw();
}

const cv=$("#cv"),x=cv.getContext("2d"),st=$("#st"),y=st.getContext("2d");
// v0.9.3: size the internal canvas to the viewport aspect so planets are
// circles, not stretched ellipses. Called on load, on resize, and on tab
// switch (a hidden canvas reports 0 size, so keep the old size then).
function sizeCanvas(c){try{const r=c.getBoundingClientRect();if(!r||r.width<10||r.height<10)return;let w=Math.round(r.width),h=Math.round(r.height);const k=Math.min(1,1600/w,1200/h);w=Math.max(320,Math.round(w*k));h=Math.max(320,Math.round(h*k));if(c.width!==w||c.height!==h){c.width=w;c.height=h}}catch(e){}}
// v1.6: a resize refits the galaxy camera ONLY while it is still in
// its default fit state — otherwise a window resize would yank the
// camera away from wherever the player deliberately zoomed/panned it.
// v1.7: the same for the station — and this is also what keeps the
// bottom row of base tiles visible when the activity tray appears:
// the tray shrinks the safe height, so a fitted station camera must
// refit against the new safe area (live v1.6: the tray covered the
// bottom row because the station zoom never changed when it showed).
// activityUI already calls measureUI()+sizeCanvases() on every tray
// show/hide transition, so the refit happens automatically.
function sizeCanvases(){measureUI();sizeCanvas(cv);sizeCanvas(st);if(camFitted)fitCam();if(stCamFitted)(stFitKind==="fit"?fitStCam:homeStCam)();clampCam();clampStCam()}
if(typeof window!=="undefined"&&window.addEventListener)window.addEventListener("resize",()=>{sizeCanvases();update()});
sizeCanvases();
function pal(){const cs=getComputedStyle(document.documentElement),c={};[["b","--bg"],["h","--hi"],["m","--mid"],["f","--fg"]].forEach(a=>c[a[0]]=cs.getPropertyValue(a[1]).trim());return c}
function draw(){drawGalaxy(x,CAM,{sx:(cv.width||384)/2,sy:safeCyCv()});drawBase(y,STCAM,{sx:(st.width||384)/2,sy:safeCySt()});drawMinimap()} // v2.1: safeTop is no longer passed — labels sit a fixed 20px above their sprite with NO clamp (live v2.0: the clamp pinned labels to the top bar)
// v0.9.1 station: drag to pan, pinch / wheel / double-tap to zoom,
// tap a building to open it, tap an open plot to see what can be built there.
// Tap vs drag: a pointer that moves more than 8px is a drag, never a tap.
const stPointers=new Map();let stStart=null,stDrag=false,stPinch=0;
st.addEventListener("pointerdown",e=>{if(POP)return; // v1.4: map cannot steal a popup tap
if(st.setPointerCapture)try{st.setPointerCapture(e.pointerId)}catch(_){}stPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(stPointers.size===1){stStart={x:e.clientX,y:e.clientY};stDrag=false}else if(stPointers.size===2){const a=[...stPointers.values()];stPinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);stDrag=true}});
st.addEventListener("pointermove",e=>{if(!stPointers.has(e.pointerId))return;stPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const q=st.getBoundingClientRect();if(stPointers.size===2){const a=[...stPointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2;if(stPinch>0)setStZoom(STCAM.zoom*d/stPinch,(mx-q.left)/q.width*st.width,(my-q.top)/q.height*st.height);stPinch=d;update();return}if(stStart){const dx=e.clientX-stStart.x,dy=e.clientY-stStart.y;if(Math.abs(dx)+Math.abs(dy)>8)stDrag=true;if(stDrag){const sc=stScale();STCAM.cx-=dx/q.width*st.width/sc;STCAM.cy-=dy/q.height*st.height/sc;stStart={x:e.clientX,y:e.clientY};stCamFitted=false;clampStCam();update()}}});
const stEnd=e=>{stPointers.delete(e.pointerId);if(stPointers.size<2)stPinch=0;if(stPointers.size===0&&stStart&&!stDrag){const q=st.getBoundingClientRect(),sx=(e.clientX-q.left)/q.width*st.width,sy=(e.clientY-q.top)/q.height*st.height,w=stScreenToWorld(sx,sy);
 // v1.2 iso hit test: a tap on a tall building sprite must select that
 // building, not the plot behind it. Check buildings front-to-back
 // (highest x+y first) against their iso silhouette (isoBuildingHit),
 // then fall back to the ground diamond the tap lands in.
 let hit=null;
 [...S.bl].sort((a,b)=>(b.x+b.y)-(a.x+a.y)).some(b=>{if(isoBuildingHit(w.x,w.y,b,stScale())){hit=b;return true}return false});
 if(hit){if(S.place||S.mv)msg("That spot is taken.");else openBuilding(hit.u)}
 else{const cell=isoCellFromPoint(w.x,w.y),bx=cell.i,by=cell.j;if(bx>=0&&by>=0&&bx<12&&by<12){const at=bAt(bx,by);if(at){if(S.place||S.mv)msg("That spot is taken.");else openBuilding(at.u)}else if(S.place)placeB(S.place,bx,by);else if(S.mv){const b=S.bl.find(z=>z.u===S.mv);if(b){if(plotLocked(bx,by)){msg("Locked — upgrade the Command Station to Lv "+plotReqLv(bx,by)+" to unlock this plot.")}else{b.x=bx;b.y=by;S.mv=null;msg("Building moved.")}}else S.mv=null}else openPlot(bx,by)}}
 update();save()}stStart=null;stDrag=false};
st.addEventListener("pointerup",stEnd);st.addEventListener("pointercancel",stEnd);
st.addEventListener("wheel",e=>{if(e.preventDefault)e.preventDefault();const q=st.getBoundingClientRect();setStZoom(STCAM.zoom*(e.deltaY<0?1.15:1/1.15),(e.clientX-q.left)/q.width*st.width,(e.clientY-q.top)/q.height*st.height);update()},{passive:false});
st.addEventListener("dblclick",e=>{const q=st.getBoundingClientRect();setStZoom(STCAM.zoom>=4?1:4,(e.clientX-q.left)/q.width*st.width,(e.clientY-q.top)/q.height*st.height);update()});
// UI OVERHAUL v0.9 — interactive galaxy map: drag to pan, pinch / wheel /
// double-tap to zoom, tap to open a system. Tap vs drag: a pointer that
// moves more than 8px is a drag and never selects anything.
const pointers=new Map();let pStart=null,pDrag=false,pPinch=0;
cv.addEventListener("pointerdown",e=>{if(POP)return; // v1.4: map cannot steal a popup tap
if(cv.setPointerCapture)try{cv.setPointerCapture(e.pointerId)}catch(_){}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){pStart={x:e.clientX,y:e.clientY};pDrag=false}else if(pointers.size===2){const a=[...pointers.values()];pPinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);pDrag=true}});
cv.addEventListener("pointermove",e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const q=cv.getBoundingClientRect();if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2;if(pPinch>0)setZoom(CAM.zoom*d/pPinch,(mx-q.left)/q.width*cv.width,(my-q.top)/q.height*cv.height);pPinch=d;update();return}if(pStart){const dx=e.clientX-pStart.x,dy=e.clientY-pStart.y;if(Math.abs(dx)+Math.abs(dy)>8)pDrag=true;if(pDrag){camFitted=false;const sc=camScale();CAM.cx-=dx/q.width*cv.width/sc;CAM.cy-=dy/q.height*cv.height/sc;pStart={x:e.clientX,y:e.clientY};clampCam();update()}}});
const cvEnd=e=>{pointers.delete(e.pointerId);if(pointers.size<2)pPinch=0;if(pointers.size===0&&pStart&&!pDrag){const q=cv.getBoundingClientRect(),sx=(e.clientX-q.left)/q.width*cv.width,sy=(e.clientY-q.top)/q.height*cv.height,w=screenToWorld(sx,sy),lx=w.x/WORLD.px,ly=w.y/WORLD.px;let best=-1,bd=100;SYS.forEach((s,i)=>{if(secOf(i)!==SEC)return;const d=(s.x-lx)**2+(s.y-ly)**2;if(d<bd){bd=d;best=i}});if(best>=0)openSystem(best)}pStart=null;pDrag=false};
cv.addEventListener("pointerup",cvEnd);cv.addEventListener("pointercancel",cvEnd);
cv.addEventListener("wheel",e=>{if(e.preventDefault)e.preventDefault();const q=cv.getBoundingClientRect();setZoom(CAM.zoom*(e.deltaY<0?1.15:1/1.15),(e.clientX-q.left)/q.width*cv.width,(e.clientY-q.top)/q.height*cv.height);update()},{passive:false});
cv.addEventListener("dblclick",e=>{const q=cv.getBoundingClientRect();setZoom(CAM.zoom>=2?1:2,(e.clientX-q.left)/q.width*cv.width,(e.clientY-q.top)/q.height*cv.height);update()});
const popEl=$("#pop");
if(popEl){popEl.addEventListener("click",e=>{if(e.target===popEl)closePopup()});
popEl.addEventListener("pointerup",e=>{if(e.target===popEl)closePopup()});} // v1.4: backdrop works on touch too
document.addEventListener("keydown",e=>{if(e.key==="Escape"){const m=$("#menu");if(m&&!m.hidden&&m.classList.contains("open"))closeMenu();else if(POP)closePopup();else if(PAGE.kind!=="tab")goBack();}});
const mm=$("#mm");if(mm)mm.addEventListener("click",e=>{camFitted=false;const q=mm.getBoundingClientRect();CAM.cx=(e.clientX-q.left)/q.width*WORLD.w;CAM.cy=(e.clientY-q.top)/q.height*WORLD.h;clampCam();update()});
function handleBodyClick(e){
const b=e.target.closest("button");if(!b)return;
const d=b.dataset;ac();sfx("click");done();
if(d.tab){S.tab=d.tab;PAGE={kind:"tab"}}
else if(d.page){openEmpire()}
else if(d.back){goBack()}
else if(d.fly){const i=+d.fly;S.sel=i;PAGE={kind:"tab"};S.tab="map";flyTo(i)}
else if(d.zin){setZoom(CAM.zoom*1.25)}
else if(d.zout){setZoom(CAM.zoom/1.25)}
else if(d.zhome){homeCam()}
else if(d.zfit){fitCam()}
else if(d.sec){SEC=+d.sec;fitCam()}
else if(d.szin){setStZoom(STCAM.zoom*1.25)}
else if(d.szout){setStZoom(STCAM.zoom/1.25)}
else if(d.shome){homeStCam()}
else if(d.sfit){fitStCam()}
else if(d.place){const t=d.place;if(POP&&POP.kind==="plot"){placeB(t,POP.x,POP.y);closePopup()}}
else if(d.pclose){closePopup()}
else if(d.menu){openMenu()}
else if(d.mclose){closeMenu()}
else if(d.mitem){const m=d.mitem;closeMenu();if(m==="empire")openEmpire();else if(m==="log"){PAGE={kind:"log"};update()}else if(m==="howto"){showTut(0)}else if(m==="sound"){S.mute=S.mute?0:1;sfx("ok")}else if(m==="hide")setUIHidden(true);else if(m==="reset"){$("#rbox").hidden=false}}
else if(d.tutnext){if(TUT.i>=TUT_STEPS.length-1)closeTut(true);else{TUT.i++;tutRender()}}
else if(d.tutback){if(TUT.i>0){TUT.i--;tutRender()}}
else if(d.tutskip){closeTut(true)}
else if(d.tutdone){closeTut(true)}
else if(d.act){const a=d.act;
if(a.startsWith("bld:")){const u=+a.slice(4);S.tab="station";PAGE={kind:"tab"};openBuilding(u)}
else if(a.startsWith("col:")){const i=+a.slice(4);S.tab="map";PAGE={kind:"tab"};openSystem(i)} // v2.6: tap a colony upgrade job to jump to that system's popup
else if(a==="res"){S.tab="research";PAGE={kind:"tab"};update()}
else if(a==="ship"){S.tab="fleet";PAGE={kind:"tab"};update()}}
else if(d.hide){setUIHidden(true)}
else if(d.showui){setUIHidden(false)}
else if(d.skip){if(BT&&!BT.done){BT.f=59;bframe()}else $("#bbox").hidden=true}
else if(d.log){PAGE={kind:"log"};update()}
else if(d.bup){const b=S.bl.find(z=>z.u===S.bsel);if(b){const l=effL(b),c=cost(b.t,l);if(l<lvlCap(b.t)&&S.bq.length<bqcap()&&can(c)){pay(c);{const s0=Math.max(Date.now(),...S.bq.filter(j=>j.u===b.u).map(j=>j.end));S.bq.push({u:b.u,s:s0,end:s0+dur(l)*1000})}msg(B[b.t].n+" upgrade started.")}}}
else if(d.bmv){S.mv=S.mv===S.bsel?null:S.bsel;S.place=null;if(S.mv)closePopup()}
else if(d.bnew){S.place=S.place===d.bnew?null:d.bnew;S.mv=null;S.bsel=null}
else if(d.build){const k=d.build,u=U[k],n=+d.n||1;let ok=0;for(let j=0;j<n;j++){if(S.bx.hangar>=u.h&&usedQ()+u.sz<=scap()&&S.sq.length<qcap()&&can(u.c)){pay(u.c);const s0=Math.max(Date.now(),S.sq.length?S.sq[S.sq.length-1].end:0);S.sq.push({k,end:s0+DUR[k]*1000*tmul()*crewShipMul()});ok++}else break}if(ok)msg(ok+"x "+u.n+" construction started.")}
else if(d.claim){const q=Q.find(z=>z.id===d.claim);if(q&&q.ok()&&!S.q.includes(q.id)){S.q.push(q.id);for(const k in q.r)S.res[k]=Math.min(cap(),S.res[k]+q.r[k]);msg("Quest complete: "+q.t);sfx("claim")}}
else if(d.tech){const t=TECH.find(z=>z.id===d.tech);if(t&&!S.rq&&!S.tech.includes(t.id)&&(!t.req||S.tech.includes(t.req))&&can(t.c)){pay(t.c);S.rq={id:t.id,end:Date.now()+t.t*1000*tmul()*crewResMul()};msg("Research started: "+t.n)}}
else if(d.cmd){const id=d.cmd,c=CM[id],sl=c.t==="fleet"?"fleet":"station";if(!S.cmds.includes(id)){if(S.res.credits>=c.c){S.res.credits-=c.c;S.cmds.push(id);S.slot[sl]=id;msg(c.n+" joins your command.")}}else S.slot[sl]=S.slot[sl]===id?null:id}
else if(d.crew){const parts=d.crew.split(":"),k=parts[0],delta=+parts[1];const c=crewAt();if(["mine","ship","res"].includes(k)){if(delta>0&&crewTotal()<crewCap())c[k]=(c[k]||0)+1;else if(delta<0&&(c[k]||0)>0)c[k]--;}}
else if(d.scrap){const k=d.scrap;if(S.ships[k]>0){S.ships[k]--;for(const r in U[k].c)S.res[r]=Math.min(cap(),S.res[r]+Math.floor(U[k].c[r]/2));msg(U[k].n+" scrapped. Half its cost was refunded.")}}
else if(d.cspec){const i=S.sel,c=colAt(i);if(i>0&&S.won.includes(i)&&c&&!c.spec&&COLSPEC[d.cspec]){c.spec=d.cspec;msg("Colony on "+SYS[i].n+" focuses on "+COLSPECNAME[d.cspec]+" — it now earns +"+(COL_INC*c.l).toFixed(1)+" "+COLSPEC[d.cspec]+"/s.")}}
else if(d.cup){const i=S.sel,c=colAt(i);if(i>0&&S.won.includes(i)&&c&&c.l<COL_MAX&&!S.bq.some(j=>j.col===i)&&S.bq.length<bqcap()){const cc=colUpCost(c.l);if(can(cc)){pay(cc);const s0=Math.max(Date.now(),...S.bq.filter(j=>j.col===i).map(j=>j.end));S.bq.push({col:i,s:s0,end:s0+colDur(c.l)*1000});msg("Colony upgrade started on "+SYS[i].n+".")}}}
else if(d.dip){const parts=d.dip.split(":"),kind=parts[0],id=parts[1];
if(!RV[id]||!heldCount(id))return; // a defeated faction has nothing to offer
if(S.res.credits<DIP[kind])return; // cannot afford it
const rel=dipRel(id);
if(kind==="tribute"&&(rel==="truce"||rel==="pact"||rel==="ally"))return;
if(kind==="pact"&&(rel==="pact"||rel==="ally"))return;
if(kind==="ally"&&rel==="ally")return;
if(!S.dip[id])S.dip[id]={};
S.res.credits-=DIP[kind];
if(kind==="tribute"){S.dip[id].truceUntil=Date.now()+DIP.TRUCE_MS;msg("You paid tribute to the "+RV[id].n+" — a 30-minute truce. They will not raid you while it lasts.");}
if(kind==="pact"){S.dip[id].pact=1;delete S.dip[id].truceUntil;msg("You signed a pact with the "+RV[id].n+" — neither side will raid the other.");}
if(kind==="ally"){S.dip[id].ally=1;delete S.dip[id].pact;delete S.dip[id].truceUntil;msg("The "+RV[id].n+" is now your ally — they will never raid you, and will raid your enemies instead.");}
sfx("ok")}
else if(d.gsend||d.grecall){const i=S.sel,k=d.gsend||d.grecall;if(i>0&&S.won.includes(i)){if(!S.gar)S.gar={};const g=S.gar[i]||(S.gar[i]={fighter:0,cruiser:0,capital:0});if(d.gsend){if(S.ships[k]>0){S.ships[k]--;g[k]=(g[k]||0)+1;msg("1 "+U[k].n+" sent to "+SYS[i].n+".")}}else if(g[k]>0){g[k]--;S.ships[k]++;msg("1 "+U[k].n+" recalled from "+SYS[i].n+" to your home fleet.")}}}
else if(d.atk){
const i=S.sel,s=SYS[i];if(!avail(i)||total()<1)return;
// v2.7: attacking a faction's system breaks any truce, pact or
// alliance with that faction instantly — the popup warns first.
const holder=S.own[i];
if(holder){const rel=dipRel(holder);if(rel==="truce"||rel==="pact"||rel==="ally"){const dd=dipAt(holder);delete dd.pact;delete dd.ally;delete dd.truceUntil;msg("You broke the "+(rel==="ally"?"alliance":rel)+" with the "+RV[holder].n+" by attacking "+s.n+"!")}}
const p=fpower(i)*(.85+Math.random()*.3),pre={...S.ships},need=spw(i),win=p>=need;HOLD=true;
if(win){for(const k in U)S.ships[k]=Math.ceil(S.ships[k]*Math.min(.95,.7+tsum("keep")));if(S.own[i]){S.cap++;delete S.own[i]}delete S.gar[i];S.won.push(i);
// v2.6: conquering founds a colony — level 1, no focus chosen yet.
// (A re-conquered system gets a FRESH one: the raid-loss path
// deletes the old colony, so this never resurrects a lost level.)
if(i>0){if(!S.col)S.col={};S.col[i]={l:1,spec:null};if(!S.stab)S.stab={};S.stab[i]=100}
checkEnd();
for(const k in s.r)S.res[k]=Math.min(cap(),S.res[k]+s.r[k]);
gain("fleet",2);msg(i===15?"You conquered the Dark Nexus. The galaxy is yours!":i===7?"The Hive Core falls, but the galaxy is bigger than you thought.":"Victory! "+s.n+" is yours and now pays you credits.")}
else{for(const k in U)S.ships[k]=Math.floor(S.ships[k]*(.4+tsum("keep")));msg("Defeat. Your fleet retreats with heavy losses. Build the ship type this enemy is weak to, or upgrade the Command Station.")}
closePopup();
battle(win,pre,s,p,need);
}
else if(b.id==="snd"){S.mute=S.mute?0:1;sfx("ok")}
else if(b.id==="reset"){$("#rbox").hidden=false}
else if(d.rcancel){$("#rbox").hidden=true}
else if(d.rgo){S=fresh();recalc();qKey="";hideEnd();$("#rbox").hidden=true;msg("A new empire begins.")}
else if(d.endkeep){hideEnd()}
else if(d.endnew){S=fresh();recalc();qKey="";hideEnd();$("#rbox").hidden=true;msg("A new empire begins.")}
update();save();
}
// v1.4 popup touch: click path — ignore a click that is really the
// tail of the tap that opened the popup, or the click that follows
// a pointerup activation (which already fired the action).
document.body.addEventListener("click",e=>{
if(Date.now()<popClickGuard)return;
const t=e.target;
if(t&&t.closest&&t.closest("#pop")&&Date.now()-popOpenAt<350)return;
handleBodyClick(e)});
// v1.4 popup touch: pointerup path — a tap on a POPUP button fires
// immediately on pointerup (no waiting for click), with a <12px
// movement threshold so drags/scrolls do not activate buttons.
let downBtn=null,downX=0,downY=0;
document.body.addEventListener("pointerdown",e=>{
const b=e.target&&e.target.closest?e.target.closest("button"):null;
downBtn=(b&&b.closest&&(b.closest("#pop")||b.closest("#activity")))?b:null;downX=e.clientX;downY=e.clientY});
document.body.addEventListener("pointerup",e=>{
if(!downBtn)return;
const b=e.target&&e.target.closest?e.target.closest("button"):null;
const btn=downBtn;downBtn=null;
if(b!==btn||b.disabled)return;
if(Math.abs(e.clientX-downX)>=12||Math.abs(e.clientY-downY)>=12)return;
popClickGuard=Date.now()+600; // swallow the click that follows
handleBodyClick(e)});

function rstr(id){const f=RV[id]||{b:150,eco:1};let k=0;for(const i in S.own)if(S.own[i]===id)k++;return f.b*(1+Math.min(5,S.min*.02))*(1+.1*k)*(.8+.2*(f.eco||1))}
function nb(id,i){return Object.keys(S.own).some(j=>S.own[j]===id&&adj(i,+j))}
function dpower(){let p=0;for(const k in U)p+=S.ships[k]*U[k].pw;return p*(1+.2*(S.b.command-1))*(1+tsum("pw"))*(1+cb("fleet"))*1.2}
// v2.4 LIVING WORLD — one shared cycle clock for every faction.
// A cycle is 5 real minutes (300000ms). Per cycle per faction: ONE
// claim attempt (if it holds < 6 systems, with probability exp) and
// ONE raid attempt (with probability agg x 0.7, only after 10 minutes
// of play). The old code DISCARDED the backlog when a clock fell more
// than 12 min (claims) / 10 min (raids) behind — rivals froze while
// the player was away. Backlog is now NEVER discarded: during play
// each faction runs one cycle per 250ms tick when its clock is due,
// and on load offlineSim() simulates up to 24 cycles (2h) for the
// away period. Claims keep the old eligibility verbatim (neutral,
// adjacent to faction territory, systems 1-3 need S.min>=45 — the
// (i>=4||S.min>=45) filter — and never the Dark Nexus or Home World).
// Starting systems, in order c, v, k, a, m, first-free from each list,
// never 0/1/2/3/15. v2.5: the three new factions relocated to Sector 2
// (see RV_START below).
const CYCLE_MS=300000,CYCLE_CAP=24;
// v2.5: k/a/m start in Sector 2 — Keth at Ember Drift (16), Aurelian
// at Gilded Throne (31), Vortex at Stormbreak Point (19). c/v keep
// their Sector 1 homes (14/11). First-free from each list, as before.
const RV_START={c:[14,13,12],v:[11,10,9],k:[16,20,17],a:[31,27,30],m:[19,18,23]};
// Defensive clock state: an old save's rv may lack a faction or still
// carry the v2.3 cl/rd fields (load() normalises the usual case; this
// covers a save that bypassed it). The old clock is carried forward,
// never reset.
function rvState(id){if(!S.rv||typeof S.rv!=="object")S.rv={};let r=S.rv[id];if(!r||typeof r!=="object"){r={cy:Date.now()};S.rv[id]=r}if(r.cy===undefined){r.cy=Math.min(r.cl||Date.now(),r.rd||Date.now());delete r.cl;delete r.rd}return r}
const heldCount=id=>Object.keys(S.own).filter(j=>S.own[j]===id).length;
// v2.7 DIPLOMACY — S.dip maps faction id -> {truceUntil, pact, ally}.
// S.war (v2.4) is kept as the "has taken one of your systems" history
// flag; relation precedence is ally > pact > truce > war > peace, so a
// pacted ex-enemy still reads as pacted. A truce is a real-time
// 30-minute expiry; pacts and alliances have no expiry but can be
// betrayed (see rivalCycle) or broken by the player attacking that
// faction's system (see the d.atk handler).
const DIP={tribute:300,pact:500,ally:1000,TRUCE_MS:1800000};
const dipAt=id=>{if(!S.dip||typeof S.dip!=="object")S.dip={};return S.dip[id]||{}};
const dipTruce=id=>{const d=dipAt(id);return !!(d.truceUntil&&d.truceUntil>Date.now())};
const dipRel=id=>{const d=dipAt(id);if(d.ally)return "ally";if(d.pact)return "pact";if(dipTruce(id))return "truce";if(S.war&&S.war[id])return "war";return "peace"};
const dipRelWord=id=>({truce:"truce",pact:"pact",ally:"alliance"}[dipRel(id)]||"");
function relText(id){
  if(!heldCount(id))return "defeated";
  const r=dipRel(id);
  if(r==="ally")return "Allied";
  if(r==="pact")return "Pact";
  if(r==="truce")return "Truce — "+Math.max(1,Math.ceil((dipAt(id).truceUntil-Date.now())/60000))+" min left";
  if(r==="war")return "At war";
  return "Peace";
}
// v2.7 RIVAL-PAIR DIPLOMACY — S.pair maps "a-b" (ids sorted) ->
// "pact" | "war". Bordering rival pairs only. Pacts stop their mutual
// raids; wars raise the raid probability x1.5 (see rivalCycle).
const pairKey=(a,b)=>a<b?a+"-"+b:b+"-"+a;
const pairRel=(a,b)=>(S.pair||{})[pairKey(a,b)]||null;
const bordering=(a,b)=>Object.keys(S.own).some(j=>S.own[j]===a&&Object.keys(S.own).some(k=>S.own[k]===b&&adj(+j,+k)));
function rivalDiplomacy(){
  if(!S.pair||typeof S.pair!=="object")S.pair={};
  const ids=Object.keys(RV);
  for(let x=0;x<ids.length;x++)for(let y=x+1;y<ids.length;y++){
    const a=ids[x],b=ids[y];
    if(!heldCount(a)||!heldCount(b)||!bordering(a,b))continue;
    const k=pairKey(a,b),rel=S.pair[k],avg=(((RV[a].agg||0)+(RV[b].agg||0))/2);
    if(rel==="pact"){if(Math.random()<avg*.1){delete S.pair[k];msg("The "+RV[a].n+" and the "+RV[b].n+" broke their pact!")}continue}
    if(rel==="war")continue; // wars persist until one side is gone
    const r=Math.random(),pactP=(1-avg)*.1,warP=avg*.1;
    if(r<pactP){S.pair[k]="pact";msg("The "+RV[a].n+" and the "+RV[b].n+" signed a pact.")}
    else if(r<pactP+warP){S.pair[k]="war";msg("The "+RV[a].n+" declared war on the "+RV[b].n+"!")}
  }
}
// v2.7 VICTORY / DEFEAT — one checkEnd() after every ownership
// change (attack win, raid resolution, cycle claims, offline sim, and
// update() as a backstop). Victory: hold 13 systems (40% of 32) OR
// twice the next faction's count. Each achievement shows its overlay
// once (S.end.v13 / S.end.v2x); "Keep playing" continues. Defeat:
// Home World falls (S.end.lost) — overlay with restart only.
const VICTORY_SYSTEMS=13;
function nextFaction(){let best=null,bn=0;for(const id in RV){const n=heldCount(id);if(n>bn){bn=n;best=id}}return{id:best,n:bn}}
function checkEnd(){
  if(!S.end||typeof S.end!=="object")S.end={};
  if(S.end.lost)return;
  if(!S.end.v13&&S.won.length>=VICTORY_SYSTEMS){S.end.v13=1;showEnd("win","13");return}
  const nx=nextFaction();
  if(!S.end.v2x&&nx.id&&nx.n>=1&&S.won.length>=2*nx.n){S.end.v2x=1;showEnd("win","2x")}
}
function endStats(){const nx=nextFaction();return "You hold "+S.won.length+" of "+SYS.length+" systems."+(nx.id?" The next strongest faction is the "+RV[nx.id].n+" with "+nx.n+".":" No rival holds any systems.")}
function showEnd(kind,how){
  const t=$("#end-title"),s=$("#end-stats"),k=$("#end-keep"),box=$("#end");
  if(!t||!s||!box)return;
  if(kind==="win"){t.textContent="Victory! The galaxy is yours.";s.textContent=(how==="13"?"You hold 13 systems — 40% of the galaxy. ":"You hold twice as many systems as the next faction. ")+endStats();if(k)k.hidden=false;msg("Victory! "+(how==="13"?"You hold 13 systems.":"You hold twice as many systems as the next faction."));sfx("win")}
  else{t.textContent="Defeat — your Home World has fallen.";s.textContent="A rival fleet overran your Home World. Your empire is scattered. "+endStats();if(k)k.hidden=true;msg("Defeat — your Home World has fallen.");sfx("lose")}
  box.hidden=false;
}
function hideEnd(){const b=$("#end");if(b)b.hidden=true}
// v2.7 STABILITY — colonies far from Home rebel unless garrisoned.
// Stability 100; -1/cycle if the garrison is empty AND the system is
// >=3 link-hops from Home (BFS over systems you own); +5/cycle if
// garrisoned (max 100). At 0 the system defects to the neighbouring
// faction with the most adjacent systems (or goes neutral if none);
// its colony + garrison are deleted, feed line logged. Runs once per
// 5-minute cycle from rivalTick (S.stabCy gate).
function hopsFromHome(){const hops={0:0},q=[0];while(q.length){const i=q.shift();for(const j of SYS[i].l){if(S.won.includes(j)&&hops[j]===undefined){hops[j]=hops[i]+1;q.push(j)}}}return hops}
function stabTick(){
  if(!S.stab||typeof S.stab!=="object")S.stab={};
  const hops=hopsFromHome();
  for(const i of S.won.slice()){
    if(i===0)continue;const c=colAt(i);if(!c)continue;
    if(S.stab[i]===undefined)S.stab[i]=100;
    const g=garAt(i),hasGar=g.fighter+g.cruiser+g.capital>0;
    if(hasGar)S.stab[i]=Math.min(100,S.stab[i]+5);
    else if((hops[i]===undefined?99:hops[i])>=3)S.stab[i]-=1;
    if(S.stab[i]<=0){
      const counts={};for(const j of SYS[i].l){const o=S.own[j];if(o)counts[o]=(counts[o]||0)+1}
      let best=null,bn=0;for(const o in counts)if(counts[o]>bn){bn=counts[o];best=o}
      S.won.splice(S.won.indexOf(i),1);delete S.gar[i];delete S.col[i];delete S.stab[i];
      if(best){S.own[i]=best;msg("The colony on "+SYS[i].n+" rebelled and joined the "+RV[best].n+"!")}
      else msg("The colony on "+SYS[i].n+" rebelled and declared independence!");
    }
  }
}
function rivalCycle(id,offline,lost){
  // One 5-minute cycle for one faction. offline=true when called from
  // offlineSim(); lost is the per-return loss counter (at most ONE of
  // your systems per faction per return).
  if(!heldCount(id))return;
  const f=RV[id]||{b:150,agg:.7,exp:.5,eco:1};
  // (a) CLAIM — one random eligible neutral adjacent system.
// v2.5: the claim filter now spans BOTH sectors (was i<15): the Dark
// Nexus (15) is still never claimed, and a Sector 2 system is only
// eligible once the faction's jump drives are online (S.min>=60).
// The S.min>=45 rule for index>=4 covers all of Sector 2 anyway.
  if(heldCount(id)<6&&Math.random()<(f.exp||0)){
    const c=SYS.map((s,i)=>i).filter(i=>i>0&&i!==15&&!S.won.includes(i)&&!S.own[i]&&nb(id,i)&&(i>=4||S.min>=45)&&(secOf(i)===0||S.min>=60));
    if(c.length){const i=c[Math.floor(Math.random()*c.length)];S.own[i]=id;msg(f.n+" claimed "+SYS[i].n+".")}
  }
  // (b) RAID — target pool is your adjacent systems PLUS other
  // factions' adjacent systems (rival-vs-rival: raids are the only way
  // factions take from each other; claims never target held systems).
  // v2.7 DIPLOMACY: a pacted faction may BETRAY each cycle
  // (probability agg x 0.05 — the pact ends and the raid resolves
  // normally that cycle); an ally betrays far more rarely (agg x
  // 0.01). The betrayal roll runs before the raid roll, every cycle.
  const d=dipAt(id);
  let betrayed=null;
  if(d.pact&&Math.random()<(f.agg||0)*.05){delete d.pact;betrayed="pact"}
  else if(d.ally&&Math.random()<(f.agg||0)*.01){delete d.ally;betrayed="alliance"}
  if(betrayed)msg(f.n+" broke the "+betrayed+" with you!");
  const rel=dipRel(id);
  // v2.7: a faction at war with a bordering rival raids at x1.5
  // probability (capped at 1) — wars are hotter than cold peace.
  const atWarBorder=Object.keys(RV).some(o=>o!==id&&pairRel(id,o)==="war"&&bordering(id,o));
  const raidP=Math.min(1,(f.agg||0)*.7*(atWarBorder?1.5:1));
  if(S.min<10||Math.random()>=raidP){checkEnd();return}
  // v2.7: a truce, pact or alliance means this faction cannot raid
  // YOU at all (rival-vs-rival raids still happen). An ally raids
  // only YOUR enemies (factions flagged in S.war) instead. A pacted
  // rival is never a raid target either (pair pact). Home World (0)
  // joins the pool ONLY live (never offline) and ONLY if the faction
  // owns a system adjacent to Home (1 or 2) — Home defence is the
  // FULL home fleet (sysDef(0) = dpower()).
  let mine=[];
  if(rel!=="truce"&&rel!=="pact"&&rel!=="ally"){
    mine=S.won.filter(i=>i>0&&nb(id,i));
    if(!offline&&S.won.includes(0)&&nb(id,0))mine.push(0);
  }
  let theirs=[];for(const j in S.own)if(S.own[j]!==id&&nb(id,+j)&&pairRel(id,S.own[j])!=="pact")theirs.push(+j);
  if(rel==="ally")theirs=theirs.filter(j=>S.war&&S.war[S.own[j]]);
  if(!mine.length&&!theirs.length){checkEnd();return}
  const pool=mine.map(i=>({i,who:"you"})).concat(theirs.map(i=>({i,who:S.own[i]}))).filter(t=>secOf(t.i)===0||S.min>=60); // v2.5: no raids INTO Sector 2 before the faction's jump drives come online (S.min>=60) — same rule as claims
  if(!pool.length){checkEnd();return}
  const t=pool[Math.floor(Math.random()*pool.length)];
  // Offline cap: at most ONE of your systems per faction per return.
  // The attempt is spent when the target is yours (no re-pick onto a
  // rival) — but rival-vs-rival raids are NOT capped.
  if(t.who==="you"&&offline&&lost&&lost[id]){checkEnd();return}
  const rp=rstr(id)*(.85+Math.random()*.3);
  if(t.who==="you"){
    const def=sysDef(t.i),gar=Math.round(garPow(t.i)*garMult()),col=Math.round(colDef(t.i)),home=Math.round(.5*dpower());
    // v2.6: the split names the colony term when a colony stands
    // ("garrison 528 + colony 75 + home fleet 3"); with no colony it
    // reads exactly as v2.4 did ("garrison 0 + home fleet 3").
    // v2.7: at Home the split is just the full home fleet.
    const split=t.i===0?"home fleet "+Math.round(dpower())+" (your full fleet)":"garrison "+gar+(col>0?" + colony "+col:"")+" + home fleet "+home;
    if(rp>def){
      S.won.splice(S.won.indexOf(t.i),1);S.own[t.i]=id;delete S.gar[t.i];
      // v2.6: a lost system loses its colony too — re-conquering
      // later founds a fresh level-1 colony with no focus chosen.
      if(S.col)delete S.col[t.i];
      if(S.stab)delete S.stab[t.i];
      S.war[id]=1;if(offline&&lost)lost[id]=1;
      // v2.7: losing Home World is DEFEAT — overlay with restart.
      if(t.i===0){if(!S.end||typeof S.end!=="object")S.end={};S.end.lost=1;msg(f.n+" overran your Home World (raid "+Math.round(rp)+" vs your defence "+Math.round(def)+" — "+split+")!");showEnd("lose");sfx("lose")}
      else{msg(f.n+" raided "+SYS[t.i].n+" (raid "+Math.round(rp)+" vs your defence "+Math.round(def)+" — "+split+") and took it!");sfx("alert")}
    }else{S.rep++;gain("fleet",1);msg("Your fleet repelled "+f.n+" at "+SYS[t.i].n+" (raid "+Math.round(rp)+" vs your defence "+Math.round(def)+" — "+split+").");sfx("ok")}
  }else{
    // Rival-vs-rival: rival systems have no garrisons in v2.4 (that is
    // a v2.6 colony concern) — the defender fights at rstr x 0.6.
    // A failed raid changes nothing and logs nothing (no feed spam).
    if(rp>rstr(t.who)*.6){S.own[t.i]=id;msg(f.n+" seized "+SYS[t.i].n+" from the "+RV[t.who].n+".")}
  }
  checkEnd();
}
function rivalTick(){const now=Date.now();
if(!S.rvi){S.rvi=1;const pick=l=>l.find(i=>!S.won.includes(i)&&!S.own[i]);for(const id of["c","v","k","a","m"]){const a=pick(RV_START[id]);if(a!==undefined)S.own[a]=id}}
for(const k in S.own)if(S.won.includes(+k))delete S.own[k];
// v2.7: truces expire in real time — prune + log once when noticed.
for(const id in RV){const d=dipAt(id);if(d.truceUntil&&d.truceUntil<=now){delete d.truceUntil;msg("Your truce with the "+RV[id].n+" has expired.")}}
// v2.7: rival-pair diplomacy + colony stability run once per cycle
// (5 min), gated on their own clocks so the 250ms tick never
// re-rolls them.
if(now-(S.pairCy||0)>=CYCLE_MS){S.pairCy=now;rivalDiplomacy()}
if(now-(S.stabCy||0)>=CYCLE_MS){S.stabCy=now;stabTick()}
for(const id in RV){const r=rvState(id);
if(!heldCount(id)){r.cy=now;continue} // no territory: no actions, clock stays current
if(now-r.cy>=CYCLE_MS){r.cy+=CYCLE_MS;rivalCycle(id,false,null)}}}
// v2.4 OFFLINE SIMULATION — rivals advance on the same clock while
// you are away, capped at 24 cycles (2h) per return. Home World
// (system 0) can never be a raid target (it already isn't — the raid
// pool is i>0 only), and each faction takes at most ONE of your
// systems per return; claims simulate normally (rivals MUST gain
// ground while you are away — that is the point of the shared clock).
// Called once, at load, from the top-level away block (which runs
// exactly once per page load, right after step(away) advances S.min).
// Offline production itself is UNCHANGED: full rate, 8h cap, storage
// cap — the balance now comes from rivals advancing + garrisons.
function offlineSim(away){
  const cycles=Math.min(CYCLE_CAP,Math.floor(away/300));
  if(cycles<1)return;
  const lost={};
  const before={};for(const id in RV)before[id]=heldCount(id);
  const wonBefore=S.won.length;
  for(let c=0;c<cycles;c++)for(const id in RV)rivalCycle(id,true,lost);
  for(const id in RV)rvState(id).cy=Date.now(); // backlog processed (capped) — don't replay it live
  const parts=[];
  for(const id in RV){const n=heldCount(id);if(n>before[id])parts.push(RV[id].n+" claimed "+(n-before[id])+" system"+(n-before[id]>1?"s":""));if(lost[id])parts.push(RV[id].n+" raided one of your systems")}
  const lostN=wonBefore-S.won.length;
  msg("While you were away: "+(parts.length?parts.join("; "):"the rivals made no moves")+(lostN?". You lost "+lostN+" system"+(lostN>1?"s":"")+".":". You lost nothing."));
}
let BT=null;
const nU=o=>o.fighter+o.cruiser+o.capital;
function battle(win,pre,s,p,need){const text=HELD;HOLD=false;
const ps=[];["capital","cruiser","fighter"].forEach(k=>{for(let n=0;n<pre[k]&&ps.length<12;n++)ps.push(k)});
if(BT&&BT.iv)clearInterval(BT.iv);
BT={f:0,win,ps,en:s.t==="swarm"?10:s.t==="armored"?6:3,t:s.t,keep:nU(S.ships)/Math.max(1,nU(pre)),lp:ps.length,le:99,done:0,lost:nU(pre)-nU(S.ships),msg:text};
$("#bbox").hidden=false;$("#bskip").textContent="Skip";$("#bcap").textContent="Power "+Math.round(p)+" vs "+need;
BT.iv=setInterval(bframe,70)}
function bframe(){const b=BT;if(!b||b.done)return;b.f++;const f=b.f,t=Math.min(1,f/50),q=$("#bt").getContext("2d"),SP=SPR();b.fx=b.fx||[];
if(!b.pp){const ps=b.ps.map(k=>SP[k]),es=Array(b.en).fill(SP["e"+b.t]);b.pp=lay(ps,6,6,88);b.ee=lay(es,0,6,88).map((p,i)=>({x:186-p.x-es[i].width,y:p.y}));b.lp=b.pp.length;b.le=99}
const np=b.pp.length,ne=b.ee.length,pa=Math.round(np*(1-(1-b.keep)*t)),ea=Math.ceil(ne*(b.win?1-t:1-.3*t));
if(b.le===99)b.le=ea;
if(ea<b.le){for(let i=ea;i<b.le;i++)b.fx.push({x:b.ee[i].x+10,y:b.ee[i].y+6,f});b.le=ea;boom()}
if(pa<b.lp){for(let i=pa;i<b.lp;i++)b.fx.push({x:b.pp[i].x+10,y:b.pp[i].y+6,f});b.lp=pa;boom()}
q.drawImage(BBG(),0,0);
for(let i=0;i<30;i++){q.fillStyle=i%3?"#5a6bb0":"#cfd8ff";q.fillRect((i*37+f*(1+i%3))%191,(i*53)%95,1,1)}
const E=SP["e"+b.t];
for(let i=0;i<pa;i++)q.drawImage(SP[b.ps[i]],b.pp[i].x,b.pp[i].y+Math.round(Math.sin((f+i*3)/4)));
for(let i=0;i<ea;i++)q.drawImage(E,b.ee[i].x,b.ee[i].y+Math.round(Math.sin((f+i*5)/4)));
if(pa&&ea)for(let j=0;j<3;j++){const a=(f+j*5)%pa,e=(f*3+j*7)%ea,u=(f*.12+j*.33)%1,A=SP[b.ps[a]],sx=b.pp[a].x+A.width,sy=b.pp[a].y+A.height/2,ex=b.ee[e].x,ey=b.ee[e].y+E.height/2;
q.fillStyle="#9be8ff";q.fillRect(Math.round(sx+(ex-sx)*u),Math.round(sy+(ey-sy)*u),5,2);
const a2=(f*2+j*3)%ea,e2=(f+j*4)%pa,w=(f*.1+j*.3)%1,B2=SP[b.ps[e2]],tx=b.ee[a2].x,ty=b.ee[a2].y+E.height/2,rx=b.pp[e2].x+B2.width,ry=b.pp[e2].y+B2.height/2;
q.fillStyle="#ff6b6b";q.fillRect(Math.round(tx+(rx-tx)*w),Math.round(ty+(ry-ty)*w),5,2)}
if(f%6===0&&pa&&ea)sfx("laser");
b.fx=b.fx.filter(e=>f-e.f<8);b.fx.forEach(e=>{const g=f-e.f,s=3+g*2,cl=["#ffffff","#ffe066","#ff9a3c","#e0584a"];q.fillStyle=cl[Math.min(3,g>>1)];q.fillRect(e.x-(s>>1),e.y-(s>>1),s,s);q.fillStyle=cl[Math.min(3,(g>>1)+1)];q.fillRect(e.x-(s>>2),e.y-(s>>2),s>>1,s>>1)});
if(f>=60)bend()}
function bend(){const b=BT;if(b.done)return;b.done=1;clearInterval(b.iv);msg(b.msg);sfx(b.win?"win":"lose");$("#bcap").textContent=b.msg+" Ships lost: "+b.lost+".";$("#bskip").textContent="Close"}
function recalc(){const b={},m={};for(const t in B){b[t]=0;m[t]=0}S.bl.forEach(x=>{b[x.t]+=x.l;m[x.t]=Math.max(m[x.t],x.l)});S.b=b;S.bx=m}
function placeB(t,x,y){if(plotLocked(x,y)){msg("Locked — upgrade the Command Station to Lv "+plotReqLv(x,y)+" to unlock this plot.");S.place=null;return}const c=newCost(t);if(cnt(t)<MAXC(t)&&S.bq.length<bqcap()&&can(c)){pay(c);const b={u:S.nu++,t,x,y,l:0};S.bl.push(b);S.bq.push({u:b.u,s:Date.now(),end:Date.now()+dur(0)*1000});S.bsel=b.u;msg(B[t].n+" construction started.")}S.place=null}
function baseUI(now){
if(!$("#binfo"))return; // v0.9.2: station info/build boxes removed — popups cover this now.
const sel=S.bl.find(b=>b.u===S.bsel);
$("#bq").textContent=S.bq.length?"Building: "+S.bq.map(j=>{if(j.col!==undefined){const c=colAt(j.col);return c?"Colony Lv "+(c.l+1)+" on "+SYS[j.col].n+" ("+left(j.end-now)+")":""}const b=S.bl.find(z=>z.u===j.u);return b?B[b.t].n+" ("+left(j.end-now)+")":""}).join(", ")+". Builders busy: "+S.bq.length+"/"+bqcap()+".":"Builders idle (up to "+bqcap()+" jobs at once).";
for(const t in B){const n=cnt(t),mx=MAXC(t),c=newCost(t),b=$("#bmb-"+t);$("#bmn-"+t).textContent=n+"/"+mx;
$("#bmc-"+t).textContent=n>=mx?(t==="command"?"Only one allowed.":"Upgrade the Command Station for more copies."):"Cost: "+cstr(c)+". Time: "+left(dur(0)*1000);
b.textContent=S.place===t?"Cancel":"Place";b.disabled=S.place===t?false:(n>=mx||S.bq.length>=bqcap()||!can(c))}
const hint=S.place?"Tap an empty spot on the map to place your "+B[S.place].n+".":S.mv?"Tap an empty spot on the map to move it.":"Tap a building to see its stats. Buildings produce at full rate wherever they stand.";
if(!sel){$("#bi-name").textContent="Your base";$("#bi-stats").textContent=hint;$("#bi-cost").textContent="";$("#bi-up").hidden=true;$("#bi-mv").hidden=true}
else{const t=sel.t,e=effL(sel),max=e>=lvlCap(t),c=cost(t,e),m=mult(sel),pr=Object.keys(B[t].p)[0];
$("#bi-name").textContent=B[t].n+" Lv "+sel.l+(e>sel.l?" (+"+(e-sel.l)+" queued)":"");
let st=B[t].d+". ";
if(sel.l===0)st="Under construction. ";
else if(pr)st+="Makes +"+(B[t].p[pr]*sel.l*m*(1+tsum("eco"))*(1+cb("econ"))).toFixed(1)+" "+pr+"/s. ";
else if(t==="hangar")st+="Holds "+(5+tsum("slot"))*sel.l+" ship slots. ";
else st+="Max building level "+lvlCap("hangar")+", storage "+fmt(cap())+". ";
$("#bi-stats").textContent=st+hint;
$("#bi-cost").textContent=max?(t==="command"?"Max level.":"Upgrade the Command Station to go higher."):"Upgrade to Lv "+(e+1)+": "+cstr(c)+". Time: "+left(dur(e)*1000);
$("#bi-up").hidden=false;$("#bi-mv").hidden=false;$("#bi-up").disabled=max||S.bq.length>=bqcap()||!can(c);$("#bi-mv").textContent=S.mv===sel.u?"Cancel move":"Move"}}
function showTab(){const t=S.tab||"map",pg=PAGE.kind;document.querySelectorAll("[data-pg]").forEach(e=>{e.hidden=pg==="tab"?e.dataset.pg!==t:e.dataset.pg!==pg});sizeCanvases();if(pg==="tab"&&t==="station"&&!stFitted)homeStCam(); /* v1.5: first visit to the Station tab fits the cluster; user pan/zoom after that is preserved */ document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("on",pg==="tab"&&b.dataset.tab===t));document.querySelectorAll("[data-sec]").forEach(b=>b.classList.toggle("on",+b.dataset.sec===SEC)); /* v2.5: sector toggle shows the active sector */if(pg==="log"){const h=$("#hlog");if(h)h.innerHTML=S.feed.slice().reverse().map(x=>"<div class=\"row\">"+x+"</div>").join("")||"<small class=\"empty\">No events yet.</small>";}const n=Q.filter(q=>!S.q.includes(q.id)&&q.ok()).length;const bd=$("#tq-badge");if(bd){bd.hidden=!n;bd.textContent=n||""}else{const tq=$("#tq");if(tq)tq.textContent=n?"Quests ("+n+")":"Quests"}$("#snd").textContent="Sound: "+(S.mute?"off":"on")}
// Render key: popup identity + every value shown in it. If the key is
// unchanged, the popup's DOM nodes are left exactly as they are —
// the 250ms tick must never rebuild a button under a finger.
function popKey(){
if(!POP)return "";
if(POP.kind==="system"){const i=S.sel,own=S.won.includes(i),g=garAt(i),col=colAt(i);return "sys|"+i+"|"+(own?1:0)+"|"+(avail(i)?1:0)+"|"+S.ships.fighter+"|"+S.ships.cruiser+"|"+S.ships.capital+"|"+g.fighter+"|"+g.cruiser+"|"+g.capital+"|"+Math.round(sysDef(i))+"|"+spw(i)+"|"+fpower(i).toFixed(1)+"|"+S.won.length+"|col:"+(col?col.l+":"+(col.spec||"-"):"-")+"|"+(col&&col.l<COL_MAX&&S.bq.some(j=>j.col===i)?1:0)+"|"+(col&&col.l<COL_MAX?can(colUpCost(col.l))?1:0:0)+"|"+S.bq.length+"|rel:"+(S.own[i]?dipRel(S.own[i]):"-")+"|tru:"+(S.own[i]?(dipAt(S.own[i]).truceUntil||0):0)+"|stab:"+(S.stab?S.stab[i]||"":"")}
if(POP.kind==="building"){const b=S.bl.find(z=>z.u===POP.u);if(!b)return "gone";const e=effL(b),c=cost(b.t,e);return "bld|"+b.u+"|"+b.l+"|"+e+"|"+(e>=lvlCap(b.t)?1:0)+"|"+cstr(c)+"|"+S.bq.length+"|"+(can(c)?1:0)+"|"+(S.mv===b.u?1:0)}
if(POP.kind==="plot"){return "plot|"+POP.x+"|"+POP.y+"|"+(plotLocked(POP.x,POP.y)?1:0)+"|"+plotReqLv(POP.x,POP.y)+"|"+S.b.command+"|"+unlockedCount()+"|"+S.bq.length+"|"+Object.keys(B).map(t=>cnt(t)+"/"+MAXC(t)+"/"+(can(newCost(t))?1:0)).join(",")}
return "?"}
function popupUI(){
const p=$("#pop");
if(!POP){if(p)p.hidden=true;popKeyCache="";return}
if(p)p.hidden=false;
const _pk=popKey();if(_pk===popKeyCache)return;popKeyCache=_pk;
const title=$("#pop-title"),hero=$("#pop-hero"),body=$("#pop-body"),acts=$("#pop-actions");
if(!title||!hero||!body||!acts)return;
const hq=hero.getContext("2d");
if(hq){hq.imageSmoothingEnabled=false;hq.fillStyle="#0a0e2a";hq.fillRect(0,0,96,96)}
if(POP.kind==="system"){
const i=S.sel,s=SYS[i],own=S.won.includes(i),av=avail(i);
title.textContent=s.n;
if(hq){const sp=planetSprite(i);hq.drawImage(sp,16,16,64,64)}
if(i===0){const stat=(k,v)=>'<div class="stat"><span>'+k+'</span><b>'+v+'</b></div>';
body.innerHTML="<small>Your base. Build your station and fleet here.</small>"
+stat("Systems owned",S.won.length+" of "+SYS.length)
+stat("Fleet power",Number.isFinite(fpt())?String(Math.round(fpt())):"0")
+stat("Home defence",Math.round(sysDef(0))+" (your full fleet)");
acts.innerHTML='<button data-pclose="1" class="grow">Close</button>';}
else{const need=spw(i),fp=fpower(i),loot=s.r?cstr(s.r):"";
const stat=(k,v)=>'<div class="stat"><span>'+k+'</span><b>'+v+'</b></div>';
// v2.5: a Sector 2 system without Jump Drive says so in one plain
// line; a jump gate names the system it links to.
body.innerHTML="<small>"+s.t.toUpperCase()+" fleet. "+(own?"You own this system.":av?"Ready to attack.":secOf(i)===1&&!hasJump()?"Requires Jump Drive research — Sector 2 is beyond normal range.":"Out of reach. Claim a neighboring system first.")+(S.own[i]?" Held by "+RV[S.own[i]].n+".":"")+(GATE[i]!==undefined?" Jump gate — links to "+SYS[GATE[i]].n+" (Sector "+(secOf(GATE[i])+1)+").":"")+"</small>"
+stat("Needs",Number.isFinite(need)?need+" power":"—")
+stat("Your fleet vs "+s.t,Number.isFinite(fp)?fp.toFixed(1):"0.0")
+(loot?stat("Loot",loot):"")
+stat("Counter","Bring "+WEAK[s.t]+"s (+50%)");
// v2.7: attacking a faction you have a deal with breaks the deal —
// warn in the popup before the player taps Attack.
const relW=S.own[i]?dipRel(S.own[i]):"peace";
if(!own&&S.own[i]&&(relW==="truce"||relW==="pact"||relW==="ally"))body.innerHTML+="<small>⚠ Attacking breaks your "+dipRelWord(S.own[i])+" with the "+RV[S.own[i]].n+"!</small>";
if(own){const g=garAt(i),def=sysDef(i),gar=Math.round(garPow(i)*garMult()),col=Math.round(colDef(i)),home=Math.round(.5*dpower());
body.innerHTML+="<small><b>Garrison</b> — ships stationed here defend this system. A garrison defends at full strength, plus half your home fleet rushes to help.</small>"
+stat("Defence here",Math.round(def)+" (garrison "+gar+(col>0?" + colony "+col:"")+" + home fleet "+home+")")
+Object.keys(U).map(k=>'<div class="row"><div><b>'+U[k].n+'</b> ×'+g[k]+' stationed<br><small>Home fleet: '+S.ships[k]+'</small></div><div class="bg"><button data-gsend="'+k+'" '+(S.ships[k]<1?"disabled":"")+'>Send 1</button><button data-grecall="'+k+'" '+(g[k]<1?"disabled":"")+'>Recall 1</button></div></div>').join("");
// v2.6 COLONY — one per owned system (never Home World, never
// rival-held). Stacked vertically like the garrison rows, so the
// popup stays readable on a phone. Every line says what it does.
const c=colAt(i);
if(c){body.innerHTML+="<small><b>Colony Lv "+c.l+"</b> — settlers here work the system for you. A colony adds +"+COL_DEF+" defence power per level and earns resources once you choose its focus.</small>";
body.innerHTML+=stat("Stability",(S.stab&&S.stab[i]!==undefined?S.stab[i]:100)+" / 100 — a garrison keeps a far colony loyal; an empty garrison far from Home slowly rebels");
if(!c.spec){body.innerHTML+="<small>Choose a focus to start earning. Until then the colony earns nothing from its focus"+(tradeAt(i)>0?" — it still earns +"+TRADE_INC.toFixed(1)+" trade credits/s from its route to Home World":"")+" — it only adds defence.</small>"
+Object.keys(COLSPEC).map(k=>'<div class="row"><div><b>'+COLSPECNAME[k]+'</b><br><small>Earns +'+COL_INC.toFixed(1)+' '+COLSPEC[k]+'/s per colony level.</small></div><button data-cspec="'+k+'">Choose</button></div>').join("");
if(tradeAt(i)>0)body.innerHTML+=stat("Trade","+"+TRADE_INC.toFixed(1)+" credits/s — connected to Home World");
else body.innerHTML+="<small>No trade route — this colony has no owned-system path to Home World, so it earns no trade income.</small>";
;}
else{body.innerHTML+=stat("Income","+"+(COL_INC*c.l*crewMineMult()).toFixed(1)+" "+COLSPEC[c.spec]+"/s at Lv "+c.l+(tradeAt(i)>0?", +"+TRADE_INC.toFixed(1)+" trade credits/s":""));
if(tradeAt(i)===0)body.innerHTML+="<small>No trade route — this colony has no owned-system path to Home World, so it earns no trade income.</small>";
if(c.l>=COL_MAX){body.innerHTML+="<small>Max level.</small>";}
else{const cc=colUpCost(c.l),upg=S.bq.some(j=>j.col===i);
body.innerHTML+=upg?"<small>Upgrading to Lv "+(c.l+1)+" — watch the activity tray above the dock.</small>":"<small>Upgrade to Lv "+(c.l+1)+": "+cstr(cc)+". Time: "+left(colDur(c.l)*1000)+". A higher level earns more and adds +"+COL_DEF+" defence power per level.</small>";
body.innerHTML+='<div class="row"><div><b>Upgrade colony</b><br><small>Cost: '+cstr(cc)+' · '+left(colDur(c.l)*1000)+'</small></div><button data-cup="1" '+((upg||S.bq.length>=bqcap()||!can(cc))?"disabled":"")+'>Upgrade</button></div>';}}}}
acts.innerHTML='<button data-atk="1" class="grow" '+(own||!av||total()<1?"disabled":"")+'>'+(own?"Owned":"Attack")+'</button><button data-pclose="1" class="grow">Close</button>';}
}else if(POP.kind==="building"){
const b=S.bl.find(z=>z.u===POP.u);
if(!b){closePopup();return}
const t=b.t,e=effL(b),max=e>=lvlCap(t),c=cost(t,e),m=mult(b),pr=Object.keys(B[t].p)[0];
title.textContent=B[t].n+" Lv "+b.l;
if(hq){hq.fillStyle="#c98a5a";hq.fillRect(0,0,96,96);const sp=buildingSprite(t,b.l);hq.drawImage(sp,24,24,48,48)}
let st=B[t].d+". ";
if(b.l===0)st="Under construction. ";
else if(pr)st+="Makes +"+(B[t].p[pr]*b.l*m*(1+tsum("eco"))*(1+cb("econ"))*crewMineMult()).toFixed(1)+" "+pr+"/s. ";
else if(t==="hangar")st+="Holds "+(5+tsum("slot"))*b.l+" ship slots. ";
else st+="Max building level "+lvlCap("hangar")+", storage "+fmt(cap())+". ";
const DISTNAME={solar:"Power District",foundry:"Industrial District",mine:"Industrial District",hub:"Trade District",hangar:"Military District",command:"The Keep"};body.innerHTML="<small><b>"+(DISTNAME[t]||"")+"</b> — "+st+"</small><br><small>"+(max?(t==="command"?"Max level.":"Upgrade the Command Station to go higher."):"Upgrade to Lv "+(e+1)+": "+cstr(c)+". Time: "+left(dur(e)*1000))+"</small>";
acts.innerHTML='<button data-bup="1" '+((max||S.bq.length>=bqcap()||!can(c))?"disabled":"")+'>Upgrade</button><button data-bmv="1">'+(S.mv===b.u?"Cancel move":"Move")+'</button><button data-pclose="1">Close</button>';
}else if(POP.kind==="plot"){
const x=POP.x,y=POP.y,lk=plotLocked(x,y),un=unlockedCount();
title.textContent=lk?"Locked land ("+(x+1)+", "+(y+1)+")":"Open land ("+(x+1)+", "+(y+1)+")";const _kp=S.bl.find(b=>b.t==="command");const _dn=_kp?(x<_kp.x-1?"West — near the Military quarter":x>_kp.x+1?"East — near the Industrial quarter":y<_kp.y-1?"North — near the Power fields":"South — near the Trade quarter"):"Open land";
if(hq){hq.fillStyle=lk?"#6b7590":"#c98a5a";hq.fillRect(0,0,96,96)}
if(lk){body.innerHTML="<small>🔒 Locked — upgrade the Command Station to Lv "+plotReqLv(x,y)+" to unlock this plot.</small><br><small>"+un+" of 144 plots unlocked — Command Station Lv "+S.b.command+". The city grows outward from the keep.</small>";acts.innerHTML='<button data-pclose="1" class="grow">Close</button>';}
else{body.innerHTML="<small>"+_dn+". "+un+" of 144 plots unlocked — Command Station Lv "+S.b.command+". What can you build here? Each new copy costs 1.5x the last. Buildings produce at full rate wherever they stand.</small>"+Object.keys(B).map(t=>{const n=cnt(t),mx=MAXC(t),c=newCost(t),ok=n<mx&&S.bq.length<bqcap()&&can(c);return '<div class="row"><div><b>'+B[t].n+'</b> '+n+"/"+mx+'<br><small>'+B[t].d+'<br>Cost: '+cstr(c)+'</small></div><button data-place="'+t+'" '+(ok?"":"disabled")+'>Place</button></div>'}).join("");acts.innerHTML="";}
}}
function empireUI(){if(PAGE.kind!=="empire")return;$("#emp-sum").textContent=S.won.length+" of "+SYS.length+" systems. Each owned system pays +0.3 credits/s."+(tradeTotal()>0?" Trade routes pay +"+tradeTotal().toFixed(1)+" credits/s.":"");
$("#emp-list").innerHTML=S.won.map(i=>'<div class="emp-row"><div><b>'+SYS[i].n+'</b><br><small>'+(i===0?"Home World · defence "+Math.round(sysDef(0))+" (your full fleet)":"Power "+SYS[i].pw+" · Loot "+cstr(SYS[i].r)+" · Defence "+Math.round(sysDef(i)))+'</small></div><button data-fly="'+i+'">Go to</button></div>').join("")||"<small>No systems yet.</small>";
// v2.7 STANDINGS BOARD — every faction plus you: systems, estimated
// fleet power, and your REAL relation (diplomacy state, not the v2.4
// placeholder): Allied / Pact / Truce with minutes left / At war
// (they took one of your systems) / Peace / defeated. Below it, one
// diplomacy row per faction (Tribute / Pact / Ally + costs) and live
// victory-progress lines with current numbers.
const rows=[{n:"You",sys:S.won.length,pw:dpower(),st:"—"}].concat(Object.keys(RV).map(id=>({n:RV[id].n,sys:heldCount(id),pw:rstr(id),st:relText(id)})));
const best=rows.slice().sort((a,b)=>b.sys-a.sys||b.pw-a.pw)[0];
const nx=nextFaction();
const vicLine="Victory: hold 13 systems (you hold "+S.won.length+") or double the next faction ("+(nx.id?RV[nx.id].n+" holds "+nx.n+" — you need "+(2*nx.n):"no rival holds any systems — you need 13")+").";
const DIPLINE={truce:"They will not raid you until the truce ends.",pact:"Neither side raids the other.",ally:"They raid your enemies, never you.",war:"They have taken one of your systems.",peace:"No fighting — for now.",defeated:"No systems left — nothing to deal with."};
const dipRows=Object.keys(RV).map(id=>{
  const rel=heldCount(id)?dipRel(id):"defeated";
  const dis=k=>(S.res.credits<DIP[k]||!heldCount(id)||(k==="tribute"&&(rel==="truce"||rel==="pact"||rel==="ally"))||(k==="pact"&&(rel==="pact"||rel==="ally"))||(k==="ally"&&rel==="ally"))?"disabled":"";
  return '<div class="emp-row"><div><b>'+RV[id].n+'</b><br><small>'+relText(id)+' — '+DIPLINE[rel]+'</small></div><div class="bg"><button data-dip="tribute:'+id+'" '+dis("tribute")+'>Tribute '+DIP.tribute+'</button><button data-dip="pact:'+id+'" '+dis("pact")+'>Pact '+DIP.pact+'</button><button data-dip="ally:'+id+'" '+dis("ally")+'>Ally '+DIP.ally+'</button></div></div>';
}).join("");
$("#e-rvs").innerHTML="<b>Standings</b> — relations are real deals now, not just warnings.<br>"+rows.map(r=>"<b>"+r.n+"</b>: "+r.sys+" system"+(r.sys===1?"":"s")+", power "+Math.round(r.pw)+(r.st==="—"?"":", "+r.st)).join("<br>")+"<br>"+vicLine+"<br>Strongest faction: "+(best.n==="You"?"you":best.n)+" — "+best.sys+" systems, power "+Math.round(best.pw)+". You hold "+S.won.length+" system"+(S.won.length===1?"":"s")+".<br><br><b>Diplomacy</b> — Tribute ("+DIP.tribute+" credits) buys a 30-minute truce: they will not raid you. A pact ("+DIP.pact+") stops raids both ways until someone breaks it. An alliance ("+DIP.ally+") means they never raid you and raid your enemies instead. Attacking a friend's system breaks the deal instantly.<br>"+dipRows+"<br>Rival raids start after about 10 minutes of play. A rival raids one of your systems next to their territory — if your defence power is higher than the raid's power, you repel it (counts toward the 'Repel a rival raid' quest); if not, they take the system and destroy the garrison stationed there — your home fleet is untouched, but the system is lost.<br>Raid power grows the longer you play and the more systems the rival owns. Raise your defence power with more and bigger ships, a garrison stationed on the system, a higher Command Station, power research, and an assigned fleet commander. A colony on a system adds +15 defence power per level and earns resources once you choose its focus — Mining for metal, Forge for crystal, Trade for credits. A colony connected to Home World through systems you own also earns +0.2 trade credits/s — a far-flung colony with no owned-system path home earns no trade income. If a raid takes a system, its colony is gone too; conquering it back founds a fresh level-1 colony.<br>Your defence power now: "+Math.round(dpower())+"."+"<br><br>Sector 2 lies beyond the jump gates — Void Gate and Rift Armada in Sector 1. Rival factions reach it once their jump drives come online, after about 60 minutes of play, and your fleet needs Jump Drive research (Research tab) to attack or claim Sector 2 systems."+"<br><br>Home World is different: a rival can only raid it if they own a system next to it, and it defends with your FULL home fleet — never half. If Home World falls, your empire is defeated."}
// v1.5 GLOBAL ACTIVITY TRAY — anything that takes time to create must
// be visible on every screen, not just on its own menu page. The tray
// sits above the bottom dock (it counts toward the safe-area inset in
// measureUI, so map content never hides under it) and shows every timed
// job at once: building construction/upgrades (S.bq), research (S.rq),
// shipyard queue (S.sq, grouped by ship type). Each job has an icon +
// name, a thin progress bar and time remaining (left(), never raw
// seconds). Tapping a job jumps to it: building -> Station tab with
// that building's popup, research -> Research page, ships -> Fleet page.
// Display only: no timers, durations, caps or costs change, no new
// save field. Like popupUI, the DOM is NOT rebuilt every tick — rows
// are rebuilt only when the job set changes (actKey); progress bars
// and times are updated in place, so a tap can never land on a node
// that is about to be destroyed.
function actJobs(){
  const now=Date.now(),jobs=[];
  const perU={};
  S.bq.slice().sort((a,b)=>a.end-b.end).forEach(j=>{
    // v2.6: a colony upgrade job ({col: system id}) shows in the tray
    // like any other job — tap it to jump to that system's popup.
    // One colony job per system at a time, so the target level is l+1.
    if(j.col!==undefined){const c=colAt(j.col);if(!c)return;jobs.push({id:"c"+j.col,icon:"✦",name:"Colony Lv "+(c.l+1)+" — "+SYS[j.col].n,act:"col:"+j.col,s:j.s||j.end-colDur(c.l)*1000,end:j.end});return}
    const b=S.bl.find(z=>z.u===j.u);if(!b)return;
    perU[j.u]=(perU[j.u]||0)+1;
    const target=b.l+perU[j.u]; // Lv the building will reach when this job finishes
    jobs.push({id:"b"+j.u,icon:"▦",name:B[b.t].n+" Lv "+target,act:"bld:"+j.u,s:j.s||j.end-dur(0)*1000,end:j.end});
  });
  if(S.rq){const t=TECH.find(z=>z.id===S.rq.id);if(t)jobs.push({id:"r"+t.id,icon:"⚙",name:"Research: "+t.n,act:"res",s:S.rq.end-t.t*1000*tmul()*crewResMul(),end:S.rq.end})}
  const byShip={};
  S.sq.forEach(j=>{(byShip[j.k]=byShip[j.k]||[]).push(j)});
  Object.keys(byShip).forEach(k=>{
    const list=byShip[k].slice().sort((a,b)=>a.end-b.end);
    jobs.push({id:"s"+k,icon:"▲",name:U[k].n+(list.length>1?" ×"+list.length:""),act:"ship",s:list[0].end-DUR[k]*1000*tmul()*crewShipMul(),end:list[list.length-1].end});
  });
  return jobs;
}
let actKeyCache="";
function activityUI(){
  const el=$("#activity");if(!el)return;
  const jobs=actJobs(),now=Date.now();
  const key=jobs.map(j=>j.id+"@"+j.end).join("|");
  const wasHidden=el.hidden;
  el.hidden=jobs.length===0;
  if(jobs.length===0){actKeyCache="";if(!wasHidden){measureUI();sizeCanvases()}return}
  if(key!==actKeyCache){
    actKeyCache=key;
    el.innerHTML=jobs.map(j=>'<button class="actjob" data-act="'+j.act+'"><span class="actic">'+j.icon+'</span><span class="actname">'+j.name+'</span><span class="actbar"><i data-actfill="'+j.id+'"></i></span><span class="acttime" data-acttime="'+j.id+'"></span></button>').join("");
    if(wasHidden){measureUI();sizeCanvases()}
  }
  jobs.forEach(j=>{
    const p=Math.max(0,Math.min(1,j.end>j.s?(now-j.s)/(j.end-j.s):1));
    const fill=el.querySelector('[data-actfill="'+j.id+'"]');
    if(fill)fill.style.width=Math.round(p*100)+"%";
    const tm=el.querySelector('[data-acttime="'+j.id+'"]');
    if(tm)tm.textContent=left(Math.max(0,j.end-now));
  });
}
function progressBars(){const now=Date.now();const set=(id,p)=>{const el=$(id);if(el)el.style.width=Math.round(Math.max(0,Math.min(1,p||0))*100)+"%"};
const bq=S.bq.filter(j=>j.u!==undefined).slice().sort((a,b)=>a.end-b.end)[0];set("#pb-build",bq&&bq.s?(now-bq.s)/(bq.end-bq.s):0); // v2.6: colony jobs use the tray, not the station build bar
if(S.rq){const t=TECH.find(z=>z.id===S.rq.id);set("#pb-res",t?1-(S.rq.end-now)/(t.t*1000*tmul()*crewResMul()):0)}else set("#pb-res",0);
const sq=S.sq[0];set("#pb-ship",sq?1-(sq.end-now)/(DUR[sq.k]*1000*tmul()*crewShipMul()):0)}
function drawMinimap(){const mm=$("#mm");if(!mm)return;const q=mm.getContext("2d");if(!q||!q.fillRect)return;q.fillStyle="#0a0e2a";q.fillRect(0,0,96,120);const MMCOL={c:"#e0584a",v:"#b07cf0",k:"#ffb02e",a:"#4fc3f7",m:"#ff7ad9"};SYS.forEach((s,i)=>{if(secOf(i)!==SEC)return;const own=S.won.includes(i),o=S.own[i];q.fillStyle=own?"#6ee7f5":o?MMCOL[o]||"#7c849c":"#7c849c";q.fillRect(Math.round(s.x*WORLD.px/WORLD.w*96)-2,Math.round(s.y*WORLD.px/WORLD.h*120)-2,4,4)});const sc=camScale(),vw=cv.width/sc/WORLD.w*96,vh=safeH()/sc/WORLD.h*120,vx=CAM.cx/WORLD.w*96-vw/2,vy=CAM.cy/WORLD.h*120-vh/2;q.fillStyle="rgba(255,224,102,.9)";q.fillRect(vx,vy,Math.max(4,vw),1);q.fillRect(vx,vy+vh-1,Math.max(4,vw),1);q.fillRect(vx,vy,1,Math.max(4,vh));q.fillRect(vx+vw-1,vy,1,Math.max(4,vh))}
function upd2(){const now=Date.now();showTab();
$("#fpw").textContent="Fleet power: "+Math.round(fpt())+". Vs swarm "+Math.round(fpt("swarm"))+", armored "+Math.round(fpt("armored"))+", fortress "+Math.round(fpt("fortress"))+".";
const rvEl=$("#rvs");if(rvEl)rvEl.innerHTML=Object.keys(RV).map(id=>{const k=Object.keys(S.own).filter(j=>S.own[j]===id).length;return "<b>"+RV[id].n+"</b>: "+(k?k+" systems, power "+Math.round(rstr(id)):"defeated")}).join("<br>")+"<br>Rivals claim neutral systems next to their territory and raid yours. Raids start after about 10 minutes of play. A strong home fleet repels them.";
TECH.forEach(t=>{const dn=S.tech.includes(t.id),av=!dn&&(!t.req||S.tech.includes(t.req));$("#tr-"+t.id).style.display=av?"":"none";if(av){$("#tc-"+t.id).textContent="Cost: "+cstr(t.c)+". Time: "+left(t.t*1000*tmul()*crewResMul());$("#tb-"+t.id).disabled=!!S.rq||!can(t.c)}});
$("#rq").textContent=(S.rq?"Researching: "+TECH.find(z=>z.id===S.rq.id).n+" ("+left(S.rq.end-now)+"). ":"Lab idle. ")+"Completed "+S.tech.length+" of "+TECH.length+".";
crewUI();
for(const id in CM){const c=CM[id],h=S.cmds.includes(id),sl=c.t==="fleet"?"fleet":"station",on=S.slot[sl]===id;
$("#cl-"+id).textContent=h?"Lv "+lv(id)+(on?" (assigned)":""):"";
$("#cc-"+id).textContent=h?"Bonus now: +"+Math.round(c.b*lv(id)*100)+"% "+TT[c.t]+(on?"":" (not assigned)"):"Hire cost: "+c.c+" credits";
const b=$("#cb-"+id);b.textContent=!h?"Hire":on?"Unassign":"Assign";b.disabled=!h&&S.res.credits<c.c}}
// v2.8 CREW PANEL — assignment rows on the Crew tab, above the
// commanders list. Rebuilt only when the key changes (cap, counts,
// Command level, colony levels), never every tick, so a tap can
// never land on a button that is about to be destroyed.
let crewKeyCache="";
function crewUI(){const el=$("#crew-panel");if(!el)return;const c=crewAt(),cap=crewCap(),tot=crewTotal();
const key=[cap,tot,c.mine,c.ship,c.res,S.b.command,Object.values(S.col||{}).map(x=>x.l).join(",")].join("|");
if(key===crewKeyCache)return;crewKeyCache=key;
const desc={mine:"Boosts building and colony production.",ship:"Ships finish faster.",res:"Research finishes faster."};
const row=(k,label,bonus)=>{const n=c[k]||0;return '<div class="row"><div><b>'+label+': '+n+' crew → +'+(n*2)+'% '+bonus+'</b><br><small>'+desc[k]+'</small></div><div class="bg"><button data-crew="'+k+':-1" '+(n<=0?"disabled":"")+'>−</button><button data-crew="'+k+':+1" '+(tot>=cap?"disabled":"")+'>+</button></div></div>'};
el.innerHTML='<small>Assign your crew to mining, shipbuilding or research. Crew grows with your Command Station and colonies.</small><br><small><b>Crew: '+tot+' assigned / '+cap+' total ('+(cap-tot)+' idle)</b></small>'+row("mine","Mining","production")+row("ship","Shipbuilding","shipyard speed")+row("res","Research","research speed");}
const away=Math.min((Date.now()-S.t)/1000,28800);
if(away>60){step(away);done();offlineSim(away);msg("Welcome back! Your empire worked for "+Math.floor(away/60)+" minutes while you were away.")}
let last=Date.now(),starve=0;
setInterval(()=>{
const n=Date.now(),dt=Math.min((n-last)/1000,5);last=n;step(dt);
if(S.res.energy<=0&&rates().energy<0&&total()>0){starve+=dt;if(starve>10){starve=0;const k=S.ships.fighter?"fighter":S.ships.cruiser?"cruiser":"capital";S.ships[k]--;msg("A ship went dark. You are out of energy!")}}
rivalTick();update();
},250);
setInterval(save,5000);
fitCam(); // v1.5: default galaxy view fits the whole galaxy in the safe area (bottom row visible)
update();
maybeTut();
