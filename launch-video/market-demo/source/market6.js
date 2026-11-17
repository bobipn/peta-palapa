/* ================= C-Ring Market — live product demo (registration → activation → documents), ~2:15 ================= */
/* Fictional sample customer only. No prices, no URLs, no real account data. */
const DEMO_CO='PT Contoh Pelanggan';
/* replay an original 45s scene at a new place/speed; T is remapped so packets & ripples stay in sync */
function rel(fn,a0,k=1){return t=>{const s=T;T=a0+t*k;try{fn(t*k)}finally{T=s}}}
/* ---- chapter slate ---- */
function slate(t,num,title,sub){cam(1+t*.02,W/2,H/2);
 const k=E.out(prog(t,0,.5));txt(num,260,430,{size:30,fam:MONO,weight:700,c:OR,a:k});sk([[260,462],[260+lerp(0,1400,E.io(prog(t,.1,.8))),462]],{w:3,c:LB,passes:1});
 txt(title,260,560,{size:76,weight:800,c:NAVY,p:E.out(prog(t,.15,.65))});txt(sub,260,630,{size:30,weight:500,c:GREY,a:prog(t,.45,.8)});
 orb(lerp(W+60,1640,E.out(prog(t,.2,.9))),540,{s:1.3,a:1-prog(t,1.7,2)});softIn(t,.2)}
/* ---- notification mocks (generic mail client + chat phone; no third-party logos) ---- */
function mailClient(x,y,w,h,items,t,o={}){box(x,y,w,h,{r:20});fillP(rrect(x+2,y+2,w-4,60,18),'#F3F5FA');[[x+28,'#E2E6EE'],[x+50,'#E2E6EE'],[x+72,'#E2E6EE']].forEach(([cx,c])=>fillP(ell(cx,y+32,7,7),c));txt('Email · Kotak masuk',x+w/2,y+40,{size:18,weight:700,c:GREY,align:'center'});
 const lw=360;sk([[x+lw,y+62],[x+lw,y+h-10]],{w:1.5,c:LINE,passes:1});
 const shown=items.filter(it=>t>=it.at);shown.slice().reverse().forEach((it,i)=>{const yy=y+74+i*104;const k=E.out(prog(t,it.at,it.at+.35));const sel=i===0;ctx.save();ctx.globalAlpha*=k;ctx.translate(lerp(-30,0,k),0);
  if(sel)fillP(rrect(x+10,yy,lw-20,94,12),SOFT);fillP(ell(x+36,yy+30,16,16),NAVY);ctx.drawImage(IMG.app_icon,x+24,yy+18,24,24);txt('C-Ring Market',x+62,yy+28,{size:16,weight:800});txt(it.time||'',x+lw-24,yy+28,{size:13,weight:600,c:GREY,align:'right'});
  txt(it.title.length>30?it.title.slice(0,29)+'…':it.title,x+62,yy+54,{size:16,weight:700,c:sel?OR2:INK});txt((it.body.length>34?it.body.slice(0,33)+'…':it.body),x+62,yy+78,{size:14,weight:500,c:GREY});ctx.restore()});
 const cur=shown[shown.length-1];if(cur){const k=E.out(prog(t,cur.at+.2,cur.at+.6));ctx.save();ctx.globalAlpha*=k;const rx=x+lw+30,rw=w-lw-60;
  txt(cur.title,rx,y+112,{size:26,weight:800});fillP(ell(rx+18,y+160,18,18),NAVY);ctx.drawImage(IMG.app_icon,rx+4,y+146,28,28);txt('C-Ring Market',rx+48,y+156,{size:17,weight:800});txt('kepada: email kantor Anda',rx+48,y+180,{size:14,weight:500,c:GREY});
  sk([[rx,y+204],[rx+rw,y+204]],{w:1.5,c:LINE,passes:1});const bh=wrapTxt(cur.body,rx,y+246,rw,20,{c:INK,weight:500,lh:30});
  if(cur.code){let cx=rx;cur.code.split('').forEach(d=>{fillP(rrect(cx,y+260+bh,52,64,10),'#EEF2F8');txt(d,cx+26,y+304+bh,{size:34,weight:800,c:NAVY,align:'center'});cx+=62})}
  if(cur.attach){let ax=rx;cur.attach.forEach(a=>{const aw=mw(a,16,700)+64;fillP(rrect(ax,y+270+bh,aw,48,10),'#fff');sk(rrect(ax,y+270+bh,aw,48,10),{closed:true,w:2,c:LINE,passes:1});fillP(rrect(ax+12,y+280+bh,26,28,4),'#C0392B');txt('PDF',ax+25,y+299+bh,{size:9,weight:900,c:'#fff',align:'center'});txt(a,ax+48,y+300+bh,{size:16,weight:700});ax+=aw+12})}
  if(!cur.code){const by=y+(cur.attach?350:280)+bh;btn(rx,by,250,52,'Buka C-Ring Market',{size:18})}
  txt('Email otomatis dari C-Ring Market.',rx,y+h-30,{size:13,weight:500,c:GREY});ctx.restore()}}
