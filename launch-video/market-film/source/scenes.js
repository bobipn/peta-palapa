/* ===== C-Ring Market — cinematic product film: scenes ===== */
/* Route stops follow the numbered list the live marketplace shows (19 Nov 2026); coordinates are approximate town centres. */
const ST_TTN=[['MAKASSAR',-5.14,119.42],['MAROS',-5.00,119.57],['PANGKAJENE',-4.83,119.55],['BARRU',-4.42,119.62],['PAREPARE',-4.01,119.63],['SIDRAP',-3.92,119.80],['PINRANG',-3.79,119.65],['ENREKANG',-3.56,119.78],['MAKALE / RANTEPAO',-3.04,119.87],['PALOPO',-2.99,120.20],['MASAMBA',-2.55,120.33],['WOTU',-2.60,120.79],['MANGKUTANA',-2.30,120.86],['TENTENA',-1.77,120.65]];
const ST_MDO=[['MAKASSAR',-5.14,119.42],['MAROS',-5.00,119.57],['PANGKAJENE',-4.83,119.55],['BARRU',-4.42,119.62],['PAREPARE',-4.01,119.63],['SIDRAP',-3.92,119.80],['PINRANG',-3.79,119.65],['PALU',-0.90,119.87],['TONDANO',1.30,124.91],['TOMOHON',1.32,124.84],['MANADO',1.48,124.84]];
const PATH_TTN=ST_TTN.map(s=>[s[1],s[2]]);
const PATH_MDO=[...ST_MDO.slice(0,7).map(s=>[s[1],s[2]]),[-3.6,119.4],[-3.42,119.33],[-2.27,119.32],[-0.9,119.87],[-0.68,119.74],[1.04,120.81],[0.5,122.35],[0.66,122.88],[0.84,122.92],[0.9,123.38],[0.87,124.02],[1.12,124.5],[1.08,124.75],[1.3,124.91],[1.32,124.84],[1.48,124.84]];
const VIA_TTN='IDC Makassar · Makassar → Lantebung → Maros → Pangkajene → Barru → Parepare → Sidenreng → Pinrang → Enrekang → Getengan → Makale → Rantepao → Palopo → Masamba → Wotu → Wonorejo → Mangkutana → Pendolo → TBG SANGELE · Tentena';
const VIA_MDO='IDC Makassar · Makassar → Lantebung → Maros → Pangkajene → Barru → Parepare → Sidenreng → Pinrang → Lampa → Polewali → Tobadak → Palu → Donggala → Tinabogan → Tilamuta → Molobulahe → Isimu → Kwandang → Boroko → Pimpi → Lolak → Bolaang → Tenga → Ratahan → Tondano → Airmadidi → Laikit → neuCentrIX Manado · Manado';
const CO='PT Contoh Pelanggan';
/* --- sulawesi map inside a rect --- */
function sulPanel(R,lat0,lon0,Rad,draw){ctx.save();rr(R[0],R[1],R[2],R[3],R[4]==null?16:R[4]);ctx.clip();const g=ctx.createLinearGradient(0,R[1],0,R[1]+R[3]);g.addColorStop(0,'#04102a');g.addColorStop(1,'#020a1c');ctx.fillStyle=g;ctx.fillRect(R[0],R[1],R[2],R[3]);
 const V=view(lat0,lon0,Rad,R[0]+R[2]/2,R[1]+R[3]/2);globe(V,{dots:0,body:0,atm:0,land:1,landC:'#0e2148',edgeC:'rgba(111,163,255,.28)'});prtRoutes(V,.35,{c:'rgba(111,163,255,.6)',w:1.2});if(draw)draw(V);ctx.restore();strokeR(R[0],R[1],R[2],R[3],R[4]==null?16:R[4],LINE,1)}
function cityDot(V,lat,lon,name,a=1,side='r',big=false){if(a<=0)return;const s=V.P(lat,lon);circ(s[0],s[1],big?7:5,'#fff',a);ring(s[0],s[1],big?13:10,LB,1.4,a*.8);if(name)txt(name,s[0]+(side==='r'?18:-18),s[1]+6,{size:big?18:15,weight:600,align:side==='r'?'left':'right',a,ls:.5})}
function stopTags(V,ST,t,t0,dt=.12,max=99,show=null){ST.forEach((s,i)=>{if(i>=max)return;const k=E.back(prog(t,t0+i*dt,t0+i*dt+.35));if(k<=0)return;const q=V.P(s[1],s[2]);circ(q[0],q[1],5,'#fff',clamp(k));ring(q[0],q[1],9,LB,1.4,clamp(k)*.8);
 if(show&&!show.includes(i))return;const lab=(i+1)+'. '+s[0];const w=mw(lab,12,600,1)+18;const side=show?(s[2]>(ST===ST_TTN?120.0:121)?-1:1):((i%2===0)?1:-1);const x=side>0?q[0]+14:q[0]-14-w;ctx.save();ctx.globalAlpha*=clamp(k);fillR(x,q[1]-12,w,24,6,'rgba(8,22,52,.92)');strokeR(x,q[1]-12,w,24,6,'rgba(111,163,255,.35)',1);txt(lab,x+9,q[1]+5,{size:12,weight:600,ls:1});ctx.restore()})}
/* ================= 0–9 : ORBIT ================= */
function sOrbit(t){ctx.fillStyle=BK;ctx.fillRect(0,0,W,H);stars(prog(t,.2,2),t*.03);
 const z=E.expo(prog(t,5.6,9.0));const R=lerp(lerp(330,470,E.sine(prog(t,0,6))),7200,Math.pow(z,1.15));const lon=lerp(lerp(96,116,E.sine(prog(t,0,6))),121.6,E.io(prog(t,4.5,8.6)));const lat=lerp(lerp(8,0,E.sine(prog(t,0,6))),-1.7,E.io(prog(t,4.5,8.6)));
 const cy=lerp(H/2+30,H/2,E.io(prog(t,4,8)));const V=view(lat,lon,R,W/2,cy);const a=E.out(prog(t,.3,2.2));
 globe(V,{dots:a*(1-prog(R,2600,6000)),body:a,atm:a,land:prog(R,1800,4200)});
 prtRoutes(V,prog(t,2.6,4.2)*.9,{c:'rgba(150,190,255,.85)',w:lerp(1,1.6,z)});
 if(t>3.2){lightRoute(proj(V,PATH_TTN),E.io(prog(t,3.4,6.0)),'#fff',lerp(1.2,3.4,z),.9);lightRoute(proj(V,PATH_MDO),E.io(prog(t,3.8,7.2)),LB,lerp(1.2,3.4,z),.9)}
 // copy
 reveal('Sulawesi.',W/2,250,1.4,{size:24,weight:500,ls:10,align:'center',c:ICEB,a:1-prog(t,5.0,5.6)});
 reveal('Kota demi kota, terhubung serat optik.',W/2,H-150,2.4,{size:44,weight:300,align:'center',a:1-prog(t,5.3,5.9)});
 fade(1-prog(t,0,.8))}
