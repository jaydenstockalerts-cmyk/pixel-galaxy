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
// v2.2: topmost drawn row (canvas px, outline included) — labels anchor
// to the VISIBLE top of the sprite, not the canvas top. Sprites are
// drawn on a 44x44 grid but the content does not fill it (the Lv1
// Solar Array's panels start at grid row 19, so ~40% of the canvas
// above them is empty and a label anchored to the canvas top floated
// ~115px above the panels at Fit zoom, live v2.1).
let _top=H;for(let j=0;j<H;j++){let _a=false;for(let i=0;i<W;i++)if(o[j][i]){_a=true;break}if(_a){_top=j;break}}
cv._top=_top;
return cv}
const bev=(R,x,y,w,h,l,m,d)=>{R(x,y,w,h,m);R(x,y,w,1,l);R(x,y,1,h,l);R(x,y+h-1,w,1,d);R(x+w-1,y,1,h,d)};
const win=(R,x,y,lit)=>{R(x,y,5,6,"d");R(x+1,y+1,3,4,lit?"y":"b");R(x+1,y+1,1,1,lit?"w":"c");R(x+3,y+4,1,1,lit?"z":"B")};
function ball(R,cx,cy,r,l,m,d,hi){for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(dx*dx+dy*dy>r*r+r*.6)continue;const L=(-dx*.55-dy*.75)/r;let c=L>.62?(hi||l):L>.12?l:L>-.38?m:d;if(Math.abs(L-.12)<.08&&((dx+dy)&1))c=m;else if(Math.abs(L+.38)<.08&&((dx+dy)&1))c=d;R(cx+dx,cy+dy,1,1,c)}}
function cr(R,x,y,h,a,b){for(let j=0;j<h;j++){const w=Math.max(0,Math.round(Math.min(j,h-1-j)*.45+.4));R(x-w,y+j,2*w+1,1,j<h*.4?b:a)}R(x,y+1,1,Math.max(1,h-3),"w")}
const tier=l=>l>=12?3:l>=8?2:l>=4?1:0;
const BS={
solar:(R,t)=>{const g=t>1,pn=(x,y)=>{bev(R,x,y,11,11,g?"z":"c","u",g?"Z":"U");R(x+5,y+1,1,9,"U");R(x+1,y+5,9,1,"U");R(x+2,y+2,2,1,"w");R(x+5,y+11,2,8,"G")};
if(t>0)for(let i=0;i<3;i++)pn(5+i*12,5);
// v2.2: the mount is ONE flat slab, not a stepped pyramid. The five
// inset rows read as a small stack sitting on the blue plinth (live
// v2.1). The flat slab spans the full sprite width at the bottom;
// the panel legs reach down to meet it (8 tall, was 4).
R(2,38,40,4,"g");R(2,38,40,1,"G");R(2,41,40,1,"d");
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
// v1.9 KEEP REDRAW (live v1.8): the old keep read as TWO buildings —
// a wide tan base with no windows and a plain dark door, then a much
// narrower grey tower with yellow windows, then a blue dome with a
// hard dark patch on its right side, topped by a grey stalk with a
// red cap (a chimney, not a flag). Now ONE coherent building: base
// and tower share the same stone ("w" with grey trim), the base has
// lit windows and a gold-framed door, a gold cornice band hides the
// tower/base seam, the dome is a HALF dome (flat bottom) with a
// smooth vertical gradient (light top to dark bottom — no diagonal
// dark patch) and a white highlight, a gold trim band sits under it,
// and the stalk is replaced by a real flag: a thin pole with a
// waving red pennant. Side towers (tier 1+) unchanged.
const dome=(cx,cy,r)=>{
  // v2.0 SMOOTH DOME (live v1.9: the old 3-band shading read as
  // stepped/pixel-banded, the highlight was a blocky white rectangle,
  // the top was flattened and there was a notch where the flag pole
  // sat). Per-row interpolated gradient (light top -> dark bottom),
  // top row forced 3px wide so the cap reads rounded, and a soft
  // ELLIPTICAL highlight (rows of shrinking width, upper-left).
  const TOP=[191,233,255],BOT=[47,120,176]; // #bfe9ff -> #2f78b0
  const mixC=t=>{const m=TOP.map((a,i)=>Math.round(a+(BOT[i]-a)*t));return"rgb("+m[0]+","+m[1]+","+m[2]+")"};
  for(let dy=-r;dy<=0;dy++){const w=Math.max(1,Math.round(Math.sqrt(Math.max(0,r*r-dy*dy)))),tt=(dy+r)/r;R(cx-w,cy+dy,2*w+1,1,mixC(tt))}
  R(cx-4,cy-r+2,4,1,"#e8f6ff");R(cx-5,cy-r+3,5,1,"#e8f6ff");R(cx-4,cy-r+4,3,1,"#cfeeff");
};
if(t>0){bev(R,3,18,10,14,"w","g","G");bev(R,31,18,10,14,"w","g","G");[[5,21],[33,21],[5,27],[33,27]].forEach(p=>win(R,p[0],p[1],1))}
// tower first: the base is drawn over its bottom rows, so the tower
// emerges from the base's roofline (not in front of its face).
bev(R,14,top,16,30-top,"w","g","G");
for(let j=top+4;j<27;j+=5){R(17,j,3,3,"y");R(24,j,3,3,"y")}
// base: same stone as the tower, lit windows flanking the door,
// gold-framed door.
bev(R,4,28,36,14,"w","g","G");
win(R,8,32,1);win(R,30,32,1);
R(18,32,8,10,"Z");R(19,33,6,9,"N");R(20,34,4,8,"n");R(21,33,2,1,"z");
// cornice band across the full base width hides the tower/base seam.
R(4,27,36,1,"z");R(4,28,36,1,"G");
// gold trim band under the dome, wider than the tower.
R(12,top+2,20,1,"z");R(12,top+3,20,1,"Z");
dome(22,top+1,9);
// flag: thin pole with a waving red pennant. v2.1 (live v2.0: the
// pole sat left of the dome centre with a notch at the apex and a
// yellow square finial). The pole is exactly on the dome apex
// (x=22 = dome centre) and ends AT the dome's top row — running it
// 3 rows INTO the dome cut a dark slit through the light dome top.
// The finial is a single red pixel, the flag's own colour — the gold
// square is gone.
R(22,0,1,Math.max(1,top-8),"G");R(23,0,5,1,"r");R(23,1,4,1,"r");R(22,0,1,1,"r")}
};
const SC=R=>{bev(R,4,36,36,6,"s","S","d");R(6,14,2,28,"n");R(36,14,2,28,"n");R(6,14,32,2,"N");R(6,26,32,2,"N");for(let i=0;i<10;i++)R(8+i*3,16+i,2,2,"n");R(30,2,2,14,"y");R(20,2,14,2,"y");R(21,4,1,8,"G");R(10,31,8,5,"x");R(12,32,4,1,"X")};
// v2.2 MARS decor: no green trees, no blue ponds on Mars — decor is
// rocks, craters and mineral crystals only (dark rust/grey blobs).
const DC={
rock:R=>{ball(R,13,19,7,"s","S","G");ball(R,21,22,4,"s","S","G")},
crater:R=>{for(let j=-6;j<=6;j++){const w=Math.round(11*Math.sqrt(1-(j/7)*(j/7)));R(15-w,16+j,2*w,1,j<=-3?"G":j<=2?"d":"k")}R(9,12,4,1,"e");R(20,11,3,1,"e")},
crystal:R=>{R(6,24,18,4,"S");cr(R,13,6,18,"p","P");cr(R,21,12,14,"c","b");cr(R,8,16,11,"c","b")}
};
const decor=(i,j)=>{const k=["rock","crater","crystal","rock","crater","crystal","rock"][(((i*5+j*11)%7)+7)%7];return memo("d"+k,()=>spr(30,30,DC[k]))};
function ground(){return memo("g",()=>{const c=document.createElement("canvas");c.width=576;c.height=576;const q=c.getContext("2d"),H=(a,b)=>((a*73856093)^(b*19349663))>>>0;
for(let tx=0;tx<36;tx++)for(let ty=0;ty<36;ty++){const h=H(tx,ty),x=tx*16,y=ty*16;q.fillStyle=(tx+ty)&1?"#c98a5a":"#b56a3c";q.fillRect(x,y,16,16);
for(let k=0;k<4;k++){const hh=H(tx*7+k,ty*3+k*5),px=x+(hh%13)+1,py=y+((hh>>4)%13)+2;q.fillStyle=k&1?"#e8a06a":"#7a3b26";q.fillRect(px,py,1,1);q.fillRect(px+1,py-1,1,1);q.fillRect(px-1,py-1,1,1)}
if(h%23===0){q.fillStyle="#a89468";q.fillRect(x+3,y+5,10,6);q.fillStyle="#8f8a76";q.fillRect(x+5,y+7,6,2)}
if(h%19===0){q.fillStyle=["#ff6b8a","#ffd84a","#ffffff","#b07cf0"][h%4];q.fillRect(x+4,y+6,2,2);q.fillStyle="#7a3b26";q.fillRect(x+4,y+8,1,2)}}
return c})}
const DG=["111101101101111","010110010010111","111001111100111","111001111001111","101101111001001","111100111001111","111100111101111","111001001001001","111101111101111","111101111001111"];
function num(q,n,x,y){const s=String(n);q.fillStyle="#161628";q.fillRect(x,y,s.length*4+2,7);q.fillStyle="#fff";for(let k=0;k<s.length;k++){const p=DG[+s[k]];for(let i=0;i<15;i++)if(p[i]==="1")q.fillRect(x+1+k*4+i%3,y+1+Math.floor(i/3),1,1)}}
function glyph(q,p,x,y){q.fillStyle="#161628";for(let i=0;i<15;i++)if(p[i]==="1")q.fillRect(x+1+i%3,y+1+Math.floor(i/3),1,1);q.fillStyle="#fff";for(let i=0;i<15;i++)if(p[i]==="1")q.fillRect(x+i%3,y+Math.floor(i/3),1,1)}
// v1.2 ISOMETRIC station — Hobbit: Kingdoms of Middle-earth is an
// isometric city view, not a top-down grid (GameSkinny: "an isometric
// view of your inner city where military and residential structures
// can be built and upgraded"). The logical model is UNCHANGED: 12x12
// plots, S.bl {u,t,x,y,l} (adjacency BONUS removed in v1.4 — see game.js mult()),
// MAXC / newCost / placeB untouched. Only the rendering changes.
// Projection (2:1 dimetric, the pixel-art standard):
//   screenX = (gx - gy) * 32,  screenY = (gx + gy) * 16 - z
// for grid coords (gx,gy); a tile is a 64x32 diamond (axes ~26.57°).
// Ground is drawn first, then buildings / decor / wall in painter's
// order (back-to-front by x+y), so nearer buildings cover farther ones.
// v1.6: buildings are NOT extruded blocks. The extruded cube (v1.2–
// v1.5) swallowed the sprite and its yellow top read as another grey
// cube — the live v1.5 station was a pile of yellow-topped cubes.
// Now a building is a LARGE upright pixel sprite standing on a FLAT
// roof-coloured plinth diamond on the ground plane, with a drop
// shadow under it. A purple level shield floats just above each
// building, like Hobbit's level shields (1, 2, 5, 10). The plaza is
// a flat stone diamond on the ground plane — never a block. The wall
// and towers are flat stone diamonds too, at the city edge only.
// v1.1 city dressing is kept in iso form: keep/plaza, districts by
// building type, roads (cross through the keep + spur to every
// building), wall + gates + corner towers that grow with the city,
// farmland outside the wall, foundation pads on open plots.
// NOTE: ground() above is the legacy top-down terrain canvas; it is
// no longer used by drawBase (iso tiles are drawn procedurally).
const ISO_TW=64, ISO_TH=32, ISO_H=480; // tile size + iso world height (game.js stScale uses the same 480)
const ISO_BASE={solar:"#4aa3df",foundry:"#d46a4f",mine:"#b07cf0",hub:"#ecdcb4",hangar:"#aab4c9",command:"#f4f6ff"};
function isoC(i,j){return{x:(i-j)*ISO_TW/2,y:(i+j+1)*ISO_TH/2}} // centre of plot (i,j), ground level
function isoPt(gx,gy){return{x:(gx-gy)*ISO_TW/2,y:(gx+gy)*ISO_TH/2}}
// v1.5: the SPRITE is the building. The extruded iso cube is gone as a
// building — it was drawn far too big relative to the sprite, so the
// sprite looked tiny and buried inside a huge yellow/grey cube, and the
// four corner towers (36 tall, gold roof) read as the four huge yellow
// cubes that dominated the base. Now a building is a small neutral
// basalt platform (v2.3: 24x12, #4b4b57 — was a LOW roof-coloured
// plinth) with the pixel sprite drawn LARGE and upright on it
// (36x36 world units, keep 42x42).
// Level is shown by the sprite tier + the level shield, not by height.
const ISO_PLINTH_H=2, ISO_PLINTH_KEEP_H=3; // v1.6: plinth is FLAT (was 6/8 tall) — a low platform, not a cube (v2.3: the platform is basalt, not roof-coloured)
const ISO_SPRITE_W=36, ISO_SPRITE_H=36, ISO_SPRITE_KEEP_W=42, ISO_SPRITE_KEEP_H=42; // v1.9: smaller (was 40/48) — adjacent buildings keep clear ground between them (live v1.8: the Foundry abutted the keep)
function isoPlinthH(b){return b&&b.t==="command"?ISO_PLINTH_KEEP_H:ISO_PLINTH_H}
function isoSpriteSize(b){return b&&b.t==="command"?{w:ISO_SPRITE_KEEP_W,h:ISO_SPRITE_KEEP_H}:{w:ISO_SPRITE_W,h:ISO_SPRITE_H}}
function isoHeight(b){const s=isoSpriteSize(b);return isoPlinthH(b)+s.h} // top of the sprite above the ground
function isoCellFromPoint(wx,wy){const gx=wx/(ISO_TW/2),gy=wy/(ISO_TH/2);return{i:Math.floor((gx+gy)/2),j:Math.floor((gy-gx)/2)}}
function shade(hex,f){const n=parseInt(hex.slice(1),16);return"rgb("+Math.round(((n>>16)&255)*f)+","+Math.round(((n>>8)&255)*f)+","+Math.round((n&255)*f)+")";}
// v2.2: topmost visible row of a building's sprite canvas, as a
// fraction of the canvas height (0 = content starts at the very top).
// The sprite's visible content does not fill the 44x44 grid — the
// Lv1 Solar Array's panels start at grid row 19, so ~40% of the
// canvas above them is empty. Labels (and the shield hit circle)
// anchor to the VISIBLE content top, not the canvas top.
function spriteTopFrac(b){const t=tier(b.l),sp=b.l>0?memo(b.t+t,()=>spr(44,44,R=>BS[b.t](R,t))):memo("scaf",()=>spr(44,44,SC));return (sp._top||0)/sp.height}
function isoBuildingHit(wx,wy,b,k){
  // v1.7 KEEP HITBOX TAPER: the keep's dome is narrow, so the sprite
  // BODY test tapers for command only — the dome zone (the top ~12u
  // of the sprite) is only the dome / central tower wide (±10u), so
  // a tap on the ground just left of the dome selects the LAND, not
  // the Command Station (live v1.6). The tower/body zone below it
  // keeps the full width (±21u, covers the side towers and body).
  // Roof centre, plinth and sprite body still select the building;
  // ground one tile away selects that plot.
  const c=isoC(b.x,b.y), s=isoSpriteSize(b), ph=isoPlinthH(b);
  // v2.2: the drawn shield sits a FIXED 20 screen px above the
  // VISIBLE top of the sprite (see the label pass) — the hit circle
  // must match it. k = world->screen scale (stScale(), passed by
  // game.js); without it, fall back to the old canvas-top circle,
  // which is correct at zoom ~1.
  if(k!==undefined){const shY=c.y-ph-s.h+spriteTopFrac(b)*s.h-20/k;if(Math.hypot(wx-c.x,wy-shY)<=10)return true}
  else if(Math.hypot(wx-c.x,wy-(c.y-ph-s.h-10))<=10)return true;
  const yTop=c.y-ph-s.h+14, yBot=c.y-ph+2;
  if(b.t==="command"){
    const hw=wy<yTop+12?10:21;
    if(Math.abs(wx-c.x)<=hw&&wy>=yTop&&wy<=yBot)return true;
  } else if(Math.abs(wx-c.x)<=s.w/2-4&&wy>=yTop&&wy<=yBot)return true;
  // v2.3: the HIT zone stays the plot-sized ground diamond (40x20,
  // keep 44x22) — a generous tap target on phones — even though the
  // DRAWN plinth is now a small 24x12 basalt platform. Hit-testing
  // and drawing are deliberately separate: shrinking the plinth must
  // never shrink the tap target.
  const rx=b.t==="command"?22:20, ry=b.t==="command"?11:10;
  return Math.abs(wx-c.x)/rx+Math.abs(wy-c.y)/ry<=1.0;
}
const DISTTINT={solar:"#ffe066",foundry:"#ff9a3c",mine:"#b07cf0",hub:"#9be8ff",hangar:"#4aa3df",command:"#f4f6ff"};
const DISTNAME={solar:"Power District",foundry:"Industrial District",mine:"Industrial District",hub:"Trade District",hangar:"Military District",command:"The Keep"};
// ---- v1.3 station rewrite (live-browser bug fixes) ----
// What was wrong in v1.2, seen live at 1919x998:
//  1. Floating red/yellow bars — tower red flags, gate yellow bars and
//     the Lv0 hazard bar floated in mid-air. REMOVED: no flags, no gate
//     bars, no hazard bar. The only bar left is the build progress bar,
//     anchored to the building's base on the ground.
//  2. Buildings fused into one grey mass — the sprite was SHEARED onto
//     the roof (a skewed sticker) and neighbours touched. Now each type
//     has a distinct roof colour, the roof is a clean iso diamond, the
//     sprite is drawn UPRIGHT (unsheared) sitting on the roof, footprints
//     are smaller than the tile (visible gap + shadow between neighbours),
//     and every building gets a name label + level shield.
//  3. Map ~80% empty / 11. noisy ground — empty plots are now plain grass
//     diamonds with a faint border; the "+" foundation pad only shows in
//     Place/Move mode. Terrain diamonds are drawn over a WIDE area
//     (i,j -4..15) so there is no flat void outside the city.
//  4. Waterfall floated in the void — REMOVED entirely.
//  5. River unreadable — v1.7: actually one continuous band now
//     (a single stroked channel with sand banks and flow dashes —
//     the v1.3/v1.6 per-tile diamonds left grass gaps between them
//     and read as separate blue tiles). Kept on the i=-1 edge,
//     clear of plots.
//  6. No visible wall/cliffs — the city sits on a raised terrace
//     platform with a visible vertical skirt, the wall is taller (22)
//     with crenellations that touch its top, corner towers are taller
//     with gold roofs, and gates are plain gaps in the wall (no posts,
//     no yellow bar). 10. The four grey pillars were the gate posts —
//     gone with the gates.
//     v2.0: the terrace skirt itself is DELETED — the south-face polys
//     read as a dark-brown dirt trench across locked plots (live v1.9).
//     v2.1: the wall itself is DELETED — the thin border read as roads
//     (live v2.0).
//  7. Shields tiny/misplaced — now drawn in SCREEN space at a fixed
//     13px radius, one per building, in a second pass on top of
//     everything. (v1.6: the stem that connected shield to building
//     is removed — it read as a purple plumb-line through the sprite.)
//  8. Trees pasted on buildings — decor now only on empty plots
//     OUTSIDE the wall, never adjacent to a building, ground-anchored.
const ROOF={solar:"#2f78b0",foundry:"#e0584a",mine:"#b07cf0",hub:"#4fc3f7",hangar:"#5a6b8a",command:"#c9a86a"}; // Per-type colours: they live in the SPRITE art and the selection outline ONLY. v2.3: ROOF no longer colours any ground fill — the plot-sized roof-coloured plinths read as coloured tiles (the blue Solar plinth was a pond, the gold keep plinth hid the plaza). v1.9: command is a MUTED gold (was saturated lemon #ffd84a — the keep's plinth read as a bright yellow tile, live v1.8).
// ---- v1.5 sprite-is-the-building + clean ground + visible roads ----
// Live v1.4 defects (seen at 1919x998, NOT headless): the four huge
// yellow-topped cubes were the corner TOWERS (36 tall, gold roof) and
// the wall segments (22 tall, beige top) — they dominated the base
// while the real sprites were tiny and buried. The fix:
//   plinth ................ v2.3: ONE small neutral basalt platform
//     (24x12, #4b4b57) for ALL types, keep included, + a soft
//     y-offset shadow (alpha .18). The v2.2 plot-sized roof-coloured
//     plinths (40x20, keep 44x22) read as coloured tiles on the
//     ground, and the keep's hid the plaza entirely. Type colour
//     lives ONLY in the sprite now.
//   sprite ................ 36x36 world units, upright, LARGE (keep
//     42x42) — the sprite IS the building, the plinth just grounds it (v1.9: was 40/48)
//   wall .................. v2.1: DELETED ENTIRELY. The v2.0 thin
//     border stroked along the ring's outer edges read as grey-brown
//     ROADS radiating from the keep, the merlons as beige tabs at the
//     path ends, and the corner towers as grey plots with yellow
//     centre dots (live v2.0). Jayden never asked for a wall; the
//     city edge is just grass now.
//   towers ................ DELETED with the wall (v2.1).
//   ground ................ v2.2 MARS: plots are DARKER RUST
//     (#7a3b26) than the Mars sand in the gaps (#c98a5a) — no green
//     anywhere on the station ground. No checker alternation, border
//     alpha .05. Farmland REMOVED entirely (v2.2), decor ~5 Mars
//     rocks/craters/crystals, all outside the city.
//   roads/plaza ........... v2.0: NO roads at all (Jayden had the
//     paths removed entirely — they were complained about in every
//     version). v2.3: NO plaza either — the v2.2 plaza diamond was
//     drawn under the keep's plinth and never showed; the keep's
//     basalt platform IS the plaza now.
//   hitbox ................ isoBuildingHit is now the whole building
//     (ground diamond + sprite rectangle + shield), not just the sprite.
// Tile pitch stays 64x32, so the projection and tap math are untouched.
// v2.0 (live v1.9): the plots/wall/roads/labels were still wrong —
// see the v2.0 notes in drawBase. Plinth 40x20 (keep 44x22), sprite
// 36x36 (keep 42x42), plaza is the keep's own plot only, NO roads
// at all (Jayden: paths removed entirely), the wall is a thin border
// along the ring's outer edges (never tiles on plots), locks are
// drawn last on clean grass, labels are centred + clamped to the
// safe area, the dome is a smooth gradient.
// v2.1 (live v2.0): the wall border read as roads, the plinth was
// still a stack of 4 diamonds, labels still floated 150-250px above
// their buildings at max zoom (the safeTop clamp), the flag pole cut
// a slit through the dome top with a yellow square finial, locks
// became huge navy blobs at zoom 5, river dashes read as stray white
// bars, and plots blended into the gaps (same #5fae4f). Fixes: wall
// DELETED entirely, plinth = shadow + ONE diamond, labels fixed 20px
// above the sprite with NO clamp, pole ends at the dome top with a
// red finial pixel, locks capped at 28px tall on screen, river
// dashes removed, plots darker green (#3e8236) than the gaps.
// v2.2 (live v2.1): the Solar label floated ~115px above its panels
// (label anchored to the sprite CANVAS top, but the solar's visible
// content starts at grid row 19); one locked plot had stray
// farmland rows on it; the plaza had a hard rim. Plus Jayden's Mars
// direction: station ground goes rust/sand, river becomes lava.
// Fixes: labels anchor to the VISIBLE content top per sprite
// (measured in spr()), farmland REMOVED entirely, plaza = one flat
// basalt diamond + soft shadow only, ground is Mars rust/sand with
// NO green anywhere, river is a lava channel (basalt banks, molten
// orange, bright centre), decor is rocks/craters/crystals only.
// v2.3 (live v2.2): the Command plot still read wrong — a khaki
// diamond ringed by a thick dark rim, and NO plaza visible. Root
// cause: the "plaza" (28x14) was drawn UNDER the keep's 44x22
// plinth, so it was fully covered (the v2.2 comment claiming it
// was "just larger" than the plinth was wrong), and every
// building's plot-sized roof-coloured plinth read as a coloured
// tile (the Solar Array's blue plinth was a blue pond). Fixes:
// plaza DELETED entirely (the keep's plinth IS the basalt
// platform), every plinth is ONE small neutral basalt platform
// (24x12, #4b4b57) + a soft y-offset shadow (alpha .18), and the
// gold selection outline hugs the small platform and is drawn
// BEFORE the sprite so it never crosses the building.
const ISO_DIA_RX=26, ISO_DIA_RY=13;
function drawBase(q,cam,opts){
  const now=Date.now(),F=Math.floor(now/250),go=S.place||S.mv;
  const cam2=cam||{cx:0,cy:192,zoom:1};
  const vw=q.canvas.width||384,vh=q.canvas.height||384,sc=(vh/ISO_H)*cam2.zoom;
  const sx=opts&&opts.sx!==undefined?opts.sx:vw/2,sy=opts&&opts.sy!==undefined?opts.sy:vh/2;
  const ox=sx-cam2.cx*sc,oy=sy-cam2.cy*sc,k=sc;
  const X=wx=>ox+wx*sc,Y=wy=>oy+wy*sc;
  const poly=(pts,fill,al)=>{if(al!==undefined)q.globalAlpha=al;q.beginPath();q.moveTo(X(pts[0][0]),Y(pts[0][1]));for(let n=1;n<pts.length;n++)q.lineTo(X(pts[n][0]),Y(pts[n][1]));q.closePath();q.fillStyle=fill;q.fill();if(al!==undefined)q.globalAlpha=1};
  const dia=(cx,cy,rx,ry,fill,al)=>poly([[cx,cy-ry],[cx+rx,cy],[cx,cy+ry],[cx-rx,cy]],fill,al);
  const diaStroke=(cx,cy,rx,ry,color,lw)=>{q.beginPath();q.moveTo(X(cx),Y(cy-ry));q.lineTo(X(cx+rx),Y(cy));q.lineTo(X(cx),Y(cy+ry));q.lineTo(X(cx-rx),Y(cy));q.closePath();q.strokeStyle=color;q.lineWidth=lw;q.stroke()};
  q.fillStyle="#c98a5a";q.fillRect(0,0,vw,vh); // v2.2 MARS: gaps between diamonds are light Mars sand, not a dark void
  // (v2.3: the `keep` lookup is gone with the plaza — nothing in
  // drawBase needs the Command Station specially any more.)
  let mnx=12,mxx=-1,mny=12,mxy=-1;
  S.bl.forEach(b=>{mnx=Math.min(mnx,b.x);mxx=Math.max(mxx,b.x);mny=Math.min(mny,b.y);mxy=Math.max(mxy,b.y)});
  if(mxx<0){mnx=3;mxx=5;mny=3;mxy=5}
  const wx0=Math.max(0,mnx-1),wx1=Math.min(11,mxx+1),wy0=Math.max(0,mny-1),wy1=Math.min(11,mxy+1);
  // v2.0: NO roads at all (Jayden: "remove the paths entirely") and
  // NO wall at all (v2.1: deleted entirely — the border read as
  // roads). Every locked plot shows its lock.
  const Hh=(a,b)=>((a*73856093)^(b*19349663))>>>0;
  let decorN=0; // v1.5 caps: decor is sparse by count, not just by pattern
  // v2.0: NO terrace platform skirt — the ground is flat. The old
  // south-face polys (#4a3f30/#5d4f3c) read as a dark-brown dirt
  // trench crossing locked plots and running off the edges (live
  // v1.9, cause B).
  // --- ground: wide terrain first, then plots, back-to-front ---
  const cells=[];
  for(let j=-4;j<=15;j++)for(let i=-4;i<=15;i++)cells.push([i,j]);
  cells.sort((a,b)=>(a[0]+a[1])-(b[0]+b[1])||a[0]-b[0]);
  let riverDrawn=false; // v1.7: the river band is drawn ONCE, at its first cell
  cells.forEach(([i,j])=>{
    const c=isoC(i,j);
    if(i<0||j<0||i>11||j>11){
      if(i===-1&&j>=0&&j<=11){
        // v2.2 LAVA (Jayden: Mars / space vibe — the river is lava
        // now). Same channel geometry, new palette only: dark
        // charred-basalt banks, molten orange, bright yellow-orange
        // centre. No blue water anywhere on the station.
        // Live v1.6: the per-tile diamonds (20x10 on a 64x32 pitch)
        // left grass gaps between them, so the river read as 5-6
        // separate blue tiles / small pools, with a road cutting
        // across the row. The river centres are collinear —
        // isoC(-1,j) steps (-32,+16) — so the whole river is ONE
        // straight stroked band from (144,-88) to (-560,264) (v1.9:
        // extended past both map edges — the old ends stopped inside
        // the terrain, so the NE end read as a blunt rounded cap, a
        // pill, touching the plaza's NW edge, live v1.8): a sand
        // bank stroke, a water stroke, a lighter centre flow, and
        // four animated flow dashes. Drawn once, at the first river
        // cell (depth -1, behind everything); the other river cells
        // draw nothing — the canvas underneath is already grass.
        // (A diamond of rx,ry has perpendicular half-width
        // rx*ry/sqrt(rx^2+ry^2) along this diagonal: 8.94 / 7.16 /
        // 4.92 world units for bank / lava / centre — hence the
        // 17.9 / 14.3 / 9.8 stroke widths.)
        if(!riverDrawn){
          riverDrawn=true;
          const rx0=144,ry0=-88,rx1=-560,ry1=264;
          q.lineJoin="round";q.lineCap="round";
          const band=(w,col)=>{q.beginPath();q.moveTo(X(rx0),Y(ry0));q.lineTo(X(rx1),Y(ry1));q.strokeStyle=col;q.lineWidth=Math.max(1,w*k);q.stroke()};
          band(17.9,"#3a2a26"); // v2.2 LAVA: dark charred basalt banks (outer)
          band(14.3,"#ff6a00"); // molten orange lava
          band(9.8,"#ffb02e"); // brighter yellow-orange centre flow
          // v2.1: NO flow dashes. The pale blue-white dashes read as
          // stray white bars at Fit zoom (live v2.0) — the three-band
          // river reads fine without them.
        }
      } else { // terrain outside the city: Mars sand, never void
        dia(c.x,c.y,ISO_DIA_RX,ISO_DIA_RY,"#c98a5a"); // v2.2: light Mars sand, no checker
      }
      return;
    }
    const h=Hh(i,j),bd0=bAt(i,j);
    // v2.2 MARS: plots are DARKER RUST than the gaps (Jayden: the
    // plot diamonds and the sand in between must read as different
    // ground). Plot fill #7a3b26, gaps + terrain outside the grid
    // stay light Mars sand #c98a5a. Applies to ALL empty plots,
    // locked and unlocked — the padlock remains the only difference.
    const base="#7a3b26";
    dia(c.x,c.y,ISO_DIA_RX,ISO_DIA_RY,base); // spaced diamond: sand gap between plots
    diaStroke(c.x,c.y,ISO_DIA_RX,ISO_DIA_RY,"rgba(0,0,0,0.05)",1); // faint border only
    // v2.2: FARMLAND IS REMOVED ENTIRELY. The three pale rows read as
    // a stray mark on a locked plot (live v2.1, SE quadrant) — it was
    // decorative clutter Jayden never asked for. Nothing replaces it.
    // v1.9: NO dim overlay on locked plots — a locked plot is clean
    // rust exactly like an unlocked one; the lock icon is drawn
    // in a LAST pass (after ground AND objects), so the ground and
    // the buildings can no longer paint over it (live v1.8: locks
    // were missing from plots near the keep and on road lines).
    // Foundation pad ONLY in Place/Move mode — normal ground is terrain, not grid.
    if(!bd0&&go&&!plotLocked(i,j)){
      dia(c.x,c.y,22,11,"#8f8a76");
      dia(c.x,c.y,17,8,"#cdb98a");
      q.fillStyle="#ffb02e";q.globalAlpha=.9; // v2.2 MARS: amber + (was bright green) — buildable marker on rust
      q.fillRect(X(c.x)-Math.max(1,1.5*k),Y(c.y)-Math.max(3,7*k),Math.max(2,3*k),Math.max(6,14*k));
      q.fillRect(X(c.x)-Math.max(3,7*k),Y(c.y)-Math.max(1,1.5*k),Math.max(6,14*k),Math.max(2,3*k));
      q.globalAlpha=1;
    }
  });
  // --- v2.3: NO plaza diamond at all (deleted). The v2.2 plaza was
  // a 28x14 basalt diamond drawn UNDER the keep's 44x22 plinth, so
  // it was fully covered and never visible — the comment claiming
  // it was "just larger than the keep's 44x22 plinth" was wrong
  // (28x14 < 44x22). What the player actually saw on the Command
  // plot was the khaki plinth ringed by its own dark shadow: a
  // coloured tile with a thick dark rim, and no plaza. The keep's
  // plinth IS the basalt platform now (see the objects loop below),
  // so there is nothing left for a separate plaza to do. Future
  // check: assert the keep plot's VISIBLE fills, never that a plaza
  // draw call exists — a draw call under an opaque fill is dead code.
  // --- objects: buildings, decor — painter's order ---
  // v2.1: NO wall/tower objects — the wall is deleted entirely, so no
  // plot ever carries a wall tile.
  const objs=[];
  S.bl.forEach(b=>objs.push({d:b.x+b.y,kind:"bld",b}));
  // Decor: ONLY on empty ground outside the city — ground-anchored,
  // sized to the tile, never on a building or a road.
  // v1.4: sparse, deliberate decor — a handful of trees/rocks at the
  // city edge, never adjacent to a building, never on a road or river.
  const nearB=(i,j)=>S.bl.some(b=>Math.abs(b.x-i)+Math.abs(b.y-j)<=1);
  // v2.1: decor is a handful of trees/rocks OUTSIDE the city, capped at 5.
  for(let j=-2;j<=13;j++)for(let i=-2;i<=13;i++){
    if(decorN>=5)break;
    if(i<0||j<0||i>11||j>11){if(i!==-1&&!nearB(i,j)&&(i<wx0-1||i>wx1+1||j<wy0-1||j>wy1+1)&&(i*7+j*11)%41===0){decorN++;objs.push({d:i+j,kind:"decor",i,j,out:true})}}
  }
  objs.sort((a,b)=>a.d-b.d||(a.i||0)-(b.i||0));
  const labels=[]; // second pass: shields + names drawn on top, screen space
  objs.forEach(o=>{
    if(o.kind==="decor"){
      const c=isoC(o.i,o.j),dc=decor(o.i,o.j),ds=Math.round(22*k);
      q.drawImage(dc,X(c.x)-ds/2,Y(c.y+8)-ds,ds,ds); // bottom anchored to the ground
      return;
    }
    const b=o.b,c=isoC(b.x,b.y);
    const ph=isoPlinthH(b), ssz=isoSpriteSize(b);
    // v2.3: the sprite IS the building, standing on a SMALL neutral
    // basalt platform — the same 24x12 diamond for ALL six types,
    // keep included. The v2.2 plot-sized roof-coloured plinths
    // (40x20, keep 44x22) read as coloured tiles on the ground: the
    // Solar Array's blue plinth was a blue pond, and the keep's
    // muted-gold plinth completely covered the 28x14 plaza drawn
    // under it (the plaza never showed — see the note above). Type
    // colour now lives ONLY in the sprite/roof, never in a ground
    // fill. The platform is clearly smaller than the 52x26 plot
    // diamond, so it reads as a pad the building stands on, not a
    // coloured tile. The sprite is drawn LARGE and upright with its
    // bottom overlapping the platform by 3u — so there is NO white
    // gap under the sprite.
    // The base is EXACTLY TWO fills: a soft y-offset drop shadow
    // (same 24x12 size, shifted down 2u, alpha .18 — it peeks below
    // the platform as a crescent, never a uniform dark ring) and
    // ONE flat basalt platform (#4b4b57). The old stack (stone
    // foundation + shadow + plinth + lighter centre = four
    // concentric diamonds) read as stacked tiles (live v2.0).
    const rx=12,ry=6; // v2.3: platform 24x12, all types
    dia(c.x,c.y+2,rx,ry,"#000000",.18); // soft drop shadow, y-offset only
    dia(c.x,c.y,rx,ry,"#4b4b57"); // ONE flat basalt platform
    // v2.3: THIN muted selection outline (fixed 2 canvas px, dull
    // gold) that hugs the SMALL platform — same 24x12 diamond, so
    // its extents stay within the platform bounds +1px (the stroke
    // width). It is drawn BEFORE the sprite, so the sprite paints
    // over any part of it that would cross the building: the v2.2
    // plot-sized outline (52x26) crossed in front of the solar
    // panels' lower edge. What stays visible is the gold rim on the
    // platform's lower edge, below the sprite.
    if(b.u===S.bsel||b.u===S.mv)diaStroke(c.x,c.y,rx,ry,"#c9a86a",2);
    const t=tier(b.l),sp=b.l>0?memo(b.t+t,()=>spr(44,44,R=>BS[b.t](R,t))):memo("scaf",()=>spr(44,44,SC));
    const ssw=Math.round(ssz.w*k),ssh=Math.round(ssz.h*k),spx=X(c.x),spy=Y(c.y-ph);
    q.drawImage(sp,spx-ssw/2,spy-ssh+Math.max(2,3*k),ssw,ssh); // bottom overlaps the plinth: no gap
    // Production effects, anchored to the sprite (never floating above it).
    // v1.7: the foundry smoke is REMOVED — its rising grey squares
    // drifted above the sprite top, right where the level shield and
    // name sit, and read as stray white/grey squares on the map at
    // zoom (live v1.6). The other effects are small marks ON the
    // sprite body, so they stay.
    if(b.l>0){
      const sTop=spy-ssh;
      if(b.t==="mine"){q.fillStyle=F&2?"#9be8ff":"#b07cf0";q.fillRect(spx-Math.max(1,2*k),sTop+Math.max(2,6*k),Math.max(2,4*k),Math.max(2,4*k))}
      if(b.t==="hub"){q.fillStyle=F&2?"#ffe066":"#ff9a3c";q.fillRect(spx-Math.max(3,10*k),spy-Math.max(3,8*k),Math.max(1,3*k),Math.max(1,3*k));q.fillRect(spx+Math.max(3,7*k),spy-Math.max(3,8*k),Math.max(1,3*k),Math.max(1,3*k))}
      if(b.t==="hangar"){q.fillStyle=F&2?"#ff6b6b":"#ffd0d0";q.fillRect(spx-Math.max(3,8*k),spy-Math.max(2,4*k),Math.max(2,4*k),Math.max(2,3*k));q.fillRect(spx+Math.max(3,4*k),spy-Math.max(2,4*k),Math.max(2,4*k),Math.max(2,3*k))}
      // v1.9: NO canvas-space glint squares. The command glint (a gold
      // square just above the sprite top) read as a stray yellow square
      // under the level shield AND as a yellow speck at the dome's edge
      // (live v1.8, #5/#13) — the dome's highlight is now inside the
      // sprite art. The solar glint (a 12u white bar) read as the lone
      // white bar on the NW walkway (live v1.8, #4) — the panels
      // already carry white highlight pixels in the sprite.
    }
    // Build progress: anchored to the building's base on the ground.
    const job=S.bq.filter(j=>j.u===b.u).sort((u,v)=>u.end-v.end)[0];
    if(job&&job.s){const p=Math.min(1,(now-job.s)/(job.end-job.s));q.fillStyle="#161628";q.fillRect(X(c.x)-18,Y(c.y+20),36,5);q.fillStyle="#ffe066";q.fillRect(X(c.x)-17,Y(c.y+21),Math.max(1,Math.round(34*p)),3)}
    else if(job){q.fillStyle="#ffe066";q.fillRect(X(c.x)-18,Y(c.y+20),8,5)}
    // (v2.3: the selection outline is drawn BEFORE the sprite now —
    // see the platform code above. A plot-sized outline drawn here,
    // after the sprite, crossed in front of the panels' lower edge.)
    // v2.2: label anchor = VISIBLE content top of the sprite, not the
    // canvas top. ct is the screen y of the first drawn pixel row
    // (sp._top, measured in spr()). The shield sits 20 screen px
    // above ct in the label pass, so the gap from shield bottom to
    // visible building top is 7px for EVERY building type.
    const ctY=(spy-ssh+Math.max(2,3*k))+(sp._top||0)/sp.height*ssh;
    labels.push({u:b.u,l:b.l,name:B[b.t].n,roofX:spx,roofY:spy,ss:ssh,ct:ctY});
    if(window.__isoDraw)window.__isoDraw.push({u:b.u,d:b.x+b.y,t:b.t,l:b.l,H:isoHeight(b)});
  });
  // --- v2.1 LOCKS, drawn LAST (after ground AND objects).
  // (v2.3: the plaza is gone — the keep's plinth IS the basalt
  // platform — so there is no plaza left to draw after.)
  // No wall at all, so EVERY locked plot gets a padlock. A clear
  // padlock on clean green grass: a white shackle ARC + a dark body
  // + a gold keyhole, sized with a pixel floor so it reads at default
  // zoom on a phone. The lock is the ONLY difference between locked
  // and unlocked empty plots — no dim overlay, no grey.
  for(let j=0;j<12;j++)for(let i=0;i<12;i++){
    if(!plotLocked(i,j))continue;
    const c=isoC(i,j),lx=X(c.x),ly=Y(c.y);
    // v2.1: cap the lock's SCREEN size. The 9k×7k lock scaled with
    // zoom and was a ~45×35px navy blob at zoom 5 (live v2.0). lk
    // caps the zoom factor at 4, so the body is at most 36×28px and
    // the shackle line stays thin.
    const lk=Math.min(4,k);
    const bw=Math.max(10,9*lk),bh=Math.max(8,7*lk),r=bw/2;
    q.strokeStyle="#f4f6ff";q.lineWidth=Math.max(2,Math.min(3,2*k));
    q.beginPath();q.arc(lx,ly-bh/2,r,Math.PI,0);q.stroke();
    q.fillStyle="#1e2438";q.fillRect(lx-bw/2,ly-bh/2,bw,bh);
    q.fillStyle="#ffd84a";q.fillRect(lx-1,ly-1,2,2);
    if(window.__isoDraw)window.__isoDraw.push({lock:i+","+j});
  }
  // --- second pass: level shields + names, screen space, always on top.
  // v2.2 LABELS (live v2.1: the Solar Array's label floated ~115px
  // above its panels at Fit zoom, ~190px at max zoom — Foundry was
  // ~25-35px and Command ~15px. Cause: the shield anchored to the
  // top of the 44x44 sprite CANVAS, but the solar's visible content
  // (panels) starts at grid row 19, so ~40% of the canvas above them
  // is empty and the label sat over the locked plot above the panels.
  // The shield+name now anchor to the VISIBLE content top (L.ct,
  // measured per sprite in spr()) with the same fixed 20 screen px
  // gap and NO vertical clamp. A label may leave the top of the
  // screen if the player pans its building up there (that is normal);
  // a label floating above empty canvas space is not.
  labels.forEach(L=>{
    const spriteTop=L.ct!==undefined?L.ct:L.roofY-L.ss; // screen y of the VISIBLE sprite top (first drawn pixel row)
    const nameW=L.name.length*7+6;
    let shx=Math.max(nameW/2+4,Math.min(vw-nameW/2-4,L.roofX));
    let shy=spriteTop-20; // shield centre: fixed 20 screen px above the sprite
    q.fillStyle="#7a4fc0";q.beginPath();q.moveTo(shx,shy-13);q.lineTo(shx+13,shy);q.lineTo(shx,shy+13);q.lineTo(shx-13,shy);q.closePath();q.fill();
    q.strokeStyle="#ffffff";q.lineWidth=2;q.stroke();
    try{q.font="bold 12px 'Courier New',monospace"}catch(e){}
    q.textAlign="center";q.textBaseline="middle";q.fillStyle="#ffffff";q.fillText(String(L.l),shx,shy+1);
    drawLabel(q,L.name,Math.round(shx),Math.round(shy-22),"#ffffff",11,true);
    if(window.__isoDraw)window.__isoDraw.push({shield:L.u,l:L.l,shx,shy});
  });
}

