const $=s=>document.querySelector(s);
const fresh=()=>({res:{energy:40,metal:40,crystal:10,credits:10},b:{solar:1,foundry:1,mine:0,hub:0,hangar:0,command:1},ships:{fighter:0,cruiser:0,capital:0},won:[0],sel:1,pos:JSON.parse(JSON.stringify(POS0)),bq:[],sq:[],q:[],selB:null,tech:[],rq:null,cmds:[],cx:{},slot:{fleet:null,station:null},own:{},rv:{c:{cl:Date.now(),rd:Date.now()},v:{cl:Date.now(),rd:Date.now()}},min:0,rvi:0,rep:0,cap:0,feed:[],t:Date.now()});
function load(){try{const j=JSON.parse(localStorage.getItem(KEY));if(j&&j.res&&j.b&&j.ships&&j.pos)return Object.assign(fresh(),j)}catch(e){}return fresh()}
function save(){try{S.t=Date.now();localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
let S=load();
const tsum=k=>TECH.filter(x=>S.tech.includes(x.id)&&x.k===k).reduce((a,x)=>a+x.v,0);
const lv=id=>Math.min(10,1+Math.floor(Math.sqrt((S.cx[id]||0)/2)));
const cb=t=>{const id=S.slot[t==="fleet"?"fleet":"station"];return id&&CM[id].t===t?CM[id].b*lv(id):0};
const tmul=()=>1-Math.min(.5,cb("build"));
const scap=()=>(5+tsum("slot"))*S.b.hangar;
function gain(s,n){const id=S.slot[s];if(id)S.cx[id]=(S.cx[id]||0)+n}
const cap=()=>100+500*S.b.command;
const lvlCap=id=>id==="command"?5+tsum("cmax"):Math.min(13,S.b.command*2+1);
const eff=id=>S.b[id]+S.bq.filter(j=>j.id===id).length;
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
const mult=id=>{const p=S.pos[id];let n=0;for(const o in S.pos)if(o!==id&&S.b[o]>0&&Math.abs(S.pos[o][0]-p[0])+Math.abs(S.pos[o][1]-p[1])===1)n++;return 1+.15*n};
function fpower(i){const w=WEAK[SYS[i].t];let p=0;for(const k in U)p+=S.ships[k]*U[k].pw*(k===w?1.5:1);return p*(1+.2*(S.b.command-1))*(1+tsum("pw"))*(1+cb("fleet"))}
function rates(){const o={energy:0,metal:0,crystal:0,credits:0};for(const id in B)for(const r in B[id].p)o[r]+=B[id].p[r]*S.b[id]*mult(id)*(1+tsum("eco"))*(1+cb("econ"));o.credits+=.3*(S.won.length-1);o.energy-=.05*used();return o}
function step(dt){S.min+=dt/60;const r=rates();R.forEach(k=>{S.res[k]=Math.min(cap(),Math.max(0,S.res[k]+r[k]*dt))})}
function done(){const n=Date.now();
while(S.bq.length&&S.bq[0].end<=n){const id=S.bq.shift().id;S.b[id]++;gain("station",1);msg(B[id].n+" reaches level "+S.b[id]+".")}
while(S.sq.length&&S.sq[0].end<=n){const k=S.sq.shift().k;S.ships[k]++;msg(U[k].n+" launched.")}
if(S.rq&&S.rq.end<=n){const t=TECH.find(z=>z.id===S.rq.id);S.tech.push(t.id);S.rq=null;gain("station",1);msg("Research complete: "+t.n)}}
const msg=t=>{S.feed.push(t);if(S.feed.length>5)S.feed.shift();$("#log").textContent=S.feed.slice(-3).join("\n")};
const left=ms=>Math.max(0,Math.ceil(ms/1000))+"s";

$("#res").innerHTML=R.map(r=>`<div>${r}<b id="v-${r}"></b><small id="r-${r}"></small></div>`).join("");
$("#blds").innerHTML=Object.keys(B).map(id=>`<div class="row"><div><b>${B[id].n}</b> <span id="lv-${id}"></span><br><small>${B[id].d}</small><br><small id="cs-${id}"></small></div><button data-up="${id}" id="bt-${id}"></button></div>`).join("");
$("#ships").innerHTML=Object.keys(U).map(k=>`<div class="row"><div><b>${U[k].n}</b> x<span id="n-${k}"></span><br><small>Power ${U[k].pw}, ${U[k].sz} slot${U[k].sz>1?"s":""}, ${DUR[k]}s. Cost: ${cstr(U[k].c)}</small></div><div style="display:flex;gap:6px"><button data-scrap="${k}" id="sc-${k}">Scrap</button><button data-build="${k}" id="sb-${k}"></button></div></div>`).join("");

$("#tech").innerHTML=TECH.map(t=>`<div class="row" id="tr-${t.id}"><div><b>${t.n}</b><br><small>${t.d}<br><span id="tc-${t.id}"></span></small></div><button data-tech="${t.id}" id="tb-${t.id}">Research</button></div>`).join("");
$("#cmds").innerHTML=Object.keys(CM).map(id=>`<div class="row"><div><b>${CM[id].n}</b> <span id="cl-${id}"></span><br><small>${CM[id].d}<br><span id="cc-${id}"></span></small></div><button data-cmd="${id}" id="cb-${id}"></button></div>`).join("");
let qKey="";
function update(){
done();
const r=rates(),now=Date.now();
R.forEach(k=>{$("#v-"+k).textContent=fmt(S.res[k]);$("#r-"+k).textContent=(r[k]>=0?"+":"")+r[k].toFixed(1)+"/s"});
$("#cap").textContent="Storage holds "+fmt(cap())+" of each. Upgrade the Command Station to store more.";
for(const id in B){
const l=S.b[id],e=eff(id),max=e>=lvlCap(id),c=cost(id,e);
$("#lv-"+id).textContent="Lv "+l+(e>l?" (+"+(e-l)+" queued)":"");
$("#cs-"+id).textContent=max?(id==="command"?"Max level":"Upgrade the Command Station to go higher"):"Cost: "+cstr(c)+". Time: "+left(dur(e)*1000);
const b=$("#bt-"+id);b.textContent=e?"Upgrade":"Build";b.disabled=max||S.bq.length>=2||!can(c);
}
$("#bq").textContent=S.bq.length?"Building: "+S.bq.map((j,i)=>B[j.id].n+" Lv "+(S.b[j.id]+1+S.bq.slice(0,i).filter(x=>x.id===j.id).length)+" ("+left(j.end-now)+")").join(", "):"Builders idle (2 jobs can be queued).";
const slots=scap();
$("#slots").textContent="Slots used: "+usedQ()+" / "+slots+". Ships burn a little energy each.";
$("#sq").textContent=S.sq.length?"Shipyard: "+S.sq.map(j=>U[j.k].n+" ("+left(j.end-now)+")").join(", "):"Shipyard idle (5 ships can be queued).";
for(const k in U){$("#n-"+k).textContent=S.ships[k]+(S.sq.some(j=>j.k===k)?" (+"+S.sq.filter(j=>j.k===k).length+")":"");$("#sc-"+k).disabled=S.ships[k]<1;const b=$("#sb-"+k),ok=S.b.hangar>=U[k].h;
b.textContent=ok?"Build":"Hangar Lv"+U[k].h;b.disabled=!ok||usedQ()+U[k].sz>slots||S.sq.length>=5||!can(U[k].c)}
const s=SYS[S.sel],a=$("#atk");
if(S.sel===0){$("#info").innerHTML="<b>Home World</b><br><small>Your base. Build your station and fleet here.</small>";a.disabled=true;a.textContent="Home"}
else{
const own=S.won.includes(S.sel),av=avail(S.sel);
$("#info").innerHTML=`<b>${s.n}</b><br><small>${s.t} fleet, weak to ${WEAK[s.t]}s. Needs ${spw(S.sel)} power.${S.own[S.sel]?" Held by "+RV[S.own[S.sel]].n+".":""} Your fleet: ${fpower(S.sel).toFixed(1)}.<br>Loot: ${cstr(s.r)}<br>${own?"You own this system.":av?"Ready to attack.":"Out of reach. Claim a neighboring system first."}</small>`;
a.disabled=own||!av||total()<1;a.textContent=own?"Owned":"Attack"}
$("#sthint").textContent=S.selB?B[S.selB].n+" selected (+"+Math.round((mult(S.selB)-1)*100)+"% from neighbors). Tap an empty tile to move it.":"Tap a building to select it, then tap an empty tile to move it. Each neighboring building adds +15% production.";
upd2();
const open=Q.filter(q=>!S.q.includes(q.id)).slice(0,3),key=open.map(q=>q.id+(q.ok()?1:0)).join();
if(key!==qKey){qKey=key;$("#quests").innerHTML=open.length?open.map(q=>`<div class="row"><div>${q.t}<br><small>Reward: ${cstr(q.r)}</small></div><button data-claim="${q.id}" ${q.ok()?"":"disabled"}>Claim</button></div>`).join(""):"<small>All quests complete. Nice work, Commander.</small>"}
draw();
}

const cv=$("#cv"),x=cv.getContext("2d"),st=$("#st"),y=st.getContext("2d");
function pal(){const cs=getComputedStyle(document.documentElement),c={};[["b","--bg"],["h","--hi"],["m","--mid"],["f","--fg"]].forEach(a=>c[a[0]]=cs.getPropertyValue(a[1]).trim());return c}
function draw(){
const c=pal(),r=(a,b,w,h,k)=>{x.fillStyle=c[k];x.fillRect(a,b,w,h)};
r(0,0,128,160,"b");
for(let i=0;i<90;i++)r((i*37)%127,(i*53)%159,1,1,i%5?"h":"m");
x.strokeStyle=c.h;x.lineWidth=1;
SYS.forEach((s,i)=>s.l.forEach(j=>{if(j>i){x.beginPath();x.moveTo(s.x+.5,s.y+.5);x.lineTo(SYS[j].x+.5,SYS[j].y+.5);x.stroke()}}));
SYS.forEach((s,i)=>{
const own=S.won.includes(i),av=avail(i),z=i===0?9:7,a=s.x-(z>>1),b=s.y-(z>>1);
r(a,b,z,z,own?"f":av?"m":"h");
if(own)r(a+2,b+2,z-4,z-4,"b");
const o=S.own[i];if(o){r(a,b,z,z,"m");const gx=a+2,gy=b+1;if(o==="c"){r(gx,gy,3,1,"b");r(gx,gy+1,1,3,"b");r(gx,gy+4,3,1,"b")}else{r(gx,gy,1,3,"b");r(gx+2,gy,1,3,"b");r(gx+1,gy+3,1,1,"b");r(gx+1,gy+4,1,1,"b")}}
if(i===S.sel){r(a-2,b-2,z+4,1,"f");r(a-2,b+z+1,z+4,1,"f");r(a-2,b-2,1,z+4,"f");r(a+z+1,b-2,1,z+4,"f")}
});
for(let i=0;i<Math.min(total(),12);i++)r(4+i*3,152,2,2,"m");
drawSt(c);
}
function drawSt(c){
const r=(a,b,w,h,k)=>{y.fillStyle=c[k];y.fillRect(a,b,w,h)};
r(0,0,128,64,"b");
for(let tx=0;tx<8;tx++)for(let ty=0;ty<4;ty++){r(tx*16,ty*16,1,1,"h");r(tx*16+8,ty*16+8,1,1,"h")}
const spr={
solar:(a,b)=>{r(a+2,b+6,12,8,"m");r(a+2,b+9,12,1,"b");r(a+2,b+12,12,1,"b");r(a+7,b+6,1,8,"b");r(a+7,b+2,2,4,"f")},
foundry:(a,b)=>{r(a+4,b+5,8,10,"f");r(a+2,b+3,12,3,"m");r(a+7,b+8,2,3,"b")},
mine:(a,b)=>{r(a+1,b+8,6,6,"m");r(a+7,b+5,8,9,"f");r(a+9,b+7,2,2,"b")},
hub:(a,b)=>{r(a+2,b+7,12,8,"f");r(a+1,b+4,14,3,"m");[3,7,11].forEach(o=>r(a+o,b+4,2,3,"b"))},
hangar:(a,b)=>{r(a+2,b+6,12,9,"m");r(a+6,b+10,4,5,"f");r(a+12,b+1,1,6,"f");r(a+9,b+1,3,3,"b")},
command:(a,b)=>{r(a+3,b+6,10,9,"f");r(a+1,b+3,4,12,"m");r(a+11,b+3,4,12,"m");r(a+6,b+10,4,5,"b")}
};
for(const id in S.pos){
const a=S.pos[id][0]*16,b=S.pos[id][1]*16,l=S.b[id];
if(l>0){spr[id](a,b);for(let i=0;i<Math.min(l,7);i++)r(a+1+i*2,b+15,1,1,"f")}
else{r(a+2,b+2,12,12,"m");r(a+3,b+3,10,10,"b")}
if(S.bq.some(j=>j.id===id))r(a+12,b+1,3,3,"m");
if(id===S.selB){r(a,b,16,1,"f");r(a,b+15,16,1,"f");r(a,b,1,16,"f");r(a+15,b,1,16,"f")}
}
}

st.addEventListener("click",e=>{
const q=st.getBoundingClientRect(),tx=Math.floor((e.clientX-q.left)/q.width*8),ty=Math.floor((e.clientY-q.top)/q.height*4);
const at=Object.keys(S.pos).find(id=>S.pos[id][0]===tx&&S.pos[id][1]===ty);
if(at)S.selB=S.selB===at?null:at;
else if(S.selB){S.pos[S.selB]=[tx,ty];S.selB=null;msg("Building moved.")}
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
const d=b.dataset;done();
if(d.up){const id=d.up,l=eff(id),c=cost(id,l);
if(l<lvlCap(id)&&S.bq.length<2&&can(c)){pay(c);const s0=Math.max(Date.now(),S.bq.length?S.bq[S.bq.length-1].end:0);S.bq.push({id,end:s0+dur(l)*1000});msg(B[id].n+" upgrade started.")}}
else if(d.build){const k=d.build,u=U[k];
if(S.b.hangar>=u.h&&usedQ()+u.sz<=scap()&&S.sq.length<5&&can(u.c)){pay(u.c);const s0=Math.max(Date.now(),S.sq.length?S.sq[S.sq.length-1].end:0);S.sq.push({k,end:s0+DUR[k]*1000*tmul()});msg(u.n+" construction started.")}}
else if(d.claim){const q=Q.find(z=>z.id===d.claim);if(q&&q.ok()&&!S.q.includes(q.id)){S.q.push(q.id);for(const k in q.r)S.res[k]=Math.min(cap(),S.res[k]+q.r[k]);msg("Quest complete: "+q.t)}}
else if(d.tech){const t=TECH.find(z=>z.id===d.tech);if(t&&!S.rq&&!S.tech.includes(t.id)&&(!t.req||S.tech.includes(t.req))&&can(t.c)){pay(t.c);S.rq={id:t.id,end:Date.now()+t.t*1000*tmul()};msg("Research started: "+t.n)}}
else if(d.cmd){const id=d.cmd,c=CM[id],sl=c.t==="fleet"?"fleet":"station";if(!S.cmds.includes(id)){if(S.res.credits>=c.c){S.res.credits-=c.c;S.cmds.push(id);S.slot[sl]=id;msg(c.n+" joins your command.")}}else S.slot[sl]=S.slot[sl]===id?null:id}
else if(d.scrap){const k=d.scrap;if(S.ships[k]>0){S.ships[k]--;for(const r in U[k].c)S.res[r]=Math.min(cap(),S.res[r]+Math.floor(U[k].c[r]/2));msg(U[k].n+" scrapped. Half its cost was refunded.")}}
else if(d.atk){
const i=S.sel,s=SYS[i];if(!avail(i)||total()<1)return;
const p=fpower(i)*(.85+Math.random()*.3);
if(p>=spw(i)){for(const k in U)S.ships[k]=Math.ceil(S.ships[k]*Math.min(.95,.7+tsum("keep")));if(S.own[i]){S.cap++;delete S.own[i]}S.won.push(i);for(const k in s.r)S.res[k]=Math.min(cap(),S.res[k]+s.r[k]);
gain("fleet",2);msg(i===15?"You conquered the Dark Nexus. The galaxy is yours!":i===7?"The Hive Core falls, but the galaxy is bigger than you thought.":"Victory! "+s.n+" is yours and now pays you credits.")}
else{for(const k in U)S.ships[k]=Math.floor(S.ships[k]*(.4+tsum("keep")));msg("Defeat. Your fleet retreats with heavy losses. Build the ship type this enemy is weak to, or upgrade the Command Station.")}
}
else if(b.id==="reset"){
if(b.dataset.arm){S=fresh();qKey="";b.textContent="Reset game";delete b.dataset.arm;msg("A new empire begins.")}
else{b.dataset.arm=1;b.textContent="Tap again to confirm";setTimeout(()=>{delete b.dataset.arm;b.textContent="Reset game"},3000)}
}
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
g=0;while(now-r.rd>=300000&&g++<1){r.rd+=300000;if(S.min<10)continue;const t=S.won.filter(i=>i>0&&nb(id,i));if(t.length&&Math.random()<.7){const i=t[Math.floor(Math.random()*t.length)],rp=rstr(id)*(.85+Math.random()*.3);if(rp>dpower()){S.won.splice(S.won.indexOf(i),1);S.own[i]=id;for(const k in U)S.ships[k]=Math.ceil(S.ships[k]*.75);msg(RV[id].n+" raided "+SYS[i].n+" and took it!")}else{S.rep++;gain("fleet",1);msg("Your fleet repelled "+RV[id].n+" at "+SYS[i].n+".")}}}
if(now-r.rd>=600000)r.rd=now}}
function upd2(){const now=Date.now();
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
