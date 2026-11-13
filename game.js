const $=s=>document.querySelector(s);
let AC=null;
function ac(){try{if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume()}catch(e){}return AC}
function tone(f,d,ty,v,t0,f2){const a=ac();if(!a||S.mute)return;const o=a.createOscillator(),g=a.createGain(),t=a.currentTime+(t0||0);o.type=ty||"square";o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);g.gain.setValueAtTime(v||.04,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+d+.02)}
function boom(){const a=ac();if(!a||S.mute)return;const n=Math.floor(a.sampleRate*.3),b=a.createBuffer(1,n,a.sampleRate),c=b.getChannelData(0);for(let i=0;i<n;i++)c[i]=(Math.random()*2-1)*(1-i/n);const s=a.createBufferSource(),g=a.createGain();s.buffer=b;g.gain.value=.08;s.connect(g);g.connect(a.destination);s.start()}
function sfx(k){const m={click:()=>tone(520,.04),ok:()=>{tone(660,.08);tone(880,.12,"square",.04,.08)},laser:()=>tone(900,.12,"sawtooth",.025,0,200),boom:boom,win:()=>[523,659,784,1047].forEach((f,i)=>tone(f,.15,"square",.045,i*.12)),lose:()=>[392,330,262,196].forEach((f,i)=>tone(f,.2,"triangle",.06,i*.15)),alert:()=>{tone(880,.1);tone(660,.1,"square",.05,.15);tone(880,.1,"square",.05,.3)},claim:()=>[784,988,1319].forEach((f,i)=>tone(f,.12,"square",.045,i*.09))};if(m[k])m[k]()}
const fresh=()=>({res:{energy:40,metal:40,crystal:10,credits:10},b:{solar:1,foundry:1,mine:0,hub:0,hangar:0,command:1},ships:{fighter:0,cruiser:0,capital:0},won:[0],sel:1,bl:[{u:1,t:"solar",x:1,y:2,l:1},{u:2,t:"foundry",x:2,y:2,l:1},{u:3,t:"command",x:2,y:1,l:1}],nu:4,bsel:null,place:null,mv:null,bq:[],sq:[],q:[],tech:[],rq:null,cmds:[],cx:{},slot:{fleet:null,station:null},own:{},rv:{c:{cl:Date.now(),rd:Date.now()},v:{cl:Date.now(),rd:Date.now()}},min:0,rvi:0,rep:0,cap:0,feed:[],tab:"map",t:Date.now()});
function load(){try{const j=JSON.parse(localStorage.getItem(KEY));if(j&&j.res&&j.b&&j.ships){const s=Object.assign(fresh(),j);
if(!j.bl){s.bl=[];s.nu=1;let n=0;for(const t in B)if(j.b[t]>0)s.bl.push({u:s.nu++,t,x:n%3+1,y:Math.floor(n++/3)+2,l:j.b[t]});
s.bq=(j.bq||[]).map(q=>{let b=s.bl.find(z=>z.t===q.id);if(!b){b={u:s.nu++,t:q.id,x:n%3+1,y:Math.floor(n++/3)+2,l:0};s.bl.push(b)}return{u:b.u,end:q.end}})}
delete s.pos;delete s.selB;return s}}catch(e){}return fresh()}
function save(){try{S.t=Date.now();localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
let S=load();recalc();
// UI OVERHAUL v1.0 — camera, page and UI-hide state are VIEW-ONLY: they
// are never saved in S and never change the save format (still pixelgalaxy-v3).
// UI OVERHAUL v0.9 — camera and page state are VIEW-ONLY: they are never
// saved in S and never change the save format (still pixelgalaxy-v3).
const WORLD={w:640,h:800,px:5}; // galaxy world, SYS x/y * 5 (v0.9.1: bigger, detailed map)
let CAM={cx:80,cy:200,zoom:1.8}; // centre (world units), zoom 1-2.5; default 1.8 on Home World (v0.9.1)
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
{t:"Your station",b:"This is your home station. Tap a building to see it, or tap open land to build. A Solar Array is a good first build — it makes energy."},
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
function setStZoom(z,px,py){const s0=stScale(),w=px===undefined?null:{x:STCAM.cx+(px-(st.width||384)/2)/s0,y:STCAM.cy+(py-safeCySt())/s0};STCAM.zoom=Math.max(1,Math.min(2.5,z));if(w){const s1=stScale();STCAM.cx=w.x-(px-(st.width||384)/2)/s1;STCAM.cy=w.y-(py-safeCySt())/s1}clampStCam()}
// v1.3: station cameras fit the OCCUPIED building cluster, not the
// whole 12x12 diamond (live bug: the map was ~80% empty in both Home
// and Fit, and the default view centred the clump in the upper third).
// occupiedIsoBBox returns the iso bbox of all buildings, expanded to
// include the level shield + name label above the top building and the
// spaced-out footprint, in iso world units.
function occupiedIsoBBox(margin){
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  S.bl.forEach(b=>{const c=isoC(b.x,b.y);x0=Math.min(x0,c.x-48);x1=Math.max(x1,c.x+48);y0=Math.min(y0,c.y-72);y1=Math.max(y1,c.y+24)});
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
function homeStCam(){const bb=occupiedIsoBBox(48);STCAM.cx=bb.cx;STCAM.cy=bb.cy;STCAM.zoom=stZoomForBox(bb,1.0,2.5);clampStCam()}
function fitStCam(){const bb=occupiedIsoBBox(128);STCAM.cx=bb.cx;STCAM.cy=bb.cy;STCAM.zoom=stZoomForBox(bb,.4,2.5);clampStCam()}
function openPlot(x,y){POP={kind:"plot",x,y};showPopup();update()}
const camScale=()=>((cv.height||480)/WORLD.h)*CAM.zoom;
// v1.0: galaxy camera centres on the SAFE area (between HUD and dock).
// Visible world height is the safe height, so nothing the camera shows
// is ever drawn under the top or bottom bar.
const safeH=()=>Math.max(1,(cv.height||480)-UIIN.top-UIIN.bottom);
const worldToScreen=(wx,wy)=>{const sc=camScale();return{x:(cv.width||384)/2+(wx-CAM.cx)*sc,y:safeCyCv()+(wy-CAM.cy)*sc}};
const screenToWorld=(sx,sy)=>{const sc=camScale();return{x:CAM.cx+(sx-(cv.width||384)/2)/sc,y:CAM.cy+(sy-safeCyCv())/sc}};
function clampCam(){const sc=camScale(),hw=(cv.width||384)/(2*sc),hh=safeH()/(2*sc);if(hw>=WORLD.w/2)CAM.cx=WORLD.w/2;else CAM.cx=Math.max(hw,Math.min(WORLD.w-hw,CAM.cx));if(hh>=WORLD.h/2)CAM.cy=WORLD.h/2;else CAM.cy=Math.max(hh,Math.min(WORLD.h-hh,CAM.cy))}
function setZoom(z,px,py){const s0=camScale(),w=px===undefined?null:{x:CAM.cx+(px-(cv.width||384)/2)/s0,y:CAM.cy+(py-safeCyCv())/s0};CAM.zoom=Math.max(1,Math.min(2.5,z));if(w){const s1=camScale();CAM.cx=w.x-(px-(cv.width||384)/2)/s1;CAM.cy=w.y-(py-safeCyCv())/s1}clampCam()}
function flyTo(i){const s=SYS[i];CAM.cx=s.x*WORLD.px;CAM.cy=s.y*WORLD.px;CAM.zoom=Math.max(CAM.zoom,1.8);clampCam()}
function fitCam(){const vh=safeH(),vw=cv.width||384,ch=cv.height||480;
  const sc=Math.min(vw/WORLD.w,vh/WORLD.h); // world must fit the SAFE area
  CAM={cx:320,cy:400,zoom:Math.max(.3,Math.min(2.5,sc*WORLD.h/ch))};clampCam()}
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
const adj=(i,j)=>SYS[i].l.includes(j)||SYS[j].l.includes(i);
const spw=i=>Math.round(SYS[i].pw*(S.own[i]?1.4:1));
const avail=i=>!S.won.includes(i)&&S.won.some(j=>adj(i,j));
// v1.4: adjacency bonus REMOVED at Jayden's request (approved mechanics
// change). Production is base rate only (plus tech/commander effects),
// so spaced-out buildings produce at full rate — that is what makes
// the spaced-out city layout work. mult() stays as a stub returning 1
// so rates() and the popups need no other change.
const mult=b=>1;
function fpower(i){return fpt(SYS[i].t)}
function fpt(t){const w=WEAK[t];let p=0;for(const k in U)p+=S.ships[k]*U[k].pw*(k===w?1.5:1);return p*(1+.2*(S.b.command-1))*(1+tsum("pw"))*(1+cb("fleet"))}
function rates(){const o={energy:0,metal:0,crystal:0,credits:0};S.bl.forEach(b=>{if(b.l>0)for(const r in B[b.t].p)o[r]+=B[b.t].p[r]*b.l*mult(b)*(1+tsum("eco"))*(1+cb("econ"))});o.credits+=.3*(S.won.length-1);o.energy-=.05*used();return o}
function step(dt){S.min+=dt/60;const r=rates();R.forEach(k=>{S.res[k]=Math.min(cap(),Math.max(0,S.res[k]+r[k]*dt))})}
function done(){const n=Date.now();
S.bq=S.bq.filter(j=>{if(j.end>n)return true;const b=S.bl.find(z=>z.u===j.u);if(b){b.l++;gain("station",1);msg(B[b.t].n+" reaches level "+b.l+".");sfx("ok")}return false});recalc();
while(S.sq.length&&S.sq[0].end<=n){const k=S.sq.shift().k;S.ships[k]++;msg(U[k].n+" launched.");sfx("ok")}
if(S.rq&&S.rq.end<=n){const t=TECH.find(z=>z.id===S.rq.id);S.tech.push(t.id);S.rq=null;gain("station",1);msg("Research complete: "+t.n);sfx("claim")}}
let HOLD=false,HELD="";
function toast(t){const c=$("#toasts"),el=document.createElement("div");el.className="toast";el.textContent=t;c.appendChild(el);while(c.children.length>3)c.removeChild(c.firstChild);setTimeout(()=>el.remove(),5000)}
const msg=t=>{if(HOLD){HELD=t;return}S.feed.push(t);if(S.feed.length>30)S.feed.shift();toast(t)};
const left=ms=>{const s=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return(h?h+"h ":"")+(h||m?m+"m ":"")+(s%60)+"s"};

const RICON={energy:"⚡",metal:"▣",crystal:"◆",credits:"●"};
$("#res").innerHTML=R.map(r=>`<div class="pill"><span class="pline"><span class="ric dot-${r}">${RICON[r]||""}</span><b id="v-${r}"></b><span class="rate" id="r-${r}"></span></span><span class="sbar"><i id="sb-${r}"></i></span><span class="cap" id="c-${r}"></span></div>`).join("");
const resEl=$("#res");
if(resEl)resEl.addEventListener("click",()=>{resEl.classList.toggle("expanded")});
const _bm=$("#bmenu");if(_bm)_bm.innerHTML=Object.keys(B).map(t=>`<div class="row"><div><b>${B[t].n}</b> <span id="bmn-${t}"></span><br><small>${B[t].d}</small><br><small id="bmc-${t}"></small></div><button data-bnew="${t}" id="bmb-${t}">Place</button></div>`).join("");
$("#ships").innerHTML=Object.keys(U).map(k=>`<div class="row"><div><b>${U[k].n}</b> x<span id="n-${k}"></span><br><small>Power ${U[k].pw}, ${U[k].sz} slot${U[k].sz>1?"s":""}, ${DUR[k]}s. Strong vs ${Object.keys(WEAK).find(t=>WEAK[t]===k)} (+50%).<br>Cost: ${cstr(U[k].c)}</small></div><div class="bg"><button data-build="${k}" id="sb-${k}"></button><button data-build="${k}" data-n="5" id="s5-${k}">x5</button><button data-scrap="${k}" id="sc-${k}">Scrap</button><button data-build="${k}" data-n="10" id="s10-${k}">x10</button></div></div>`).join("");

$("#tech").innerHTML=TECH.map(t=>`<div class="row" id="tr-${t.id}"><div><b>${t.n}</b><br><small>${t.d}<br><span id="tc-${t.id}"></span></small></div><button data-tech="${t.id}" id="tb-${t.id}">Research</button></div>`).join("");
$("#cmds").innerHTML=Object.keys(CM).map(id=>`<div class="row"><div><b>${CM[id].n}</b> <span id="cl-${id}"></span><br><small>${CM[id].d}<br><span id="cc-${id}"></span></small></div><button data-cmd="${id}" id="cb-${id}"></button></div>`).join("");
let qKey="";
function update(){
done();
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
if(inf)inf.innerHTML=`<b>${s.n}</b><br><small>${s.t.toUpperCase()} fleet. Bring ${WEAK[s.t]}s (+50%). Needs ${spw(S.sel)} power.${S.own[S.sel]?" Held by "+RV[S.own[S.sel]].n+".":""} Your fleet: ${fpower(S.sel).toFixed(1)}.<br>Loot: ${cstr(s.r)}<br>${own?"You own this system.":av?"Ready to attack.":"Out of reach. Claim a neighboring system first."}</small>`;
if(a){a.disabled=own||!av||total()<1;a.textContent=own?"Owned":"Attack"}}}
baseUI(now);
upd2();
const all=Q.filter(q=>!S.q.includes(q.id)),open=all.filter(q=>q.ok()).concat(all.filter(q=>!q.ok()).slice(0,3)),key=open.map(q=>q.id+(q.ok()?1:0)).join();
if(key!==qKey){qKey=key;$("#quests").innerHTML=open.length?open.map(q=>`<div class="row"><div>${q.t}<br><small>Reward: ${cstr(q.r)}</small></div><button data-claim="${q.id}" ${q.ok()?"":"disabled"}>Claim</button></div>`).join(""):"<small>All quests complete. Nice work, Commander.</small>"}
popupUI();empireUI();progressBars();
draw();
}

const cv=$("#cv"),x=cv.getContext("2d"),st=$("#st"),y=st.getContext("2d");
// v0.9.3: size the internal canvas to the viewport aspect so planets are
// circles, not stretched ellipses. Called on load, on resize, and on tab
// switch (a hidden canvas reports 0 size, so keep the old size then).
function sizeCanvas(c){try{const r=c.getBoundingClientRect();if(!r||r.width<10||r.height<10)return;let w=Math.round(r.width),h=Math.round(r.height);const k=Math.min(1,1600/w,1200/h);w=Math.max(320,Math.round(w*k));h=Math.max(320,Math.round(h*k));if(c.width!==w||c.height!==h){c.width=w;c.height=h}}catch(e){}}
function sizeCanvases(){measureUI();sizeCanvas(cv);sizeCanvas(st);clampCam();clampStCam()}
if(typeof window!=="undefined"&&window.addEventListener)window.addEventListener("resize",()=>{sizeCanvases();update()});
sizeCanvases();
function pal(){const cs=getComputedStyle(document.documentElement),c={};[["b","--bg"],["h","--hi"],["m","--mid"],["f","--fg"]].forEach(a=>c[a[0]]=cs.getPropertyValue(a[1]).trim());return c}
function draw(){drawGalaxy(x,CAM,{sx:(cv.width||384)/2,sy:safeCyCv()});drawBase(y,STCAM,{sx:(st.width||384)/2,sy:safeCySt()});drawMinimap()}
// v0.9.1 station: drag to pan, pinch / wheel / double-tap to zoom,
// tap a building to open it, tap an open plot to see what can be built there.
// Tap vs drag: a pointer that moves more than 8px is a drag, never a tap.
const stPointers=new Map();let stStart=null,stDrag=false,stPinch=0;
st.addEventListener("pointerdown",e=>{if(POP)return; // v1.4: map cannot steal a popup tap
if(st.setPointerCapture)try{st.setPointerCapture(e.pointerId)}catch(_){}stPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(stPointers.size===1){stStart={x:e.clientX,y:e.clientY};stDrag=false}else if(stPointers.size===2){const a=[...stPointers.values()];stPinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);stDrag=true}});
st.addEventListener("pointermove",e=>{if(!stPointers.has(e.pointerId))return;stPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const q=st.getBoundingClientRect();if(stPointers.size===2){const a=[...stPointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2;if(stPinch>0)setStZoom(STCAM.zoom*d/stPinch,(mx-q.left)/q.width*st.width,(my-q.top)/q.height*st.height);stPinch=d;update();return}if(stStart){const dx=e.clientX-stStart.x,dy=e.clientY-stStart.y;if(Math.abs(dx)+Math.abs(dy)>8)stDrag=true;if(stDrag){const sc=stScale();STCAM.cx-=dx/q.width*st.width/sc;STCAM.cy-=dy/q.height*st.height/sc;stStart={x:e.clientX,y:e.clientY};clampStCam();update()}}});
const stEnd=e=>{stPointers.delete(e.pointerId);if(stPointers.size<2)stPinch=0;if(stPointers.size===0&&stStart&&!stDrag){const q=st.getBoundingClientRect(),sx=(e.clientX-q.left)/q.width*st.width,sy=(e.clientY-q.top)/q.height*st.height,w=stScreenToWorld(sx,sy);
 // v1.2 iso hit test: a tap on a tall building sprite must select that
 // building, not the plot behind it. Check buildings front-to-back
 // (highest x+y first) against their iso silhouette (isoBuildingHit),
 // then fall back to the ground diamond the tap lands in.
 let hit=null;
 [...S.bl].sort((a,b)=>(b.x+b.y)-(a.x+a.y)).some(b=>{if(isoBuildingHit(w.x,w.y,b)){hit=b;return true}return false});
 if(hit){if(S.place||S.mv)msg("That spot is taken.");else openBuilding(hit.u)}
 else{const cell=isoCellFromPoint(w.x,w.y),bx=cell.i,by=cell.j;if(bx>=0&&by>=0&&bx<12&&by<12){const at=bAt(bx,by);if(at){if(S.place||S.mv)msg("That spot is taken.");else openBuilding(at.u)}else if(S.place)placeB(S.place,bx,by);else if(S.mv){const b=S.bl.find(z=>z.u===S.mv);if(b){b.x=bx;b.y=by}S.mv=null;msg("Building moved.")}else openPlot(bx,by)}}
 update();save()}stStart=null;stDrag=false};
st.addEventListener("pointerup",stEnd);st.addEventListener("pointercancel",stEnd);
st.addEventListener("wheel",e=>{if(e.preventDefault)e.preventDefault();const q=st.getBoundingClientRect();setStZoom(STCAM.zoom*(e.deltaY<0?1.15:1/1.15),(e.clientX-q.left)/q.width*st.width,(e.clientY-q.top)/q.height*st.height);update()},{passive:false});
st.addEventListener("dblclick",e=>{const q=st.getBoundingClientRect();setStZoom(STCAM.zoom>=2?1:2,(e.clientX-q.left)/q.width*st.width,(e.clientY-q.top)/q.height*st.height);update()});
// UI OVERHAUL v0.9 — interactive galaxy map: drag to pan, pinch / wheel /
// double-tap to zoom, tap to open a system. Tap vs drag: a pointer that
// moves more than 8px is a drag and never selects anything.
const pointers=new Map();let pStart=null,pDrag=false,pPinch=0;
cv.addEventListener("pointerdown",e=>{if(POP)return; // v1.4: map cannot steal a popup tap
if(cv.setPointerCapture)try{cv.setPointerCapture(e.pointerId)}catch(_){}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){pStart={x:e.clientX,y:e.clientY};pDrag=false}else if(pointers.size===2){const a=[...pointers.values()];pPinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);pDrag=true}});
cv.addEventListener("pointermove",e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const q=cv.getBoundingClientRect();if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2;if(pPinch>0)setZoom(CAM.zoom*d/pPinch,(mx-q.left)/q.width*cv.width,(my-q.top)/q.height*cv.height);pPinch=d;update();return}if(pStart){const dx=e.clientX-pStart.x,dy=e.clientY-pStart.y;if(Math.abs(dx)+Math.abs(dy)>8)pDrag=true;if(pDrag){const sc=camScale();CAM.cx-=dx/q.width*cv.width/sc;CAM.cy-=dy/q.height*cv.height/sc;pStart={x:e.clientX,y:e.clientY};clampCam();update()}}});
const cvEnd=e=>{pointers.delete(e.pointerId);if(pointers.size<2)pPinch=0;if(pointers.size===0&&pStart&&!pDrag){const q=cv.getBoundingClientRect(),sx=(e.clientX-q.left)/q.width*cv.width,sy=(e.clientY-q.top)/q.height*cv.height,w=screenToWorld(sx,sy),lx=w.x/WORLD.px,ly=w.y/WORLD.px;let best=-1,bd=100;SYS.forEach((s,i)=>{const d=(s.x-lx)**2+(s.y-ly)**2;if(d<bd){bd=d;best=i}});if(best>=0)openSystem(best)}pStart=null;pDrag=false};
cv.addEventListener("pointerup",cvEnd);cv.addEventListener("pointercancel",cvEnd);
cv.addEventListener("wheel",e=>{if(e.preventDefault)e.preventDefault();const q=cv.getBoundingClientRect();setZoom(CAM.zoom*(e.deltaY<0?1.15:1/1.15),(e.clientX-q.left)/q.width*cv.width,(e.clientY-q.top)/q.height*cv.height);update()},{passive:false});
cv.addEventListener("dblclick",e=>{const q=cv.getBoundingClientRect();setZoom(CAM.zoom>=2?1:2,(e.clientX-q.left)/q.width*cv.width,(e.clientY-q.top)/q.height*cv.height);update()});
const popEl=$("#pop");
if(popEl){popEl.addEventListener("click",e=>{if(e.target===popEl)closePopup()});
popEl.addEventListener("pointerup",e=>{if(e.target===popEl)closePopup()});} // v1.4: backdrop works on touch too
document.addEventListener("keydown",e=>{if(e.key==="Escape"){const m=$("#menu");if(m&&!m.hidden&&m.classList.contains("open"))closeMenu();else if(POP)closePopup();else if(PAGE.kind!=="tab")goBack();}});
const mm=$("#mm");if(mm)mm.addEventListener("click",e=>{const q=mm.getBoundingClientRect();CAM.cx=(e.clientX-q.left)/q.width*WORLD.w;CAM.cy=(e.clientY-q.top)/q.height*WORLD.h;clampCam();update()});
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
else if(d.hide){setUIHidden(true)}
else if(d.showui){setUIHidden(false)}
else if(d.skip){if(BT&&!BT.done){BT.f=59;bframe()}else $("#bbox").hidden=true}
else if(d.log){PAGE={kind:"log"};update()}
else if(d.bup){const b=S.bl.find(z=>z.u===S.bsel);if(b){const l=effL(b),c=cost(b.t,l);if(l<lvlCap(b.t)&&S.bq.length<bqcap()&&can(c)){pay(c);{const s0=Math.max(Date.now(),...S.bq.filter(j=>j.u===b.u).map(j=>j.end));S.bq.push({u:b.u,s:s0,end:s0+dur(l)*1000})}msg(B[b.t].n+" upgrade started.")}}}
else if(d.bmv){S.mv=S.mv===S.bsel?null:S.bsel;S.place=null;if(S.mv)closePopup()}
else if(d.bnew){S.place=S.place===d.bnew?null:d.bnew;S.mv=null;S.bsel=null}
else if(d.build){const k=d.build,u=U[k],n=+d.n||1;let ok=0;for(let j=0;j<n;j++){if(S.bx.hangar>=u.h&&usedQ()+u.sz<=scap()&&S.sq.length<qcap()&&can(u.c)){pay(u.c);const s0=Math.max(Date.now(),S.sq.length?S.sq[S.sq.length-1].end:0);S.sq.push({k,end:s0+DUR[k]*1000*tmul()});ok++}else break}if(ok)msg(ok+"x "+u.n+" construction started.")}
else if(d.claim){const q=Q.find(z=>z.id===d.claim);if(q&&q.ok()&&!S.q.includes(q.id)){S.q.push(q.id);for(const k in q.r)S.res[k]=Math.min(cap(),S.res[k]+q.r[k]);msg("Quest complete: "+q.t);sfx("claim")}}
else if(d.tech){const t=TECH.find(z=>z.id===d.tech);if(t&&!S.rq&&!S.tech.includes(t.id)&&(!t.req||S.tech.includes(t.req))&&can(t.c)){pay(t.c);S.rq={id:t.id,end:Date.now()+t.t*1000*tmul()};msg("Research started: "+t.n)}}
else if(d.cmd){const id=d.cmd,c=CM[id],sl=c.t==="fleet"?"fleet":"station";if(!S.cmds.includes(id)){if(S.res.credits>=c.c){S.res.credits-=c.c;S.cmds.push(id);S.slot[sl]=id;msg(c.n+" joins your command.")}}else S.slot[sl]=S.slot[sl]===id?null:id}
else if(d.scrap){const k=d.scrap;if(S.ships[k]>0){S.ships[k]--;for(const r in U[k].c)S.res[r]=Math.min(cap(),S.res[r]+Math.floor(U[k].c[r]/2));msg(U[k].n+" scrapped. Half its cost was refunded.")}}
else if(d.atk){
const i=S.sel,s=SYS[i];if(!avail(i)||total()<1)return;
const p=fpower(i)*(.85+Math.random()*.3),pre={...S.ships},need=spw(i),win=p>=need;HOLD=true;
if(win){for(const k in U)S.ships[k]=Math.ceil(S.ships[k]*Math.min(.95,.7+tsum("keep")));if(S.own[i]){S.cap++;delete S.own[i]}S.won.push(i);for(const k in s.r)S.res[k]=Math.min(cap(),S.res[k]+s.r[k]);
gain("fleet",2);msg(i===15?"You conquered the Dark Nexus. The galaxy is yours!":i===7?"The Hive Core falls, but the galaxy is bigger than you thought.":"Victory! "+s.n+" is yours and now pays you credits.")}
else{for(const k in U)S.ships[k]=Math.floor(S.ships[k]*(.4+tsum("keep")));msg("Defeat. Your fleet retreats with heavy losses. Build the ship type this enemy is weak to, or upgrade the Command Station.")}
closePopup();
battle(win,pre,s,p,need);
}
else if(b.id==="snd"){S.mute=S.mute?0:1;sfx("ok")}
else if(b.id==="reset"){$("#rbox").hidden=false}
else if(d.rcancel){$("#rbox").hidden=true}
else if(d.rgo){S=fresh();recalc();qKey="";$("#rbox").hidden=true;msg("A new empire begins.")}
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
downBtn=(b&&b.closest&&b.closest("#pop"))?b:null;downX=e.clientX;downY=e.clientY});
document.body.addEventListener("pointerup",e=>{
if(!downBtn)return;
const b=e.target&&e.target.closest?e.target.closest("button"):null;
const btn=downBtn;downBtn=null;
if(b!==btn||b.disabled)return;
if(Math.abs(e.clientX-downX)>=12||Math.abs(e.clientY-downY)>=12)return;
popClickGuard=Date.now()+600; // swallow the click that follows
handleBodyClick(e)});

