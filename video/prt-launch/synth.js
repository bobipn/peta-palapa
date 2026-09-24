const fs=require('fs');const SR=44100,D=30,N=SR*D;const L=new Float32Array(N),R=new Float32Array(N);
const add=(t,buf,pan=0)=>{const i0=Math.floor(t*SR);for(let i=0;i<buf.length;i++){const j=i0+i;if(j<0||j>=N)continue;L[j]+=buf[i]*(1-Math.max(0,pan));R[j]+=buf[i]*(1+Math.min(0,pan))}};
let seed=1;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647*2-1};
const hz=m=>440*Math.pow(2,(m-69)/12);
function tone(f,dur,{type='sq',vol=.2,duty=.5,att=.005,rel=.08,slide=0}={}){const n=Math.floor(dur*SR),b=new Float32Array(n);let ph=0;
  for(let i=0;i<n;i++){const t=i/SR;const ff=f*Math.pow(2,slide*t/dur);ph+=ff/SR;const p=ph%1;let v;
    if(type==='sq')v=p<duty?1:-1;else if(type==='tri')v=4*Math.abs(p-.5)-1;else v=Math.sin(2*Math.PI*p);
    const env=Math.min(1,t/att)*Math.min(1,(dur-t)/rel);b[i]=v*vol*env}return b}
function noise(dur,{vol=.2,decay=20,hp=0}={}){const n=Math.floor(dur*SR),b=new Float32Array(n);let prev=0;
  for(let i=0;i<n;i++){const t=i/SR;let x=rnd();const y=hp?x-prev:x;prev=x;b[i]=y*vol*Math.exp(-t*decay)}return b}
function kick(vol=.7){const n=Math.floor(.25*SR),b=new Float32Array(n);let ph=0;for(let i=0;i<n;i++){const t=i/SR;ph+=(50+120*Math.exp(-t*30))/SR;b[i]=Math.sin(2*Math.PI*ph)*vol*Math.exp(-t*12)}return b}
function whoosh(dur=.5,vol=.25,up=true){const n=Math.floor(dur*SR),b=new Float32Array(n);let lp=0;for(let i=0;i<n;i++){const t=i/SR,p=t/dur;const a=up?p:1-p;const k=.02+a*.5;lp+=(rnd()-lp)*k;b[i]=lp*vol*Math.sin(Math.PI*p)}return b}
const BEAT=.5; // 120 BPM: every cut lands on a beat
// chords Am F C G (i VI III VII)
const prog=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]];
for(let bar=0;bar<15;bar++){const t0=bar*2;const ch=prog[bar%4];
  const intro=t0<3,outro=t0>=28;
  // arpeggio 16ths
  for(let s=0;s<16;s++){const t=t0+s*BEAT/4;if(t>=29.6)break;const note=ch[s%3]+12*(1+(s>>3&1));
    add(t,tone(hz(note),.11,{type:'sq',duty:.25,vol:intro?.045:.05}),s%2?.3:-.3)}
  if(intro)continue;
  // bass 8ths
  for(let s=0;s<8;s++){const t=t0+s*BEAT/2;if(t<3||t>=29.5)continue;add(t,tone(hz(ch[0]-12+(s%2?12:0)),.22,{type:'tri',vol:.22}))}
  // drums
  for(let b=0;b<4;b++){const t=t0+b*BEAT;if(t<3||t>=29)continue;add(t,kick(.55));
    add(t+BEAT/2,noise(.05,{vol:.12,decay:60,hp:1}),.2);if(b%2)add(t,noise(.18,{vol:.22,decay:18}),-.1)}
}
// intro: drop + landing
add(0.35,tone(hz(84),.5,{type:'sq',duty:.5,vol:.12,slide:-2}));add(0.85,kick(.8));add(0.85,noise(.3,{vol:.25,decay:12}));
add(1.45,tone(hz(96),.06,{vol:.1}));add(2.1,tone(hz(79),.08,{vol:.12}));add(2.18,tone(hz(84),.12,{vol:.12}));
add(2.45,whoosh(.55,.35,true));
// cuts
[3,6,10,13.5,17.5,21,24.5].forEach(t=>{add(t,noise(.35,{vol:.3,decay:9}));add(t-.35,whoosh(.4,.25,true))});
// stamp
add(5.1,kick(.9));add(5.1,noise(.4,{vol:.35,decay:8}));
// counters: ticking blips
for(let t=6.5;t<8.4;t+=.07)add(t,tone(hz(88+Math.floor((t-6.5)*6)),.03,{vol:.06}));
for(let t=10.3;t<12.2;t+=.07)add(t,tone(hz(86+Math.floor((t-10.3)*6)),.03,{vol:.06}));
// PoP blips (27)
for(let i=0;i<27;i++)add(15.5+i*.045,tone(hz(72+(i*5)%24),.06,{vol:.08}),((i%5)-2)/3);
// route draw zip
add(13.6,tone(hz(60),1.8,{type:'sq',duty:.125,vol:.04,slide:2}));
// 600 Gbps slam + riser
add(18.2,whoosh(1.35,.35,true));add(19.55,kick(1));add(19.55,noise(.6,{vol:.4,decay:6}));add(19.55,tone(hz(45),.7,{type:'tri',vol:.35}));
// cards
[21,22,23].forEach((t,i)=>{add(t,noise(.12,{vol:.3,decay:30}));add(t,tone(hz(76+i*4),.1,{vol:.1}))});
// logo sparkle + final chime
for(let i=0;i<8;i++)add(25.8+i*.05,tone(hz(84+[0,4,7,12,16,19,24,28][i]),.25,{type:'tri',vol:.08}));
[[69,72,76,81]].forEach(ch=>ch.forEach((m,k)=>add(27.5+k*.03,tone(hz(m),2.2,{type:'tri',vol:.1,rel:1.5}))));
// master: soft clip + fade
const out=Buffer.alloc(44+N*4);let o=44;
for(let i=0;i<N;i++){const t=i/SR;const f=Math.min(1,t/0.05)*Math.min(1,(D-t)/0.8);for(const x of [L[i],R[i]]){const y=Math.tanh(x*1.1)*.85*f;out.writeInt16LE(Math.round(y*32767),o);o+=2}}
out.write('RIFF',0);out.writeUInt32LE(36+N*4,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);out.writeUInt32LE(SR,24);out.writeUInt32LE(SR*4,28);out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(N*4,40);
fs.writeFileSync('music.wav',out);console.log('ok');
