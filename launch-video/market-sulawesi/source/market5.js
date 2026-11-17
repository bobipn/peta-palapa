/* ================= C-Ring Market launch film — Sulawesi customers (market only, no prices, no URLs) ================= */
/* ---- spiral orb cursor (replaces the mascot) ---- */
function orb(x,y,o={}){const {press=0,s=1,a=1}=o;if(a<=0)return;const k=s*(1-.16*press);ctx.save();ctx.translate(x,y);ctx.globalAlpha*=a;
 ctx.fillStyle='rgba(8,22,51,.22)';ctx.beginPath();ctx.arc(3*k,6*k,24*k,0,2*PI);ctx.fill();ctx.scale(k,k);
 const g=ctx.createRadialGradient(-7,-9,2,0,0,25);g.addColorStop(0,'#3569D1');g.addColorStop(1,'#0B1C3E');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,23,0,2*PI);ctx.fill();
 ctx.strokeStyle='#fff';ctx.lineCap='round';const rot=T*2.4;ctx.lineWidth=2.6;ctx.beginPath();for(let i=0;i<=70;i++){const u=i/70,an=rot+u*PI*3.4,r=1.5+u*14.5;const px=Math.cos(an)*r,py=Math.sin(an)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.stroke();
 ctx.strokeStyle='rgba(111,163,255,.95)';ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(0,0,23,0,2*PI);ctx.stroke();ctx.restore()}
/* keys: [t,x,y,click] in scene time. Moves take .45s (ease), then the orb dwells. */
function orbPath(keys,t){let x=keys[0][1],y=keys[0][2],press=0,px=x,py=y;for(let i=0;i<keys.length;i++){const [ti,xi,yi,cl]=keys[i];if(t<ti){if(i>0){const [t0,x0,y0]=keys[i-1];const d=Math.min(.45,ti-t0);const f=E.io(prog(t,ti-d,ti));x=lerp(x0,xi,f);y=lerp(y0,yi,f)}break}x=xi;y=yi;if(cl){const k=prog(t,ti,ti+.22);if(k>0&&k<1)press=Math.sin(k*PI)}}
 return {x,y,press}}
function orbClicks(keys,t,c=OR){keys.forEach(([ti,x,y,cl])=>{if(!cl)return;const k=prog(t,ti,ti+.5);if(k<=0||k>=1)return;ctx.save();ctx.strokeStyle=c;ctx.globalAlpha=(1-k)*.9;ctx.lineWidth=3*(1-k)+1;ctx.beginPath();ctx.arc(x,y,24+70*E.out(k),0,2*PI);ctx.stroke();ctx.restore()})}
function drawOrb(keys,t,o={}){orbClicks(keys,t,o.c);const p=orbPath(keys,t);orb(p.x,p.y,{press:p.press,a:o.a==null?1:o.a});return p}
/* ---- geography (approximate waypoints, named after the route returned by the market) ---- */
const SUL={mks:[-5.14,119.42],plp:[-2.99,120.2],ttn:[-1.77,120.65],palu:[-0.9,119.87],kdi:[-3.97,122.51],bau:[-5.47,122.6],gto:[0.54,123.06],mdo:[1.48,124.84],mmj:[-2.68,118.89],lwk:[-0.95,122.79]};
const R_TTN=[[-5.14,119.42],[-5.08,119.47],[-5.0,119.57],[-4.42,119.62],[-3.95,119.78],[-3.79,119.65],[-3.05,119.86],[-2.99,120.2],[-2.45,120.75],[-2.08,120.68],[-1.77,120.65]];
const R_MDO=[[-5.14,119.42],[-5.0,119.57],[-4.42,119.62],[-3.95,119.78],[-3.79,119.65],[-3.6,119.4],[-3.42,119.33],[-2.27,119.32],[-0.9,119.87],[-0.68,119.74],[1.04,120.81],[0.5,122.35],[0.66,122.88],[0.84,122.92],[0.9,123.38],[0.87,124.02],[1.12,124.5],[1.08,124.75],[1.3,124.91],[1.42,124.98],[1.48,124.84]];
const VIA_TTN='IDC Makassar · Makassar → Lantebung → Maros → Barru → Sidenreng → Pinrang → Getengan → Palopo → Wonorejo → Pendolo → TBG SANGELE · Tentena';
const VIA_MDO='IDC Makassar · Makassar → Lantebung → Maros → Barru → Sidenreng → Pinrang → Lampa → Polewali → Tobadak → Palu → Donggala → Tinabogan → Tilamuta → Molobulahe → Isimu → Kwandang → Boroko → Pimpi → Lolak → Bolaang → Tenga → Ratahan → Tondano → Airmadidi → Laikit → neuCentrIX Manado · Manado';
function wrapTxt(s,x,y,maxW,size,o={}){const lh=o.lh||size*1.45;const words=s.split(' ');let line='',yy=y,n=0;words.forEach(wd=>{const tst=line?line+' '+wd:wd;if(mw(tst,size,o.weight||500)>maxW){txt(line,x,yy,Object.assign({size},o));line=wd;yy+=lh;n++}else line=tst});if(line){txt(line,x,yy,Object.assign({size},o));n++}return n*lh}
function sulMap(R,P,o={}){const {prt=1,bg='#0A1A3A',land='#16294F',edge='#2A4475',route='#3D5C93'}=o;ctx.save();fillP(rrect(R[0],R[1],R[2],R[3],o.r==null?18:o.r),bg);ctx.beginPath();ctx.rect(R[0],R[1],R[2],R[3]);ctx.clip();
 LAND.forEach(pl=>{const pts=pl.map(q=>[P.x(q[1]),P.y(q[0])]);fillP(pts,land);sk(pts,{closed:true,w:1.4,c:edge,passes:1,step:24})});
 if(prt>0)ROUTES.forEach(r=>sk(r.p.map(q=>[P.x(q[1]),P.y(q[0])]),{p:prt,w:r.t==='i'?3:2,c:route,passes:1,step:12,dash:r.t==='i'?null:[8,7]}));
 if(o.extra)o.extra();ctx.restore()}
