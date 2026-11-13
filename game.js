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
const mult=b=>{let n=0;S.bl.forEach(o=>{if(o!==b&&o.l>0&&Math.abs(o.x-b.x)+Math.abs(o.y-b.y)===1)n++});return 1+.15*n};
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

$("#res").innerHTML=R.map(r=>`<div>${r}<b id="v-${r}"></b><small id="r-${r}"></small></div>`).join("");
$("#bmenu").innerHTML=Object.keys(B).map(t=>`<div class="row"><div><b>${B[t].n}</b> <span id="bmn-${t}"></span><br><small>${B[t].d}</small><br><small id="bmc-${t}"></small></div><button data-bnew="${t}" id="bmb-${t}">Place</button></div>`).join("");
$("#ships").innerHTML=Object.keys(U).map(k=>`<div class="row"><div><b>${U[k].n}</b> x<span id="n-${k}"></span><br><small>Power ${U[k].pw}, ${U[k].sz} slot${U[k].sz>1?"s":""}, ${DUR[k]}s. Strong vs ${Object.keys(WEAK).find(t=>WEAK[t]===k)} (+50%).<br>Cost: ${cstr(U[k].c)}</small></div><div class="bg"><button data-build="${k}" id="sb-${k}"></button><button data-build="${k}" data-n="5" id="s5-${k}">x5</button><button data-scrap="${k}" id="sc-${k}">Scrap</button><button data-build="${k}" data-n="10" id="s10-${k}">x10</button></div></div>`).join("");

$("#tech").innerHTML=TECH.map(t=>`<div class="row" id="tr-${t.id}"><div><b>${t.n}</b><br><small>${t.d}<br><span id="tc-${t.id}"></span></small></div><button data-tech="${t.id}" id="tb-${t.id}">Research</button></div>`).join("");
$("#cmds").innerHTML=Object.keys(CM).map(id=>`<div class="row"><div><b>${CM[id].n}</b> <span id="cl-${id}"></span><br><small>${CM[id].d}<br><span id="cc-${id}"></span></small></div><button data-cmd="${id}" id="cb-${id}"></button></div>`).join("");
let qKey="";
function update(){
done();
const r=rates(),now=Date.now();
R.forEach(k=>{$("#v-"+k).textContent=fmt(S.res[k]);$("#r-"+k).textContent=(r[k]>=0?"+":"")+r[k].toFixed(1)+"/s"});
$("#cap").textContent="Storage holds "+fmt(cap())+" of each. Upgrade the Command Station to store more.";
const slots=scap();
$("#slots").textContent="Slots used: "+usedQ()+" / "+slots+". Ships burn a little energy each.";
$("#sq").textContent=S.sq.length?"Shipyard: "+S.sq.map(j=>U[j.k].n+" ("+left(j.end-now)+")").join(", "):"Shipyard idle ("+qcap()+" ships can be queued).";
for(const k in U){$("#n-"+k).textContent=S.ships[k]+(S.sq.some(j=>j.k===k)?" (+"+S.sq.filter(j=>j.k===k).length+")":"");$("#sc-"+k).disabled=S.ships[k]<1;const b=$("#sb-"+k),ok=S.bx.hangar>=U[k].h;
b.textContent=ok?"Build":"Hangar Lv"+U[k].h;b.disabled=!ok||usedQ()+U[k].sz>slots||S.sq.length>=qcap()||!can(U[k].c);$("#s5-"+k).disabled=$("#s10-"+k).disabled=b.disabled}
const s=SYS[S.sel],a=$("#atk");
if(S.sel===0){$("#info").innerHTML="<b>Home World</b><br><small>Your base. Build your station and fleet here.</small>";a.disabled=true;a.textContent="Home"}
else{
const own=S.won.includes(S.sel),av=avail(S.sel);
$("#info").innerHTML=`<b>${s.n}</b><br><small>${s.t.toUpperCase()} fleet. Bring ${WEAK[s.t]}s (+50%). Needs ${spw(S.sel)} power.${S.own[S.sel]?" Held by "+RV[S.own[S.sel]].n+".":""} Your fleet: ${fpower(S.sel).toFixed(1)}.<br>Loot: ${cstr(s.r)}<br>${own?"You own this system.":av?"Ready to attack.":"Out of reach. Claim a neighboring system first."}</small>`;
a.disabled=own||!av||total()<1;a.textContent=own?"Owned":"Attack"}
baseUI(now);
upd2();
const all=Q.filter(q=>!S.q.includes(q.id)),open=all.filter(q=>q.ok()).concat(all.filter(q=>!q.ok()).slice(0,3)),key=open.map(q=>q.id+(q.ok()?1:0)).join();
if(key!==qKey){qKey=key;$("#quests").innerHTML=open.length?open.map(q=>`<div class="row"><div>${q.t}<br><small>Reward: ${cstr(q.r)}</small></div><button data-claim="${q.id}" ${q.ok()?"":"disabled"}>Claim</button></div>`).join(""):"<small>All quests complete. Nice work, Commander.</small>"}
draw();
}