function rstr(id){let k=0;for(const i in S.own)if(S.own[i]===id)k++;return RV[id].b*(1+Math.min(5,S.min*.02))*(1+.1*k)}
function nb(id,i){return Object.keys(S.own).some(j=>S.own[j]===id&&adj(i,+j))}
function dpower(){let p=0;for(const k in U)p+=S.ships[k]*U[k].pw;return p*(1+.2*(S.b.command-1))*(1+tsum("pw"))*(1+cb("fleet"))*1.2}
function rivalTick(){const now=Date.now();
if(!S.rvi){S.rvi=1;const pick=l=>l.find(i=>!S.won.includes(i)&&!S.own[i]);const a=pick([14,13,12]);if(a)S.own[a]="c";const b=pick([11,10,9]);if(b)S.own[b]="v"}
for(const k in S.own)if(S.won.includes(+k))delete S.own[k];
for(const id in RV){const r=S.rv[id];if(!Object.keys(S.own).some(j=>S.own[j]===id))continue;
let g=0;while(now-r.cl>=360000&&g++<2){r.cl+=360000;if(Object.keys(S.own).filter(j=>S.own[j]===id).length<6){const c=SYS.map((s,i)=>i).filter(i=>i>0&&i<15&&!S.won.includes(i)&&!S.own[i]&&nb(id,i)&&(i>=4||S.min>=45));if(c.length){const i=c[Math.floor(Math.random()*c.length)];S.own[i]=id;msg(RV[id].n+" claimed "+SYS[i].n+".")}}}
if(now-r.cl>=720000)r.cl=now;
g=0;while(now-r.rd>=300000&&g++<1){r.rd+=300000;if(S.min<10)continue;const t=S.won.filter(i=>i>0&&nb(id,i));if(t.length&&Math.random()<.7){const i=t[Math.floor(Math.random()*t.length)],rp=rstr(id)*(.85+Math.random()*.3);if(rp>dpower()){S.won.splice(S.won.indexOf(i),1);S.own[i]=id;for(const k in U)S.ships[k]=Math.ceil(S.ships[k]*.75);msg(RV[id].n+" raided "+SYS[i].n+" and took it!");sfx("alert")}else{S.rep++;gain("fleet",1);msg("Your fleet repelled "+RV[id].n+" at "+SYS[i].n+".");sfx("ok")}}}
if(now-r.rd>=600000)r.rd=now}}
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
function placeB(t,x,y){const c=newCost(t);if(cnt(t)<MAXC(t)&&S.bq.length<bqcap()&&can(c)){pay(c);const b={u:S.nu++,t,x,y,l:0};S.bl.push(b);S.bq.push({u:b.u,s:Date.now(),end:Date.now()+dur(0)*1000});S.bsel=b.u;msg(B[t].n+" construction started.")}S.place=null}
function baseUI(now){
if(!$("#binfo"))return; // v0.9.2: station info/build boxes removed — popups cover this now.
const sel=S.bl.find(b=>b.u===S.bsel);
$("#bq").textContent=S.bq.length?"Building: "+S.bq.map(j=>{const b=S.bl.find(z=>z.u===j.u);return b?B[b.t].n+" ("+left(j.end-now)+")":""}).join(", ")+". Builders busy: "+S.bq.length+"/"+bqcap()+".":"Builders idle (up to "+bqcap()+" jobs at once).";
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
function showTab(){const t=S.tab||"map",pg=PAGE.kind;document.querySelectorAll("[data-pg]").forEach(e=>{e.hidden=pg==="tab"?e.dataset.pg!==t:e.dataset.pg!==pg});sizeCanvases();document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("on",pg==="tab"&&b.dataset.tab===t));if(pg==="log"){const h=$("#hlog");if(h)h.innerHTML=S.feed.slice().reverse().map(x=>"<div class=\"row\">"+x+"</div>").join("")||"<small class=\"empty\">No events yet.</small>";}const n=Q.filter(q=>!S.q.includes(q.id)&&q.ok()).length;const bd=$("#tq-badge");if(bd){bd.hidden=!n;bd.textContent=n||""}else{const tq=$("#tq");if(tq)tq.textContent=n?"Quests ("+n+")":"Quests"}$("#snd").textContent="Sound: "+(S.mute?"off":"on")}
// Render key: popup identity + every value shown in it. If the key is
// unchanged, the popup's DOM nodes are left exactly as they are —
// the 250ms tick must never rebuild a button under a finger.
function popKey(){
if(!POP)return "";
if(POP.kind==="system"){const i=S.sel,own=S.won.includes(i);return "sys|"+i+"|"+(own?1:0)+"|"+(avail(i)?1:0)+"|"+total()+"|"+spw(i)+"|"+fpower(i).toFixed(1)+"|"+S.won.length}
if(POP.kind==="building"){const b=S.bl.find(z=>z.u===POP.u);if(!b)return "gone";const e=effL(b),c=cost(b.t,e);return "bld|"+b.u+"|"+b.l+"|"+e+"|"+(e>=lvlCap(b.t)?1:0)+"|"+cstr(c)+"|"+S.bq.length+"|"+(can(c)?1:0)+"|"+(S.mv===b.u?1:0)}
if(POP.kind==="plot"){return "plot|"+POP.x+"|"+POP.y+"|"+S.bq.length+"|"+Object.keys(B).map(t=>cnt(t)+"/"+MAXC(t)+"/"+(can(newCost(t))?1:0)).join(",")}
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
+stat("Systems owned",S.won.length+" of 16")
+stat("Fleet power",Number.isFinite(fpt())?String(Math.round(fpt())):"0");
acts.innerHTML='<button data-pclose="1" class="grow">Close</button>';}
else{const need=spw(i),fp=fpower(i),loot=s.r?cstr(s.r):"";
const stat=(k,v)=>'<div class="stat"><span>'+k+'</span><b>'+v+'</b></div>';
body.innerHTML="<small>"+s.t.toUpperCase()+" fleet. "+(own?"You own this system.":av?"Ready to attack.":"Out of reach. Claim a neighboring system first.")+(S.own[i]?" Held by "+RV[S.own[i]].n+".":"")+"</small>"
+stat("Needs",Number.isFinite(need)?need+" power":"—")
+stat("Your fleet vs "+s.t,Number.isFinite(fp)?fp.toFixed(1):"0.0")
+(loot?stat("Loot",loot):"")
+stat("Counter","Bring "+WEAK[s.t]+"s (+50%)");
acts.innerHTML='<button data-atk="1" class="grow" '+(own||!av||total()<1?"disabled":"")+'>'+(own?"Owned":"Attack")+'</button><button data-pclose="1" class="grow">Close</button>';}
}else if(POP.kind==="building"){
const b=S.bl.find(z=>z.u===POP.u);
if(!b){closePopup();return}
const t=b.t,e=effL(b),max=e>=lvlCap(t),c=cost(t,e),m=mult(b),pr=Object.keys(B[t].p)[0];
title.textContent=B[t].n+" Lv "+b.l;
if(hq){hq.fillStyle="#5fae4f";hq.fillRect(0,0,96,96);const sp=buildingSprite(t,b.l);hq.drawImage(sp,24,24,48,48)}
let st=B[t].d+". ";
if(b.l===0)st="Under construction. ";
else if(pr)st+="Makes +"+(B[t].p[pr]*b.l*m*(1+tsum("eco"))*(1+cb("econ"))).toFixed(1)+" "+pr+"/s. ";
else if(t==="hangar")st+="Holds "+(5+tsum("slot"))*b.l+" ship slots. ";
else st+="Max building level "+lvlCap("hangar")+", storage "+fmt(cap())+". ";
const DISTNAME={solar:"Power District",foundry:"Industrial District",mine:"Industrial District",hub:"Trade District",hangar:"Military District",command:"The Keep"};body.innerHTML="<small><b>"+(DISTNAME[t]||"")+"</b> — "+st+"</small><br><small>"+(max?(t==="command"?"Max level.":"Upgrade the Command Station to go higher."):"Upgrade to Lv "+(e+1)+": "+cstr(c)+". Time: "+left(dur(e)*1000))+"</small>";
acts.innerHTML='<button data-bup="1" '+((max||S.bq.length>=bqcap()||!can(c))?"disabled":"")+'>Upgrade</button><button data-bmv="1">'+(S.mv===b.u?"Cancel move":"Move")+'</button><button data-pclose="1">Close</button>';
}else if(POP.kind==="plot"){
const x=POP.x,y=POP.y;
title.textContent="Open land ("+(x+1)+", "+(y+1)+")";const _kp=S.bl.find(b=>b.t==="command");const _dn=_kp?(x<_kp.x-1?"West — near the Military quarter":x>_kp.x+1?"East — near the Industrial quarter":y<_kp.y-1?"North — near the Power fields":"South — near the Trade quarter"):"Open land";
if(hq){hq.fillStyle="#5fae4f";hq.fillRect(0,0,96,96)}
body.innerHTML="<small>"+_dn+". What can you build here? Each new copy costs 1.5x the last. Buildings produce at full rate wherever they stand.</small>"+Object.keys(B).map(t=>{const n=cnt(t),mx=MAXC(t),c=newCost(t),ok=n<mx&&S.bq.length<bqcap()&&can(c);return '<div class="row"><div><b>'+B[t].n+'</b> '+n+"/"+mx+'<br><small>'+B[t].d+'<br>Cost: '+cstr(c)+'</small></div><button data-place="'+t+'" '+(ok?"":"disabled")+'>Place</button></div>'}).join("");
acts.innerHTML="";
}}
function empireUI(){if(PAGE.kind!=="empire")return;$("#emp-sum").textContent=S.won.length+" of 16 systems. Each owned system pays +0.3 credits/s.";
$("#emp-list").innerHTML=S.won.map(i=>'<div class="emp-row"><div><b>'+SYS[i].n+'</b><br><small>'+(i===0?"Home World":"Power "+SYS[i].pw+" · Loot "+cstr(SYS[i].r))+'</small></div><button data-fly="'+i+'">Go to</button></div>').join("")||"<small>No systems yet.</small>";
$("#e-rvs").innerHTML=Object.keys(RV).map(id=>{const k=Object.keys(S.own).filter(j=>S.own[j]===id).length;return "<b>"+RV[id].n+"</b>: "+(k?k+" systems, power "+Math.round(rstr(id)):"defeated")}).join("<br>")}
function progressBars(){const now=Date.now();const set=(id,p)=>{const el=$(id);if(el)el.style.width=Math.round(Math.max(0,Math.min(1,p||0))*100)+"%"};
const bq=S.bq.slice().sort((a,b)=>a.end-b.end)[0];set("#pb-build",bq&&bq.s?(now-bq.s)/(bq.end-bq.s):0);
if(S.rq){const t=TECH.find(z=>z.id===S.rq.id);set("#pb-res",t?1-(S.rq.end-now)/(t.t*1000*tmul()):0)}else set("#pb-res",0);
const sq=S.sq[0];set("#pb-ship",sq?1-(sq.end-now)/(DUR[sq.k]*1000*tmul()):0)}
function drawMinimap(){const mm=$("#mm");if(!mm)return;const q=mm.getContext("2d");if(!q||!q.fillRect)return;q.fillStyle="#0a0e2a";q.fillRect(0,0,96,120);SYS.forEach((s,i)=>{const own=S.won.includes(i),o=S.own[i];q.fillStyle=own?"#6ee7f5":o==="c"?"#e0584a":o==="v"?"#b07cf0":"#7c849c";q.fillRect(Math.round(s.x*WORLD.px/WORLD.w*96)-2,Math.round(s.y*WORLD.px/WORLD.h*120)-2,4,4)});const sc=camScale(),vw=cv.width/sc/WORLD.w*96,vh=safeH()/sc/WORLD.h*120,vx=CAM.cx/WORLD.w*96-vw/2,vy=CAM.cy/WORLD.h*120-vh/2;q.fillStyle="rgba(255,224,102,.9)";q.fillRect(vx,vy,Math.max(4,vw),1);q.fillRect(vx,vy+vh-1,Math.max(4,vw),1);q.fillRect(vx,vy,1,Math.max(4,vh));q.fillRect(vx+vw-1,vy,1,Math.max(4,vh))}
function upd2(){const now=Date.now();showTab();
$("#fpw").textContent="Fleet power: "+Math.round(fpt())+". Vs swarm "+Math.round(fpt("swarm"))+", armored "+Math.round(fpt("armored"))+", fortress "+Math.round(fpt("fortress"))+".";
const rvEl=$("#rvs");if(rvEl)rvEl.innerHTML=Object.keys(RV).map(id=>{const k=Object.keys(S.own).filter(j=>S.own[j]===id).length;return "<b>"+RV[id].n+"</b>: "+(k?k+" systems, power "+Math.round(rstr(id)):"defeated")}).join("<br>")+"<br>Rivals claim neutral systems next to their territory and raid yours. Raids start after about 10 minutes of play. A strong home fleet repels them.";
TECH.forEach(t=>{const dn=S.tech.includes(t.id),av=!dn&&(!t.req||S.tech.includes(t.req));$("#tr-"+t.id).style.display=av?"":"none";if(av){$("#tc-"+t.id).textContent="Cost: "+cstr(t.c)+". Time: "+left(t.t*1000*tmul());$("#tb-"+t.id).disabled=!!S.rq||!can(t.c)}});
$("#rq").textContent=(S.rq?"Researching: "+TECH.find(z=>z.id===S.rq.id).n+" ("+left(S.rq.end-now)+"). ":"Lab idle. ")+"Completed "+S.tech.length+" of "+TECH.length+".";
for(const id in CM){const c=CM[id],h=S.cmds.includes(id),sl=c.t==="fleet"?"fleet":"station",on=S.slot[sl]===id;
$("#cl-"+id).textContent=h?"Lv "+lv(id)+(on?" (assigned)":""):"";
$("#cc-"+id).textContent=h?"Bonus now: +"+Math.round(c.b*lv(id)*100)+"% "+TT[c.t]+(on?"":" (not assigned)"):"Hire cost: "+c.c+" credits";
const b=$("#cb-"+id);b.textContent=!h?"Hire":on?"Unassign":"Assign";b.disabled=!h&&S.res.credits<c.c}}
const away=Math.min((Date.now()-S.t)/1000,28800);
if(away>60){step(away);done();msg("Welcome back! Your empire worked for "+Math.floor(away/60)+" minutes while you were away.")}
let last=Date.now(),starve=0;
setInterval(()=>{
const n=Date.now(),dt=Math.min((n-last)/1000,5);last=n;step(dt);
if(S.res.energy<=0&&rates().energy<0&&total()>0){starve+=dt;if(starve>10){starve=0;const k=S.ships.fighter?"fighter":S.ships.cruiser?"cruiser":"capital";S.ships[k]--;msg("A ship went dark. You are out of energy!")}}
rivalTick();update();
},250);
setInterval(save,5000);
update();
maybeTut();