/* ================= 9–15 : TITLE ================= */
function sTitle(t){ctx.fillStyle=BK;ctx.fillRect(0,0,W,H);const V=view(-1.7,121.6,lerp(7200,6600,E.sine(prog(t,0,6))),W/2,H/2);
 ctx.save();ctx.globalAlpha=lerp(1,.38,E.io(prog(t,.2,1.4)));globe(V,{dots:0,body:0,atm:0,land:1,landC:'#0b1c3f',edgeC:'rgba(111,163,255,.25)'});prtRoutes(V,.7,{c:'rgba(150,190,255,.7)',w:1.5});
 const p1=proj(V,PATH_TTN),p2=proj(V,PATH_MDO);lightRoute(p1,1,'#fff',3.2,.9);lightRoute(p2,1,LB,3.2,.9);pulses(p1,9,3,.18,3.5);pulses(p2,9,4,.12,3.5);ctx.restore();
 ctx.save();ctx.setTransform(1,0,0,1,0,0);const gv=ctx.createRadialGradient(W/2,H/2,80,W/2,H/2,800);gv.addColorStop(0,'rgba(1,3,9,.7)');gv.addColorStop(1,'rgba(1,3,9,.15)');ctx.fillStyle=gv;ctx.fillRect(0,0,W,H);ctx.restore();
 const lw=1000,lh=lw*1128/3372,lx=(W-lw)/2,ly=H/2-lh/2-40;const k=E.io(prog(t,.6,2.0));
 if(k>0){ctx.save();ctx.beginPath();ctx.rect(lx-40,ly-40,(lw+80)*k,lh+80);ctx.clip();ctx.globalAlpha=prog(t,.6,1.2);ctx.drawImage(IMG.logo,lx,ly,lw,lh);ctx.restore();if(k<1)streak(lx-40+(lw+80)*k,ly+lh*.45,320,.9*Math.sin(k*PI))}
 txt('MARKET',W/2,ly-18,{size:20,weight:500,ls:16,c:LB,align:'center',a:E.out(prog(t,1.8,2.4))});
 reveal('Konektivitas antar-kota di Sulawesi, dipesan dalam satu portal.',W/2,ly+lh+90,2.6,{size:34,weight:300,align:'center',c:ICEB});
 fade(prog(t,5.4,6.0))}
/* ================= chapter cards ================= */
function chapter(t,n,title,sub,d=2.6){ctx.fillStyle=BK;ctx.fillRect(0,0,W,H);stars(.35,T*.02);const a=Math.min(E.out(prog(t,0,.6)),1-prog(t,d-.5,d));
 ctx.save();ctx.globalAlpha=a;ctx.translate(W/2,H/2);ctx.scale(lerp(1.04,1,E.out(prog(t,0,d))),lerp(1.04,1,E.out(prog(t,0,d))));ctx.translate(-W/2,-H/2);
 txt(n+'  /  06',W/2,H/2-92,{size:14,weight:500,ls:5,c:LB,align:'center',fam:MONO});
 txt(title,W/2,H/2+10,{size:78,weight:300,ls:22,align:'center'});
 const lw2=lerp(0,520,E.io(prog(t,.2,1.2)));fillR(W/2-lw2/2,H/2+46,lw2,1,0,'rgba(111,163,255,.6)');
 txt(sub,W/2,H/2+98,{size:22,weight:400,c:MU,align:'center',a:prog(t,.5,1.1)});ctx.restore();streak(W/2,H/2+46,420,.5*Math.sin(prog(t,.2,1.2)*PI))}
const C1=t=>chapter(t,'01','DAFTAR','Email kantor, kode verifikasi, data perusahaan.');
const C2=t=>chapter(t,'02','VERIFIKASI','Data perusahaan, dokumen KYC, persetujuan LTI.');
const C3=t=>chapter(t,'03','PILIH RUTE','Makassar → Tentena  ·  Makassar → Manado');
const C4=t=>chapter(t,'04','PESAN','Vendor mengonfirmasi dalam 24 jam.');
const C5=t=>chapter(t,'05','AKTIVASI','Status per vendor, dikabarkan lewat email dan WhatsApp.');
const C6=t=>chapter(t,'06','DOKUMEN','Kontrak, BAA dan BAST ditandatangani sistem.');
/* ================= registration ================= */
function regHead(cx,cy,cw,step,title){const lw=112;ctx.drawImage(IMG.word,cx+40,cy+38,lw,lw*882/3372);ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(cx+166,cy+38,1,28);txt('Market',cx+180,cy+59,{size:17,weight:600});
 txt(title,cx+40,cy+128,{size:32,weight:600});['Isi data','Kode email','Lengkapi data'].forEach((s,i)=>{const sw=(cw-80-20)/3,sx=cx+40+i*(sw+10);fillR(sx,cy+148,sw,3,2,i<=step?BL2:'rgba(255,255,255,.12)');txt(s,sx,cy+176,{size:14,weight:i===step?600:400,c:i===step?TX:MU})})}
function sReg(t){stage(t);const s=lerp(1.03,1,E.out(prog(t,0,10)));cam(s,W*.62,H/2);
 const cw=640,ch=930,cx=W-cw-190,cy=(H-ch)/2+6;glowPanel(cx,cy,cw,ch,24,E.out(prog(t,0,.5)));regHead(cx,cy,cw,0,'Buat akun perusahaan');
 label('Saya mendaftar untuk',cx+40,cy+222);const sel=t>1.0;['Membeli layanan','Menyewakan kabel','Keduanya'].forEach((s,i)=>{const bw=(cw-80-16)/3,bx=cx+40+i*(bw+8);const on=sel&&i===0;fillR(bx,cy+236,bw,46,11,on?'rgba(46,107,219,.3)':'rgba(255,255,255,.04)');strokeR(bx,cy+236,bw,46,11,on?BL2:LINE2,on?1.4:1);txt(s,bx+bw/2,cy+265,{size:15,weight:600,align:'center',c:on?'#fff':ICEB})});
 txt('Cari rute, pesan leased line atau sewa core, dan bayar dalam satu tagihan.',cx+40,cy+312,{size:14,c:MU,a:prog(t,1.0,1.4)});
 const F=[['Nama perusahaan',CO,1.5,2.4],['Nama lengkap Anda','Nama PIC',2.6,3.2],['Email kantor','pic@••••••.co.id',3.4,4.2],['No. HP/WA','0812 •••• ••••',4.4,5.0],['Kata sandi','••••••••••',5.2,5.7]];
 F.forEach(([l,v,a,b],i)=>field(cx+40,cy+340+i*86,cw-80,l,v,prog(t,a,b+.5)*(1+.5/(b-a))));
 const ck=t>6.4;checkbox(cx+40,cy+780,ck,E.out(prog(t,6.4,6.6)));txt('Saya setuju data perusahaan & PIC diproses LTI untuk verifikasi (KYC).',cx+76,cy+798,{size:14,c:ICEB});
 btn(cx+40,cy+830,cw-80,58,'Daftar & kirim kode',{press:t>7.4&&t<7.65?1:0});
 const fy=i=>cy+340+i*86+40;drawOrb([[0,cx+cw/2,H+80],[.9,cx+150,cy+259,1],[1.4,cx+260,fy(0),1],[2.5,cx+260,fy(1),1],[3.3,cx+260,fy(2),1],[4.3,cx+260,fy(3),1],[5.1,cx+260,fy(4),1],[6.3,cx+52,cy+792,1],[7.3,cx+cw/2,cy+859,1],[8.4,cx+cw/2+80,cy+930]],t);
 ctx.setTransform(1,0,0,1,0,0);
 reveal('Daftar sebagai',110,420,.6,{size:58,weight:300});reveal('perusahaan.',110,490,.8,{size:58,weight:300,c:LB});
 txt('Registrasi mandiri. Data PIC dan',110,560,{size:22,c:MU,a:prog(t,1.4,2)});txt('nomor WhatsApp dicatat sejak awal.',110,592,{size:22,c:MU,a:prog(t,1.4,2)});
 toast('Kode dikirim ke email Anda',7.85,9.6);fade(1-prog(t,0,.5))}