function phoneChat(x,y,items,t){const pw=430,ph=860;fillP(rrect(x+14,y+18,pw,ph,56),'rgba(13,33,80,.2)');fillP(rrect(x,y,pw,ph,56),INK);fillP(rrect(x+14,y+14,pw-28,ph-28,44),'#ECE8E1');
 ctx.save();ctx.beginPath();ctx.rect(x+14,y+14,pw-28,ph-28);ctx.clip();fillP(rrect(x+14,y+14,pw-28,104,8),NAVY);txt('WHATSAPP',x+pw/2,y+44,{size:12,fam:MONO,weight:500,c:'#9FB0CF',align:'center'});
 fillP(ell(x+60,y+80,20,20),'#fff');ctx.drawImage(IMG.app_icon,x+44,y+64,32,32);txt('C-Ring Market',x+92,y+78,{size:19,weight:800,c:'#fff'});txt('akun bisnis · notifikasi layanan',x+92,y+100,{size:13,weight:500,c:'#C9D4E8'});
 const shown=items.filter(it=>t>=it.at+.15);let yy=y+ph-40;shown.slice().reverse().forEach(it=>{const lines=[];let line='';(it.title+' — '+it.wa).split(' ').forEach(wd=>{const tst=line?line+' '+wd:wd;if(mw(tst,16,500)>pw-130){lines.push(line);line=wd}else line=tst});if(line)lines.push(line);
  const bh=24+lines.length*23+20;yy-=bh+12;if(yy<y+120)return;const k=E.back(prog(t,it.at+.15,it.at+.45));ctx.save();ctx.translate(x+32,yy+bh);ctx.scale(k,k);ctx.translate(-(x+32),-(yy+bh));
  fillP(rrect(x+32,yy,pw-110,bh,14),'#fff');lines.forEach((l,i)=>txt(l,x+48,yy+30+i*23,{size:16,weight:i===0?700:500,c:INK}));txt((it.time||'')+'  ✓✓',x+32+pw-110-14,yy+bh-10,{size:12,weight:600,c:'#4A78C8',align:'right'});ctx.restore()});
 ctx.restore()}
function notifyScene(t,items,head,sub){cam(1+t*.006,W/2,H/2);
 txt(head,120,120,{size:44,weight:800,c:NAVY,p:E.out(prog(t,0,.4))});txt(sub,120,166,{size:22,weight:500,c:GREY,a:prog(t,.2,.5)});
 mailClient(100,210,1120,640,items,t);phoneChat(1340,150,items,t);
 [['Lonceng notifikasi portal','in-app'],['Email kantor','PDF terlampir bila ada'],['WhatsApp PIC','bila dipilih di preferensi']].forEach(([a,b],i)=>{const x=100+i*380,yy=880,k=E.out(prog(t,.5+i*.15,.8+i*.15));if(k<=0)return;ctx.save();ctx.globalAlpha*=k;
  fillP(rrect(x,yy,360,96,16),'#fff');sk(rrect(x,yy,360,96,16),{closed:true,w:2,c:LINE,passes:1});fillP(ell(x+40,yy+48,18,18),'#E3F5EC');checkMark(x+40,yy+50,16,1,'#1D8348',3.5);
  txt(a,x+72,yy+42,{size:19,weight:800});txt(b,x+72,yy+70,{size:15,weight:500,c:GREY});ctx.restore()});
 const last=items[items.length-1];drawOrb([[0,1250,1100],[items[0].at+.6,400,300,1],[last.at+.8,400,300,1],[last.at+1.8,1180,780]],t);softIn(t,.2)}