function city(P,k,label,a,side='r',c='#fff'){const q=LL(P,SUL[k]);if(a<=0)return q;ctx.save();ctx.globalAlpha*=a;fillP(ell(q[0],q[1],7,7),LB);ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q[0],q[1],7,0,2*PI);ctx.stroke();
 txt(label,side==='r'?q[0]+14:q[0]-14,q[1]+7,{size:20,weight:700,c,align:side==='r'?'left':'right'});ctx.restore();return q}
function seg2(x,y,w,h,items,sel,size=22){fillP(rrect(x,y,w,h,12),'#EEF2F8');const cw=w/items.length;items.forEach((s,i)=>{if(i===sel)fillP(rrect(x+cw*i+5,y+5,cw-10,h-10,10),NAVY);txt(s,x+cw*i+cw/2,y+h/2+size*.36,{size,weight:800,c:i===sel?'#fff':INK,align:'center'})})}
function pill(x,y,s,o={}){const size=o.size||17,h=o.h||34;const w=mw(s,size,700)+28;fillP(rrect(x,y,w,h,h/2),o.bg||'#EEF2F8');txt(s,x+w/2,y+h/2+size*.36,{size,weight:700,c:o.c||INK,align:'center'});return w}
function softIn(t,d=.3){const k=1-E.out(prog(t,0,d));if(k<=0)return;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=`rgba(241,244,249,${k})`;ctx.fillRect(0,0,W,H);ctx.restore()}
function swipe(tb){const a=prog(T,tb-.32,tb),b=prog(T,tb,tb+.36);if(a<=0||b>=1)return;ctx.save();ctx.setTransform(1,0,0,1,0,0);const x0=b>0?lerp(-200,W+200,E.io(b)):-200,x1=b>0?W+400:lerp(-200,W+400,E.io(a));
 ctx.fillStyle=NAVY;ctx.beginPath();ctx.moveTo(x0,0);ctx.lineTo(x1,0);ctx.lineTo(x1-200,H);ctx.lineTo(x0-200,H);ctx.closePath();ctx.fill();
 ctx.strokeStyle=LB;ctx.lineWidth=4;ctx.beginPath();const ex=b>0?x0:x1;ctx.moveTo(ex,0);ctx.lineTo(ex-200,H);ctx.stroke();ctx.restore()}