function sCode(t){stage(t);cam(lerp(1.02,1,E.out(prog(t,0,6))),W*.62,H/2);const cw=640,ch=560,cx=W-cw-190,cy=(H-ch)/2;
 glowPanel(cx,cy,cw,ch,24);regHead(cx,cy,cw,t>4.2?2:1,'Masukkan kode');txt('Kami mengirim kode 6 digit ke email Anda.',cx+40,cy+226,{size:17,c:MU});
 const code='482916';const n=Math.floor(clamp((t-2.2)/1.2)*6.999);for(let i=0;i<6;i++){const bw=(cw-80-50)/6,bx=cx+40+i*(bw+10);fillR(bx,cy+252,bw,78,12,FLD);const on=i===n&&t<3.5;strokeR(bx,cy+252,bw,78,12,on?BL2:LINE2,on?1.6:1);if(i<n)txt(code[i],bx+bw/2,cy+305,{size:36,weight:500,align:'center'})}
 btn(cx+40,cy+360,cw-80,58,'Verifikasi & masuk',{press:t>3.7&&t<3.95?1:0});txt('Kode berlaku 15 menit.',cx+40,cy+460,{size:15,c:MU});
 const ok=E.back(prog(t,4.1,4.45));if(ok>0){ctx.save();ctx.translate(cx+cw/2,cy+ch-48);ctx.scale(ok,ok);fillR(-170,-22,340,44,22,OKBG);txt('Email terverifikasi',0,7,{size:17,weight:600,c:OK,align:'center'});ctx.restore()}
 // incoming email (system notification)
 const nk=E.out(prog(t,.4,.9))*(1-prog(t,5.0,5.4));if(nk>0){const nx=lerp(W+20,W-600,nk),ny=60;glowPanel(nx,ny,540,138,18);ctx.drawImage(IMG.icon,nx+22,ny+24,42,42);
  txt('EMAIL · BARU SAJA',nx+82,ny+40,{size:11,weight:500,ls:2,c:MU,fam:MONO});txt('C-Ring Market · Kode verifikasi',nx+82,ny+68,{size:18,weight:600});txt('Kode Anda: 482 916 · berlaku 15 menit',nx+82,ny+98,{size:16,c:LB});txt('Jangan bagikan kode ini kepada siapa pun.',nx+82,ny+122,{size:13,c:MU})}
 drawOrb([[0,cx+cw/2,cy+ch+80],[1.1,W-330,130],[2.0,cx+130,cy+291,1],[3.6,cx+cw/2,cy+389,1],[4.7,cx+cw/2+60,cy+470]],t);
 ctx.setTransform(1,0,0,1,0,0);reveal('Satu kode.',110,420,.3,{size:58,weight:300});reveal('Akun aktif.',110,490,.5,{size:58,weight:300,c:LB});txt('Kode 6 digit dikirim ke email kantor.',110,560,{size:22,c:MU,a:prog(t,1,1.6)})}
/* ================= company & KYC ================= */
const RAIL=[['BERANDA',['Ringkasan']],['BELANJA',['Marketplace A→B','Pesan Koneksi']],['LAYANAN',['Layanan Saya','Tiket & Gangguan']],['DOKUMEN',['Kontrak & Penawaran']],['AKUN',['Perusahaan']]];
function rail(x,y,h,act){fillR(x,y,260,h,0,'rgba(5,12,28,.6)');ctx.fillStyle=LINE;ctx.fillRect(x+259,y,1,h);txt('MENU',x+24,y+40,{size:11,weight:500,ls:2,c:MU,fam:MONO});let yy=y+62;
 RAIL.forEach(([g,items])=>{yy+=22;txt(g,x+24,yy,{size:11,weight:500,ls:2,c:MU2,fam:MONO});yy+=10;items.forEach(n=>{const on=n===act;if(on){fillR(x+10,yy,236,38,9,'rgba(46,107,219,.22)');fillR(x+2,yy+8,3,22,2,LB)}txt(n,x+28,yy+25,{size:16,weight:on?600:400,c:on?'#fff':ICEB});yy+=42})})}
const WX=150,WY=46,WW=1620,WH=852;
function sKYC(t){stage(t);cam(lerp(1.035,1,E.out(prog(t,0,11))),W/2,H/2);glowPanel(WX,WY,WW,WH,20);ctx.save();rr(WX,WY,WW,WH,20);ctx.clip();appBar(WX,WY,WW,null,['Akun','Keranjang','Modul']);rail(WX,WY+64,WH-64,'Perusahaan');
 const x0=WX+300,w1=720;const ver=t>10.0;txt(CO,x0,WY+124,{size:30,weight:600});if(ver)pillS(x0+mw(CO,30,600)+18,WY+102,'Terverifikasi',{bg:OKBG,c:OK,size:14,h:30});
 txt('Data perusahaan',x0,WY+178,{size:19,weight:600});
 const F=[['Nama badan hukum',CO,.4,1.2],['NPWP','••.•••.•••.•-•••.•••',1.4,2.0],['Kota','Makassar',3.4,3.8],['PIC — Jabatan','Direktur',3.9,4.4]];
 F.forEach(([l,v,a,b],i)=>field(x0+(i%2)*(w1/2+10),WY+200+Math.floor(i/2)*90,w1/2-10,l,v,prog(t,a,b+.5)*(1+.5/(b-a))));
 label('Segmen',x0,WY+396);let sx=x0;['ISP / penyedia internet','Operator seluler / jaringan','Korporasi','Pemerintah / BUMN'].forEach((s,i)=>{sx+=chip(sx,WY+408,s,i===0&&t>2.9,{size:13,h:32})+8});
 btn(x0,WY+462,190,48,'Simpan data',{size:16,press:t>4.6&&t<4.85?1:0});
 // KYC docs
 const dx=x0+w1+36,dw=WX+WW-dx-36;card(dx,WY+96,dw,430,{fill:'rgba(255,255,255,.03)'});txt('Dokumen KYC',dx+24,WY+136,{size:19,weight:600});txt('PDF/JPG/PNG maks. 5 MB. Wajib: Akta keanggotaan APJII, NPWP perusahaan.',dx+24,WY+162,{size:13,c:MU});
 [['Akta keanggotaan APJII',5.2],['NPWP perusahaan',6.3],['NIB (OSS)',7.4]].forEach(([s,a],i)=>{const yy=WY+186+i*108;card(dx+20,yy,dw-40,94,{r:12,fill:'rgba(255,255,255,.03)'});txt(s,dx+40,yy+36,{size:16,weight:600});
  const p=E.io(prog(t,a,a+.7));if(p<=0){txt('Belum diunggah',dx+40,yy+66,{size:13,c:MU});btn(dx+dw-150,yy+26,110,40,'Unggah',{kind:'ghost',size:14})}else{fillR(dx+40,yy+60,dw-230,6,3,'rgba(255,255,255,.08)');fillR(dx+40,yy+60,(dw-230)*p,6,3,BL2);if(p>=1)pillS(dx+dw-140,yy+30,'diterima',{bg:OKBG,c:OK,size:13,h:28})}})
 // onboarding steps (8, as in portal)
 const cy0=WY+556,bw0=WX+WW-x0-36;card(x0,cy0,bw0,WH-580,{fill:'rgba(255,255,255,.025)'});txt('Langkah menuju layanan aktif',x0+24,cy0+40,{size:19,weight:600});
 const STP=[['Registrasi perusahaan',4.8,'Data perusahaan lengkap.'],['Verifikasi dokumen (KYC)',8.2,'Dokumen diterima.'],['Persetujuan LTI',10.0,'Disetujui.'],['Pengguna tim'],['Profil pembayaran & kredit'],['Pemesanan layanan'],['Kontrak ditandatangani'],['Layanan aktif']];
 const cw0=(bw0-48)/4;STP.forEach(([h,a,ds],i)=>{const xx=x0+24+(i%4)*cw0,yy=cy0+92+Math.floor(i/4)*86,done=a!=null&&t>a,cur=i===2&&t>8.2&&!done;
  if(done){circ(xx+16,yy,15,OK);tick(xx+16,yy+1,13,'#06140e',2.6,E.out(prog(t,a,a+.3)))}else{ring(xx+16,yy,14,cur?LB:LINE2,1.4);txt(String(i+1),xx+16,yy+5,{size:13,weight:600,c:cur?LB:MU,align:'center'})}
  txt(h,xx+44,yy-2,{size:15,weight:600,c:done?TX:ICEB});txt(done?ds:cur?'Diperiksa tim LTI…':'—',xx+44,yy+20,{size:13,c:cur?LB:MU})});
 ctx.restore();
 const fx=i=>[x0+(i%2)*(w1/2+10)+170,WY+200+Math.floor(i/2)*90+40];
 drawOrb([[0,W/2,H+60],[.3,...fx(0),1],[1.3,...fx(1),1],[2.8,x0+90,WY+424,1],[3.3,...fx(2),1],[3.8,...fx(3),1],[4.5,x0+95,WY+486,1],[5.1,dx+dw-95,WY+232,1],[6.2,dx+dw-95,WY+340,1],[7.3,dx+dw-95,WY+448,1],[8.8,x0+24+2*cw0+20,cy0+70],[10.6,x0+24+2*cw0+60,cy0+140]],t);
 caption('02 / VERIFIKASI','Unggah dokumen. LTI memverifikasi.','Wajib: Akta keanggotaan APJII dan NPWP perusahaan.',t,.5,10.6);fade(1-prog(t,0,.5))}