/* ---- 15–27 : registration (real form, fictional data) ---- */
function loginBackdrop(dim=0){ctx.save();ctx.setTransform(1,0,0,1,0,0);const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#10306A');g.addColorStop(1,'#060E21');ctx.fillStyle=g;ctx.fillRect(0,0,W*.52,H);ctx.fillStyle='#F3F5F8';ctx.fillRect(W*.52,0,W*.48,H);ctx.restore();
 logo(70,70,260,'#fff');txt('Konektivitas antar-PoP &',70,470,{size:54,weight:800,c:'#fff'});txt('data center, sesuai kebutuhan.',70,532,{size:54,weight:800,c:'#fff'});
 txt('Hitung rute dari jalur kabel nyata, pesan layanan, pantau status',70,592,{size:22,weight:500,c:'#C9D4E8'});txt('provisioning, dan kelola tiket dalam satu portal.',70,624,{size:22,weight:500,c:'#C9D4E8'});
 [['Rute presisi','PRT + kabel laut + data center'],['Self-service','Pesan, ubah bandwidth, perpanjang'],['Status real-time','Diajukan → aktif'],['Tiket','Gangguan & permintaan']].forEach(([a,b],i)=>{const x=70+(i%2)*390,y=800+Math.floor(i/2)*110;fillP(rrect(x,y,370,96,14),'rgba(255,255,255,.07)');txt(a,x+20,y+38,{size:20,weight:800,c:'#fff'});txt(b,x+20,y+68,{size:16,weight:500,c:'#C9D4E8'})});
 if(dim>0){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=`rgba(241,244,249,${dim})`;ctx.fillRect(0,0,W,H);ctx.restore()}}