/* ---- app chrome of the market (top bar + panel) ---- */
function appFrame(sub,o={}){box(FX,FY,FW,FH,{r:26,shadow:true,p:o.p==null?1:o.p});if((o.p==null?1:o.p)<.4)return;crTop(sub,null,[['','moon'],['Untuk Cable Owner','dark'],['Akun','dark'],['Modul','dark']])}
function tabs(x,y,act){[['Hasil pencarian',0],['Pesanan saya',1],['Cara kerja',2]].forEach(([s,i])=>{const w=mw(s,18,800)+34,xx=x+[0,196,360][i];if(i===act)fillP(rrect(xx,y,w,44,11),NAVY);else{fillP(rrect(xx,y,w,44,11),'#fff');sk(rrect(xx,y,w,44,11),{closed:true,w:2,c:LINE,passes:1})}txt(s,xx+w/2,y+29,{size:18,weight:800,c:i===act?'#fff':INK,align:'center'})})}
/* 0.0–4.0 : intro — the orb draws the C-RING wordmark */
function m0Intro(t){cam(1+t*.012,W/2,H/2);
 const lw=980,lx=(W-lw)/2,ly=330;const lp=E.io(prog(t,.7,1.9));logo(lx,ly,lw,NAVY,lp);const lh=lw*520/2121;
 const ox=t<.7?lerp(W/2,lx,E.io(prog(t,.25,.7))):lx+lw*lp;const oy=t<.7?lerp(H/2+40,ly+lh*.55,E.io(prog(t,.25,.7))):ly+lh*.55-Math.sin(lp*PI)*30;
 const ap=E.back(prog(t,0,.35));if(t<2.1)orb(ox,oy,{s:ap*1.4});else orb(lerp(lx+lw,lx+lw+80,E.out(prog(t,2.1,2.5))),lerp(ly+lh*.55,ly+lh+150,E.out(prog(t,2.1,2.5))),{s:1.4*(1-.3*prog(t,2.1,2.5)),a:1-prog(t,3.2,3.6)});
 tagline(W/2,ly+lh+70,30,NAVY,prog(t,1.8,2.2));
 const k=prog(t,2.2,2.6);if(k>0){txt('MARKET',W/2,ly-50,{size:26,weight:700,c:OR2,align:'center',ls:16,a:k})}
 txt('Marketplace konektivitas untuk pelanggan Sulawesi',W/2,ly+lh+150,{size:36,weight:500,c:INK,align:'center',a:E.out(prog(t,2.5,2.95))});
}
/* 4.0–8.0 : Sulawesi network — promise */
const PS=(()=>{const R=[860,40,1020,1000];const s=R[3]/8.6;return {R,P:{x:lon=>R[0]+60+(lon-118.4)*s,y:lat=>R[1]+(2.5-lat)*s}}})();
function m1Map(t){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#081633';ctx.fillRect(0,0,W,H);ctx.restore();cam(lerp(1.06,1,E.out(prog(t,0,1.5))),W/2,H/2);
 const {R,P}=PS;sulMap([0,0,W,H],P,{bg:'#081633',land:'#14264B',edge:'#253F6E',route:'#3D5C93',prt:E.out(prog(t,.1,1.3)),r:0,extra:()=>{
  const p1=crs(R_TTN.map(c=>LL(P,c)),10),p2=crs(R_MDO.map(c=>LL(P,c)),10);sk(p2,{p:E.io(prog(t,1.2,2.6)),w:5,c:LB,passes:1,step:8});sk(p1,{p:E.io(prog(t,1.0,1.9)),w:5,c:'#fff',passes:1,step:8});
  [['mks','Makassar','l'],['plp','Palopo','r'],['ttn','Tentena','r'],['palu','Palu','l'],['kdi','Kendari','r'],['bau','Bau-Bau','r'],['gto','Gorontalo','r'],['mdo','Manado','r'],['lwk','Luwuk','r']].forEach(([k,n,s],i)=>city(P,k,n,prog(t,.5+i*.08,.7+i*.08),s))}});
 txt('C-RING MARKET',120,330,{size:20,fam:MONO,weight:500,c:LB,a:prog(t,.2,.4)});
 txt('Link antar-kota Sulawesi,',120,410,{size:64,weight:800,c:'#fff',p:E.out(prog(t,.3,.8))});txt('dalam satu pesanan.',120,488,{size:64,weight:800,c:LB,p:E.out(prog(t,.55,1.05))});
 txt('Pilih titik A dan B, bandingkan rute, pesan,',120,566,{size:26,weight:500,c:'#C9D4E8',a:prog(t,1.0,1.3)});txt('lalu pantau sampai layanan aktif.',120,604,{size:26,weight:500,c:'#C9D4E8',a:prog(t,1.0,1.3)});
 let px=120;['Leased line 1G','Leased line 10G'].forEach((s,i)=>{const a=prog(t,1.5+i*.15,1.7+i*.15);if(a>0){ctx.save();ctx.globalAlpha*=a;px+=pill(px,660,s,{bg:'#1E3466',c:'#fff',size:20,h:42})+12;ctx.restore()}});
 const mk=LL(P,SUL.mks),md=LL(P,SUL.mdo),tt=LL(P,SUL.ttn);drawOrb([[0,W/2,H+80],[1.0,mk[0]+40,mk[1]-30],[1.8,tt[0]+40,tt[1]-30],[2.8,md[0]+40,md[1]-30]],t,{c:LB});
}
/* 8.0–12.5 : search form (Marketplace A→B), 1G */
function m2Search(t){cam(lerp(1.02,1,E.out(prog(t,0,1))),W/2,H/2);appFrame('Marketplace Konektivitas',{p:E.out(prog(t,0,.2))});if(t<.12)return;
 const X=FX+120,Wd=FW-240,Y=FY+110;fillP(rrect(X,Y,Wd,650,24),NAVY);
 txt('Link dari kota mana pun ke kota mana pun, dalam satu pesanan',X+36,Y+64,{size:36,weight:800,c:'#fff'});
 txt('Pilih titik A dan B. Sistem merangkai ruas kabel dari cable owner dan menghitung rutenya.',X+36,Y+104,{size:20,weight:500,c:'#C9D4E8'});
 const F=[X+24,Y+132,Wd-48,494];fillP(rrect(F[0],F[1],F[2],F[3],18),'#fff');const fx=F[0]+28,fw=F[2]-56,half=(fw-80)/2;
 const fa=prog(t,.7,1.05),fb=prog(t,1.45,1.75);field(fx,F[1]+28,half,'Dari','Makassar',fa);field(fx+half+80,F[1]+28,half,'Ke','Tentena',fb);
 sk(rrect(fx+half+14,F[1]+42,52,62,12),{closed:true,w:2,c:LINE,passes:1});sk([[fx+half+34,F[1]+60],[fx+half+34,F[1]+86]],{w:2.5,passes:1});sk([[fx+half+46,F[1]+60],[fx+half+46,F[1]+86]],{w:2.5,passes:1});
 if(t>.95&&t<1.25){fillP(rrect(fx,F[1]+98,half,50,10),'#fff');sk(rrect(fx,F[1]+98,half,50,10),{closed:true,w:2,c:OR,passes:1});txt('Makassar · IDC Makassar',fx+18,F[1]+130,{size:19,weight:700})}
 if(t>1.65&&t<1.95){const bx=fx+half+80;fillP(rrect(bx,F[1]+98,half,50,10),'#fff');sk(rrect(bx,F[1]+98,half,50,10),{closed:true,w:2,c:OR,passes:1});txt('Tentena · TBG SANGELE',bx+18,F[1]+130,{size:19,weight:700})}
 lab('LAYANAN',fx,F[1]+176);seg2(fx,F[1]+190,560,58,['Leased line','Sewa core'],t>2.05?0:-1,20);
 lab('KAPASITAS',fx+620,F[1]+176);seg2(fx+620,F[1]+190,300,58,['1G','10G'],t>2.5?0:-1,22);
 lab('KONTRAK',fx+980,F[1]+176);seg2(fx+980,F[1]+190,fw-980,58,['12 bln','24 bln','36 bln'],t>2.9?0:-1,20);
 lab('URUTKAN',fx,F[1]+284);seg2(fx,F[1]+298,fw,54,['Termurah','Terpendek','Tercepat aktif'],0,20);
 btn(fx,F[1]+386,fw,70,'Cari link',{dark:false,size:26,press:0,icon:'search'});
 tabs(X,Y+680,0);txt('Masukkan asal dan tujuan, lalu tekan Cari link.',X+560,Y+709,{size:20,weight:500,c:GREY});
 drawOrb([[0,1700,980],[.55,fx+220,F[1]+73,1],[1.3,fx+half+300,F[1]+73,1],[1.95,fx+140,F[1]+219,1],[2.4,fx+620+75,F[1]+219,1],[2.8,fx+980+90,F[1]+219,1],[3.5,fx+fw/2,F[1]+421,1],[4.2,fx+fw/2+60,F[1]+460]],t);
 softIn(t,.2);
}
/* result view shared by 12.5–17.5 (Tentena, 1G) and 17.5–21.5 (Manado, 10G) */
function resultView(t,st){appFrame('Marketplace Konektivitas');
 const R=[FX+24,FY+104,820,FH-128];const P=mapP(R,118.4,2.3,7.9);
 const pth=crs((st.dest==='mdo'?R_MDO:R_TTN).map(c=>LL(P,c)),10);const old=st.prev?crs(R_TTN.map(c=>LL(P,c)),10):null;
 sulMap(R,P,{extra:()=>{if(old)sk(old,{w:6,c:'#fff',passes:1,step:8,a:1-st.swap});sk(pth,{p:st.route,w:7,c:st.dest==='mdo'?LB:'#fff',passes:1,step:8});
  city(P,'mks','Makassar',1,'r');city(P,st.dest,st.dest==='mdo'?'Manado':'Tentena',E.out(prog(st.route,.85,1)),st.dest==='mdo'?'l':'r');
  if(st.route>=1&&st.flow)packets(pth,st.flow,3,.7,6)}});
 const cx=FX+870,cw=FW-894;const sy=FY+104;fillP(rrect(cx,sy,cw,64,14),'#EEF2F8');
 txt('Makassar',cx+24,sy+41,{size:21,weight:800});txt('→',cx+136,sy+41,{size:21,weight:800,c:GREY});txt(st.dest==='mdo'?'Manado':'Tentena',cx+170,sy+41,{size:21,weight:800,c:st.dest==='mdo'?OR2:INK});
 seg2(cx+cw-330,sy+8,200,48,['1G','10G'],st.bw,19);fillP(rrect(cx+cw-118,sy+8,106,48,10),OR);txt('Cari',cx+cw-65,sy+40,{size:19,weight:800,c:'#fff',align:'center'});
 const ca=st.card;if(ca<=0)return {cx,cw,sy};ctx.save();ctx.globalAlpha*=ca;ctx.translate(lerp(60,0,E.out(ca)),0);
 const y0=sy+86;txt(`4 pilihan rute  ·  Leased line ${st.bw?'10G':'1G'}  ·  12 bulan`,cx,y0+22,{size:19,weight:600,c:GREY});
 const cy=y0+44;box(cx,cy,cw,600,{r:18,c:OR,w:3,shadow:false});
 let tx=cx+24;['Termurah','Tercepat aktif','SLA tertinggi','Terpendek'].forEach(s=>{tx+=pill(tx,cy+22,s,{bg:SOFT,c:OR2,size:15,h:30})+8});
 txt('1 vendor · 1 ruas',cx+24,cy+98,{size:30,weight:800});
 const vh=wrapTxt(st.dest==='mdo'?VIA_MDO:VIA_TTN,cx+24,cy+140,cw-48,17,{c:'#33415C',weight:500,lh:25});
 const chips=st.dest==='mdo'?['2.034 km','SLA ±99%','Aktif ±3 hari','darat 1.816 km · laut 218 km']:['719 km','SLA ±99%','Aktif ±3 hari','darat 713 km · laut 6 km'];
 let chx=cx+24,chy=cy+140+vh+6;chips.forEach(s=>{const w=mw(s,18,700)+30;if(chx+w>cx+cw-20){chx=cx+24;chy+=46}sk(rrect(chx,chy,w,38,10),{closed:true,w:2,c:LINE,passes:1});txt(s,chx+w/2,chy+26,{size:18,weight:800,align:'center'});chx+=w+10});
 const ty=chy+64;sk([[cx+24,ty],[cx+cw-24,ty]],{w:1.5,c:LINE,passes:1});txt('KOMPONEN',cx+24,ty+30,{size:14,fam:MONO,weight:500,c:GREY});txt('VENDOR',cx+cw-140,ty+30,{size:14,fam:MONO,weight:500,c:GREY});
 txt(st.dest==='mdo'?'Ruas Makassar → Manado · darat + laut':'Ruas Makassar → Tentena · darat',cx+24,ty+68,{size:19,weight:600});txt('Vendor A',cx+cw-140,ty+68,{size:19,weight:800,c:NAVY});
 btn(cx+24,cy+600-88,360,62,'Pesan rute ini',{dark:false,size:22,press:st.press||0});ctx.restore();return {cx,cw,sy,cy}}