/* ================= notifications: email + WhatsApp mockups ================= */
function mail(x,y,w,h,items,t){glowPanel(x,y,w,h,18);ctx.save();rr(x,y,w,h,18);ctx.clip();fillR(x,y,w,52,0,'rgba(255,255,255,.04)');[0,1,2].forEach(i=>circ(x+26+i*20,y+26,6,'rgba(255,255,255,.14)'));txt('EMAIL  ·  KOTAK MASUK',x+w/2,y+32,{size:12,weight:500,ls:2.5,c:MU,align:'center',fam:MONO});
 const lw=360;ctx.fillStyle=LINE;ctx.fillRect(x+lw,y+52,1,h-52);const shown=items.filter(it=>t>=it.at);
 shown.slice().reverse().forEach((it,i)=>{const yy=y+64+i*98;const k=E.out(prog(t,it.at,it.at+.4));ctx.save();ctx.globalAlpha*=k;ctx.translate(lerp(-24,0,k),0);if(i===0)fillR(x+10,yy,lw-20,88,10,'rgba(46,107,219,.16)');
  ctx.drawImage(IMG.icon,x+24,yy+16,28,28);txt('C-Ring Market',x+64,yy+30,{size:15,weight:600});txt(it.time,x+lw-24,yy+30,{size:12,c:MU,align:'right'});const tt=it.title.length>30?it.title.slice(0,29)+'…':it.title;txt(tt,x+64,yy+54,{size:14,weight:600,c:i===0?LB:ICEB});txt(it.body.length>36?it.body.slice(0,35)+'…':it.body,x+64,yy+76,{size:13,c:MU});ctx.restore()});
 const cur=shown[shown.length-1];if(cur){const k=E.out(prog(t,cur.at+.2,cur.at+.7));ctx.save();ctx.globalAlpha*=k;const rx=x+lw+34,rw=w-lw-68;txt(cur.title,rx,y+108,{size:24,weight:600});ctx.drawImage(IMG.icon,rx,y+132,36,36);txt('C-Ring Market',rx+50,y+148,{size:16,weight:600});txt('kepada: email kantor Anda',rx+50,y+168,{size:13,c:MU});
  ctx.fillStyle=LINE;ctx.fillRect(rx,y+190,rw,1);const bh=para(cur.body,rx,y+232,rw,{size:18,c:ICEB,lh:28});
  if(cur.attach){let ax=rx;cur.attach.forEach(a=>{const aw=mw(a,14,600)+62;card(ax,y+250+bh,aw,44,{r:10});fillR(ax+12,y+260+bh,22,24,4,'#C0392B');txt('PDF',ax+23,y+276+bh,{size:8,weight:700,align:'center'});txt(a,ax+44,y+278+bh,{size:14,weight:600});ax+=aw+10})}
  btn(rx,y+(cur.attach?320:262)+bh,230,48,'Buka C-Ring Market',{size:15});txt('Email otomatis dari C-Ring Market.',rx,y+h-26,{size:12,c:MU2});ctx.restore()}ctx.restore()}
function phone(x,y,items,t){const pw=400,ph=820;ctx.save();ctx.shadowColor='rgba(46,107,219,.3)';ctx.shadowBlur=80;fillR(x,y,pw,ph,58,'#0b0f18');ctx.restore();strokeR(x,y,pw,ph,58,'rgba(255,255,255,.18)',1.5);fillR(x+12,y+12,pw-24,ph-24,48,'#0b141a');
 ctx.save();rr(x+12,y+12,pw-24,ph-24,48);ctx.clip();fillR(x+12,y+12,pw-24,108,0,'#0f1d2b');fillR(x+pw/2-60,y+24,120,30,15,'#000');
 txt('WHATSAPP',x+pw/2,y+76,{size:10,weight:500,ls:2.5,c:MU,align:'center',fam:MONO});ctx.drawImage(IMG.icon,x+32,y+82,30,30);txt('C-Ring Market',x+74,y+98,{size:16,weight:600});txt('notifikasi layanan',x+74,y+114,{size:11,c:MU});
 const shown=items.filter(it=>t>=it.at+.2);let yy=y+ph-36;shown.slice().reverse().forEach(it=>{const L=wrap(it.title+' — '+it.wa,pw-120,14,400);const bh=22+L.length*20+22;yy-=bh+10;if(yy<y+130)return;const k=E.back(prog(t,it.at+.2,it.at+.55));
  ctx.save();ctx.translate(x+30,yy+bh);ctx.scale(k,k);ctx.translate(-(x+30),-(yy+bh));fillR(x+30,yy,pw-96,bh,12,'#1f2c34');L.forEach((l,i)=>txt(l,x+44,yy+28+i*20,{size:14,weight:i===0?600:400}));txt(it.time+'  ✓✓',x+30+pw-96-12,yy+bh-9,{size:10,c:'#53bdeb',align:'right'});ctx.restore()});ctx.restore()}
function notifyScene(t,items,head,sub,idx){stage(t,{stars:.6});cam(lerp(1.025,1,E.out(prog(t,0,8))),W/2,H/2);
 mail(110,150,1150,640,items,t);phone(1380,120,items,t);
 [['Lonceng notifikasi portal','in-app'],['Email kantor','PDF terlampir bila ada'],['WhatsApp PIC','bila dipilih di preferensi']].forEach(([a,b],i)=>{const x=110+i*390,yy=820,k=E.out(prog(t,.6+i*.15,1+i*.15));if(k<=0)return;ctx.save();ctx.globalAlpha*=k;card(x,yy,372,76,{r:14});circ(x+36,yy+38,15,OKBG);tick(x+36,yy+39,13,OK,2.4,1);txt(a,x+64,yy+34,{size:17,weight:600});txt(b,x+64,yy+58,{size:13,c:MU});ctx.restore()});
 const last=items[items.length-1];drawOrb([[0,1260,1150],[items[0].at+.7,300,230,1],[last.at+.9,300,230,1],[last.at+1.9,1150,700]],t);
 ctx.setTransform(1,0,0,1,0,0);txt(idx,110,74,{size:13,weight:500,ls:3,c:LB,fam:MONO});txt(head,110,118,{size:36,weight:300,a:prog(t,0,.5)});txt(sub,110+mw(head,36,300)+24,118,{size:18,c:MU,a:prog(t,.3,.8)});fade(1-prog(t,0,.4))}
