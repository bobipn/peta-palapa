/* ===== Chapter 07 — Cable owner (texts follow the live Portal Cable Owner, 19 Nov 2026; no fees or amounts shown) ===== */
const ORAIL=[['CABLE OWNER',['Ringkasan','Tugas pesanan','Tiket gangguan','Ruas kabel','Unggah KML/KMZ','Titik & perangkat','Bagi hasil','Akun & tim']],['ALAT',['Simulator pembagian']]];
function ownerFrame(act){glowPanel(WX,WY,WW,WH,20);ctx.save();rr(WX,WY,WW,WH,20);ctx.clip();fillR(WX,WY,WW,64,0,'rgba(5,12,28,.85)');ctx.fillStyle=LINE;ctx.fillRect(WX,WY+63,WW,1);
 const lw=118;ctx.drawImage(IMG.word,WX+28,WY+16,lw,lw*882/3372);ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(WX+164,WY+18,1,28);txt('Portal Cable Owner',WX+180,WY+40,{size:17,weight:600});
 let rx=WX+WW-24;['Cari link','Portal','Modul'].slice().reverse().forEach(s=>{const bw=mw(s,15,600)+30;rx-=bw;fillR(rx,WY+16,bw,34,9,'rgba(255,255,255,.07)');txt(s,rx+bw/2,WY+38,{size:15,weight:600,align:'center'});rx-=10});
 const x=WX,y=WY+64,h=WH-64;fillR(x,y,250,h,0,'rgba(5,12,28,.6)');ctx.fillStyle=LINE;ctx.fillRect(x+249,y,1,h);let yy=y+22;
 ORAIL.forEach(([g,items])=>{yy+=20;txt(g,x+24,yy,{size:11,weight:500,ls:2,c:MU2,fam:MONO});yy+=12;items.forEach(n=>{const on=n===act;if(on){fillR(x+10,yy,226,38,9,'rgba(46,107,219,.22)');fillR(x+2,yy+8,3,22,2,LB)}txt(n,x+26,yy+25,{size:16,weight:on?600:400,c:on?'#fff':ICEB});yy+=42})})}
/* 4-step "cara kerja untuk owner" */
const OHOW=[['Daftarkan titik & ruas','PoP, landing station, data center, dan ruas kabel beserta tarifnya.'],['Daftarkan port & perangkat','Pengelola fasilitas dapat mengisi tarif cross-connect.'],['Terima & aktifkan pesanan','Pesanan yang melewati ruas Anda masuk ke menu Tugas.'],['Terima bagi hasil','Pembayaran pelanggan dibagi otomatis, lalu dibayarkan lewat payout.']];
function sOHow(t){stage(t,{stars:.8});cam(lerp(1.03,1,E.out(prog(t,0,6))),W/2,H/2);
 reveal('Kabel Anda, bekerja untuk Anda.',W/2,200,.1,{size:54,weight:300,align:'center'});txt('Cable owner memasang ruas di C-Ring Market dan menerima porsi dari setiap layanan yang melewatinya.',W/2,256,{size:21,c:MU,align:'center',a:prog(t,.6,1.1)});
 const cw=380,gap=24,x0=(W-(4*cw+3*gap))/2;OHOW.forEach(([h,b],i)=>{const k=E.out(prog(t,.8+i*.35,1.6+i*.35));if(k<=0)return;const x=x0+i*(cw+gap),y=lerp(470,420,k);ctx.save();ctx.globalAlpha*=k;glowPanel(x,y,cw,300,18);
  txt('0'+(i+1),x+28,y+56,{size:14,weight:500,ls:3,c:LB,fam:MONO});fillR(x+28,y+70,lerp(0,36,k),2,1,LB);const L=wrap(h,cw-56,24,600);L.forEach((l,j)=>txt(l,x+28,y+118+j*30,{size:24,weight:600}));para(b,x+28,y+124+L.length*30+14,cw-56,{size:16,c:MU,lh:24});
  if(i<3){const ax=x+cw+2,ay=y+150;line([[ax,ay],[ax+gap-4,ay]],LB,1.6,k*.8)}ctx.restore()});
 caption('07 / CABLE OWNER','Satu akun, dua peran.','Daftar dengan pilihan "Keduanya" untuk membeli layanan sekaligus menyewakan kabel.',t,.6,5.8);fade(1-prog(t,0,.4))}