function regSteps(x,y,w,act){['Isi data','Kode email','Lengkapi data'].forEach((s,i)=>{const sw=(w-20)/3,sx=x+i*(sw+10);fillP(rrect(sx,y,sw,5,3),i<=act?OR:LINE);txt(s,sx,y+30,{size:16,weight:i===act?800:500,c:i===act?INK:GREY})})}
function sReg(t){cam(1+t*.004,W/2,H/2);loginBackdrop();
 const cw=600,cx=W*.52+(W*.48-cw)/2;
 if(t<2.1){const ch=520,cy=(H-ch)/2;box(cx,cy,cw,ch,{r:22});logo(cx+32,cy+36,130,NAVY);sk([[cx+182,cy+36],[cx+182,cy+70]],{w:2,c:LINE,passes:1});txt('Market',cx+196,cy+62,{size:20,weight:800});
  txt('Masuk',cx+32,cy+130,{size:34,weight:800});txt('Masuk dengan email kantor Anda.',cx+32,cy+166,{size:18,weight:500,c:GREY});field(cx+32,cy+200,cw-64,'Email','',0);field(cx+32,cy+300,cw-64,'Kata sandi','',0);
  btn(cx+32,cy+404,cw-64,58,'Masuk',{size:21});txt('Belum punya akun?',cx+32,cy+496,{size:17,weight:500,c:GREY});txt('Daftar',cx+186,cy+496,{size:17,weight:800,c:OR2});
  drawOrb([[0,cx+cw/2,H+60],[1.2,cx+215,cy+490,1],[2.0,cx+240,cy+500]],t);softIn(t,.2);return}
 const lt=t-2.1;const ch=960,cy=(H-ch)/2+6;const k=E.out(prog(lt,0,.4));ctx.save();ctx.globalAlpha*=k;box(cx,cy,cw,ch,{r:22});
 logo(cx+32,cy+30,120,NAVY);sk([[cx+170,cy+30],[cx+170,cy+62]],{w:2,c:LINE,passes:1});txt('Market',cx+184,cy+55,{size:19,weight:800});
 txt('Buat akun perusahaan',cx+32,cy+118,{size:32,weight:800});regSteps(cx+32,cy+138,cw-64,0);
 lab('SAYA MENDAFTAR UNTUK',cx+32,cy+206);const sel=lt>.9?0:-1;[['Membeli layanan',0],['Menyewakan kabel',1]].forEach(([s,i])=>{const bx=cx+32+i*(cw-64)/2+(i?6:0),bw=(cw-64)/2-6;if(i===sel)fillP(rrect(bx,cy+218,bw,50,12),NAVY);else{fillP(rrect(bx,cy+218,bw,50,12),'#fff');sk(rrect(bx,cy+218,bw,50,12),{closed:true,w:2,c:LINE,passes:1})}txt(s,bx+bw/2,cy+250,{size:18,weight:800,c:i===sel?'#fff':INK,align:'center'})});
 sk(rrect(cx+32,cy+276,cw-64,44,12),{closed:true,w:2,c:LINE,passes:1});txt('Keduanya',cx+cw/2,cy+305,{size:17,weight:800,align:'center'});
 if(sel===0)txt('Cari rute, pesan leased line atau sewa core, dan bayar dalam satu tagihan.',cx+32,cy+346,{size:15,weight:500,c:'#33415C',a:prog(lt,.9,1.2)});
 const F=[['Nama perusahaan',DEMO_CO,1.4,2.3],['Nama lengkap Anda','Nama PIC',2.5,3.1],['Email kantor','pic@••••••.co.id',3.3,4.1],['No. HP/WA','0812 •••• ••••',4.3,4.9],['Kata sandi','••••••••••',5.1,5.6]];
 F.forEach(([l,v,a,b],i)=>field(cx+32,cy+372+i*92,cw-64,l,v,prog(lt,a,b+.5)*(1+.5/(b-a))));
 const ck=lt>6.4;sk(rrect(cx+32,cy+838,26,26,6),{closed:true,w:2.5,c:ck?OR:INK,passes:1});if(ck){fillP(rrect(cx+32,cy+838,26,26,6),OR);checkMark(cx+45,cy+852,18,E.out(prog(lt,6.4,6.55)),'#fff',3.5)}
 txt('Saya setuju data perusahaan & PIC diproses LTI untuk verifikasi (KYC).',cx+70,cy+858,{size:14,weight:500});
 btn(cx+32,cy+880,cw-64,56,'Daftar & kirim kode',{size:20,press:lt>7.4&&lt<7.6?1:0});ctx.restore();
 const fy=i=>cy+372+i*92+45;drawOrb([[0,cx+240,cy+490],[.8,cx+160,cy+243,1],[1.3,cx+200,fy(0),1],[2.4,cx+200,fy(1),1],[3.2,cx+200,fy(2),1],[4.2,cx+200,fy(3),1],[5.0,cx+200,fy(4),1],[6.3,cx+45,cy+851,1],[7.3,cx+cw/2,cy+908,1],[8.2,cx+cw/2+60,cy+940]],lt);
 const tk=E.back(prog(lt,7.8,8.1))*(1-prog(lt,9.4,9.8));if(tk>0){ctx.save();ctx.translate(cx+cw/2,70);ctx.scale(tk,tk);fillP(rrect(-250,-34,500,68,34),'#1D8348');txt('Kode dikirim ke email Anda',0,9,{size:22,weight:800,c:'#fff',align:'center'});ctx.restore()}
 softIn(t,.2)}
