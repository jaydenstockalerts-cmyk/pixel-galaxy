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
function ground(){return memo("g",()=>{const c=document.createElement("canvas");c.width=576;c.height=576;const q=c.getContext("2d"),H=(a,b)=>((a*73856093)^(b*19349663))>>>0;
for(let tx=0;tx<36;tx++)for(let ty=0;ty<36;ty++){const h=H(tx,ty),x=tx*16,y=ty*16;q.fillStyle=(tx+ty)&1?"#5fae4f":"#59a64a";q.fillRect(x,y,16,16);
for(let k=0;k<4;k++){const hh=H(tx*7+k,ty*3+k*5),px=x+(hh%13)+1,py=y+((hh>>4)%13)+2;q.fillStyle=k&1?"#7ccb5e":"#3e8236";q.fillRect(px,py,1,1);q.fillRect(px+1,py-1,1,1);q.fillRect(px-1,py-1,1,1)}
if(h%23===0){q.fillStyle="#a89468";q.fillRect(x+3,y+5,10,6);q.fillStyle="#8f8a76";q.fillRect(x+5,y+7,6,2)}
if(h%19===0){q.fillStyle=["#ff6b8a","#ffd84a","#ffffff","#b07cf0"][h%4];q.fillRect(x+4,y+6,2,2);q.fillStyle="#3e8236";q.fillRect(x+4,y+8,1,2)}}
return c})}
const DG=["111101101101111","010110010010111","111001111100111","111001111001111","101101111001001","111100111001111","111100111101111","111001001001001","111101111101111","111101111001111"];
function num(q,n,x,y){const s=String(n);q.fillStyle="#161628";q.fillRect(x,y,s.length*4+2,7);q.fillStyle="#fff";for(let k=0;k<s.length;k++){const p=DG[+s[k]];for(let i=0;i<15;i++)if(p[i]==="1")q.fillRect(x+1+k*4+i%3,y+1+Math.floor(i/3),1,1)}}
function glyph(q,p,x,y){q.fillStyle="#161628";for(let i=0;i<15;i++)if(p[i]==="1")q.fillRect(x+1+i%3,y+1+Math.floor(i/3),1,1);q.fillStyle="#fff";for(let i=0;i<15;i++)if(p[i]==="1")q.fillRect(x+i%3,y+Math.floor(i/3),1,1)}
// v0.9.1 station: 12x12 plots (48 world units each, world 576x576),
// the old 6x6 settled area in the top-left, open land around it.
// drawBase(q) with no camera draws the fit view; drawBase(q, cam) draws
// the camera window (cam={cx,cy,zoom}, zoom 1-2.5). Camera is view-only.
// v1.1 Hobbit-style city: the station is a walled city, not a grid.
// Logical model is UNCHANGED: 12x12 plots, S.bl {u,t,x,y,l}, adjacency is
// still orthogonal neighbours, MAXC / newCost / placeB untouched.
// Visual only:
//  - Command Station = the keep, drawn bigger on a stone plaza at its
//    logical cell (visual overlap only; tap target stays that cell).
//  - Districts are emergent, by building type: Power (Solar), Industrial
//    (Foundry+Mine), Trade (Hub), Military (Hangar). Each occupied plot
//    gets a district ground tint under its pad.
//  - Roads: a stone/dirt cross through the keep to the wall gates, plus
//    an L-shaped spur road from the keep to every occupied building.
//  - Wall: a stone ring (with crenellations + gates where roads cross)
//    around the occupied bounding box expanded by 1 plot — it grows as
//    the city grows. Farmland (crop rows) covers empty plots outside it.
//  - Open plots are cleared foundation pads: stone border, dirt centre,
//    dashed outline + a small "+" — always visible, brighter in Place/Move mode.
const DISTTINT={solar:"#ffe066",foundry:"#ff9a3c",mine:"#b07cf0",hub:"#9be8ff",hangar:"#4aa3df",command:"#f4f6ff"};
const DISTNAME={solar:"Power District",foundry:"Industrial District",mine:"Industrial District",hub:"Trade District",hangar:"Military District",command:"The Keep"};
function drawBase(q,cam,opts){const now=Date.now(),F=Math.floor(now/250),go=S.place||S.mv,cam2=cam||{cx:288,cy:288,zoom:1},vw=q.canvas.width||384,vh=q.canvas.height||384,sc=(vh/576)*cam2.zoom,sx=opts&&opts.sx!==undefined?opts.sx:vw/2,sy=opts&&opts.sy!==undefined?opts.sy:vh/2,ox=sx-cam2.cx*sc,oy=sy-cam2.cy*sc,CS=48*sc,k=CS/48;
const X=wx=>ox+wx*sc, Y=wy=>oy+wy*sc;
const R2=(x,y,w,h,c,al)=>{if(al!==undefined)q.globalAlpha=al;q.fillStyle=c;q.fillRect(X(x),Y(y),Math.max(1,w*sc),Math.max(1,h*sc));if(al!==undefined)q.globalAlpha=1};
q.fillStyle="#59a64a";q.fillRect(0,0,vw,vh);
const pad=memo("pad",()=>spr(46,46,R=>{bev(R,0,0,46,46,"e","s","S");[11,23,34].forEach(v=>{R(v,0,1,46,"S");R(0,v,46,1,"S")})}));
q.drawImage(ground(),ox,oy,576*sc,576*sc);
// --- city layer: keep, wall box, plaza, roads, farmland, district tints ---
const keep=S.bl.find(b=>b.t==="command")||null;
const kx=keep?keep.x*48+24:288, ky=keep?keep.y*48+24:288;
let mnx=12,mxx=-1,mny=12,mxy=-1;
S.bl.forEach(b=>{mnx=Math.min(mnx,b.x);mxx=Math.max(mxx,b.x);mny=Math.min(mny,b.y);mxy=Math.max(mxy,b.y)});
if(mxx<0){mnx=3;mxx=5;mny=3;mxy=5}
const wx0=Math.max(0,mnx-1),wx1=Math.min(11,mxx+1),wy0=Math.max(0,mny-1),wy1=Math.min(11,mxy+1);
const wallX0=wx0*48, wallX1=(wx1+1)*48, wallY0=wy0*48, wallY1=(wy1+1)*48;
// farmland: crop rows on empty plots outside the wall
for(let j=0;j<12;j++)for(let i=0;i<12;i++){
  if(i>=wx0&&i<=wx1&&j>=wy0&&j<=wy1)continue;
  if(bAt(i,j))continue;
  R2(i*48+3,j*48+6,42,36,(i+j)%2?"#7ccb5e":"#8fe070",.55);
  for(let r=0;r<4;r++)R2(i*48+5,j*48+10+r*9,38,2,(i+j+r)%2?"#ffd84a":"#5fae4f",.8);
}
// plaza: stone tiles around the keep (3x3 cells, clamped)
for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
  const px=keep?keep.x+i:5, py=keep?keep.y+j:5;
  if(px<0||px>11||py<0||py>11)continue;
  R2(px*48,py*48,48,48,(i+j)%2?"#c9c3b0":"#b8b09a");
  R2(px*48,py*48,48,2,"#8f8a76"); R2(px*48,py*48,2,48,"#8f8a76");
}
// roads: dirt/stone cross through the keep to the wall gates
R2(wallX0,ky-7,wallX1-wallX0,14,"#cdb98a"); R2(wallX0,ky-7,wallX1-wallX0,2,"#8f8a76"); R2(wallX0,ky+5,wallX1-wallX0,2,"#8f8a76");
R2(kx-7,wallY0,14,wallY1-wallY0,"#cdb98a"); R2(kx-7,wallY0,2,wallY1-wallY0,"#8f8a76"); R2(kx+5,wallY0,2,wallY1-wallY0,"#8f8a76");
// spur roads: keep -> every occupied building (L-shaped, under buildings)
S.bl.forEach(b=>{
  if(!keep||b.u===keep.u)return;
  const bx=b.x*48+24, by=b.y*48+24;
  R2(Math.min(kx,bx),by-5,Math.abs(bx-kx)+10,10,"#cdb98a");
  R2(kx-5,Math.min(ky,by),10,Math.abs(by-ky)+10,"#cdb98a");
});
// district tints under occupied plots
S.bl.forEach(b=>{R2(b.x*48+2,b.y*48+2,44,44,DISTTINT[b.t]||"#ffffff",.20)});
// wall: stone ring around the settled area, gates where the cross roads pass
const WT=8, gateW=48;
const gateX0=kx-gateW/2, gateY0=ky-gateW/2;
const wallSeg=(x,y,w,h)=>{R2(x,y,w,h,"#8f8a76");};
// top + bottom edges (gap at the keep's x = north/south gates)
wallSeg(wallX0,wallY0,Math.max(0,gateX0-wallX0),WT); wallSeg(gateX0+gateW,wallY0,Math.max(0,wallX1-(gateX0+gateW)),WT);
wallSeg(wallX0,wallY1-WT,Math.max(0,gateX0-wallX0),WT); wallSeg(gateX0+gateW,wallY1-WT,Math.max(0,wallX1-(gateX0+gateW)),WT);
// left + right edges (gap at the keep's y = west/east gates)
wallSeg(wallX0,wallY0,WT,Math.max(0,gateY0-wallY0)); wallSeg(wallX0,gateY0+gateW,WT,Math.max(0,wallY1-(gateY0+gateW)));
wallSeg(wallX1-WT,wallY0,WT,Math.max(0,gateY0-wallY0)); wallSeg(wallX1-WT,gateY0+gateW,WT,Math.max(0,wallY1-(gateY0+gateW)));
// crenellations along the wall + corner towers
for(let xx=wallX0;xx<wallX1;xx+=16){R2(xx,wallY0-4,8,6,"#c9c3b0");R2(xx,wallY1-2,8,6,"#c9c3b0")}
for(let yy=wallY0;yy<wallY1;yy+=16){R2(wallX0-4,yy,6,8,"#c9c3b0");R2(wallX1-2,yy,6,8,"#c9c3b0")}
[[wallX0,wallY0],[wallX1,wallY0],[wallX0,wallY1],[wallX1,wallY1]].forEach(c=>{R2(c[0]-8,c[1]-8,16,16,"#8f8a76");R2(c[0]-4,c[1]-12,8,6,"#c9c3b0")});
// gate posts (south gate, the main entrance)
R2(gateX0-6,wallY1-WT-10,8,18,"#8f8a76"); R2(gateX0+gateW-2,wallY1-WT-10,8,18,"#8f8a76");
R2(gateX0-6,wallY1-WT-12,8,4,"#ffd84a"); R2(gateX0+gateW-2,wallY1-WT-12,8,4,"#ffd84a");
// --- plots: foundations + buildings (non-keep first, keep last so it overlaps) ---
const drawPlot=(i,j,bd)=>{
  const a=ox+i*48*sc,b=oy+j*48*sc;
  if(!bd){
    // cleared foundation pad: stone border, dirt centre, dashed outline, "+"
    R2(i*48+4,j*48+4,40,40,"#8f8a76");
    R2(i*48+7,j*48+7,34,34,"#cdb98a");
    const dash=go?(F&1?"#ffffff":"#8fe070"):"#ecdcb4";
    [[4,4],[22,4],[4,42],[22,42],[4,22],[42,22],[22,4],[22,42]].forEach(pt=>R2(i*48+pt[0],j*48+pt[1],4,2,dash));
    q.fillStyle=go?"#8fe070":"#ffffff";q.globalAlpha=go?.95:.55;
    q.fillRect(a+CS/2-1.5*k,b+CS/2-7*k,3*k,14*k);q.fillRect(a+CS/2-7*k,b+CS/2-1.5*k,14*k,3*k);q.globalAlpha=1;
    if((i*3+j*5)%4!==0){const dc=decor(i,j),ds=CS*.34;q.drawImage(dc,a+CS*.62,b+CS*.02,ds,ds)}
    return;
  }
  q.drawImage(pad,a,b,CS,CS);
  const isKeep=keep&&bd.u===keep.u;
  const sz=isKeep?CS*1.5:CS*1.08;
  q.globalAlpha=.30;q.fillStyle="#000";q.fillRect(a+CS/2-sz*.42,b+CS*.82,sz*.84,7*k);q.globalAlpha=1;
  const t=tier(bd.l),sp=bd.l>0?memo(bd.t+t,()=>spr(44,44,R=>BS[bd.t](R,t))):memo("scaf",()=>spr(44,44,SC));
  if(isKeep)q.drawImage(sp,a+CS/2-sz/2,b+CS-sz*.96,sz,sz);
  else q.drawImage(sp,a+CS/2-sz/2,b+CS/2-sz/2,sz,sz);
  if(bd.l===0){q.fillStyle="#ffd84a";q.fillRect(a+CS/2-10*k,b+2*k,20*k,3*k);q.fillStyle="#161628";q.fillRect(a+CS/2-10*k,b+2*k,3*k,3*k);q.fillRect(a+CS/2+7*k,b+2*k,3*k,3*k)}
};
for(let j=0;j<12;j++)for(let i=0;i<12;i++){const bd=bAt(i,j);if(bd&&keep&&bd.u===keep.u)continue;drawPlot(i,j,bd)}
if(keep)drawPlot(keep.x,keep.y,keep);
S.bl.forEach(bd=>{const a=ox+bd.x*48*sc,b=oy+bd.y*48*sc;
if(bd.l>0){const n=String(bd.l).length;num(q,bd.l,a+CS-(n*4+2)-2*k,b+CS-9*k);
const tp=tier(bd.l);for(let pp=0;pp<tp;pp++){q.fillStyle="#ffe066";q.fillRect(a+4*k+pp*6*k,b+3*k,4*k,4*k)}}
const job=S.bq.filter(j=>j.u===bd.u).sort((u,v)=>u.end-v.end)[0];
if(job&&job.s){const p=Math.min(1,(now-job.s)/(job.end-job.s));q.fillStyle="#161628";q.fillRect(a+4*k,b+44*k,40*k,3*k);q.fillStyle="#ffe066";q.fillRect(a+5*k,b+45*k,Math.round(38*p)*k,1*k)}
else if(job){q.fillStyle="#ffe066";q.fillRect(a+4*k,b+44*k,4*k,3*k)}
if(bd.l>0){
if(bd.t==="foundry")for(let kk=0;kk<3;kk++){const g=(F+kk*3)%9,s=3+(g>>2);q.globalAlpha=.75*(1-g/9);q.fillStyle="#e8ecf5";q.fillRect(a+27*k+Math.round(Math.sin((F+kk)/2)*2),b+3*k-g*2*k,s*k,s*k);q.globalAlpha=1}
if(bd.t==="mine"&&F%6<2){q.fillStyle="#fff";q.fillRect(a+10*k,b+20*k,2*k,2*k);q.fillRect(a+38*k,b+23*k,2*k,2*k)}
if(bd.t==="mine"){q.fillStyle=F&2?"#9be8ff":"#b07cf0";q.fillRect(a+20*k,b+6*k,3*k,3*k)}
if(bd.t==="hub"){q.fillStyle=F&2?"#ffe066":"#ff9a3c";q.fillRect(a+8*k,b+10*k,3*k,3*k);q.fillRect(a+36*k,b+10*k,3*k,3*k);if(F%4<2){q.fillStyle="#ffe066";q.fillRect(a+22*k,b+2*k,3*k,3*k)}}
if(bd.t==="solar"){q.fillStyle="#fff";q.fillRect(a+7*k+(F*4)%34*k,b+24*k,2*k,1*k);q.fillRect(a+30*k-((F*3)%28)*k,b+8*k,2*k,2*k)}
if(bd.t==="hangar"){q.fillStyle=F&2?"#ff6b6b":"#ffd0d0";q.fillRect(a+22*k,b+5*k,4*k,3*k);q.fillStyle="#ffffff";for(let ll=0;ll<4;ll++)q.fillRect(a+(8+ll*9)*k,b+42*k,3*k,2*k)}
if(bd.t==="command"){q.fillStyle=F&2?"#ff6b6b":"#ffd0d0";q.fillRect(a+22*k,b+2*k,4*k,2*k);q.fillStyle="#e0584a";const wv=Math.round(Math.sin(F/2)*2);q.fillRect(a+CS/2+2*k+wv,b-6*k,10*k,5*k)}}
if(bd.u===S.bsel||bd.u===S.mv){q.fillStyle=F&1?"#ffe066":"#ffffff";const c1=1*k,c2=9*k,c3=38*k,c4=45*k;q.fillRect(a+c1,b+c1,c2,2*k);q.fillRect(a+c1,b+c1,2*k,c2);q.fillRect(a+c3,b+c1,c2,2*k);q.fillRect(a+c4,b+c1,2*k,c2);q.fillRect(a+c1,b+c4,c2,2*k);q.fillRect(a+c1,b+c3,2*k,c2);q.fillRect(a+c3,b+c4,c2,2*k);q.fillRect(a+c4,b+c3,2*k,c2)}})}
const gbgFor=(w,h)=>memo("gbg"+w+"x"+h,()=>{const c=document.createElement("canvas");c.width=w;c.height=h;const q=c.getContext("2d");q.fillStyle="#0a0e2a";q.fillRect(0,0,w,h);
for(let k=0;k<14;k++){const cx=(k*71)%w,cy=(k*97)%h,r=40+k*6;q.fillStyle=k%3===0?"#1a1442":k%3===1?"#121a46":"#241a4a";for(let dy=-r;dy<=r;dy+=2)for(let dx=-r;dx<=r;dx+=2)if(dx*dx+dy*dy<r*r&&(((dx>>1)+(dy>>1))&1)===0)q.fillRect(cx+dx,cy+dy,2,2)}return c});
const gbg=()=>gbgFor(384,480);
const GP={p:["#d8ffd0","#5fc66a","#2d7a46"],c:["#ffd0c8","#e0584a","#8f2a22"],v:["#e0d0ff","#9a74f0","#563aa8"],l:["#7c849c","#4a5270","#2e3552"],swarm:["#ffe0b0","#e8a050","#a8602a"],armored:["#dff2ff","#82aadc","#486c9e"],fortress:["#f0d6ff","#b078f0","#6a40b0"]};
function psp(i,st){return memo("p"+i+st,()=>{const s=SYS[i],r=i===0?18:i===15?20:14,W=2*r+28,pl=GP[st==="a"?s.t:st],cx=W>>1;
return spr(W,W,R=>{ball(R,cx,cx,r,pl[0],pl[1],pl[2],"#ffffff");
// surface detail: craters, patches and bands, seeded per system
for(let k=0;k<7;k++){const px=cx+((i*7+k*5)%(2*r-4))-r+2,py=cx+((i*11+k*7)%(2*r-4))-r+2;if((px-cx)**2+(py-cx)**2<(r-3)**2){R(px,py,4,2,pl[2]);R(px+1,py+1,2,1,pl[2])}}
for(let k=0;k<5;k++){const px=cx+((i*13+k*9)%(2*r-6))-r+3,py=cx+((i*17+k*11)%(2*r-6))-r+3;if((px-cx)**2+(py-cx)**2<(r-4)**2){R(px,py,2,2,"d");R(px,py,1,1,pl[1])}}
// bright polar cap + atmosphere highlight on the lit edge
R(cx-3,cx-r+1,6,2,"w");R(cx-r+2,cx-3,2,6,pl[0]);
// horizontal bands for fortress / armored worlds
if(s.t==="fortress"||s.t==="armored"){for(let b=-1;b<=1;b++){const yy=cx+b*5;for(let dx=-r+3;dx<r-2;dx++){if(dx*dx+(yy-cx)**2<r*r-4)R(cx+dx,yy,2,1,pl[2])}}}
if(s.t==="armored"||i===0)for(let a=0;a<6.3;a+=.08){const px=Math.round(cx+Math.cos(a)*(r+7)),py=Math.round(cx+Math.sin(a)*(r*.45));if(Math.sin(a)>0||Math.hypot(px-cx,py-cx)>r+.5)R(px,py,2,1,pl[0])}})})}
// v0.9.1 labels: pixel-font text on the canvas, dark-backed so it reads
// on the starfield. Uses fillText (real canvas) — the headless stub counts it.
function drawLabel(q,text,cx,cy,color,fs){const vw=q.canvas.width||384,vh=q.canvas.height||480,f=Math.max(11,fs||11);try{q.font="bold "+f+"px 'Courier New',monospace"}catch(e){}q.textAlign="center";q.textBaseline="middle";let w=text.length*7;try{if(q.measureText)w=Math.ceil(q.measureText(text).width)}catch(e){}const hh=Math.ceil(f*1.3);cx=Math.max(w/2+4,Math.min(vw-w/2-4,cx));cy=Math.max(hh/2+2,Math.min(vh-hh/2-2,cy));q.fillStyle="#161628";q.fillRect(Math.round(cx-w/2-3),Math.round(cy-hh/2),w+6,hh);q.fillStyle=color||"#ffffff";q.fillText(text,Math.round(cx),Math.round(cy))}
function glyph2(q,p,x,y,s){for(let i=0;i<15;i++)if(p[i]==="1"){q.fillStyle="#161628";q.fillRect(x+(i%3)*s-1,y+Math.floor(i/3)*s-1,s+2,s+2);q.fillStyle="#ffffff";q.fillRect(x+(i%3)*s,y+Math.floor(i/3)*s,s,s)}}
// v0.9.1: galaxy world is 640x800 world units (SYS x/y * 5), canvas 384x480.
// drawGalaxy(q) with no camera still works: it defaults to the fit view
// (whole world visible, zoom 1). Planets are ~2x larger and labelled.
// drawGalaxy(q, cam) draws the camera window: cam={cx,cy,zoom}, zoom 1-2.5,
// cx/cy = world point at the centre of the canvas. Sprites scale with zoom.
function drawGalaxy(q,cam,opts){const F=Math.floor(Date.now()/500),cam2=cam||{cx:320,cy:400,zoom:1},vw=q.canvas.width||384,vh=q.canvas.height||480,sc=(vh/800)*cam2.zoom,sx=opts&&opts.sx!==undefined?opts.sx:vw/2,sy=opts&&opts.sy!==undefined?opts.sy:vh/2,ox=sx-cam2.cx*sc,oy=sy-cam2.cy*sc,PX=wx=>ox+wx*sc,PY=wy=>oy+wy*sc,WX=s=>s.x*5,WY=s=>s.y*5,fs=Math.max(11,Math.round(11*sc/1.2));
q.drawImage(gbgFor(vw,vh),0,0);
for(let i=0;i<120;i++){const sz=i%9===0?3:i%3===0?2:1;q.fillStyle=(i+F)%13===0?"#ffffff":i%3?"#5a6bb0":"#8fa0e0";q.fillRect((i*37)%Math.max(1,vw-2),(i*53)%Math.max(1,vh-2),sz,sz)}
SYS.forEach((s,i)=>s.l.forEach(j=>{if(j>i){const a=PX(WX(s)),b=PY(WY(s)),c=PX(WX(SYS[j])),d=PY(WY(SYS[j])),n=Math.max(2,Math.round(Math.hypot(c-a,d-b)/4)),both=S.won.includes(i)&&S.won.includes(j),th=both?3:2;q.fillStyle=both?"#6ee7f5":"#3a4a9a";for(let k=1;k<n;k++)q.fillRect(Math.round(a+(c-a)*k/n),Math.round(b+(d-b)*k/n),th,th)}}));
const labels=[];
SYS.forEach((s,i)=>{const own=S.won.includes(i),o=S.own[i],st=own?"p":o||(avail(i)?"a":"l"),sp=psp(i,st),cx=PX(WX(s)),cy=PY(WY(s)),baseR=i===0?18:i===15?20:14,zw=sp.width*sc*1.2,zh=sp.height*sc*1.2,r=baseR*sc*1.2;
q.drawImage(sp,cx-(zw>>1),cy-(zh>>1),zw,zh);
if(own&&i>0){const fw=Math.max(8,Math.round(r*.7));q.fillStyle="#fff";q.fillRect(Math.round(cx+r-2),Math.round(cy-r-fw),2,fw);q.fillStyle="#6ee7f5";q.fillRect(Math.round(cx+r-1),Math.round(cy-r-fw),Math.max(8,fw),Math.max(4,fw>>1))}
if(o)glyph2(q,o==="c"?"111100100100111":"101101101101010",Math.round(cx-3),Math.round(cy-3),2);
if(i===S.sel){q.fillStyle=F&1?"#ffe066":"#ffffff";const z=r+8,bs=Math.max(3,Math.round(2*cam2.zoom));[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(d=>{q.fillRect(Math.round(cx+d[0]*z-(d[0]>0?bs*2:0)),Math.round(cy+d[1]*z-(d[1]>0?1:0)),bs*2+1,bs);q.fillRect(Math.round(cx+d[0]*z-(d[0]>0?1:0)),Math.round(cy+d[1]*z-(d[1]>0?bs*2:0)),bs,bs*2+1)})}
if(cam2.zoom>=1.5)labels.push({text:s.n,cx,cy:cy+zh/2+12+fs/2,color:own?"#6ee7f5":o==="c"?"#ff9a8a":o==="v"?"#d0b0ff":avail(i)?"#ffe066":"#aab4c9",fs});
if(cam2.zoom>=2&&s.pw!==undefined)labels.push({text:"PWR "+spw(i),cx,cy:cy+zh/2+30+fs,color:"#ffffff",fs});});
labels.forEach(l=>drawLabel(q,l.text,l.cx,l.cy,l.color,l.fs));}
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
