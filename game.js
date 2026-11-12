const $=s=>document.querySelector(s);
const fresh=()=>({res:{energy:40,metal:40,crystal:10,credits:10},b:{solar:1,foundry:1,mine:0,hub:0,hangar:0,command:1},ships:{fighter:0,cruiser:0,capital:0},won:[0],sel:1,t:Date.now()});
function load(){try{const j=JSON.parse(localStorage.getItem(KEY));if(j&&j.res&&j.b&&j.ships)return Object.assign(fresh(),j)}catch(e){}return fresh()}
function save(){try{S.t=Date.now();localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
let S=load();
const cap=()=>100+250*S.b.command;
const lvlCap=id=>id==="command"?5:S.b.command*2+1;
const cost=id=>{const o={};for(const r in B[id].c)o[r]=Math.ceil(B[id].c[r]*Math.pow(1.4,S.b[id]));return o};
const can=c=>Object.keys(c).every(r=>S.res[r]>=c[r]);
const pay=c=>{for(const r in c)S.res[r]-=c[r]};
const fmt=n=>n>=1000?(n/1000).toFixed(1)+"k":String(Math.floor(n));
const cstr=c=>Object.keys(c).map(r=>fmt(c[r])+" "+r).join(", ");
const used=()=>Object.keys(U).reduce((a,k)=>a+S.ships[k]*U[k].sz,0);
const total=()=>S.ships.fighter+S.ships.cruiser+S.ships.capital;
const adj=(i,j)=>SYS[i].l.includes(j)||SYS[j].l.includes(i);
const avail=i=>!S.won.includes(i)&&S.won.some(j=>adj(i,j));
function fpower(i){const w=WEAK[SYS[i].t];let p=0;for(const k in U)p+=S.ships[k]*U[k].pw*(k===w?1.5:1);return p*(1+.2*(S.b.command-1))}
function rates(){const o={energy:0,metal:0,crystal:0,credits:0};for(const id in B)for(const r in B[id].p)o[r]+=B[id].p[r]*S.b[id];o.credits+=.3*(S.won.length-1);o.energy-=.05*used();return o}
function step(dt){const r=rates();R.forEach(k=>{S.res[k]=Math.min(cap(),Math.max(0,S.res[k]+r[k]*dt))})}
const msg=t=>{$("#log").textContent=t};

$("#res").innerHTML=R.map(r=>`<div>${r}<b id="v-${r}"></b><small id="r-${r}"></small></div>`).join("");
$("#blds").innerHTML=Object.keys(B).map(id=>`<div class="row"><div><b>${B[id].n}</b> <span id="lv-${id}"></span><br><small>${B[id].d}</small><br><small id="cs-${id}"></small></div><button data-up="${id}" id="bt-${id}"></button></div>`).join("");
$("#ships").innerHTML=Object.keys(U).map(k=>`<div class="row"><div><b>${U[k].n}</b> x<span id="n-${k}"></span><br><small>Power ${U[k].pw}, ${U[k].sz} slot${U[k].sz>1?"s":""}. Cost: ${cstr(U[k].c)}</small></div><button data-build="${k}" id="sb-${k}"></button></div>`).join("");

function update(){
const r=rates();
R.forEach(k=>{$("#v-"+k).textContent=fmt(S.res[k]);$("#r-"+k).textContent=(r[k]>=0?"+":"")+r[k].toFixed(1)+"/s"});
$("#cap").textContent="Storage holds "+fmt(cap())+" of each. Upgrade the Command Station to store more.";
for(const id in B){
const l=S.b[id],max=l>=lvlCap(id),c=cost(id);
$("#lv-"+id).textContent="Lv "+l;
$("#cs-"+id).textContent=max?(id==="command"?"Max level":"Upgrade the Command Station to go higher"):"Cost: "+cstr(c);
const b=$("#bt-"+id);b.textContent=max?"Max":(l?"Upgrade":"Build");b.disabled=max||!can(c);
}
const slots=5*S.b.hangar;
$("#slots").textContent="Slots used: "+used()+" / "+slots+". Ships burn a little energy each.";
for(const k in U){$("#n-"+k).textContent=S.ships[k];const b=$("#sb-"+k),ok=S.b.hangar>=U[k].h;
b.textContent=ok?"Build":"Hangar Lv"+U[k].h;b.disabled=!ok||used()+U[k].sz>slots||!can(U[k].c)}
const s=SYS[S.sel],a=$("#atk");
if(S.sel===0){$("#info").innerHTML="<b>Home World</b><br><small>Your base. Build your station and fleet here.</small>";a.disabled=true;a.textContent="Home"}
else{
const own=S.won.includes(S.sel),av=avail(S.sel);
$("#info").innerHTML=`<b>${s.n}</b><br><small>${s.t} fleet, weak to ${WEAK[s.t]}s. Needs ${s.pw} power. Your fleet: ${fpower(S.sel).toFixed(1)}.<br>Loot: ${cstr(s.r)}<br>${own?"You own this system.":av?"Ready to attack.":"Out of reach. Claim a neighboring system first."}</small>`;
a.disabled=own||!av||total()<1;a.textContent=own?"Owned":"Attack"}
draw();
}

const cv=$("#cv"),x=cv.getContext("2d");
function draw(){
const cs=getComputedStyle(document.documentElement),c={};
[["b","--bg"],["h","--hi"],["m","--mid"],["f","--fg"]].forEach(a=>c[a[0]]=cs.getPropertyValue(a[1]).trim());
const r=(a,b,w,h,k)=>{x.fillStyle=c[k];x.fillRect(a,b,w,h)};
r(0,0,128,80,"b");
for(let i=0;i<40;i++)r((i*37)%127,(i*53)%79,1,1,i%5?"h":"m");
x.strokeStyle=c.h;x.lineWidth=1;
SYS.forEach((s,i)=>s.l.forEach(j=>{if(j>i){x.beginPath();x.moveTo(s.x+.5,s.y+.5);x.lineTo(SYS[j].x+.5,SYS[j].y+.5);x.stroke()}}));
SYS.forEach((s,i)=>{
const own=S.won.includes(i),av=avail(i),z=i===0?9:7,a=s.x-(z>>1),b=s.y-(z>>1);
r(a,b,z,z,own?"f":av?"m":"h");
if(own)r(a+2,b+2,z-4,z-4,"b");
if(i===S.sel){r(a-2,b-2,z+4,1,"f");r(a-2,b+z+1,z+4,1,"f");r(a-2,b-2,1,z+4,"f");r(a+z+1,b-2,1,z+4,"f")}
});
for(let i=0;i<Math.min(total(),12);i++)r(4+i*3,72,2,2,"m");
}

cv.addEventListener("click",e=>{
const q=cv.getBoundingClientRect(),lx=(e.clientX-q.left)/q.width*128,ly=(e.clientY-q.top)/q.height*80;
let best=-1,bd=100;
SYS.forEach((s,i)=>{const d=(s.x-lx)**2+(s.y-ly)**2;if(d<bd){bd=d;best=i}});
if(best>=0){S.sel=best;update();save()}
});
document.body.addEventListener("click",e=>{
const b=e.target.closest("button");if(!b)return;
const d=b.dataset;
if(d.up){const id=d.up,c=cost(id);if(S.b[id]<lvlCap(id)&&can(c)){pay(c);S.b[id]++;msg(B[id].n+" reaches level "+S.b[id]+".")}}
else if(d.build){const k=d.build,u=U[k];if(S.b.hangar>=u.h&&used()+u.sz<=5*S.b.hangar&&can(u.c)){pay(u.c);S.ships[k]++;msg(u.n+" launched.")}}
else if(d.atk){
const i=S.sel,s=SYS[i];if(!avail(i)||total()<1)return;
const p=fpower(i)*(.85+Math.random()*.3);
if(p>=s.pw){for(const k in U)S.ships[k]=Math.ceil(S.ships[k]*.7);S.won.push(i);for(const k in s.r)S.res[k]=Math.min(cap(),S.res[k]+s.r[k]);
msg(i===7?"You conquered the Alien Hive Core. The galaxy is yours!":"Victory! "+s.n+" is yours and now pays you credits.")}
else{for(const k in U)S.ships[k]=Math.floor(S.ships[k]*.4);msg("Defeat. Your fleet retreats with heavy losses. Build the ship type this enemy is weak to, or upgrade the Command Station.")}
}
else if(b.id==="reset"){
if(b.dataset.arm){S=fresh();b.textContent="Reset game";delete b.dataset.arm;msg("A new empire begins.")}
else{b.dataset.arm=1;b.textContent="Tap again to confirm";setTimeout(()=>{delete b.dataset.arm;b.textContent="Reset game"},3000)}
}
update();save();
});

const away=Math.min((Date.now()-S.t)/1000,28800);
if(away>60){step(away);msg("Welcome back! Your empire worked for "+Math.floor(away/60)+" minutes while you were away.")}
let last=Date.now(),starve=0;
setInterval(()=>{
const n=Date.now(),dt=Math.min((n-last)/1000,5);last=n;step(dt);
if(S.res.energy<=0&&rates().energy<0&&total()>0){starve+=dt;if(starve>10){starve=0;const k=S.ships.fighter?"fighter":S.ships.cruiser?"cruiser":"capital";S.ships[k]--;msg("A ship went dark. You are out of energy!")}}
update();
},250);
setInterval(save,5000);
update();
