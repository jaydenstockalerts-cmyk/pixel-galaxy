const PAL={ol:"#161628",w:"#f4f6ff",g:"#aab4c9",G:"#6b7590",d:"#3a4257",b:"#4aa3df",B:"#2f78b0",c:"#9be8ff",r:"#e0584a",R:"#a3352d",o:"#ff9a3c",y:"#ffe066",n:"#8a5a35",N:"#5a3a22",t:"#5fae4f",T:"#3e8236",l:"#8fe070",L:"#c4f5a0",p:"#b07cf0",P:"#7a4fc0",s:"#c9c3b0",S:"#8f8a76",k:"#23232f",e:"#ecdcb4",E:"#cdb98a",F:"#a89468",u:"#3f6fd1",U:"#2a4a94",z:"#ffd84a",Z:"#c9a21e",x:"#d46a4f",X:"#a84630",h:"#f09a80"};
const CC={};
const memo=(k,f)=>CC[k]||(CC[k]=f());
function spr(w,h,fn,flip){const W=w+2,H=h+2,m=Array.from({length:H},()=>Array(W).fill(null));
const R=(x,y,a,b,c)=>{for(let j=0;j<b;j++)for(let i=0;i<a;i++){const X=x+i+1,Y=y+j+1;if(X>=0&&X<W&&Y>=0&&Y<H)m[Y][X]=c}};
fn(R);
const o=m.map(r=>r.slice());
for(let j=0;j<H;j++)for(let i=0;i<W;i++)if(!m[j][i]&&((i>0&&m[j][i-1])||(i<W-1&&m[j][i+1])||(j>0&&m[j-1][i])||(j<H-1&&m[j+1][i])))o[j][i]="ol";
const cv=document.createElement("canvas");cv.width=W;cv.height=H;const q=cv.getContext("2d");
for(let j=0;j<H;j++)for(let i=0;i<W;i++){const c=o[j][flip?W-1-i:i];if(c){q.fillStyle=PAL[c]||c;q.fillRect(i,j,1,1)}}
return cv}
const bev=(R,x,y,w,h,l,m,d)=>{R(x,y,w,h,m);R(x,y,w,1,l);R(x,y,1,h,l);R(x,y+h-1,w,1,d);R(x+w-1,y,1,h,d)};
const win=(R,x,y,lit)=>{R(x,y,5,6,"d");R(x+1,y+1,3,4,lit?"y":"b");R(x+1,y+1,1,1,lit?"w":"c");R(x+3,y+4,1,1,lit?"z":"B")};
function ball(R,cx,cy,r,l,m,d,hi){for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(dx*dx+dy*dy>r*r+r*.6)continue;const L=(-dx*.55-dy*.75)/r;let c=L>.62?(hi||l):L>.12?l:L>-.38?m:d;if(Math.abs(L-.12)<.08&&((dx+dy)&1))c=m;else if(Math.abs(L+.38)<.08&&((dx+dy)&1))c=d;R(cx+dx,cy+dy,1,1,c)}}
function cr(R,x,y,h,a,b){for(let j=0;j<h;j++){const w=Math.max(0,Math.round(Math.min(j,h-1-j)*.45+.4));R(x-w,y+j,2*w+1,1,j<h*.4?b:a)}R(x,y+1,1,Math.max(1,h-3),"w")}
const tier=l=>l>=12?3:l>=8?2:l>=4?1:0;
const BS={
solar:(R,t)=>{const g=t>1,pn=(x,y)=>{bev(R,x,y,11,11,g?"z":"c","u",g?"Z":"U");R(x+5,y+1,1,9,"U");R(x+1,y+5,9,1,"U");R(x+2,y+2,2,1,"w");R(x+5,y+11,2,4,"G")};
if(t>0)for(let i=0;i<3;i++)pn(5+i*12,5);
bev(R,2,33,40,9,"g","G","d");R(4,36,36,1,"d");
for(let i=0;i<3;i++)pn(5+i*12,19);
if(t>2){R(21,0,2,5,"G");ball(R,22,2,3,"y","z","Z")}},
foundry:(R,t)=>{
if(t>1){bev(R,32,20,11,22,"g","G","d");R(32,26,11,1,"d");R(32,32,11,1,"d")}
bev(R,2,18,29,24,"h","x","X");
for(let j=0;j<5;j++){R(3,21+j*4,27,1,"X");for(let i=0;i<4;i++)R(6+i*7+(j&1)*3,22+j*4,1,3,"X")}
bev(R,0,11,33,8,"g","G","d");R(2,13,29,1,"d");
R(10,28,13,14,"d");R(11,29,11,13,"o");R(13,31,7,11,"y");R(10,28,13,1,"G");
win(R,4,22);win(R,25,22);
bev(R,22,0,7,13,"g","G","d");R(22,3,7,2,"r");R(22,7,7,1,"d");
if(t>0){bev(R,12,3,6,9,"g","G","d");R(12,5,6,2,"r")}
if(t>2){R(36,2,2,18,"y");R(26,2,12,2,"y");R(27,4,1,6,"G")}},
mine:(R,t)=>{
for(let j=0;j<26;j++){const w=Math.round(12+28*Math.sqrt((j+2)/28)),x0=22-(w>>1);R(x0,16+j,w,1,j<7?"s":j<16?"S":"G");if(j%3===0)for(let k=0;k<w;k+=5)R(x0+k+(j%2),16+j,1,1,j<7?"e":"d")}
R(14,31,16,11,"k");R(13,30,3,12,"n");R(28,30,3,12,"n");R(13,29,18,3,"N");R(16,40,12,1,"G");R(18,41,1,1,"N");R(22,41,1,1,"N");R(26,41,1,1,"N");R(31,31,2,3,"y");
cr(R,8,14,12,"c","b");cr(R,36,19,10,"c","b");
if(t>0){cr(R,26,10,14,"c","b");cr(R,16,16,9,"c","b")}
if(t>1){cr(R,5,26,8,"p","P");cr(R,39,28,8,"p","P")}
if(t>2)cr(R,21,0,18,"c","w")},
hub:(R,t)=>{
bev(R,3,19,38,23,"e","E","F");
for(let i=0;i<10;i++){R(2+i*4,13,4,7,i&1?"w":"r");R(2+i*4,20,4,1,i&1?"g":"R")}
bev(R,13,3,18,8,"N","n","N");ball(R,22,7,3,"y","z","Z");R(15,5,3,1,"y");R(26,9,3,1,"y");
win(R,6,25);win(R,33,25);R(18,27,8,15,"N");R(19,28,6,14,"n");R(23,35,1,1,"y");
bev(R,0,35,8,7,"e","n","N");
if(t>0){R(37,0,2,12,"G");ball(R,38,3,3,"w","g","G")}
if(t>1){R(5,0,1,12,"G");R(6,0,6,4,"r");R(6,2,6,1,"R")}
if(t>2)R(3,19,38,1,"z")},
hangar:(R,t)=>{
for(let j=0;j<17;j++){const q=(16-j)/17,w=Math.round(40*Math.sqrt(1-q*q)),x0=22-(w>>1);R(x0,9+j,w,1,j<2?"w":(j%4?"g":"G"))}
bev(R,2,26,40,16,"g","G","d");
R(8,28,28,14,"k");R(14,34,14,6,"w");R(26,35,5,4,"g");R(20,35,3,2,"b");R(14,39,14,1,"G");
for(let i=0;i<8;i++)R(6+i*4,41,2,1,"y");
R(21,5,2,5,"G");R(20,3,4,3,"r");
if(t>0)bev(R,37,30,7,12,"g","G","d");
if(t>1){R(5,3,2,8,"G");ball(R,6,3,3,"w","g","G")}
if(t>2)R(2,26,40,1,"z")},
command:(R,t)=>{const top=[14,12,10,9][t];
if(t>0){bev(R,3,18,10,14,"w","g","G");bev(R,31,18,10,14,"w","g","G");[[5,21],[33,21],[5,27],[33,27]].forEach(p=>win(R,p[0],p[1],1))}
bev(R,4,28,36,14,"e","E","F");bev(R,14,top,16,30-top,"w","g","G");
for(let j=top+4;j<27;j+=5){R(17,j,3,3,"y");R(24,j,3,3,"y")}
ball(R,22,top,7,t>2?"z":"c",t>2?"Z":"b",t>2?"d":"B");R(21,0,2,top-7,"G");R(20,0,4,2,"r");
R(19,33,6,9,"N");R(20,34,4,8,"n")}
};
const SC=R=>{bev(R,4,36,36,6,"s","S","d");R(6,14,2,28,"n");R(36,14,2,28,"n");R(6,14,32,2,"N");R(6,26,32,2,"N");for(let i=0;i<10;i++)R(8+i*3,16+i,2,2,"n");R(30,2,2,14,"y");R(20,2,14,2,"y");R(21,4,1,8,"G");R(10,31,8,5,"x");R(12,32,4,1,"X")};
const DC={
tree:R=>{R(13,18,4,10,"N");R(13,18,1,10,"n");ball(R,15,12,11,"l","t","T","L");R(9,10,2,1,"T");R(18,14,2,1,"T");R(14,6,2,1,"L")},
bush:R=>{ball(R,15,18,8,"l","t","T","L");R(10,18,2,1,"T");R(18,21,2,1,"T")},
flower:R=>{[[6,8,"r"],[16,6,"y"],[22,14,"w"],[10,18,"p"],[19,22,"r"],[5,24,"y"]].forEach(f=>{R(f[0],f[1],2,2,f[2]);R(f[0],f[1]+2,1,2,"T")})},
rock:R=>{ball(R,13,19,7,"s","S","G");ball(R,21,22,4,"s","S","G")},
crystal:R=>{R(6,24,18,4,"S");cr(R,13,6,18,"p","P");cr(R,21,12,14,"c","b");cr(R,8,16,11,"c","b")},
pond:R=>{for(let j=-7;j<=7;j++){const w=Math.round(13*Math.sqrt(1-(j/8)*(j/8)));R(15-w,15+j,2*w,1,j<-4?"c":j<3?"b":"B")}R(11,13,3,1,"w");R(18,16,2,1,"c");R(24,6,1,7,"T");R(26,8,1,5,"T")}
};
const decor=(i,j)=>{const k=["tree","flower","rock","bush","pond","crystal","tree"][(i*5+j*11)%7];return memo("d"+k,()=>spr(30,30,DC[k]))};
function ground(){return memo("g",()=>{const c=document.createElement("canvas");c.width=288;c.height=288;const q=c.getContext("2d"),H=(a,b)=>((a*73856093)^(b*19349663))>>>0;
for(let tx=0;tx<18;tx++)for(let ty=0;ty<18;ty++){const h=H(tx,ty),x=tx*16,y=ty*16;q.fillStyle=(tx+ty)&1?"#5fae4f":"#59a64a";q.fillRect(x,y,16,16);
for(let k=0;k<4;k++){const hh=H(tx*7+k,ty*3+k*5),px=x+(hh%13)+1,py=y+((hh>>4)%13)+2;q.fillStyle=k&1?"#7ccb5e":"#3e8236";q.fillRect(px,py,1,1);q.fillRect(px+1,py-1,1,1);q.fillRect(px-1,py-1,1,1)}
if(h%19===0){q.fillStyle=["#ff6b8a","#ffd84a","#ffffff","#b07cf0"][h%4];q.fillRect(x+4,y+6,2,2);q.fillStyle="#3e8236";q.fillRect(x+4,y+8,1,2)}}
return c})}
const DG=["111101101101111","010110010010111","111001111100111","111001111001111","101101111001001","111100111001111","111100111101111","111001001001001","111101111101111","111101111001111"];
function num(q,n,x,y){const s=String(n);q.fillStyle="#161628";q.fillRect(x,y,s.length*4+2,7);q.fillStyle="#fff";for(let k=0;k<s.length;k++){const p=DG[+s[k]];for(let i=0;i<15;i++)if(p[i]==="1")q.fillRect(x+1+k*4+i%3,y+1+Math.floor(i/3),1,1)}}
function glyph(q,p,x,y){q.fillStyle="#161628";for(let i=0;i<15;i++)if(p[i]==="1")q.fillRect(x+1+i%3,y+1+Math.floor(i/3),1,1);q.fillStyle="#fff";for(let i=0;i<15;i++)if(p[i]==="1")q.fillRect(x+i%3,y+Math.floor(i/3),1,1)}
function drawBase(q){const now=Date.now(),F=Math.floor(now/250),go=S.place||S.mv;
const pad=memo("pad",()=>spr(46,46,R=>{bev(R,0,0,46,46,"e","s","S");[11,23,34].forEach(v=>{R(v,0,1,46,"S");R(0,v,46,1,"S")})}));
q.drawImage(ground(),0,0);
for(let j=0;j<6;j++)for(let i=0;i<6;i++){const a=i*48,b=j*48,bd=bAt(i,j);
if(!bd){q.drawImage(decor(i,j),a+8,b+8);if(go){q.fillStyle=F&1?"#ffffff":"#8fe070";[[2,2],[43,2],[2,43],[43,43]].forEach(p=>q.fillRect(a+p[0],b+p[1],3,3));q.fillRect(a+22,b+16,4,16);q.fillRect(a+16,b+22,16,4)}continue}
q.drawImage(pad,a,b);q.globalAlpha=.28;q.fillStyle="#000";q.fillRect(a+8,b+40,34,5);q.globalAlpha=1;
const t=tier(bd.l),sp=bd.l>0?memo(bd.t+t,()=>spr(44,44,R=>BS[bd.t](R,t))):memo("scaf",()=>spr(44,44,SC));
q.drawImage(sp,a+1,b+1)}
S.bl.forEach(bd=>{const a=bd.x*48,b=bd.y*48;
if(bd.l>0){const n=String(bd.l).length;num(q,bd.l,a+47-(n*4+2),b+38)}
const job=S.bq.filter(j=>j.u===bd.u).sort((u,v)=>u.end-v.end)[0];
if(job&&job.s){const p=Math.min(1,(now-job.s)/(job.end-job.s));q.fillStyle="#161628";q.fillRect(a+4,b+44,40,3);q.fillStyle="#ffe066";q.fillRect(a+5,b+45,Math.round(38*p),1)}
else if(job){q.fillStyle="#ffe066";q.fillRect(a+4,b+44,4,3)}
if(bd.l>0){
if(bd.t==="foundry")for(let k=0;k<3;k++){const g=(F+k*3)%9,s=3+(g>>2);q.globalAlpha=.75*(1-g/9);q.fillStyle="#e8ecf5";q.fillRect(a+27+Math.round(Math.sin((F+k)/2)*2),b+3-g*2,s,s);q.globalAlpha=1}
if(bd.t==="mine"&&F%6<2){q.fillStyle="#fff";q.fillRect(a+10,b+20,2,2);q.fillRect(a+38,b+23,2,2)}
if(bd.t==="hangar"){q.fillStyle=F&2?"#ff6b6b":"#ffd0d0";q.fillRect(a+22,b+5,4,3)}
if(bd.t==="command"){q.fillStyle=F&2?"#ff6b6b":"#ffd0d0";q.fillRect(a+22,b+2,4,2)}
if(bd.t==="solar"){q.fillStyle="#fff";q.fillRect(a+7+(F*4)%34,b+24,2,1)}}
if(bd.u===S.bsel||bd.u===S.mv){q.fillStyle=F&1?"#ffe066":"#ffffff";[[1,1,1,1],[1,1,-1,1],[1,1,1,-1],[1,1,-1,-1]];
q.fillRect(a+1,b+1,9,2);q.fillRect(a+1,b+1,2,9);q.fillRect(a+38,b+1,9,2);q.fillRect(a+45,b+1,2,9);q.fillRect(a+1,b+45,9,2);q.fillRect(a+1,b+38,2,9);q.fillRect(a+38,b+45,9,2);q.fillRect(a+45,b+38,2,9)}})}
const gbg=()=>memo("gbg",()=>{const c=document.createElement("canvas");c.width=192;c.height=240;const q=c.getContext("2d");q.fillStyle="#0a0e2a";q.fillRect(0,0,192,240);
for(let k=0;k<8;k++){const cx=(k*71)%192,cy=(k*97)%240,r=26+k*4;q.fillStyle=k&1?"#121a46":"#1a1442";for(let dy=-r;dy<=r;dy+=2)for(let dx=-r;dx<=r;dx+=2)if(dx*dx+dy*dy<r*r&&(((dx>>1)+(dy>>1))&1)===0)q.fillRect(cx+dx,cy+dy,2,2)}return c});
const GP={p:["#d8ffd0","#5fc66a","#2d7a46"],c:["#ffd0c8","#e0584a","#8f2a22"],v:["#e0d0ff","#9a74f0","#563aa8"],l:["#7c849c","#4a5270","#2e3552"],swarm:["#ffe0b0","#e8a050","#a8602a"],armored:["#dff2ff","#82aadc","#486c9e"],fortress:["#f0d6ff","#b078f0","#6a40b0"]};
function psp(i,st){return memo("p"+i+st,()=>{const s=SYS[i],r=i===0?9:i===15?10:7,W=2*r+14,pl=GP[st==="a"?s.t:st],cx=W>>1;
return spr(W,W,R=>{ball(R,cx,cx,r,pl[0],pl[1],pl[2],"#ffffff");
for(let k=0;k<3;k++){const px=cx+((i*7+k*5)%(2*r-4))-r+2,py=cx+((i*11+k*7)%(2*r-4))-r+2;if((px-cx)**2+(py-cx)**2<(r-2)**2){R(px,py,3,1,pl[2]);R(px+1,py+1,2,1,pl[2])}}
if(s.t==="armored"||i===0)for(let a=0;a<6.3;a+=.12){const px=Math.round(cx+Math.cos(a)*(r+5)),py=Math.round(cx+Math.sin(a)*(r*.4));if(Math.sin(a)>0||Math.hypot(px-cx,py-cx)>r+.5)R(px,py,1,1,pl[0])}})})}
// UI OVERHAUL v0.9 (camera only): the galaxy world is 320x400 world units
// (SYS x/y * 2.4). drawGalaxy(q) with no camera still works exactly as
// before: it defaults to the fit view (whole world visible, zoom 1).
// drawGalaxy(q, cam) draws the camera window: cam={cx,cy,zoom}, zoom 1-2.5,
// cx/cy = world point at the centre of the canvas. Sprites scale with zoom.
function drawGalaxy(q,cam){const F=Math.floor(Date.now()/500),cam2=cam||{cx:160,cy:200,zoom:1},fit=Math.min(192/320,240/400),sc=fit*cam2.zoom,ox=96-cam2.cx*sc,oy=120-cam2.cy*sc,PX=wx=>ox+wx*sc,PY=wy=>oy+wy*sc,WX=s=>s.x*2.4,WY=s=>s.y*2.4;
q.drawImage(gbg(),0,0);
for(let i=0;i<45;i++){q.fillStyle=(i+F)%11===0?"#ffffff":i%3?"#5a6bb0":"#8fa0e0";q.fillRect((i*37)%190,(i*53)%238,1,1)}
SYS.forEach((s,i)=>s.l.forEach(j=>{if(j>i){const a=PX(WX(s)),b=PY(WY(s)),c=PX(WX(SYS[j])),d=PY(WY(SYS[j])),n=Math.round(Math.hypot(c-a,d-b)/5),both=S.won.includes(i)&&S.won.includes(j);q.fillStyle=both?"#6ee7f5":"#3a4a9a";for(let k=1;k<n;k++)q.fillRect(Math.round(a+(c-a)*k/n),Math.round(b+(d-b)*k/n),both?2:1,both?2:1)}}));
SYS.forEach((s,i)=>{const own=S.won.includes(i),o=S.own[i],st=own?"p":o||(avail(i)?"a":"l"),sp=psp(i,st),cx=PX(WX(s)),cy=PY(WY(s)),r=(i===0?9:i===15?10:7)*cam2.zoom,zw=sp.width*cam2.zoom,zh=sp.height*cam2.zoom;
q.drawImage(sp,cx-(zw>>1),cy-(zh>>1),zw,zh);
if(own&&i>0){q.fillStyle="#fff";q.fillRect(cx+r-2,cy-r-6,1,7);q.fillStyle="#6ee7f5";q.fillRect(cx+r-1,cy-r-6,5,3)}
if(o)glyph(q,o==="c"?"111100100100111":"101101101101010",cx-1,cy-2);
if(i===S.sel){q.fillStyle=F&1?"#ffe066":"#ffffff";const z=r+5;[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(d=>{q.fillRect(cx+d[0]*z-(d[0]>0?4:0)-(d[0]>0?0:0),cy+d[1]*z-(d[1]>0?1:0),5,2);q.fillRect(cx+d[0]*z-(d[0]>0?1:0),cy+d[1]*z-(d[1]>0?4:0),2,5)})}})}
// UI OVERHAUL v0.9: sprite helpers for the full System / Building pages.
// They reuse the exact sprites drawGalaxy / drawBase already draw.
function planetSprite(i){const own=S.won.includes(i),o=S.own[i],st=own?"p":o||(avail(i)?"a":"l");return psp(i,st)}
function buildingSprite(t,l){if(l>0){const tt=tier(l);return memo("hero"+t+tt,()=>spr(44,44,R=>BS[t](R,tt)))}return memo("heroscaf",()=>spr(44,44,SC))}
const lay=(list,x0,y0,mw)=>{const out=[];let x=x0,y=y0,rh=0;for(const s of list){if(x>x0&&x+s.width>x0+mw){x=x0;y+=rh+4;rh=0}if(y+s.height>92)break;out.push({x,y});x+=s.width+4;rh=Math.max(rh,s.height)}return out};
function SPR(){return memo("ships",()=>{const P1={h:"w",s:"G",t:"c",a:"B",c:"b",e:"o",f:"y"},P2={h:"R",s:"d",t:"r",a:"P",c:"y",e:"P",f:"p"};
const fi=p=>R=>{R(0,3,2,3,p.e);R(2,3,2,3,p.f);R(4,2,9,5,p.h);R(4,2,9,1,p.t);R(4,6,9,1,p.s);R(13,3,4,3,p.s);R(17,4,1,1,p.h);R(6,0,5,2,p.a);R(6,7,5,2,p.a);R(9,3,3,2,p.c)};
const cru=p=>R=>{R(0,4,3,2,p.e);R(0,8,3,2,p.e);R(1,4,2,2,p.f);R(1,8,2,2,p.f);R(3,3,20,8,p.h);R(3,3,20,1,p.t);R(3,10,20,1,p.s);R(23,4,5,6,p.s);R(28,6,2,2,p.h);R(8,0,8,3,p.s);R(10,0,4,1,p.h);R(8,11,8,3,p.s);R(6,6,14,2,p.a);R(17,4,4,2,p.c)};
const cap=p=>R=>{R(0,5,5,3,p.e);R(0,13,5,3,p.e);R(1,5,3,3,p.f);R(1,13,3,3,p.f);R(5,5,32,12,p.h);R(5,5,32,1,p.t);R(5,16,32,1,p.s);R(37,7,6,8,p.s);R(43,9,3,4,p.h);R(16,0,12,6,p.s);R(19,1,6,2,p.c);R(10,17,20,4,p.s);R(12,3,3,2,p.s);R(30,3,3,2,p.s);R(8,10,26,2,p.a);R(36,9,1,4,p.c)};
const fort=R=>{ball(R,20,20,16,"p","P","d","#e0d0ff");R(2,19,36,2,"G");[[19,0],[19,35],[0,19],[35,19]].forEach(p=>R(p[0],p[1],2+(p[0]===0||p[0]===35?3:0),2+(p[1]===0||p[1]===35?3:0),"G"));R(17,17,6,6,"r");R(19,19,2,2,"y")};
return{fighter:spr(18,9,fi(P1)),cruiser:spr(30,14,cru(P1)),capital:spr(46,22,cap(P1)),eswarm:spr(18,9,fi(P2),1),earmored:spr(30,14,cru(P2),1),efortress:spr(40,40,fort)}})}
const BBG=()=>memo("bbg",()=>{const c=document.createElement("canvas");c.width=192;c.height=96;const q=c.getContext("2d");q.fillStyle="#0a0e2a";q.fillRect(0,0,192,96);
for(let k=0;k<5;k++){const cx=(k*61)%192,cy=(k*43)%96,r=22+k*3;q.fillStyle=k&1?"#121a46":"#1a1442";for(let dy=-r;dy<=r;dy+=2)for(let dx=-r;dx<=r;dx+=2)if(dx*dx+dy*dy<r*r&&(((dx>>1)+(dy>>1))&1)===0)q.fillRect(cx+dx,cy+dy,2,2)}
q.drawImage(spr(60,60,R=>ball(R,30,30,28,"#6a7cd0","#3a4a9a","#1e2866","#9fb0f0")),132,56);return c});