/* ---- 27–33 : email verification code ---- */
function sCode(t){cam(1+t*.004,W/2,H/2);loginBackdrop();const cw=600,cx=W*.52+(W*.48-cw)/2,ch=560,cy=(H-ch)/2;
 box(cx,cy,cw,ch,{r:22});logo(cx+32,cy+30,120,NAVY);sk([[cx+170,cy+30],[cx+170,cy+62]],{w:2,c:LINE,passes:1});txt('Market',cx+184,cy+55,{size:19,weight:800});
 txt('Masukkan kode',cx+32,cy+118,{size:32,weight:800});regSteps(cx+32,cy+138,cw-64,t>4.2?2:1);txt('Kami mengirim kode 6 digit ke email Anda.',cx+32,cy+214,{size:18,weight:500,c:GREY});
 const code='482916';const n=Math.floor(clamp((t-2.2)/1.2)*6.999);for(let i=0;i<6;i++){const bx=cx+32+i*((cw-64-50)/6+10),bw=(cw-64-50)/6;fillP(rrect(bx,cy+244,bw,76,12),'#fff');sk(rrect(bx,cy+244,bw,76,12),{closed:true,w:2,c:i===n&&t<3.5?OR:LINE,passes:1});if(i<n)txt(code[i],bx+bw/2,cy+296,{size:36,weight:800,c:NAVY,align:'center'})}
 btn(cx+32,cy+352,cw-64,58,'Verifikasi & masuk',{dark:false,size:21,press:t>3.7&&t<3.9?1:0});txt('Kode berlaku 15 menit.',cx+32,cy+452,{size:16,weight:500,c:GREY});
 // incoming email (desktop notification)
 const nk=E.back(prog(t,.4,.8))*(1-prog(t,5.2,5.5));if(nk>0){const nx=W-560,ny=40;ctx.save();ctx.translate(nx+260,ny+80);ctx.scale(nk,nk);ctx.translate(-(nx+260),-(ny+80));box(nx,ny,520,150,{r:16});ctx.drawImage(IMG.app_icon,nx+20,ny+24,40,40);
  txt('EMAIL · baru saja',nx+76,ny+40,{size:13,fam:MONO,weight:500,c:GREY});txt('C-Ring Market · Kode verifikasi',nx+76,ny+66,{size:19,weight:800});txt('Kode Anda: 482 916 · berlaku 15 menit',nx+76,ny+98,{size:17,weight:600,c:OR2});txt('Jangan bagikan kode ini kepada siapa pun.',nx+76,ny+124,{size:14,weight:500,c:GREY});ctx.restore()}
 const ok=E.back(prog(t,4.1,4.4));if(ok>0){ctx.save();ctx.translate(cx+cw/2,cy+ch-60);ctx.scale(ok,ok);fillP(rrect(-210,-26,420,52,26),'#E3F5EC');txt('Email terverifikasi',0,7,{size:19,weight:800,c:'#1D8348',align:'center'});ctx.restore()}
 drawOrb([[0,cx+cw/2,cy+ch+80],[1.0,W-300,120],[2.0,cx+120,cy+282,1],[3.6,cx+cw/2,cy+381,1],[4.6,cx+cw/2+40,cy+440]],t);softIn(t,.2)}