/* KML/KMZ upload — example route (illustrative) */
const OW_DARAT=[[-3.99,122.52],[-3.95,122.30],[-3.86,122.06],[-3.93,121.85],[-4.06,121.60]];
const OW_LAUT=[[-4.06,121.60],[-3.95,121.20],[-3.78,120.80],[-3.67,120.39]];
function hkm(P){let s=0;for(let i=1;i<P.length;i++){const [a,b]=P[i-1],[c,d]=P[i];const p1=a*D,p2=c*D,dl=(d-b)*D;s+=6371*Math.acos(Math.min(1,Math.sin(p1)*Math.sin(p2)+Math.cos(p1)*Math.cos(p2)*Math.cos(dl)))}return s*1.08}
const KM_D=Math.round(hkm(OW_DARAT)),KM_L=Math.round(hkm(OW_LAUT));
function sOUpload(t){stage(t);cam(lerp(1.03,1,E.out(prog(t,0,8))),W/2,H/2);ownerFrame('Unggah KML/KMZ');const x0=WX+290,w0=WX+WW-x0-40;
 txt('Unggah jalur kabel (KML/KMZ)',x0,WY+118,{size:28,weight:600});para('Unggah file dari Google Earth, QGIS, atau as-built kontraktor. Sistem menghitung panjang kabel per ruas dan jenis kabel (darat, laut, udara, microwave), lalu membuat ruas yang siap diajukan.',x0,WY+152,980,{size:16,c:MU,lh:24});
 const dz=[x0,WY+214,620,190];const hov=t>.9&&t<1.9;ctx.save();ctx.setLineDash([8,7]);strokeR(dz[0],dz[1],dz[2],dz[3],16,hov?BL2:LINE2,1.6);ctx.restore();if(hov)fillR(dz[0],dz[1],dz[2],dz[3],16,'rgba(46,107,219,.10)');
 const ux=dz[0]+dz[2]/2,uy=dz[1]+64;line([[ux,uy+18],[ux,uy-14]],ICEB,2.6);line([[ux-12,uy-2],[ux,uy-14],[ux+12,uy-2]],ICEB,2.6);line([[ux-20,uy+14],[ux-20,uy+24],[ux+20,uy+24],[ux+20,uy+14]],ICEB,2.6);
 txt('Tarik file ke sini atau ketuk untuk memilih',ux,dz[1]+128,{size:17,weight:600,align:'center'});txt('.kml atau .kmz · maks 15 MB · jalur sebagai Path/garis, PoP sebagai titik bernama',ux,dz[1]+156,{size:13,c:MU,align:'center'});
 // file flies in
 const fk=E.io(prog(t,.4,1.5));if(fk>0&&t<2.0){const fx=lerp(W+80,ux,fk),fy=lerp(WY+120,uy+10,fk);ctx.save();ctx.translate(fx,fy);ctx.rotate((1-fk)*.5);fillR(-34,-42,68,84,8,'#123064');strokeR(-34,-42,68,84,8,LB,1.2);txt('KMZ',0,6,{size:15,weight:700,align:'center',c:'#fff'});ctx.restore()}
 // parse result
 const pk=prog(t,1.9,3.2);if(t>1.9){const y=dz[1]+dz[3]+24;card(x0,y,620,64,{r:12});ctx.drawImage(IMG.icon,x0+16,y+16,32,32);txt('jalur_contoh.kmz',x0+62,y+30,{size:15,weight:600});txt(pk<1?'Membaca jalur…':'2 ruas terbaca · siap diajukan',x0+62,y+50,{size:13,c:pk<1?MU:OK});fillR(x0+380,y+28,210,6,3,'rgba(255,255,255,.08)');fillR(x0+380,y+28,210*E.io(pk),6,3,pk<1?BL2:OK)}
 const rows=[['Ruas Kendari → Kolaka','darat',KM_D,3.3],['Ruas Kolaka → Siwa','laut',KM_L,3.6]];
 rows.forEach(([n,j,km,a],i)=>{const k=E.out(prog(t,a,a+.4));if(k<=0)return;const y=dz[1]+dz[3]+108+i*72;ctx.save();ctx.globalAlpha*=k;card(x0,y,620,60,{r:12,fill:'rgba(255,255,255,.03)'});txt(n,x0+20,y+37,{size:16,weight:600});pillS(x0+330,y+17,j,{bg:j==='laut'?'rgba(111,163,255,.18)':'rgba(255,255,255,.08)',c:j==='laut'?LB:ICEB,size:13,h:26});
  txt('± '+Math.round(km*E.out(prog(t,a,a+1)))+' km',x0+600,y+37,{size:16,weight:600,align:'right'});ctx.restore()});
 const sub=t>6.0;btn(x0,dz[1]+dz[3]+262,220,50,sub?'Diajukan':'Ajukan ruas',{size:16,press:t>5.8&&t<6.05?1:0,kind:sub?'ghost':'primary',a:prog(t,4.0,4.4)});
 if(sub)txt('Perubahan harga atau rute perlu persetujuan Admin.',x0+240,dz[1]+dz[3]+293,{size:14,c:LB,a:prog(t,6.1,6.5)});
 // map preview
 const R=[x0+650,WY+214,w0-650,WH-250];sulPanel(R,-3.85,121.42,14000,V=>{const pd=proj(V,OW_DARAT),pl=proj(V,OW_LAUT);const dp=E.io(prog(t,2.2,3.4)),lp2=E.io(prog(t,2.6,3.9));lightRoute(pd,dp,'#fff',3.2,1);
  if(lp2>0){const s=psub(pl,lp2);line(s,LB,8,.15);line(s,LB,3,.95,{dash:[10,8]})}
  [[OW_DARAT[0],'Kendari','l'],[OW_DARAT[4],'Kolaka','r'],[OW_LAUT[3],'Siwa','r']].forEach(([c,n,sd],i)=>cityDot(V,c[0],c[1],n,prog(t,2.2+i*.3,2.6+i*.3),sd,true))});
 txt('PRATINJAU  ·  CONTOH',R[0]+20,R[1]+30,{size:11,weight:500,ls:2,c:MU,fam:MONO});
 ctx.restore();
 drawOrb([[0,W/2,H+60],[1.4,ux,uy+20],[2.4,x0+520,dz[1]+dz[3]+56],[4.6,x0+110,dz[1]+dz[3]+287],[5.8,x0+110,dz[1]+dz[3]+287,1],[6.8,x0+300,dz[1]+dz[3]+340]],t);
 caption('07 / CABLE OWNER','Unggah jalur. Ruas terbentuk.','Panjang dan jenis kabel dihitung otomatis dari file KML/KMZ.',t,.5,7.8);fade(1-prog(t,0,.4))}