const N_VER=[{at:.7,time:'10.02',title:'Status verifikasi',body:'Perusahaan Anda terverifikasi. Anda sudah bisa memesan layanan.',wa:'Perusahaan Anda terverifikasi. Anda sudah bisa memesan layanan.'}];
const RT='IDC Makassar · Makassar → neuCentrIX Manado · Manado';
const N_ACT=[{at:.7,time:'09.14',title:'Semua vendor siap — aktivasi dimulai',body:RT+' · Vendor A menerima pesanan ORD-••••••. Tagihan terbit saat layanan aktif.',wa:'Vendor A menerima pesanan Makassar → Manado. Aktivasi dimulai.'},
 {at:3.4,time:'14.31',title:'Layanan aktif, tagihan & kontrak',body:'Layanan '+RT+' (Leased line 10G) sudah aktif. ID layanan: MP-••••••. Kontrak, Berita Acara Aktivasi (BAA), dan Berita Acara Serah Terima (BAST) sudah ditandatangani sistem.',wa:'Layanan Makassar → Manado 10G sudah aktif. Dokumen dikirim ke email Anda.',attach:['Kontrak.pdf','BAA.pdf','BAST.pdf']},
 {at:6.0,time:'14.32',title:'Kontrak siap ditandatangani',body:'Layanan '+RT+' sudah aktif dan kontrak sudah ditandatangani sistem. Mohon tandatangani di menu Kontrak & Penawaran.',wa:'Kontrak siap ditandatangani di menu Kontrak & Penawaran.'}];
const sNVer=t=>notifyScene(t,N_VER,'Terverifikasi.','Notifikasi masuk ke portal, email, dan WhatsApp.','02 / VERIFIKASI');
const sNAct=t=>notifyScene(t,N_ACT,'Setiap tahap, dikabarkan.','Tanpa perlu menelepon untuk menanyakan status.','05 / AKTIVASI');
/* ================= marketplace ================= */
function mpFrame(){glowPanel(WX,WY,WW,WH,20);ctx.save();rr(WX,WY,WW,WH,20);ctx.clip();appBar(WX,WY,WW,'MARKETPLACE KONEKTIVITAS',['Akun','Modul'])}
function mpForm(t,st){const X=WX+60,Wd=WW-120,Y=WY+96;fillR(X,Y,Wd,560,20,'rgba(255,255,255,.035)');strokeR(X,Y,Wd,560,20,LINE,1);
 txt('Link dari kota mana pun ke kota mana pun, dalam satu pesanan',X+40,Y+62,{size:32,weight:600});txt('Pilih titik A dan B. Sistem merangkai ruas kabel dari beberapa cable owner.',X+40,Y+98,{size:18,c:MU});
 const fw=(Wd-80-70)/2;field(X+40,Y+140,fw,'Dari',st.a,st.pa,{h:58});fillR(X+40+fw-118,Y+164,98,34,8,'rgba(255,255,255,.06)');txt('◎ Lokasi',X+40+fw-69,Y+187,{size:13,weight:600,c:LB,align:'center'});
 fillR(X+40+fw+10,Y+152,50,58,11,'rgba(255,255,255,.05)');strokeR(X+40+fw+10,Y+152,50,58,11,LINE2,1);txt('⇅',X+40+fw+35,Y+188,{size:20,align:'center',c:ICEB});field(X+40+fw+70,Y+140,fw,'Ke',st.b,st.pb,{h:58});
 if(st.acK>0){const k=E.out(st.acK);const ax=st.ac2?X+40+fw+70:X+40;ctx.save();ctx.globalAlpha*=k;glowPanel(ax,Y+218,fw,64,12);txt(st.acT,ax+18,Y+246,{size:16,weight:600});txt(st.acS,ax+18,Y+268,{size:13,c:MU});ctx.restore()}
 label('Layanan',X+40,Y+254);let cx=X+40;cx+=chip(cx,Y+268,'Leased line (sewa kapasitas)',true)+10;chip(cx,Y+268,'Sewa core (per 2 core)',false);
 label('Bandwidth',X+40,Y+342);cx=X+40;[['1G',0],['10G',1]].forEach(([s,i])=>{cx+=chip(cx,Y+356,s,st.bw===i,{size:16,h:40})+10});
 label('Kontrak',X+360,Y+342);cx=X+360;['12 bln','24 bln','36 bln'].forEach((s,i)=>{cx+=chip(cx,Y+356,s,i===0,{size:15,h:40})+10});
 label('Urutkan',X+720,Y+342);cx=X+720;['Termurah','Terpendek','Tercepat aktif'].forEach((s,i)=>{cx+=chip(cx,Y+356,s,i===0,{size:15,h:40})+10});
 btn(X+40,Y+430,Wd-80,60,'Cari link',{size:19,press:st.go?1:0});tabs3(X,Y+590,0);card(X,Y+648,Wd,92,{r:16});txt(st.go2?'Mencari rute…':'Masukkan asal dan tujuan, lalu tekan Cari link.',X+Wd/2,Y+702,{size:17,c:MU,align:'center'});return {X,Wd,Y,fw}}
function sSearch(t){stage(t);cam(lerp(1.03,1,E.out(prog(t,0,6))),W/2,H/2);mpFrame();
 const f1=t>1.3&&t<2.1,f2=t>2.8&&t<3.6;const L=mpForm(t,{a:'Makassar',pa:t>1.8?1.5:prog(t,.7,1.3),b:'Tentena',pb:t>3.3?1.5:prog(t,2.2,2.8),bw:t>3.6?0:-1,go:t>4.6&&t<4.85,go2:t>4.7,
  acK:f1?prog(t,1.3,1.5)*(1-prog(t,1.85,2.05)):f2?prog(t,2.8,3.0)*(1-prog(t,3.35,3.55)):0,ac2:f2,acT:f2?'Tentena, Indonesia':'Makassar, Indonesia',acS:f2?'2 titik · Tentena INT, TBG SANGELE':'7 titik · Cellix Hub, IDC Makassar…'});
 // NB 'ac' label
 ctx.restore();
 const {X,Wd,Y,fw}=L;
 drawOrb([[0,W/2,H+60],[.6,X+200,Y+181,1],[1.6,X+180,Y+250,1],[2.1,X+fw+300,Y+181,1],[3.1,X+fw+300,Y+250,1],[3.6,X+70,Y+376,1],[4.6,X+Wd/2,Y+460,1],[5.6,X+Wd/2+80,Y+540]],t);
 caption('03 / PILIH RUTE','Titik A ke titik B.','Leased line 1G atau 10G, kontrak 12 sampai 36 bulan.',t,.4,5.8);fade(1-prog(t,0,.5))}