const gbgFor=(w,h)=>memo("gbg"+w+"x"+h,()=>{const c=document.createElement("canvas");c.width=w;c.height=h;const q=c.getContext("2d");q.fillStyle="#0a0e2a";q.fillRect(0,0,w,h);
const blobs=[[.22,.30,110,"#241a4a"],[.55,.22,130,"#1a1442"],[.82,.45,120,"#121a46"],[.35,.68,140,"#241a4a"],[.68,.78,120,"#1a1442"],[.12,.82,90,"#2a1a5a"],[.92,.15,90,"#121a46"]];
blobs.forEach(b=>{const g=q.createRadialGradient(b[0]*w,b[1]*h,0,b[0]*w,b[1]*h,b[2]);g.addColorStop(0,b[3]);g.addColorStop(1,"rgba(10,14,42,0)");q.globalAlpha=.55;q.fillStyle=g;q.fillRect(0,0,w,h)});q.globalAlpha=1;return c});
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
function drawLabel(q,text,cx,cy,color,fs,noClamp){const vw=q.canvas.width||384,vh=q.canvas.height||480,f=Math.max(11,fs||11);try{q.font="bold "+f+"px 'Courier New',monospace"}catch(e){}q.textAlign="center";q.textBaseline="middle";let w=text.length*7;try{if(q.measureText)w=Math.ceil(q.measureText(text).width)}catch(e){}const hh=Math.ceil(f*1.3);if(!noClamp){cx=Math.max(w/2+4,Math.min(vw-w/2-4,cx));cy=Math.max(hh/2+2,Math.min(vh-hh/2-2,cy))}q.fillStyle="#161628";q.fillRect(Math.round(cx-w/2-3),Math.round(cy-hh/2),w+6,hh);q.fillStyle=color||"#ffffff";q.fillText(text,Math.round(cx),Math.round(cy))}
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
// v1.6: name threshold was 0.55 — the extra galaxy bottom margin
// lowers the fit zoom on narrow screens, and names must still show.
if(cam2.zoom>=0.4)labels.push({text:s.n,cx,cy:cy+zh/2+12+fs/2,color:own?"#6ee7f5":o==="c"?"#ff9a8a":o==="v"?"#d0b0ff":avail(i)?"#ffe066":"#aab4c9",fs});
if(cam2.zoom>=1.2&&s.pw!==undefined)labels.push({text:"PWR "+spw(i),cx,cy:cy+zh/2+30+fs,color:"#ffffff",fs});});
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