const cv=$("#cv"),x=cv.getContext("2d"),st=$("#st"),y=st.getContext("2d");
function pal(){const cs=getComputedStyle(document.documentElement),c={};[["b","--bg"],["h","--hi"],["m","--mid"],["f","--fg"]].forEach(a=>c[a[0]]=cs.getPropertyValue(a[1]).trim());return c}
function draw(){drawGalaxy(x);drawBase(y)}
st.addEventListener("click",e=>{
const q=st.getBoundingClientRect(),bx=Math.floor((e.clientX-q.left)/q.width*6),by=Math.floor((e.clientY-q.top)/q.height*6);
if(bx<0||by<0||bx>5||by>5)return;
const at=bAt(bx,by);
if(at){if(S.place||S.mv)msg("That spot is taken.");else S.bsel=S.bsel===at.u?null:at.u}
else if(S.place)placeB(S.place,bx,by);
else if(S.mv){const b=S.bl.find(z=>z.u===S.mv);if(b){b.x=bx;b.y=by}S.mv=null;msg("Building moved.")}
else S.bsel=null;
update();save();
});
cv.addEventListener("click",e=>{
const q=cv.getBoundingClientRect(),lx=(e.clientX-q.left)/q.width*128,ly=(e.clientY-q.top)/q.height*160;
let best=-1,bd=100;
SYS.forEach((s,i)=>{const d=(s.x-lx)**2+(s.y-ly)**2;if(d<bd){bd=d;best=i}});
if(best>=0){S.sel=best;update();save()}
});
document.body.addEventListener("click",e=>{
const b=e.target.closest("button");if(!b)return;
const d=b.dataset;ac();sfx("click");done();
if(d.tab){S.tab=d.tab}
else if(d.skip){if(BT&&!BT.done){BT.f=59;bframe()}else $("#bbox").hidden=true}
else if(d.log){$("#hlog").innerHTML=S.feed.slice().reverse().map(x=>"<div class=\"row\">"+x+"</div>").join("")||"No events yet.";$("#hbox").hidden=false}
else if(d.hclose){$("#hbox").hidden=true}
else if(d.bup){const b=S.bl.find(z=>z.u===S.bsel);if(b){const l=effL(b),c=cost(b.t,l);if(l<lvlCap(b.t)&&S.bq.length<bqcap()&&can(c)){pay(c);{const s0=Math.max(Date.now(),...S.bq.filter(j=>j.u===b.u).map(j=>j.end));S.bq.push({u:b.u,s:s0,end:s0+dur(l)*1000})}msg(B[b.t].n+" upgrade started.")}}}
else if(d.bmv){S.mv=S.mv===S.bsel?null:S.bsel;S.place=null}
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
battle(win,pre,s,p,need);
}
else if(b.id==="snd"){S.mute=S.mute?0:1;sfx("ok")}
else if(b.id==="reset"){$("#rbox").hidden=false}
else if(d.rcancel){$("#rbox").hidden=true}
else if(d.rgo){S=fresh();recalc();qKey="";$("#rbox").hidden=true;msg("A new empire begins.")}
update();save();
});

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
const sel=S.bl.find(b=>b.u===S.bsel);
$("#bq").textContent=S.bq.length?"Building: "+S.bq.map(j=>{const b=S.bl.find(z=>z.u===j.u);return b?B[b.t].n+" ("+left(j.end-now)+")":""}).join(", ")+". Builders busy: "+S.bq.length+"/"+bqcap()+".":"Builders idle (up to "+bqcap()+" jobs at once).";
for(const t in B){const n=cnt(t),mx=MAXC(t),c=newCost(t),b=$("#bmb-"+t);$("#bmn-"+t).textContent=n+"/"+mx;
$("#bmc-"+t).textContent=n>=mx?(t==="command"?"Only one allowed.":"Upgrade the Command Station for more copies."):"Cost: "+cstr(c)+". Time: "+left(dur(0)*1000);
b.textContent=S.place===t?"Cancel":"Place";b.disabled=S.place===t?false:(n>=mx||S.bq.length>=bqcap()||!can(c))}
const hint=S.place?"Tap an empty spot on the map to place your "+B[S.place].n+".":S.mv?"Tap an empty spot on the map to move it.":"Tap a building to see its stats. Each neighboring building adds +15% production.";
if(!sel){$("#bi-name").textContent="Your base";$("#bi-stats").textContent=hint;$("#bi-cost").textContent="";$("#bi-up").hidden=true;$("#bi-mv").hidden=true}
else{const t=sel.t,e=effL(sel),max=e>=lvlCap(t),c=cost(t,e),m=mult(sel),pr=Object.keys(B[t].p)[0];
$("#bi-name").textContent=B[t].n+" Lv "+sel.l+(e>sel.l?" (+"+(e-sel.l)+" queued)":"");
let st=B[t].d+". ";
if(sel.l===0)st="Under construction. ";
else if(pr)st+="Makes +"+(B[t].p[pr]*sel.l*m*(1+tsum("eco"))*(1+cb("econ"))).toFixed(1)+" "+pr+"/s (neighbors +"+Math.round((m-1)*100)+"%). ";
else if(t==="hangar")st+="Holds "+(5+tsum("slot"))*sel.l+" ship slots. ";
else st+="Max building level "+lvlCap("hangar")+", storage "+fmt(cap())+". ";
$("#bi-stats").textContent=st+hint;
$("#bi-cost").textContent=max?(t==="command"?"Max level.":"Upgrade the Command Station to go higher."):"Upgrade to Lv "+(e+1)+": "+cstr(c)+". Time: "+left(dur(e)*1000);
$("#bi-up").hidden=false;$("#bi-mv").hidden=false;$("#bi-up").disabled=max||S.bq.length>=bqcap()||!can(c);$("#bi-mv").textContent=S.mv===sel.u?"Cancel move":"Move"}}
function showTab(){const t=S.tab||"map";document.querySelectorAll("[data-pg]").forEach(e=>{e.hidden=e.dataset.pg!==t});document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("on",b.dataset.tab===t));const n=Q.filter(q=>!S.q.includes(q.id)&&q.ok()).length;$("#tq").textContent=n?"Quests ("+n+")":"Quests";$("#snd").textContent="Sound: "+(S.mute?"off":"on")}
function upd2(){const now=Date.now();showTab();
$("#fpw").textContent="Fleet power: "+Math.round(fpt())+". Vs swarm "+Math.round(fpt("swarm"))+", armored "+Math.round(fpt("armored"))+", fortress "+Math.round(fpt("fortress"))+".";
$("#rvs").innerHTML=Object.keys(RV).map(id=>{const k=Object.keys(S.own).filter(j=>S.own[j]===id).length;return "<b>"+RV[id].n+"</b>: "+(k?k+" systems, power "+Math.round(rstr(id)):"defeated")}).join("<br>")+"<br>Rivals claim neutral systems next to their territory and raid yours. Raids start after about 10 minutes of play. A strong home fleet repels them.";
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