/* autocomplete text fix: draw the label in st.ac */
function resultPane(t,o){const X=WX+40,Y=WY+90,mw0=760,mh=WH-120;const dest=o.dest;const ST=dest==='ttn'?ST_TTN:ST_MDO,PTH=dest==='ttn'?PATH_TTN:PATH_MDO;
 const lat0=dest==='ttn'?-3.45:-1.8,lon0=dest==='ttn'?120.15:122.2,Rad=dest==='ttn'?11500:5000;
 sulPanel([X,Y,mw0,mh],lat0,lon0,Rad,V=>{const P=proj(V,PTH);lightRoute(P,o.route,dest==='ttn'?'#fff':LB,3.4,1);if(o.route>=1)pulses(P,o.t0+1.2,3,.2,3.2);stopTags(V,ST,t,o.tags,dest==='ttn'?.13:.16,99,dest==='ttn'?[0,3,6,7,9,11,13]:[0,3,6,7,10])});
 const rx=X+mw0+30,rw=WX+WW-rx-40;txt(`4 pilihan rute  ·  Makassar → ${dest==='ttn'?'Tentena':'Manado'}  ·  Leased line ${dest==='ttn'?'1G':'10G'}  ·  12 bulan`,rx,Y+28,{size:15,c:MU});pillS(rx+rw-90,Y+8,'Bagikan',{size:13,h:28});
 const k=E.out(o.card);if(k<=0)return {rx,rw,Y};ctx.save();ctx.globalAlpha*=k;ctx.translate(0,(1-k)*20);const cy=Y+52;
 ctx.save();ctx.shadowColor='rgba(59,123,240,.35)';ctx.shadowBlur=30;fillR(rx,cy,rw,520,16,'rgba(46,107,219,.08)');ctx.restore();strokeR(rx,cy,rw,520,16,'rgba(59,123,240,.6)',1.4);
 let bx=rx+24;['Tercepat aktif','SLA tertinggi','Terpendek'].forEach(s=>{bx+=pillS(bx,cy+22,s,{bg:OKBG,c:OK,size:12,h:26})+8});
 txt('1 vendor · 1 ruas',rx+24,cy+86,{size:22,weight:600});const vh=para(dest==='ttn'?VIA_TTN:VIA_MDO,rx+24,cy+118,rw-48,{size:14,c:MU,lh:22});
 let sx=rx+24;const sy=cy+128+vh;(dest==='ttn'?['719 km','SLA ±99%','Aktif ±3 hari','darat 713 km · laut 6 km']:['2.034 km','SLA ±99%','Aktif ±3 hari','darat 1.817 km · laut 218 km']).forEach(s=>{const w=mw(s,14,500)+24;strokeR(sx,sy,w,32,8,LINE2,1);txt(s,sx+12,sy+21,{size:14,weight:500});sx+=w+8});
 fillR(rx+24,sy+52,rw-48,8,4,'rgba(59,123,240,.7)');circ(rx+30,sy+82,4,BL2);txt('Vendor A',rx+42,sy+87,{size:14,c:ICEB});
 ctx.fillStyle=LINE;ctx.fillRect(rx+24,sy+108,rw-48,1);label('Komponen',rx+24,sy+134);label('Vendor',rx+rw-120,sy+134);txt(dest==='ttn'?'Ruas Makassar → Tentena · 719,4 km darat':'Ruas Makassar → Manado · 2.034,4 km darat + laut',rx+24,sy+166,{size:15});txt('Vendor A',rx+rw-120,sy+166,{size:15});
 btn(rx+24,sy+196,220,50,'Pesan rute ini',{size:16,press:o.press?1:0});ctx.restore();
 card(rx,cy+540,(rw-12)/2,50,{r:12});circ(rx+22,cy+565,4,LB);txt('Konfirmasi vendor ≤ 24 jam',rx+36,cy+571,{size:14,c:ICEB});card(rx+(rw+12)/2,cy+540,(rw-12)/2,50,{r:12});circ(rx+(rw+12)/2+22,cy+565,4,LB);txt('Aktivasi tanpa menunggu pembayaran',rx+(rw+12)/2+36,cy+571,{size:14,c:ICEB});
 return {rx,rw,Y,btnY:sy+196}}
function tabs3(x,y,act){[['Hasil pencarian',0],['Pesanan saya',1],['Cara kerja',2]].forEach(([s,i])=>{const w=mw(s,15,600)+30;const xx=x+[0,172,320][i];if(i===act){fillR(xx,y,w,38,10,'rgba(46,107,219,.25)');strokeR(xx,y,w,38,10,BL2,1.2)}else{fillR(xx,y,w,38,10,'rgba(255,255,255,.04)');strokeR(xx,y,w,38,10,LINE2,1)}txt(s,xx+w/2,y+25,{size:15,weight:600,align:'center',c:i===act?'#fff':ICEB})})}
function sResult(t){stage(t);cam(lerp(1.0,1.03,E.sine(prog(t,0,7))),W*.3,H/2);mpFrame();const L=resultPane(t,{dest:'ttn',route:E.io(prog(t,.3,2.6)),tags:.5,card:prog(t,.8,1.4),t0:T-t});ctx.restore();
 drawOrb([[0,W/2,H+60],[1.0,700,520],[2.8,1000,400],[4.0,L.rx+260,WY+180],[5.6,L.rx+130,(L.btnY||700)+25]],t);
 caption('03 / PILIH RUTE','Rute dihitung dari jalur kabel nyata.','Makassar → Tentena: 14 titik, 719 km.',t,.6,6.6);fade(1-prog(t,0,.4))}
function sSwitch(t){stage(t);mpFrame();const sw=t>1.0;const L=resultPane(t,{dest:sw?'mdo':'ttn',route:sw?E.io(prog(t,1.2,3.4)):1,tags:sw?1.4:-5,card:sw?prog(t,1.6,2.1):1-prog(t,.7,1.0),t0:T-t+1.2,press:t>4.1&&t<4.35});
 const pk=E.out(prog(t,.2,.5))*(1-prog(t,.95,1.1));if(pk>0){ctx.save();ctx.globalAlpha*=pk;glowPanel(L.rx,WY+150,380,110,14);label('Ke',L.rx+20,WY+180);txt('Manado'.slice(0,Math.ceil(prog(t,.3,.8)*6)),L.rx+20,WY+218,{size:22,weight:600});chip(L.rx+200,WY+196,'10G',t>.75,{size:15,h:38});ctx.restore()}
 ctx.restore();drawOrb([[0,L.rx+200,WY+500],[.5,L.rx+150,WY+210,1],[.8,L.rx+230,WY+214,1],[2.6,L.rx+300,WY+300],[4.1,L.rx+130,(L.btnY||700)+25,1],[4.8,L.rx+150,(L.btnY||700)+60]],t);
 caption('03 / PILIH RUTE','Atau langsung ke Manado.','Leased line 10G · 11 titik · 2.034 km darat dan laut.',t,1.6,4.9)}
/* ================= order ================= */
function sOrder(t){stage(t);mpFrame();resultPane(t,{dest:'mdo',route:1,tags:-5,card:1,t0:0});ctx.restore();
 ctx.save();ctx.fillStyle=`rgba(1,3,9,${.7*E.out(prog(t,0,.3))*(1-prog(t,3.8,4.1))})`;ctx.fillRect(0,0,W,H);ctx.restore();
 const mk=E.back(prog(t,.05,.45))*(1-E.io(prog(t,3.7,4.0)));const mw2=1000,mh=640,mx=(W-mw2)/2,my=(H-mh)/2;
 if(mk>0){ctx.save();ctx.translate(W/2,H/2);ctx.scale(mk,mk);ctx.translate(-W/2,-H/2);glowPanel(mx,my,mw2,mh,22);txt('Pesan link ini',mx+44,my+66,{size:30,weight:600});
  para('IDC Makassar · Makassar → Maros → Pangkajene → Barru → Parepare → Pinrang → Polewali → Palu → Tilamuta → Kwandang → Tondano → neuCentrIX Manado · Manado',mx+44,my+104,mw2-88,{size:15,c:MU,lh:22});
  fillR(mx+44,my+160,mw2-88,50,12,'rgba(255,255,255,.05)');txt('Leased line 10G  ·  12 bulan  ·  2.034 km  ·  SLA ±99%  ·  aktif ±3 hari',mx+64,my+192,{size:17,weight:600});
  fillR(mx+44,my+228,mw2-88,128,12,'rgba(46,107,219,.1)');para('1 vendor menerima pesanan dan mengonfirmasi dalam 24 jam, lalu aktivasi dimulai tanpa menunggu pembayaran. Tagihan terbit saat layanan aktif. Invoice dan kontrak dikirim ke email Anda (PDF).',mx+64,my+264,mw2-128,{size:17,c:ICEB,lh:27});
  label('Catatan untuk tim (opsional)',mx+44,my+394);fillR(mx+44,my+406,mw2-88,54,11,FLD);strokeR(mx+44,my+406,mw2-88,54,11,LINE2,1);txt('Target aktif awal bulan depan'.slice(0,Math.floor(prog(t,.7,1.5)*30)),mx+64,my+440,{size:17});
  const ck=t>1.9;checkbox(mx+44,my+492,ck,E.out(prog(t,1.9,2.1)));txt('Saya menyetujui Syarat Layanan',mx+80,my+511,{size:17,c:ICEB});
  btn(mx+mw2-420,my+mh-88,170,54,'Batal',{kind:'ghost',size:17});btn(mx+mw2-236,my+mh-88,192,54,'Kirim pesanan',{size:17,press:t>2.9&&t<3.15?1:0});ctx.restore()}
 toast('Pesanan diajukan',4.0,5.6,110);
 drawOrb([[0,W/2+200,H/2+340],[.7,mx+300,my+433,1],[1.8,mx+56,my+504,1],[2.9,mx+mw2-140,my+mh-61,1],[3.9,mx+mw2-120,my+mh+40]],t);
 caption('04 / PESAN','Satu formulir. Satu klik.','Aktivasi dimulai tanpa menunggu pembayaran.',t,.5,5.8)}