function m3Result(t){cam(1+t*.006,W/2,H/2);const L=resultView(t,{dest:'ttn',bw:0,route:E.io(prog(t,.2,1.6)),card:prog(t,.5,1.0),flow:12.5+1.6});
 drawOrb([[0,960,900],[.8,560,500],[1.8,1100,560],[3.0,L.cx+200,L.cy+120],[4.2,L.cx+180,L.cy+560]],t);softIn(t,.2)}
function m4Switch(t){cam(1.006*(1+t*.006),W/2,H/2);const sw=E.io(prog(t,1.4,1.8));const L0={cx:FX+870,cw:FW-894,sy:FY+104};
 const mdo=t>1.2;const L=resultView(t,{dest:mdo?'mdo':'ttn',prev:mdo,swap:sw,bw:t>.55?1:0,route:mdo?E.io(prog(t,1.5,2.7)):1,card:mdo?prog(t,1.6,2.0):1-prog(t,1.0,1.2),flow:17.5+2.7,press:t>3.5&&t<3.7?1:0});
 if(t>.75&&t<1.35){const k=prog(t,.75,1.0);fillP(rrect(L0.cx+150,L0.sy+6,200,52,10),'#fff',{a:k});sk(rrect(L0.cx+150,L0.sy+6,200,52,10),{closed:true,w:2,c:OR,passes:1,a:k});txt('Manado'.slice(0,Math.floor(prog(t,.85,1.15)*6)),L0.cx+166,L0.sy+41,{size:21,weight:800,a:k})}
 const keys=[[0,L0.cx+200,L0.sy+300],[.45,L0.cx+L0.cw-330+150,L0.sy+32,1],[.9,L0.cx+230,L0.sy+32,1],[1.3,L0.cx+L0.cw-65,L0.sy+32,1],[3.45,L0.cx+204,L0.sy+86+44+543,1],[3.9,L0.cx+220,L0.sy+86+44+560]];drawOrb(keys,t);
 const ck=E.out(prog(t,.2,.5))*(1-prog(t,3.2,3.5));if(ck>0)txt('1G atau 10G — sesuai kebutuhan',L0.cx+L0.cw/2,FY+FH-40,{size:24,weight:700,c:OR2,align:'center',a:ck});
}
/* 21.5–25.5 : order confirmation (real copy, prices removed) */
function m5Order(t){cam(1.012,W/2,H/2);resultView(t,{dest:'mdo',bw:1,route:1,card:1,flow:21.5});
 ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=`rgba(8,22,51,${.55*E.out(prog(t,0,.3))*(1-prog(t,2.55,2.85))})`;ctx.fillRect(0,0,W,H);ctx.restore();
 const mk=E.back(prog(t,.05,.4))*(1-E.io(prog(t,2.5,2.8)));if(mk>0){const mw2=980,mh=640,mx=(W-mw2)/2,my=(H-mh)/2;ctx.save();ctx.translate(W/2,H/2);ctx.scale(mk,mk);ctx.translate(-W/2,-H/2);
  box(mx,my,mw2,mh,{r:22,shadow:true});txt('Pesan link ini',mx+40,my+66,{size:34,weight:800});
  wrapTxt('IDC Makassar · Makassar → Maros → Barru → Pinrang → Polewali → Palu → Tolitoli → Tilamuta → Kwandang → Tondano → neuCentrIX Manado · Manado',mx+40,my+108,mw2-80,18,{c:'#33415C',lh:26});
  fillP(rrect(mx+40,my+170,mw2-80,52,12),'#EEF2F8');txt('Leased line 10G  ·  12 bulan  ·  2.034 km  ·  SLA ±99%  ·  aktif ±3 hari',mx+60,my+204,{size:19,weight:800});
  fillP(rrect(mx+40,my+244,mw2-80,130,12),'#F6F8FC');wrapTxt('Vendor menerima pesanan dan mengonfirmasi dalam 24 jam, lalu aktivasi dimulai tanpa menunggu pembayaran. Invoice dan kontrak dikirim ke email Anda (PDF).',mx+60,my+284,mw2-120,20,{c:INK,weight:600,lh:30});
  lab('CATATAN UNTUK TIM (OPSIONAL)',mx+40,my+408);sk(rrect(mx+40,my+420,mw2-80,56,12),{closed:true,w:2,c:LINE,passes:1});txt('Target aktif awal bulan depan'.slice(0,Math.floor(prog(t,.55,1.05)*30)),mx+60,my+456,{size:19,weight:500});
  const ck=t>1.35;sk(rrect(mx+40,my+504,30,30,7),{closed:true,w:2.5,c:ck?OR:INK,passes:1});if(ck){fillP(rrect(mx+40,my+504,30,30,7),OR);checkMark(mx+55,my+520,22,E.out(prog(t,1.35,1.5)),'#fff',4)}txt('Saya menyetujui Syarat Layanan',mx+84,my+528,{size:20,weight:600});
  fillP(rrect(mx+mw2-440,my+mh-84,170,56,12),'#fff');sk(rrect(mx+mw2-440,my+mh-84,170,56,12),{closed:true,w:2,c:LINE,passes:1});txt('Batal',mx+mw2-355,my+mh-48,{size:20,weight:800,align:'center'});
  btn(mx+mw2-250,my+mh-84,210,56,'Kirim pesanan',{dark:false,size:20,press:t>2.05&&t<2.25?1:0});ctx.restore()}
 const tk=E.back(prog(t,2.85,3.1));if(tk>0){ctx.save();ctx.translate(W/2,140);ctx.scale(tk,tk);fillP(rrect(-250,-40,500,80,40),'#1D8348');checkMark(-200,0,30,1,'#fff',6);txt('Pesanan diajukan',20,11,{size:30,weight:800,c:'#fff',align:'center'});ctx.restore()}
 const mx=(W-980)/2,my=(H-640)/2;drawOrb([[0,W/2+200,H/2+300],[.6,mx+300,my+448],[1.3,mx+55,my+519,1],[2.0,mx+980-145,my+640-56,1],[2.9,mx+980-120,my+640+40]],t);
}
/* 25.5–31.5 : order tracker until the link is active (no billing step shown) */
const TRK2=['Dipesan','Vendor konfirmasi 1/1','Aktivasi 1/1','Aktif'];
function m6Track(t){cam(1+t*.006,W/2,H/2);appFrame('Marketplace Konektivitas');
 const X=FX+60,Wd=FW-120;tabs(X,FY+110,1);fillP(ell(X+700,FY+132,7,7),'#1D8348');txt('Status diperbarui otomatis tiap 30 detik',X+716,FY+139,{size:18,weight:600,c:GREY});
 const Y=FY+176;const tt=[.3,1.5,2.9,4.3];const done=i=>t>=tt[i];box(X,Y,Wd,FH-200,{r:20,shadow:false,c:done(3)?OR:LINE,w:done(3)?3:2});
 txt('IDC Makassar · Makassar  →  neuCentrIX Manado · Manado',X+36,Y+58,{size:28,weight:800});txt('Leased line 10G  ·  12 bulan  ·  2.034 km',X+36,Y+94,{size:20,weight:500,c:GREY});
 const st=done(3)?'AKTIF':done(2)?'AKTIVASI':done(1)?'DIKONFIRMASI':'DIPESAN';const sw=mw(st,16,800)+34;fillP(rrect(X+Wd-36-sw,Y+34,sw,36,18),done(3)?'#E3F5EC':SOFT);txt(st,X+Wd-36-sw/2,Y+58,{size:16,weight:800,c:done(3)?'#1D8348':OR2,align:'center'});
 const sx0=X+120,sx1=X+Wd*.55,sy=Y+190;sk([[sx0,sy],[sx1,sy]],{w:6,c:'#E2E6EE',passes:1});let fx=sx0;
 TRK2.forEach((s,i)=>{const x=lerp(sx0,sx1,i/3);if(i>0){const k=E.io(prog(t,tt[i]-.9,tt[i]));if(k>0){const a=lerp(sx0,sx1,(i-1)/3);sk([[a,sy],[lerp(a,x,k),sy]],{w:6,c:'#1D8348',passes:1});fx=lerp(a,x,k)}}
  const d=done(i);const kk=E.back(prog(t,tt[i],tt[i]+.25));fillP(ell(x,sy,17,17),d?'#1D8348':'#fff');ctx.save();ctx.strokeStyle=d?'#1D8348':LINE;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,sy,17,0,2*PI);ctx.stroke();ctx.restore();if(d)checkMark(x,sy+2,18*kk,1,'#fff',4);
  wrapTxt(s,x-80,sy+52,160,18,{weight:800,c:d?'#1D8348':GREY,align:'left',lh:24})});
 txt('Vendor A',X+36,Y+330,{size:22,weight:800});sk([[X+36,Y+352],[X+Wd*.55,Y+352]],{w:1.5,c:LINE,passes:1});
 const vs=done(3)?['Ruas aktif','#E3F5EC','#1D8348']:done(1)?['Terkonfirmasi',SOFT,OR2]:null;if(vs){pill(X+Wd*.55-150,Y+308,vs[0],{bg:vs[1],c:vs[2],size:16,h:32})}
 txt('Aktivasi dimulai tanpa menunggu pembayaran.',X+36,Y+420,{size:22,weight:700,c:OR2,a:prog(t,1.6,2.0)});
 let bx=X+36;['Ubah bandwidth','Perpanjang','Lapor gangguan','Kontrak'].forEach(s=>{const w=mw(s,18,800)+34;fillP(rrect(bx,Y+FH-300,w,52,12),'#fff');sk(rrect(bx,Y+FH-300,w,52,12),{closed:true,w:2,c:LINE,passes:1});txt(s,bx+w/2,Y+FH-266,{size:18,weight:800,c:OR2,align:'center'});bx+=w+12});
 const R=[X+Wd*.6,Y+24,Wd*.4-24,FH-248];const P=mapP(R,118.5,2.2,7.2);const pth=crs(R_MDO.map(c=>LL(P,c)),10);const lit=done(3)?1:t<tt[1]?0:prog(t,tt[1],tt[3]);
 sulMap(R,P,{extra:()=>{sk(pth,{w:6,c:'#3D5C93',passes:1,step:8,dash:[10,8]});sk(pth,{p:lit,w:6,c:LB,passes:1,step:8});if(done(3))packets(pth,25.5+tt[3],4,.8,6);city(P,'mks','Makassar',1);city(P,'mdo','Manado',1,'l');
  if(done(3)){const q=LL(P,SUL.mdo);const k=(T*.9)%1;ctx.save();ctx.strokeStyle=LB;ctx.globalAlpha=1-k;ctx.lineWidth=3;ctx.beginPath();ctx.arc(q[0],q[1],10+40*k,0,2*PI);ctx.stroke();ctx.restore()}}});
 drawOrb([[0,W/2,H+60],[.8,lerp(sx0,sx1,1/3),sy-50],[2.2,lerp(sx0,sx1,2/3),sy-50],[3.6,sx1,sy-50],[4.8,X+Wd*.8,Y+300],[5.5,X+Wd*.8,Y+320]],t);softIn(t,.2);
}
/* 31.5–35.5 : documents issued automatically (no invoice, no amounts) */
const DOCS2=[['Kontrak','ditandatangani sistem & pelanggan'],['Service Order Form','diterbitkan sistem'],['Berita Acara Aktivasi','diterbitkan sistem'],['Berita Acara Serah Terima','diterbitkan sistem']];
function m7Docs(t){cam(1+t*.01,W/2,H/2);
 txt('Dokumen terbit otomatis',W/2,190,{size:58,weight:800,align:'center',p:E.out(prog(t,0,.4))});txt('Tersimpan di portal, siap diunduh kapan saja.',W/2,248,{size:26,weight:500,c:GREY,align:'center',a:prog(t,.25,.5)});
 DOCS2.forEach(([h,s],i)=>{const k=E.back(prog(t,.3+i*.16,.6+i*.16));if(k<=0)return;const x=330+i*360,y=600;ctx.save();ctx.translate(x,y);ctx.rotate((i-1.5)*.03*(1-k*.5));ctx.scale(k,k);
  fillP(rrect(-138,-212,290,420,16),'rgba(13,33,80,.12)');fillP(rrect(-150,-224,290,420,16),'#fff');sk(rrect(-150,-224,290,420,16),{closed:true,w:2,c:LINE,passes:1});
  fillP(rrect(-150,-224,290,64,16),NAVY);ctx.drawImage(IMG.app_icon,-132,-212,40,40);txt('C-RING MARKET',-80,-184,{size:14,fam:MONO,weight:500,c:'#C9D4E8'});
  let ly=-118;const words=h.split(' ');let line='';words.forEach(wd=>{const tst=line?line+' '+wd:wd;if(mw(tst,24,800)>250){txt(line,-128,ly,{size:24,weight:800});line=wd;ly+=30}else line=tst});txt(line,-128,ly,{size:24,weight:800});
  for(let j=0;j<4;j++)ph(-128,ly+44+j*28,[230,200,220,150][j],'#DCE2EC',7);txt(s,-128,150,{size:15,weight:700,c:OR2});
  fillP(rrect(-128,168,120,30,8),'#EEF2F8');txt('Unduh PDF',-68,188,{size:14,weight:800,c:OR2,align:'center'});
  if(i===0){sk([[-110,120],[-92,104],[-74,122],[-56,106]],{w:3,c:NAVY,passes:1});sk([[0,120],[18,104],[34,122],[54,108]],{w:3,c:OR,passes:1})}ctx.restore()});
 drawOrb([[0,W/2,H+60],[1.2,330+80,600-160],[2.0,690+80,600-160],[2.8,330-68,600+182,1],[3.6,330-40,600+240]],t);softIn(t,.2);
}
/* 35.5–39.5 : Layanan Saya — active 10G service in the market portal (rail without NaaS) */
const RAIL_M=[['BERANDA',['Ringkasan']],['BELANJA',['Marketplace A→B']],['LAYANAN',['Layanan Saya','Tiket & Gangguan']],['DOKUMEN',['Kontrak & Penawaran']],['AKUN',['Perusahaan']]];
function m8Service(t){cam(1+t*.008,W/2,H/2);box(FX,FY,FW,FH,{r:26});crTop('Market','RUTE · BANDWIDTH · DATA CENTER',[['','moon'],['Akun','dark'],['Modul','dark']]);
 const rx=FX+4,rw=290;fillP(rrect(rx,FY+88,rw,FH-92,4),'#fff');sk([[rx+rw,FY+90],[rx+rw,FY+FH-6]],{w:2,c:LINE,passes:1});txt('MENU',rx+22,FY+128,{size:14,fam:MONO,weight:500,c:GREY});
 let y=FY+150;const act=t<.35?'Ringkasan':'Layanan Saya';RAIL_M.forEach(([g,items])=>{y+=26;txt(g,rx+22,y,{size:13,fam:MONO,weight:500,c:GREY});y+=12;items.forEach(n=>{const on=n===act;if(on){fillP(rrect(rx+10,y,rw-24,42,10),SOFT);fillP(rrect(rx+2,y+7,5,28,3),OR)}txt(n,rx+28,y+28,{size:19,weight:on?800:600,c:on?OR2:INK});y+=46})});
 const x0=rx+rw+30,w=700;box(x0,FY+110,w,130,{r:16,shadow:false,w:2});txt('Kepatuhan SLA bulan ini',x0+24,FY+152,{size:22,weight:800});txt('target per layanan · gangguan tercatat otomatis',x0+24,FY+182,{size:16,weight:500,c:GREY});
 const g=E.out(prog(t,.4,1.2));sk([[x0+24,FY+212],[x0+w-24,FY+212]],{w:12,c:'#E6E9F0',passes:1});if(g>0)sk([[x0+24,FY+212],[x0+24+(w-48)*g,FY+212]],{w:12,c:'#1D8348',passes:1});
 txt('Layanan Saya',x0,FY+290,{size:28,weight:800});box(x0,FY+310,w,560,{r:16,shadow:false,c:OR,w:3});
 txt('C-Ring Leased Line 10G',x0+28,FY+360,{size:28,weight:800});pill(x0+w-128,FY+334,'AKTIF',{bg:'#E3F5EC',c:'#1D8348',size:16,h:34});
 const sw=(w-56-30)/4;for(let i=0;i<4;i++){const sx=x0+28+i*(sw+10);fillP(rrect(sx,FY+396,sw,10,5),'#1D8348');txt(['Diajukan','Studi','Provisioning','Aktif'][i],i===0?sx:i===3?sx+sw:sx+sw/2,FY+430,{size:15,weight:600,c:GREY,align:i===0?'left':i===3?'right':'center'})}
 txt('IDC Makassar → … → neuCentrIX Manado · 2.034 km',x0+28,FY+476,{size:19,weight:600,c:'#33415C'});
 fillP(rrect(x0+28,FY+496,w-56,44,10),'#F5F7FB');txt('Marketplace · SLA rute · lacak per vendor · kontrak',x0+46,FY+525,{size:17,weight:600});
 let bx=x0+28,by=FY+566;['Laporan SLA','Ubah bandwidth','Perpanjang','Lapor gangguan','Dokumen'].forEach((s,i)=>{const bw=mw(s,17,800)+30;if(bx+bw>x0+w-24){bx=x0+28;by+=56}const a=prog(t,.5+i*.08,.65+i*.08);if(a>0){ctx.save();ctx.globalAlpha*=a;const hl=i===1&&t>2.6;fillP(rrect(bx,by,bw,46,11),hl?SOFT:'#fff');sk(rrect(bx,by,bw,46,11),{closed:true,w:2,c:hl?OR:LINE,passes:1});txt(s,bx+bw/2,by+30,{size:17,weight:800,align:'center',c:hl?OR2:INK});ctx.restore()}bx+=bw+10});
 const R=[x0+w+30,FY+88,FX+FW-(x0+w+30)-4,FH-92];const P=mapP(R,118.5,2.3,8.6);const pth=crs(R_MDO.map(c=>LL(P,c)),10);
 sulMap(R,P,{r:4,extra:()=>{sk(pth,{w:7,c:LB,passes:1,step:8});packets(pth,35.5,4,.8,6);city(P,'mks','Makassar',1);city(P,'mdo','Manado',1,'l');city(P,'ttn','Tentena',.75)}});
 drawOrb([[0,rx+120,FY+400],[.3,rx+120,FY+330,1],[1.4,x0+w-100,FY+212],[2.4,x0+200,FY+589]],t);softIn(t,.2);
}
/* 39.5–45.0 : end card */
function m9End(t){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#081633';ctx.fillRect(0,0,W,H);ctx.restore();cam(1+t*.01,W/2,H/2);
 const P={x:lon=>960+(lon-121.8)*112,y:lat=>540-(lat+1.6)*112};const pth=crs(R_MDO.map(c=>LL(P,c)),10),p2=crs(R_TTN.map(c=>LL(P,c)),10);
 ctx.save();ctx.globalAlpha=.45;sulMap([0,0,W,H],P,{bg:'#081633',land:'#102347',edge:'#1E3866',route:'#2A4A80',r:0,extra:()=>{sk(pth,{w:5,c:LB,passes:1,step:8});sk(p2,{w:5,c:'#fff',passes:1,step:8})}});ctx.restore();
 ctx.save();ctx.setTransform(1,0,0,1,0,0);const gr=ctx.createRadialGradient(W/2,H/2,100,W/2,H/2,900);gr.addColorStop(0,'rgba(8,22,51,.55)');gr.addColorStop(1,'rgba(8,22,51,.9)');ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);ctx.restore();
 const lw=860,lx=(W-lw)/2,ly=250;const lp=E.io(prog(t,.2,1.0));logo(lx,ly,lw,'#fff',lp);const lh=lw*520/2121;
 txt('MARKET',W/2,ly-40,{size:24,weight:700,c:LB,align:'center',ls:16,a:prog(t,.8,1.1)});tagline(W/2,ly+lh+64,26,'#C9D4E8',prog(t,.9,1.2));
 txt('Konektivitas antar-kota di Sulawesi.',W/2,ly+lh+160,{size:46,weight:800,c:'#fff',align:'center',a:E.out(prog(t,1.2,1.6))});
 txt('Cari  ·  Pesan  ·  Aktif — dalam satu portal.',W/2,ly+lh+222,{size:32,weight:500,c:LB,align:'center',a:E.out(prog(t,1.5,1.9))});
 const up=E.back(prog(t,2.1,2.4));if(up>0){ctx.save();ctx.translate(W/2,ly+lh+330);ctx.scale(up,up);fillP(rrect(-250,-40,500,80,40),'#fff');txt('Daftar akun perusahaan',0,12,{size:28,weight:800,c:NAVY,align:'center'});ctx.restore()}
 drawOrb([[0,W/2+420,H+60],[2.5,W/2+420,ly+lh+360],[3.1,W/2+180,ly+lh+340,1],[3.8,W/2+230,ly+lh+380]],t,{c:LB});
}
/* ---- HUD: quiet step indicator ---- */
function hud2(){const show=T>8&&T<39.3;if(!show)return;const a=Math.min(prog(T,8,8.3),1-prog(T,39.0,39.3));ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=a;
 const steps=[['CARI',8,12.5],['PILIH',12.5,21.5],['PESAN',21.5,25.5],['AKTIF',25.5,39.5]];let x=W/2-260;steps.forEach(([s,a0,a1],i)=>{const on=T>=a0&&T<a1,doneS=T>=a1;ctx.font=font(15,on?800:600,MONO);ctx.fillStyle=on?OR2:doneS?'#1D8348':GREY;ctx.fillText(s,x,40);const w=ctx.measureText(s).width;if(i<3){ctx.fillStyle=LINE;ctx.fillRect(x+w+16,34,60,2)}x+=w+92});ctx.restore()}
