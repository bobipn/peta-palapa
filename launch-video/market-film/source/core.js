/* ===== C-Ring Market — cinematic product film: core ===== */
const W=1920,H=1080,PI=Math.PI,D=PI/180;
const cv=document.getElementById('c');const ctx=cv.getContext('2d');
let T=0;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));const lerp=(a,b,t)=>a+(b-a)*t;const prog=(t,a,b)=>clamp((t-a)/(b-a));
const E={io:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,out:t=>1-Math.pow(1-t,3),in:t=>t*t*t,sine:t=>-(Math.cos(PI*t)-1)/2,
 back:t=>{const c1=1.25,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)},expo:t=>t<=0?0:t>=1?1:t<.5?Math.pow(2,20*t-10)/2:(2-Math.pow(2,-20*t+10))/2,
 outExpo:t=>t>=1?1:1-Math.pow(2,-10*t)};
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
/* palette (C-Ring dark mode) */
const BK='#010309',BG='#030a1a',PAN='#0a1630',PAN2='#0e1d3c',FLD='#071025',LINE='rgba(255,255,255,.09)',LINE2='rgba(255,255,255,.16)',
 TX='#EAF0FA',MU='#8C99B1',MU2='#5E6A80',BL='#2E6BDB',BL2='#3B7BF0',LB='#6FA3FF',ICEB='#C9D8F2',OK='#3CCB85',OKBG='rgba(60,203,133,.14)',NAVY='#0D2150';
const SANS="'Plex'",MONO="'PlexMono'";
/* images */
const IMG={};const IMGP=[];function loadImg(k,src){const i=new Image();IMGP.push(new Promise(r=>{i.onload=r;i.onerror=r}));i.src=src;IMG[k]=i}
loadImg('logo',SVG_LOGO);loadImg('word',SVG_WORD);loadImg('icon',BRAND.app_icon);
/* text */
function font(size,weight=400,fam=SANS){return `${weight} ${size}px ${fam}`}
function mw(s,size,weight=400,ls=0,fam=SANS){ctx.save();ctx.font=font(size,weight,fam);ctx.letterSpacing=ls+'px';const w=ctx.measureText(s).width;ctx.restore();return w}
function txt(s,x,y,o={}){const {size=24,weight=400,c=TX,align='left',ls=0,a=1,fam=SANS,p=null,glow=0}=o;if(a<=0||!s)return;ctx.save();ctx.globalAlpha*=a;ctx.font=font(size,weight,fam);ctx.letterSpacing=ls+'px';ctx.textAlign=align;ctx.fillStyle=c;
 if(glow){ctx.shadowColor=typeof glow==='string'?glow:'rgba(111,163,255,.6)';ctx.shadowBlur=18}
 if(p!=null){const w=ctx.measureText(s).width;const x0=align==='center'?x-w/2:align==='right'?x-w:x;ctx.beginPath();ctx.rect(x0-4,y-size*1.2,(w+8)*clamp(p),size*1.7);ctx.clip();const k=E.out(clamp(p));ctx.globalAlpha*=k}
 ctx.fillText(s,x,y);ctx.restore()}
/* staggered word reveal (cinematic) */
function reveal(s,x,y,t0,o={}){const {size=56,weight=300,c=TX,align='left',ls=0,dur=.9,st=.07,blur=true}=o;const words=s.split(' ');ctx.save();ctx.font=font(size,weight,o.fam||SANS);ctx.letterSpacing=ls+'px';
 const sp=ctx.measureText(' ').width;const ws=words.map(w=>ctx.measureText(w).width);const tot=ws.reduce((a,b)=>a+b,0)+sp*(words.length-1);let xx=align==='center'?x-tot/2:align==='right'?x-tot:x;ctx.textAlign='left';
 words.forEach((w,i)=>{const k=prog(T,t0+i*st,t0+i*st+dur);if(k>0){const e=E.out(k);ctx.save();ctx.globalAlpha*=e*(o.a==null?1:o.a);ctx.fillStyle=c;if(blur&&k<1)ctx.filter=`blur(${(1-e)*8}px)`;ctx.fillText(w,xx,y+(1-e)*size*.35);ctx.restore()}xx+=ws[i]+sp});ctx.restore()}