/* ---- 35–47 : company data & KYC documents ---- */
function sKYC(t){cam(1+t*.004,W/2,H/2);box(FX,FY,FW,FH,{r:26});crTop('Market','RUTE · BANDWIDTH · DATA CENTER',[['','moon'],['Akun','dark'],['Modul','dark']]);
 const rx=FX+4,rw=290;fillP(rrect(rx,FY+88,rw,FH-92,4),'#fff');sk([[rx+rw,FY+90],[rx+rw,FY+FH-6]],{w:2,c:LINE,passes:1});txt('MENU',rx+22,FY+128,{size:14,fam:MONO,weight:500,c:GREY});
 let y=FY+150;RAIL_M.forEach(([g,items])=>{y+=26;txt(g,rx+22,y,{size:13,fam:MONO,weight:500,c:GREY});y+=12;items.forEach(n=>{const on=n==='Perusahaan';if(on){fillP(rrect(rx+10,y,rw-24,42,10),SOFT);fillP(rrect(rx+2,y+7,5,28,3),OR)}txt(n,rx+28,y+28,{size:19,weight:on?800:600,c:on?OR2:INK});y+=46})});
 const x0=rx+rw+34,w1=760;txt(DEMO_CO,x0,FY+140,{size:32,weight:800});
 const ver=t>10.6;const pl=ver?['Status: Terverifikasi','#E3F5EC','#1D8348']:null;if(pl)pill(x0+mw(DEMO_CO,32,800)+20,FY+114,pl[0],{bg:pl[1],c:pl[2],size:15,h:32});
 txt('Data perusahaan',x0,FY+196,{size:22,weight:800});
 const F=[['Nama badan hukum',DEMO_CO,.4,1.2],['NPWP','••.•••.•••.•-•••.•••',1.4,2.0],['NIB (OSS)','•••••••••••••',2.2,2.7],['Kota','Makassar',3.6,4.0]];
 F.forEach(([l,v,a,b],i)=>field(x0+(i%2)*(w1/2+10),FY+220+Math.floor(i/2)*96,w1/2-10,l,v,prog(t,a,b+.5)*(1+.5/(b-a))));
 lab('SEGMEN',x0,FY+430);let sx=x0;['ISP / penyedia internet','Operator seluler / jaringan','Korporasi','Data center / cloud'].forEach((s,i)=>{const on=i===0&&t>3.1;const w=mw(s,15,700)+26;if(on)fillP(rrect(sx,FY+442,w,38,19),NAVY);else{fillP(rrect(sx,FY+442,w,38,19),'#fff');sk(rrect(sx,FY+442,w,38,19),{closed:true,w:2,c:LINE,passes:1})}txt(s,sx+w/2,FY+467,{size:15,weight:700,c:on?'#fff':INK,align:'center'});sx+=w+8});
 btn(x0,FY+504,220,52,'Simpan data',{size:19,press:t>4.6&&t<4.8?1:0});
 // KYC documents
 const dx=x0+w1+40,dw=FX+FW-dx-34;box(dx,FY+110,dw,470,{r:16,shadow:false,w:2});txt('Dokumen KYC',dx+24,FY+152,{size:22,weight:800});txt('PDF/JPG/PNG maks. 5 MB',dx+24,FY+180,{size:15,weight:500,c:GREY});
 ['NIB (OSS)','NPWP perusahaan','Akta pendirian / perubahan terakhir'].forEach((s,i)=>{const a=5.2+i*.9;const yy=FY+210+i*118;fillP(rrect(dx+24,yy,dw-48,100,12),'#F6F8FC');txt(s,dx+44,yy+36,{size:18,weight:800});
  const p=E.io(prog(t,a,a+.6));if(p<=0){txt('Belum diunggah',dx+44,yy+70,{size:15,weight:500,c:GREY});fillP(rrect(dx+dw-150,yy+30,110,40,10),'#fff');sk(rrect(dx+dw-150,yy+30,110,40,10),{closed:true,w:2,c:LINE,passes:1});txt('Unggah',dx+dw-95,yy+56,{size:15,weight:800,c:OR2,align:'center'})}
  else{fillP(rrect(dx+44,yy+60,dw-240,10,5),'#E2E6EE');fillP(rrect(dx+44,yy+60,(dw-240)*p,10,5),OR);if(p>=1)pill(dx+dw-150,yy+30,'diterima',{bg:'#E3F5EC',c:'#1D8348',size:15,h:34})}
  const fk=prog(t,a-.45,a);if(fk>0&&fk<1){const f=E.io(fk);ctx.save();ctx.translate(lerp(dx+dw+120,dx+dw-200,f),lerp(yy-60,yy+40,f));ctx.rotate((1-f)*.4);fillP(rrect(-24,-30,48,60,6),'#fff');sk(rrect(-24,-30,48,60,6),{closed:true,w:2,passes:1});txt('PDF',0,6,{size:12,weight:900,c:'#C0392B',align:'center'});ctx.restore()}});
 // onboarding checklist (8 steps as in the portal)
 const cy0=FY+600,bw0=FX+FW-x0-34;box(x0,cy0,bw0,FH-626,{r:16,shadow:false,w:2});txt('Langkah menuju layanan aktif',x0+24,cy0+44,{size:22,weight:800});
 const ST=[['Registrasi perusahaan',4.8],['Verifikasi dokumen (KYC)',8.0],['Persetujuan LTI',10.6],['Pengguna tim'],['Profil pembayaran & kredit'],['Pemesanan layanan'],['Kontrak ditandatangani'],['Layanan aktif']];
 const cw0=(bw0-48)/4;ST.forEach(([h,a],i)=>{const xx=x0+24+(i%4)*cw0,yy=cy0+96+Math.floor(i/4)*92,done=a!=null&&t>a,cur=i===2&&t>8&&!done;
  fillP(ell(xx+20,yy,18,18),done?OR:'#fff');ctx.save();ctx.strokeStyle=done?OR2:cur?OR:LINE;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(xx+20,yy,18,0,2*PI);ctx.stroke();ctx.restore();
  if(done)checkMark(xx+20,yy+2,18*E.back(prog(t,a,a+.2)),1,'#fff',4);else txt(String(i+1),xx+20,yy+6,{size:15,weight:800,c:cur?OR:GREY,align:'center'});
  txt(h,xx+50,yy-2,{size:18,weight:800,c:done?INK:GREY});txt(done?'Selesai':cur?'Diperiksa tim LTI…':i>2?'Setelah verifikasi':'—',xx+50,yy+24,{size:14,weight:500,c:cur?OR2:GREY})});
 const fx=(i)=>[x0+(i%2)*(w1/2+10)+180,FY+220+Math.floor(i/2)*96+45];
 drawOrb([[0,W/2,H+60],[.3,...fx(0),1],[1.3,...fx(1),1],[2.1,...fx(2),1],[3.0,x0+90,FY+461,1],[3.5,...fx(3),1],[4.5,x0+110,FY+530,1],[5.0,dx+dw-95,FY+250,1],[5.9,dx+dw-95,FY+368,1],[6.8,dx+dw-95,FY+486,1],[8.6,x0+24+2*cw0+20,cy0+60],[11,x0+24+2*cw0+40,cy0+150]],t);softIn(t,.2)}