/* ================= activation tracker ================= */
const TRK=['Dipesan','Vendor konfirmasi 1/1','Aktivasi 1/1','Aktif'];
function sTrack(t){stage(t);cam(lerp(1.03,1,E.out(prog(t,0,7))),W/2,H/2);mpFrame();const X=WX+40,Y=WY+86,Wd=WW-80;tabs3(X,Y,1);circ(X+520,Y+19,5,OK);txt('Status diperbarui otomatis tiap 30 detik',X+534,Y+25,{size:14,c:MU});
 const tt=[.4,1.8,3.4,5.0];const done=i=>t>=tt[i];const by=Y+60,bh=WH-170;ctx.save();if(done(3)){ctx.shadowColor='rgba(60,203,133,.25)';ctx.shadowBlur=40}fillR(X,by,Wd,bh,18,'rgba(255,255,255,.03)');ctx.restore();strokeR(X,by,Wd,bh,18,done(3)?'rgba(60,203,133,.6)':LINE2,1.3);
 txt('IDC Makassar · Makassar  →  neuCentrIX Manado · Manado',X+36,by+58,{size:24,weight:600});txt('ORD-••••••  ·  Leased line 10G  ·  12 bulan  ·  2.034 km',X+36,by+92,{size:16,c:MU});
 const st=done(3)?'AKTIF':done(2)?'AKTIVASI':done(1)?'DIKONFIRMASI':'DIPESAN';pillS(X+Wd*.56-120,by+40,st,{bg:done(3)?OKBG:'rgba(46,107,219,.2)',c:done(3)?OK:LB,size:13,h:30,ls:1.5});
 const sx0=X+90,sx1=X+Wd*.5,sy=by+200;fillR(sx0,sy-2,sx1-sx0,4,2,'rgba(255,255,255,.08)');
 TRK.forEach((s,i)=>{const x=lerp(sx0,sx1,i/3);if(i>0){const k=E.io(prog(t,tt[i]-1,tt[i]));if(k>0){const a=lerp(sx0,sx1,(i-1)/3);ctx.save();ctx.shadowColor='rgba(60,203,133,.7)';ctx.shadowBlur=12;fillR(a,sy-2,(x-a)*k,4,2,OK);ctx.restore()}}
  const d=done(i);if(d){circ(x,sy,17,OK);tick(x,sy+1,15,'#06140e',3,E.out(prog(t,tt[i],tt[i]+.3)))}else{fillR(x-17,sy-17,34,34,17,'#0a1630');ring(x,sy,16,LINE2,1.5)}
  const L=wrap(s,150,15,600);L.forEach((l,j)=>txt(l,x,sy+48+j*20,{size:15,weight:600,c:d?OK:MU,align:'center'}))});
 txt('Vendor A',X+36,by+330,{size:19,weight:600});ctx.fillStyle=LINE;ctx.fillRect(X+36,by+348,Wd*.5-40,1);if(done(1))pillS(X+Wd*.5-130,by+310,done(3)?'Ruas aktif':'Terkonfirmasi',{bg:done(3)?OKBG:'rgba(46,107,219,.2)',c:done(3)?OK:LB,size:13,h:28});
 txt('Aktivasi dimulai tanpa menunggu pembayaran.',X+36,by+400,{size:19,c:LB,a:prog(t,2,2.5)});
 let bx=X+36;['Ubah bandwidth','Perpanjang','Lapor gangguan','Kontrak'].forEach(s=>{const w=mw(s,15,600)+32;btn(bx,by+bh-90,w,46,s,{kind:'ghost',size:15,a:done(3)?1:.35});bx+=w+10});
 const R=[X+Wd*.58,by+24,Wd*.42-24,bh-48];sulPanel(R,-1.7,121.9,5000,V=>{const P=proj(V,PATH_MDO);line(P,'rgba(111,163,255,.35)',3,1,{dash:[8,8]});lightRoute(P,done(3)?1:t<tt[1]?0:prog(t,tt[1],tt[3]),LB,3.2,1);if(done(3)){pulses(P,T-t+tt[3],4,.25,3);const q=V.P(1.48,124.84);const k=(T*.8)%1;ring(q[0],q[1],8+40*k,LB,2,1-k)}cityDot(V,-5.14,119.42,'Makassar',1,'r',true);cityDot(V,1.48,124.84,'Manado',1,'l',true)});
 ctx.restore();drawOrb([[0,W/2,H+60],[1.0,lerp(sx0,sx1,1/3),sy-60],[2.6,lerp(sx0,sx1,2/3),sy-60],[4.2,sx1,sy-60],[5.8,X+Wd*.78,by+300],[6.6,X+Wd*.8,by+330]],t);
 caption('05 / AKTIVASI','Dari pesanan ke layanan aktif.','Status tiap vendor terlihat, diperbarui otomatis.',t,.4,6.8);fade(1-prog(t,0,.4))}
/* ================= documents ================= */
const DOCS=[['Kontrak','ditandatangani sistem'],['Berita Acara Aktivasi','BAA · ditandatangani sistem'],['Berita Acara Serah Terima','BAST · ditandatangani sistem']];
function sDocs(t){stage(t,{stars:.8});cam(lerp(1,1.04,E.sine(prog(t,0,6))),W/2,H/2);
 reveal('Dokumen terbit otomatis.',W/2,190,.1,{size:56,weight:300,align:'center'});txt('Tersimpan di Kontrak & Penawaran, dikirim ke email kantor dalam PDF.',W/2,246,{size:22,c:MU,align:'center',a:prog(t,.6,1.1)});
 DOCS.forEach(([h,s],i)=>{const k=E.out(prog(t,.6+i*.25,1.4+i*.25));if(k<=0)return;const x=W/2+(i-1)*420,y=lerp(700,620,k);ctx.save();ctx.globalAlpha*=k;ctx.translate(x,y);ctx.rotate((i-1)*.025*(1-k));
  glowPanel(-170,-250,340,460,18);fillR(-170,-250,340,70,0,'rgba(46,107,219,.18)');ctx.save();rr(-170,-250,340,460,18);ctx.clip();ctx.restore();ctx.drawImage(IMG.icon,-148,-232,36,36);txt('C-RING MARKET',-100,-208,{size:12,weight:500,ls:2,c:ICEB,fam:MONO});
  const L=wrap(h,290,24,600);L.forEach((l,j)=>txt(l,-146,-136+j*30,{size:24,weight:600}));for(let j=0;j<5;j++)fillR(-146,-136+L.length*30+20+j*24,[270,240,260,200,150][j],6,3,'rgba(255,255,255,.08)');
  txt(s,-146,118,{size:13,weight:600,c:OK});btn(-146,140,140,40,'Unduh PDF',{kind:'ghost',size:14});
  const sg=E.io(prog(t,1.6+i*.3,2.4+i*.3));if(sg>0){const P=[];for(let j=0;j<=40;j++){const u=j/40;P.push([40+u*90,96-Math.sin(u*PI*3)*10-u*8])}line(psub(P,sg),LB,2.4,1)}
  ctx.restore()});
 drawOrb([[0,W/2,H+60],[1.6,W/2-420+20,560],[2.6,W/2+20,560],[3.6,W/2-420-76,620+160,1],[4.6,W/2-420-40,620+220]],t);
 caption('06 / DOKUMEN','Kontrak, BAA dan BAST.','Satu tempat untuk semua dokumen layanan.',t,.6,5.8);fade(1-prog(t,0,.4))}