/* Tugas pesanan: SPK → aktifkan */
function sOTask(t){stage(t);cam(lerp(1.03,1,E.out(prog(t,0,6))),W/2,H/2);ownerFrame('Tugas pesanan');const x0=WX+290,w0=WX+WW-x0-40;
 txt('Tugas pesanan',x0,WY+118,{size:28,weight:600});para('Setujui SPK untuk menerima pesanan, lalu aktifkan dan isi data serah-terima. Aktivasi tidak menunggu pembayaran.',x0,WY+152,1000,{size:16,c:MU,lh:24});
 const st=t<2.2?0:t<4.0?1:2;const cy=WY+214,ch=360;const k=E.out(prog(t,.3,.8));ctx.save();ctx.globalAlpha*=k;ctx.save();ctx.shadowColor=st===2?'rgba(60,203,133,.25)':'rgba(59,123,240,.3)';ctx.shadowBlur=36;fillR(x0,cy,w0,ch,16,'rgba(255,255,255,.035)');ctx.restore();strokeR(x0,cy,w0,ch,16,st===2?'rgba(60,203,133,.6)':'rgba(59,123,240,.55)',1.3);
 txt('ORD-••••••  ·  Leased line 1G  ·  12 bulan',x0+28,cy+46,{size:15,c:MU});txt('Ruas Kendari → Kolaka',x0+28,cy+86,{size:26,weight:600});txt('bagian dari rute pelanggan · komponen ruas Anda',x0+28,cy+116,{size:15,c:MU});
 const lab=['Menunggu SPK','SPK disetujui','Ruas aktif'][st];pillS(x0+w0-mw(lab,13,600,1.5)-50,cy+28,lab.toUpperCase(),{bg:st===2?OKBG:'rgba(46,107,219,.2)',c:st===2?OK:LB,size:13,h:30,ls:1.5});
 const sx0=x0+60,sx1=x0+w0-440,sy=cy+190;fillR(sx0,sy-2,sx1-sx0,4,2,'rgba(255,255,255,.08)');[['Pesanan masuk',.3],['SPK disetujui',2.2],['Aktif & serah-terima',4.0]].forEach(([s,a],i)=>{const x=lerp(sx0,sx1,i/2);if(i>0){const kk=E.io(prog(t,a-.8,a));if(kk>0){const ax=lerp(sx0,sx1,(i-1)/2);fillR(ax,sy-2,(x-ax)*kk,4,2,OK)}}
  const d=t>=a;if(d){circ(x,sy,16,OK);tick(x,sy+1,14,'#06140e',2.8,E.out(prog(t,a,a+.3)))}else{fillR(x-16,sy-16,32,32,16,'#0a1630');ring(x,sy,15,LINE2,1.4)}txt(s,x,sy+46,{size:15,weight:600,c:d?OK:MU,align:'center'})});
 btn(x0+w0-280,cy+170,240,52,st===0?'Setujui SPK':'Aktifkan',{size:17,press:(t>1.9&&t<2.15)||(t>3.7&&t<3.95)?1:0,a:st<2?1:0});if(st===2)pillS(x0+w0-250,cy+182,'Data serah-terima terisi',{bg:OKBG,c:OK,size:13,h:30});
 txt('Pelanggan membayar paling lambat H+1 setelah aktif.',x0+28,cy+ch-34,{size:15,c:LB,a:prog(t,4.3,4.8)});ctx.restore();
 card(x0,cy+ch+24,(w0-16)/2,96,{r:14});txt('Titik & perangkat',x0+24,cy+ch+64,{size:17,weight:600});txt('Daftarkan port dan perangkat di titik serah-terima.',x0+24,cy+ch+90,{size:14,c:MU});
 card(x0+(w0+16)/2,cy+ch+24,(w0-16)/2,96,{r:14});txt('Tiket gangguan',x0+(w0+16)/2+24,cy+ch+64,{size:17,weight:600});txt('Gangguan di ruas Anda tercatat di menu Tiket gangguan.',x0+(w0+16)/2+24,cy+ch+90,{size:14,c:MU});
 ctx.restore();drawOrb([[0,W/2,H+60],[1.9,x0+w0-160,cy+196,1],[3.7,x0+w0-160,cy+196,1],[4.8,x0+w0-260,cy+300]],t);
 caption('07 / CABLE OWNER','Terima pesanan lewat SPK.','Ruas Anda aktif, layanan pelanggan berjalan.',t,.5,5.8);fade(1-prog(t,0,.4))}