function wrap(s,maxW,size,weight=400){ctx.save();ctx.font=font(size,weight);const words=s.split(' ');const L=[];let line='';words.forEach(w=>{const t=line?line+' '+w:w;if(ctx.measureText(t).width>maxW&&line){L.push(line);line=w}else line=t});if(line)L.push(line);ctx.restore();return L}
function para(s,x,y,maxW,o={}){const size=o.size||20,lh=o.lh||size*1.5;const L=wrap(s,maxW,size,o.weight||400);L.forEach((l,i)=>txt(l,x,y+i*lh,Object.assign({},o,{size})));return L.length*lh}
/* shapes */
function rr(x,y,w,h,r=14){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function fillR(x,y,w,h,r,c,a=1){if(a<=0)return;ctx.save();ctx.globalAlpha*=a;ctx.fillStyle=c;rr(x,y,w,h,r);ctx.fill();ctx.restore()}
function strokeR(x,y,w,h,r,c,lw=1,a=1){if(a<=0)return;ctx.save();ctx.globalAlpha*=a;ctx.strokeStyle=c;ctx.lineWidth=lw;rr(x+.5,y+.5,w-1,h-1,r);ctx.stroke();ctx.restore()}
function circ(x,y,r,c,a=1){if(a<=0)return;ctx.save();ctx.globalAlpha*=a;ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,2*PI);ctx.fill();ctx.restore()}
function ring(x,y,r,c,lw=2,a=1){if(a<=0)return;ctx.save();ctx.globalAlpha*=a;ctx.strokeStyle=c;ctx.lineWidth=lw;ctx.beginPath();ctx.arc(x,y,r,0,2*PI);ctx.stroke();ctx.restore()}
function line(pts,c,lw=2,a=1,o={}){if(a<=0||pts.length<2)return;ctx.save();ctx.globalAlpha*=a;ctx.strokeStyle=c;ctx.lineWidth=lw;ctx.lineCap='round';ctx.lineJoin='round';if(o.dash)ctx.setLineDash(o.dash);if(o.glow){ctx.shadowColor=o.glow;ctx.shadowBlur=o.blur||14}
 ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.stroke();ctx.restore()}
function tick(x,y,s,c='#fff',lw=3,p=1){if(p<=0)return;const P=[[x-s*.45,y],[x-s*.12,y+s*.32],[x+s*.5,y-s*.38]];const L1=Math.hypot(P[1][0]-P[0][0],P[1][1]-P[0][1]),L2=Math.hypot(P[2][0]-P[1][0],P[2][1]-P[1][1]);const d=(L1+L2)*clamp(p);
 const pts=[P[0]];if(d<=L1)pts.push([lerp(P[0][0],P[1][0],d/L1),lerp(P[0][1],P[1][1],d/L1)]);else{pts.push(P[1]);const f=(d-L1)/L2;pts.push([lerp(P[1][0],P[2][0],f),lerp(P[1][1],P[2][1],f)])}line(pts,c,lw)}