/* ================= Layanan Saya ================= */
function sService(t){stage(t);cam(lerp(1.03,1,E.out(prog(t,0,6))),W/2,H/2);glowPanel(WX,WY,WW,WH,20);ctx.save();rr(WX,WY,WW,WH,20);ctx.clip();appBar(WX,WY,WW,null,['Akun','Keranjang','Modul']);rail(WX,WY+64,WH-64,t<.4?'Ringkasan':'Layanan Saya');
 const x0=WX+290,w=720;card(x0,WY+90,w,110,{r:14});txt('Kepatuhan SLA bulan ini',x0+24,WY+128,{size:18,weight:600});txt('target per layanan · gangguan tercatat otomatis',x0+24,WY+152,{size:13,c:MU});
 const g=E.out(prog(t,.5,1.6));fillR(x0+24,WY+172,w-48,8,4,'rgba(255,255,255,.08)');ctx.save();ctx.shadowColor='rgba(60,203,133,.6)';ctx.shadowBlur=10;fillR(x0+24,WY+172,(w-48)*g,8,4,OK);ctx.restore();
 txt('Layanan Saya',x0,WY+250,{size:24,weight:600});const cy=WY+272;ctx.save();ctx.shadowColor='rgba(60,203,133,.22)';ctx.shadowBlur=40;fillR(x0,cy,w,340,16,'rgba(255,255,255,.03)');ctx.restore();strokeR(x0,cy,w,340,16,'rgba(60,203,133,.55)',1.3);
 [['Ubah bandwidth','selama masa kontrak'],['Perpanjang','dari halaman pesanan'],['Lapor gangguan','tercatat di Tiket & Gangguan']].forEach(([a,b],i)=>{const tw=(w-24)/3,tx=x0+i*(tw+12),ty=cy+364,k=E.out(prog(t,1.2+i*.15,1.7+i*.15));if(k<=0)return;ctx.save();ctx.globalAlpha*=k;card(tx,ty,tw,104,{r:14});txt(a,tx+20,ty+44,{size:17,weight:600});txt(b,tx+20,ty+72,{size:13,c:MU});ctx.restore()});
 txt('C-Ring Leased Line 10G',x0+26,cy+52,{size:24,weight:600});pillS(x0+w-110,cy+30,'AKTIF',{bg:OKBG,c:OK,size:13,h:30,ls:1.5});txt('ORD-••••••',x0+26,cy+80,{size:14,c:MU});
 const sw=(w-52-30)/4;['Diajukan','Studi','Provisioning','Aktif'].forEach((s,i)=>{const sx=x0+26+i*(sw+10);fillR(sx,cy+104,sw,6,3,OK);txt(s,i===0?sx:i===3?sx+sw:sx+sw/2,cy+132,{size:13,c:MU,align:i===0?'left':i===3?'right':'center'})});
 txt('IDC Makassar → … → neuCentrIX Manado · 2.034 km',x0+26,cy+178,{size:16,c:ICEB});fillR(x0+26,cy+198,w-52,42,10,'rgba(255,255,255,.04)');txt('Marketplace · 1 vendor (Vendor A) · SLA rute 99% · lacak per vendor · kontrak',x0+42,cy+225,{size:14,c:ICEB});
 let bx=x0+26;['Lapor gangguan','Unduh ringkasan','Riwayat'].forEach((s,i)=>{const bw=mw(s,15,600)+32;const a=prog(t,.6+i*.1,.8+i*.1);btn(bx,cy+268,bw,44,s,{kind:'ghost',size:15,a});bx+=bw+10});
 const R=[x0+w+30,WY+64,WX+WW-(x0+w+30),WH-64,0];sulPanel(R,-1.6,121.6,4700,V=>{const P=proj(V,PATH_MDO),P2=proj(V,PATH_TTN);lightRoute(P,1,LB,3.2,1);pulses(P,T-t,5,.18,3);lightRoute(P2,1,'#fff',2.4,.35);cityDot(V,-5.14,119.42,'Makassar',1,'r',true);cityDot(V,1.48,124.84,'Manado',1,'l',true);cityDot(V,-1.77,120.65,'Tentena',.7)});
 ctx.restore();drawOrb([[0,WX+130,WY+420],[.35,WX+130,WY+357,1],[1.6,x0+w-120,WY+176],[3.0,x0+140,cy+290],[4.6,x0+300,cy+380]],t);
 caption('LAYANAN SAYA','Pantau, ubah, perpanjang.','Lapor gangguan dan unduh ringkasan dari satu halaman.',t,.6,5.8);fade(1-prog(t,0,.4))}
/* ================= end ================= */
function sEnd(t){ctx.fillStyle=BK;ctx.fillRect(0,0,W,H);stars(prog(t,1.5,3.5),T*.03);
 const z=E.io(prog(t,0,4.2));const R=lerp(7000,560,Math.pow(z,.35));const V=view(lerp(-1.7,0,z),lerp(121.6,118,z),R,W/2,lerp(H/2,H*.95,E.io(prog(t,1.5,4.5))));
 ctx.save();ctx.globalAlpha=lerp(1,.75,z);globe(V,{dots:prog(R,6000,2600),body:prog(R,6000,3000),atm:prog(R,6000,3000),land:1-prog(R,4200,1800)});prtRoutes(V,.8,{c:'rgba(150,190,255,.8)'});lightRoute(proj(V,PATH_TTN),1,'#fff',lerp(3.2,1.4,z),.9);lightRoute(proj(V,PATH_MDO),1,LB,lerp(3.2,1.4,z),.9);ctx.restore();
 const lw=860,lh=lw*1128/3372,lx=(W-lw)/2,ly=200;const k=E.io(prog(t,3.0,4.4));if(k>0){ctx.save();ctx.beginPath();ctx.rect(lx-40,ly-40,(lw+80)*k,lh+80);ctx.clip();ctx.drawImage(IMG.logo,lx,ly,lw,lh);ctx.restore();if(k<1)streak(lx-40+(lw+80)*k,ly+lh*.45,300,.9*Math.sin(k*PI))}
 txt('MARKET',W/2,ly-14,{size:18,weight:500,ls:16,c:LB,align:'center',a:prog(t,4.2,4.8)});
 reveal('Daftar. Verifikasi. Pesan. Aktif.',W/2,ly+lh+84,4.6,{size:36,weight:300,align:'center'});
 const up=E.out(prog(t,5.6,6.2));if(up>0){const bw=440;ctx.save();ctx.globalAlpha=up;ctx.shadowColor='rgba(111,163,255,.5)';ctx.shadowBlur=30;fillR(W/2-bw/2,ly+lh+130,bw,64,32,'rgba(255,255,255,.95)');ctx.restore();txt('DAFTAR AKUN PERUSAHAAN',W/2,ly+lh+169,{size:17,weight:600,ls:3,c:NAVY,align:'center',a:up})}
 txt('C-Ring Market  ·  PT Len Telekomunikasi Indonesia',W/2,ly+lh+250,{size:14,weight:500,ls:2.5,c:MU,align:'center',fam:MONO,a:prog(t,6.2,6.8)});
 drawOrb([[0,W/2+420,H+60],[5.8,W/2+420,ly+lh+180],[6.6,W/2+150,ly+lh+162,1],[7.4,W/2+200,ly+lh+200]],t,{a:1-prog(t,8.6,9.2)});
 fade(prog(t,9.2,10))}