/* ---- notification sets (texts follow the market's in-app notifications; amounts removed) ---- */
const NOTE_VER=[{at:.6,time:'10.02',title:'Status verifikasi',body:'Perusahaan Anda terverifikasi. Anda sudah bisa memesan layanan.',wa:'Perusahaan Anda terverifikasi. Anda sudah bisa memesan layanan.'}];
const ROUTE_TXT='IDC Makassar · Makassar → neuCentrIX Manado · Manado';
const NOTE_ACT=[{at:.6,time:'09.14',title:'Vendor mengonfirmasi (1/1)',body:ROUTE_TXT+' · Vendor A menerima pesanan.',wa:'Vendor A menerima pesanan Makassar → Manado.'},
 {at:2.8,time:'09.15',title:'Semua vendor siap — aktivasi dimulai',body:ROUTE_TXT+' · aktivasi dimulai. Tagihan terbit saat layanan aktif.',wa:'Aktivasi Makassar → Manado dimulai.'},
 {at:5.0,time:'14.30',title:'Ruas aktif (1/1)',body:ROUTE_TXT+' · Vendor A sudah mengaktifkan ruasnya.',wa:'Vendor A sudah mengaktifkan ruasnya.'},
 {at:7.0,time:'14.31',title:'Layanan aktif, tagihan & kontrak',body:'Layanan Makassar → Manado (Leased line 10G) sudah aktif. ID layanan: MP-••••••. Tagihan dan kontrak terlampir (PDF).',wa:'Layanan Makassar → Manado 10G sudah aktif. Dokumen dikirim ke email Anda.',attach:['Kontrak.pdf','Invoice.pdf']}];