/* polyline utils */
function plen(P){let L=[0];for(let i=1;i<P.length;i++)L.push(L[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));return L}
function psub(P,f){if(f<=0)return [P[0]];const L=plen(P),tot=L[L.length-1],d=tot*clamp(f);const out=[P[0]];for(let i=1;i<P.length;i++){if(L[i]<=d)out.push(P[i]);else{const k=(d-L[i-1])/(L[i]-L[i-1]);out.push([lerp(P[i-1][0],P[i][0],k),lerp(P[i-1][1],P[i][1],k)]);break}}return out}
function pat(P,f){const s=psub(P,f);return s[s.length-1]}
function pulses(P,t0,n=3,speed=.35,r=4,c='#fff'){if(T<t0)return;for(let i=0;i<n;i++){const f=((T-t0)*speed+i/n)%1;const q=pat(P,f);ctx.save();const g=ctx.createRadialGradient(q[0],q[1],0,q[0],q[1],r*5);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.25,'rgba(140,185,255,.6)');g.addColorStop(1,'rgba(111,163,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(q[0],q[1],r*5,0,2*PI);ctx.fill();ctx.restore()}}
/* light route: glow + core */
function lightRoute(P,p,c=LB,w=4,a=1){if(p<=0)return;const s=psub(P,p);line(s,c,w*4,.12*a);line(s,c,w*2,.25*a);line(s,'#fff',w*.7,.95*a);line(s,c,w,.9*a);const h=s[s.length-1];if(p<1){const g=ctx.createRadialGradient(h[0],h[1],0,h[0],h[1],w*7);g.addColorStop(0,'rgba(255,255,255,'+a+')');g.addColorStop(1,'rgba(111,163,255,0)');ctx.save();ctx.fillStyle=g;ctx.beginPath();ctx.arc(h[0],h[1],w*7,0,2*PI);ctx.fill();ctx.restore()}}
/* camera */
function cam(s,cx=W/2,cy=H/2,dx=0,dy=0){ctx.translate(cx+dx,cy+dy);ctx.scale(s,s);ctx.translate(-cx,-cy)}
/* ===== Earth: orthographic projection ===== */
function view(lat0,lon0,R,cx=W/2,cy=H/2){const p0=lat0*D,cl=Math.cos(p0),sl=Math.sin(p0);return {R,cx,cy,P(lat,lon){const p=lat*D,l=(lon-lon0)*D,cp=Math.cos(p),sp=Math.sin(p),cL=Math.cos(l);return [cx+R*cp*Math.sin(l),cy-R*(cl*sp-sl*cp*cL),sl*sp+cl*cp*cL]}}}
const STARS=(()=>{const r=mulberry(7);return Array.from({length:420},()=>[r()*W,r()*H,r()*1.3+.2,r()])})();
function stars(a=1,drift=0){if(a<=0)return;ctx.save();STARS.forEach(([x,y,s,b])=>{const tw=.6+.4*Math.sin(T*1.3+b*40);ctx.globalAlpha=a*(.15+.55*b)*tw;ctx.fillStyle=b>.85?'#cfe0ff':'#fff';ctx.fillRect((x+drift*s*20)%W,y,s,s)});ctx.restore()}
function globe(V,o={}){const {dots=1,body=1,atm=1,land=0,landC='#102449',edgeC='rgba(111,163,255,.22)',dotC=[170,200,255]}=o;const {R,cx,cy}=V;
 if(body>0&&R<5000){ctx.save();ctx.globalAlpha=body;const g=ctx.createRadialGradient(cx-R*.35,cy-R*.4,R*.1,cx,cy,R);g.addColorStop(0,'#0c1d42');g.addColorStop(.7,'#060f26');g.addColorStop(1,'#030816');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R,0,2*PI);ctx.fill();ctx.restore()}
 if(atm>0&&R<6000){ctx.save();ctx.globalAlpha=atm;const g=ctx.createRadialGradient(cx,cy,R*.9,cx,cy,R*1.14);g.addColorStop(0,'rgba(111,163,255,0)');g.addColorStop(.36,'rgba(120,170,255,.22)');g.addColorStop(.44,'rgba(150,190,255,.30)');g.addColorStop(.6,'rgba(46,107,219,.10)');g.addColorStop(1,'rgba(46,107,219,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R*1.14,0,2*PI);ctx.fill();
  const gl=ctx.createLinearGradient(cx-R,cy-R,cx+R,cy+R);gl.addColorStop(0,'rgba(0,0,0,0)');gl.addColorStop(.55,'rgba(0,0,0,0)');gl.addColorStop(1,'rgba(1,3,9,.55)');ctx.fillStyle=gl;ctx.beginPath();ctx.arc(cx,cy,R*1.001,0,2*PI);ctx.fill();
  const g2=ctx.createRadialGradient(cx,cy,R*.6,cx,cy,R);g2.addColorStop(0,'rgba(0,0,0,0)');g2.addColorStop(1,'rgba(111,163,255,.10)');ctx.fillStyle=g2;ctx.beginPath();ctx.arc(cx,cy,R,0,2*PI);ctx.fill();ctx.restore()}
 if(land>0){ctx.save();ctx.globalAlpha=land;ctx.fillStyle=landC;ctx.strokeStyle=edgeC;ctx.lineWidth=1.2;LAND.forEach(r=>{let ok=true;ctx.beginPath();r.forEach((q,i)=>{const s=V.P(q[0],q[1]);if(s[2]<0)ok=false;i?ctx.lineTo(s[0],s[1]):ctx.moveTo(s[0],s[1])});if(ok){ctx.closePath();ctx.fill();ctx.stroke()}});ctx.restore()}
 if(dots>0){ctx.save();const ds=Math.max(1.1,Math.min(3.2,R*0.0062));for(const [la,lo] of DOTS){const s=V.P(la,lo);if(s[2]<=0.02||s[0]<-10||s[0]>W+10||s[1]<-10||s[1]>H+10)continue;const z=s[2];ctx.globalAlpha=dots*(.18+.7*z*z);ctx.fillStyle=`rgb(${dotC[0]},${dotC[1]},${dotC[2]})`;const k=ds*(.55+.45*z);ctx.fillRect(s[0]-k/2,s[1]-k/2,k,k)}ctx.restore()}}
function prtRoutes(V,a=1,o={}){if(a<=0)return;const c=o.c||'rgba(111,163,255,.55)';ROUTES.forEach(r=>{const pts=[];let ok=true;r.p.forEach(q=>{const s=V.P(q[0],q[1]);if(s[2]<0)ok=false;pts.push(s)});if(!ok)return;line(pts,c,o.w||1.4,a,r.t==='m'?{dash:[5,5]}:{})})}
function proj(V,arr){return arr.map(q=>{const s=V.P(q[0],q[1]);return [s[0],s[1]]})}
/* ===== orb cursor (spiral) ===== */
function orb(x,y,o={}){const {press=0,a=1,s=1}=o;if(a<=0)return;const k=s*(1-.18*press);ctx.save();ctx.translate(x,y);ctx.globalAlpha*=a;
 const g=ctx.createRadialGradient(0,0,0,0,0,46*k);g.addColorStop(0,'rgba(111,163,255,.35)');g.addColorStop(1,'rgba(111,163,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,46*k,0,2*PI);ctx.fill();
 const g2=ctx.createRadialGradient(-5*k,-6*k,2,0,0,19*k);g2.addColorStop(0,'#ffffff');g2.addColorStop(.55,'#dfe9ff');g2.addColorStop(1,'#9dbdf5');ctx.fillStyle=g2;ctx.beginPath();ctx.arc(0,0,18*k,0,2*PI);ctx.fill();
 ctx.rotate(T*2.6);ctx.strokeStyle=NAVY;ctx.lineWidth=2.4*k;ctx.lineCap='round';ctx.beginPath();for(let i=0;i<=60;i++){const th=i/60*PI*3.2,r=(1.5+i/60*11)*k;const px=Math.cos(th)*r,py=Math.sin(th)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.stroke();
 ctx.rotate(-T*4.2);ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(0,0,25*k,0,PI*1.3);ctx.stroke();ctx.restore()}
function orbPath(keys,t){let x=keys[0][1],y=keys[0][2],press=0;for(let i=0;i<keys.length;i++){const [ti,xi,yi,cl]=keys[i];if(t<ti){if(i>0){const [t0,x0,y0]=keys[i-1];const d=Math.min(.55,ti-t0);const f=E.io(prog(t,ti-d,ti));x=lerp(x0,xi,f);y=lerp(y0,yi,f)}break}x=xi;y=yi;if(cl){const k=prog(t,ti,ti+.24);if(k>0&&k<1)press=Math.sin(k*PI)}}return {x,y,press}}
function drawOrb(keys,t,o={}){keys.forEach(([ti,x,y,cl])=>{if(!cl)return;const k=prog(t,ti,ti+.6);if(k<=0||k>=1)return;ring(x,y,22+60*E.out(k),'rgba(140,185,255,1)',2.2*(1-k)+.6,(1-k)*.85)});const p=orbPath(keys,t);orb(p.x,p.y,{press:p.press,a:o.a==null?1:o.a});return p}
/* ===== UI kit (dark) ===== */
function glowPanel(x,y,w,h,r=22,a=1){if(a<=0)return;ctx.save();ctx.globalAlpha*=a;ctx.shadowColor='rgba(46,107,219,.28)';ctx.shadowBlur=90;ctx.shadowOffsetY=30;const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#0c1a36');g.addColorStop(1,'#08132a');ctx.fillStyle=g;rr(x,y,w,h,r);ctx.fill();ctx.restore();
 ctx.save();ctx.globalAlpha*=a;const gs=ctx.createLinearGradient(0,y,0,y+h);gs.addColorStop(0,'rgba(255,255,255,.18)');gs.addColorStop(.25,'rgba(255,255,255,.07)');gs.addColorStop(1,'rgba(255,255,255,.04)');ctx.strokeStyle=gs;ctx.lineWidth=1.2;rr(x+.5,y+.5,w-1,h-1,r);ctx.stroke();ctx.restore()}
function card(x,y,w,h,o={}){fillR(x,y,w,h,o.r||16,o.fill||'rgba(255,255,255,.035)',o.a==null?1:o.a);strokeR(x,y,w,h,o.r||16,o.c||LINE,o.lw||1,o.a==null?1:o.a)}
function appBar(x,y,w,sub,right=[]){fillR(x,y,w,64,0,'rgba(5,12,28,.85)');ctx.save();ctx.beginPath();ctx.rect(x,y+63,w,1);ctx.fillStyle=LINE;ctx.fill();ctx.restore();
 const lw=118;ctx.drawImage(IMG.word,x+28,y+16,lw,lw*882/3372);ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(x+164,y+18,1,28);txt('Market',x+180,y+30,{size:16,weight:600});txt(sub||'RUTE · BANDWIDTH · DATA CENTER',x+180,y+50,{size:11,weight:500,ls:2.2,c:MU,fam:MONO});
 let rx=x+w-24;right.slice().reverse().forEach(s=>{const bw=mw(s,15,600)+30;rx-=bw;fillR(rx,y+16,bw,34,9,s==='Keranjang'?BL:'rgba(255,255,255,.07)');txt(s,rx+bw/2,y+38,{size:15,weight:600,align:'center'});rx-=10})}
function label(s,x,y,c=MU){txt(s.toUpperCase(),x,y,{size:12,weight:500,ls:1.8,c,fam:MONO})}
function field(x,y,w,lab,val,p,o={}){label(lab,x,y);const h=o.h||54;const foc=p>0&&p<1.25;fillR(x,y+12,w,h,11,FLD);strokeR(x,y+12,w,h,11,foc?BL2:LINE2,foc?1.6:1);
 if(foc){ctx.save();ctx.shadowColor='rgba(59,123,240,.45)';ctx.shadowBlur=16;strokeR(x,y+12,w,h,11,'rgba(59,123,240,.6)',1);ctx.restore()}
 const n=Math.floor(clamp(p)*val.length);const s=val.slice(0,n);txt(s,x+18,y+12+h/2+7,{size:o.size||20,weight:400});if(foc&&Math.floor(T*3)%2===0)fillR(x+20+mw(s,o.size||20,400),y+12+h/2-12,2,24,1,LB)}
function btn(x,y,w,h,s,o={}){const {kind='primary',press=0,size=18,a=1}=o;if(a<=0)return;const d=press*3;ctx.save();ctx.globalAlpha*=a;
 if(kind==='primary'){ctx.shadowColor='rgba(46,107,219,.5)';ctx.shadowBlur=24*(1-press*.5);const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#3B7BF0');g.addColorStop(1,'#2A62CF');ctx.fillStyle=g;rr(x,y+d,w,h,11);ctx.fill();ctx.restore();txt(s,x+w/2,y+d+h/2+size*.36,{size,weight:600,align:'center',a})}
 else{ctx.restore();fillR(x,y+d,w,h,11,'rgba(255,255,255,.06)',a);strokeR(x,y+d,w,h,11,LINE2,1,a);txt(s,x+w/2,y+d+h/2+size*.36,{size,weight:600,align:'center',a})}}
function chip(x,y,s,on,o={}){const size=o.size||15,h=o.h||36;const w=mw(s,size,600)+30;if(on){fillR(x,y,w,h,h/2,'rgba(46,107,219,.28)');strokeR(x,y,w,h,h/2,BL2,1.2)}else{fillR(x,y,w,h,h/2,'rgba(255,255,255,.04)');strokeR(x,y,w,h,h/2,LINE2,1)}txt(s,x+w/2,y+h/2+size*.36,{size,weight:600,align:'center',c:on?'#fff':ICEB});return w}
function pillS(x,y,s,o={}){const size=o.size||13,h=o.h||26;const w=mw(s,size,600,o.ls||0)+22;fillR(x,y,w,h,h/2,o.bg||'rgba(255,255,255,.07)');txt(s,x+w/2,y+h/2+size*.36,{size,weight:600,align:'center',c:o.c||ICEB,ls:o.ls||0});return w}
function checkbox(x,y,on,k=1){if(on){fillR(x,y,24,24,6,BL);tick(x+12,y+12,14,'#fff',2.6,k)}else strokeR(x,y,24,24,6,LINE2,1.4)}
function toast(s,t0,t1,y=96){const k=E.back(prog(T,t0,t0+.4))*(1-E.io(prog(T,t1,t1+.35)));if(k<=0)return;const w=mw(s,19,600)+92;ctx.save();ctx.translate(W/2,y);ctx.scale(k,k);ctx.globalAlpha*=clamp(k);
 ctx.shadowColor='rgba(60,203,133,.35)';ctx.shadowBlur=30;fillR(-w/2,-28,w,56,28,'#0d2a22');ctx.shadowBlur=0;strokeR(-w/2,-28,w,56,28,'rgba(60,203,133,.5)',1.2);circ(-w/2+30,0,13,OK);tick(-w/2+30,0,12,'#06140e',2.6,1);txt(s,-w/2+56,7,{size:19,weight:600});ctx.restore()}
/* ===== cinematic overlays ===== */
const GRAIN=(()=>{const g=document.createElement('canvas');g.width=g.height=256;const c=g.getContext('2d');const d=c.createImageData(256,256);const r=mulberry(99);for(let i=0;i<d.data.length;i+=4){const v=r()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}c.putImageData(d,0,0);return g})();
function finish(){ctx.setTransform(1,0,0,1,0,0);ctx.save();ctx.globalAlpha=.045;ctx.globalCompositeOperation='overlay';const r=mulberry(Math.floor(T*24));const ox=-r()*256,oy=-r()*256;for(let x=ox;x<W;x+=256)for(let y=oy;y<H;y+=256)ctx.drawImage(GRAIN,x,y);ctx.restore();
 const vg=ctx.createRadialGradient(W/2,H/2,H*.38,W/2,H/2,H*1.0);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.55)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H)}
function fade(a,c='#000'){if(a<=0)return;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=clamp(a);ctx.fillStyle=c;ctx.fillRect(0,0,W,H);ctx.restore()}
function streak(x,y,w,a){if(a<=0)return;ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=a;const g=ctx.createLinearGradient(x-w,0,x+w,0);g.addColorStop(0,'rgba(111,163,255,0)');g.addColorStop(.5,'rgba(190,215,255,.9)');g.addColorStop(1,'rgba(111,163,255,0)');ctx.fillStyle=g;ctx.fillRect(x-w,y-1.5,2*w,3);
 const g2=ctx.createRadialGradient(x,y,0,x,y,140);g2.addColorStop(0,'rgba(200,225,255,.55)');g2.addColorStop(1,'rgba(111,163,255,0)');ctx.fillStyle=g2;ctx.fillRect(x-140,y-140,280,280);ctx.restore()}
/* ambient backdrop for UI scenes */
function stage(t,o={}){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=BK;ctx.fillRect(0,0,W,H);const g=ctx.createRadialGradient(W*.5,H*.62,50,W*.5,H*.62,W*.75);g.addColorStop(0,'rgba(22,57,122,.55)');g.addColorStop(.5,'rgba(10,27,61,.35)');g.addColorStop(1,'rgba(1,3,9,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(-60,H*.92);ctx.bezierCurveTo(W*.3,H*.55,W*.6,H*.42,W+80,H*.36);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.035)';ctx.beginPath();ctx.moveTo(-60,H*1.02);ctx.bezierCurveTo(W*.35,H*.7,W*.62,H*.6,W+80,H*.55);ctx.stroke();
 ctx.restore();stars(.25*(o.stars==null?1:o.stars),T*.02)}
/* caption (lower-left, Starlink-like) */
function caption(idx,head,sub,t,t0,t1){const a=Math.min(prog(t,t0,t0+.5),1-prog(t,t1-.4,t1));if(a<=0)return;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=a;
 txt(idx,96,H-118,{size:13,weight:500,ls:3,c:LB,fam:MONO});fillR(96,H-104,lerp(0,46,E.out(prog(t,t0,t0+.8))),2,1,LB);txt(head,96,H-66,{size:30,weight:300,ls:.5});if(sub)txt(sub,96,H-36,{size:16,weight:400,c:MU});ctx.restore()}