/* Bagi hasil: multi-owner route + payment split flow (no amounts) */
function sOShare(t){stage(t,{stars:.6});cam(lerp(1.0,1.03,E.sine(prog(t,0,7))),W/2,H/2);
 const R=[110,150,760,800];const segs=[[0,11,'#ffffff','Owner A'],[10,17,LB,'Owner B'],[16,PATH_MDO.length,'#9FE3C4','Owner C']];
 sulPanel(R,-1.8,122.2,5600,V=>{segs.forEach(([a,b,c,n],i)=>{const P=proj(V,PATH_MDO.slice(a,b));lightRoute(P,E.io(prog(t,.4+i*.6,1.4+i*.6)),c,3.4,1)});pulses(proj(V,PATH_MDO),T-t+2.4,4,.16,3.2);
  cityDot(V,-5.14,119.42,'Makassar',1,'r',true);cityDot(V,1.48,124.84,'Manado',1,'l',true);
  segs.forEach(([a,b,c,n],i)=>{const m=PATH_MDO[Math.floor((a+b)/2)];const q=V.P(m[0],m[1]);const k=prog(t,1.0+i*.6,1.4+i*.6);if(k<=0)return;const w=mw(n,13,600,1)+24;ctx.save();ctx.globalAlpha*=k;fillR(q[0]+16,q[1]-14,w,28,8,'rgba(8,22,52,.92)');strokeR(q[0]+16,q[1]-14,w,28,8,c,1);txt(n,q[0]+28,q[1]+5,{size:13,weight:600,ls:1,c});ctx.restore()})});
 txt('RUTE MULTI-OWNER  ·  ILUSTRASI',R[0]+22,R[1]+34,{size:11,weight:500,ls:2,c:MU,fam:MONO});
 const fx=960,fw=850;reveal('Bagi hasil otomatis.',fx,214,.2,{size:48,weight:300});txt('Sistem merangkai ruas dari beberapa cable owner dan membagi pembayaran secara otomatis.',fx,262,{size:18,c:MU,a:prog(t,.6,1.1)});
 const FL=[['Pembayaran pelanggan','tanpa PPN'],['Dibagi ke tiap owner','sesuai porsi komponen ruasnya'],['Dipotong fee platform','dari porsi tiap owner'],['Payout ke rekening','rekening terdaftar owner']];
 FL.forEach(([h,b],i)=>{const a=1.4+i*.7,k=E.out(prog(t,a,a+.5));if(k<=0)return;const y=320+i*130;ctx.save();ctx.globalAlpha*=k;ctx.translate((1-k)*30,0);glowPanel(fx,y,fw,100,16);circ(fx+50,y+50,22,i===3?OKBG:'rgba(46,107,219,.22)');txt(String(i+1),fx+50,y+57,{size:18,weight:600,align:'center',c:i===3?OK:LB});
  txt(h,fx+96,y+44,{size:22,weight:600});txt(b,fx+96,y+72,{size:15,c:MU});ctx.restore();if(i>0){const kk=E.io(prog(t,a-.3,a+.1));line([[fx+50,y-30],[fx+50,lerp(y-30,y,kk)]],LB,2,.7)}});
 const ck=E.out(prog(t,4.6,5.2));if(ck>0){ctx.save();ctx.globalAlpha*=ck;txt('KONTRIBUSI FISIK  =  KM × BOBOT JENIS KABEL',fx,860,{size:12,weight:500,ls:2.2,c:LB,fam:MONO});let cx=fx;['darat','laut','udara','microwave'].forEach(s=>{cx+=chip(cx,878,s,false,{size:14,h:34})+10});ctx.restore()}
 drawOrb([[0,W/2,H+60],[2.0,560,500],[4.2,fx+60,780],[6.0,fx+400,900]],t);
 caption('07 / CABLE OWNER','Setiap ruas mendapat porsinya.','Laporan bagi hasil dapat diunduh dari portal owner.',t,.6,6.8);fade(1-prog(t,0,.4))}