const NOTE_CODE=[{at:.3,time:'09.00',title:'Kode verifikasi',body:'Kode 6 digit Anda berlaku 15 menit. Jangan bagikan kode ini kepada siapa pun.',wa:'',code:'482916'}];
function sNotifVer(t){notifyScene(t,NOTE_VER,'Notifikasi otomatis','Setiap perubahan status dikirim ke email kantor dan WhatsApp PIC.')}
function sNotifAct(t){notifyScene(t,NOTE_ACT,'Notifikasi di setiap tahap','Konfirmasi vendor, aktivasi, hingga layanan aktif — tanpa perlu menelepon.')}
/* ---- hero + agenda ---- */
const AGENDA=['Daftar akun','Verifikasi & KYC','Cari & pilih rute','Pesan','Aktivasi & notifikasi','Dokumen'];
function sHero(t){rel(m1Map,4,4/7)(t);ctx.save();ctx.setTransform(1,0,0,1,0,0);
 txt('DEMO PRODUK · ALUR LENGKAP',120,770,{size:16,fam:MONO,weight:500,c:LB,a:prog(t,3.4,3.7)});
 AGENDA.forEach((s,i)=>{const a=prog(t,3.6+i*.25,3.9+i*.25);if(a<=0)return;const x=120+(i%3)*260,y=800+Math.floor(i/3)*64;ctx.save();ctx.globalAlpha*=a;fillP(rrect(x,y,246,50,12),'rgba(255,255,255,.08)');txt(String(i+1).padStart(2,'0'),x+16,y+32,{size:15,fam:MONO,weight:700,c:LB});txt(s,x+54,y+32,{size:18,weight:700,c:'#fff'});ctx.restore()});ctx.restore()}
/* ---- HUD for the long demo ---- */
const HUDS=[['DAFTAR',11,30],['VERIFIKASI',30,52],['CARI',52,71.5],['PESAN',71.5,80.5],['AKTIF',80.5,101.5],['DOKUMEN',101.5,116.5]];
function hud3(){if(T<11||T>=116.3)return;const a=Math.min(prog(T,11,11.3),1-prog(T,116,116.3));
 ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=a;let tot=0;HUDS.forEach(([s])=>{ctx.font=font(15,800,MONO);tot+=ctx.measureText(s).width+56});tot-=56;let x=W/2-tot/2;
 fillP(rrect(x-26,14,tot+52,40,20),'rgba(255,255,255,.92)');
 HUDS.forEach(([s,a0,a1],i)=>{const on=T>=a0&&T<a1,d=T>=a1;ctx.font=font(15,800,MONO);const w=ctx.measureText(s).width;ctx.font=font(15,on?800:600,MONO);ctx.fillStyle=on?OR2:d?'#1D8348':GREY;ctx.fillText(s,x,40);if(i<HUDS.length-1){ctx.fillStyle=LINE;ctx.fillRect(x+w+12,34,32,2)}x+=w+56});ctx.restore()}
/* ---- chapter slates ---- */
const sl=(n,a,b)=>t=>slate(t,n,a,b);
const S01=sl('01','Daftar akun perusahaan','Registrasi mandiri dengan email kantor dan nomor WhatsApp PIC.');
const S02=sl('02','Verifikasi & KYC','Lengkapi data perusahaan, unggah dokumen, tunggu persetujuan LTI.');
const S03=sl('03','Cari & pilih rute','Makassar → Tentena (1G) atau Makassar → Manado (10G).');
const S04=sl('04','Pesan','Satu formulir, setujui syarat layanan, kirim.');
const S05=sl('05','Aktivasi & notifikasi','Status per vendor — dikabarkan lewat email dan WhatsApp.');
const S06=sl('06','Dokumen rilis','Kontrak, SOF, BAA dan BAST terbit otomatis di portal.');
