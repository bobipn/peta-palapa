# Soundtrack for the v2 reel: 96 BPM (beat 0.625 s), kecapi-like plucks in slendro,
# kendang (dhung/tak), kitchen foley synced to the picture, and a gong with ombak (beating).
import numpy as np, wave
SR=44100; DUR=15.0; N=int(SR*DUR); BEAT=0.625; E8=BEAT/2
L=np.zeros(N); R=np.zeros(N); rng=np.random.default_rng(11)

def put(sig,t0,g=1.0,pan=0.0):
    s=int(round(t0*SR))
    if s>=N or len(sig)==0: return
    e=min(N,s+len(sig)); seg=sig[:e-s]*g; th=(pan+1)*np.pi/4
    L[s:e]+=seg*np.cos(th)*1.4142; R[s:e]+=seg*np.sin(th)*1.4142
def tt(d): return np.arange(int(d*SR))/SR
def noise(d): return rng.uniform(-1,1,int(d*SR))
def lp(x,fc):
    a=float(np.exp(-2*np.pi*fc/SR)); b=1-a; acc=0.0; out=[0.0]*len(x)
    for i,v in enumerate(x.tolist()): acc=b*v+a*acc; out[i]=acc
    return np.array(out)
def hp(x,fc): return x-lp(x,fc)
def bp(x,lo,hi): return lp(hp(x,lo),hi)
def lp_sweep(x,fcs):
    al=np.exp(-2*np.pi*fcs/SR).tolist(); out=[0.0]*len(x); acc=0.0
    for i,v in enumerate(x.tolist()): a=al[i]; acc=(1-a)*v+a*acc; out[i]=acc
    return np.array(out)
def ks(f,d,decay=0.996,bright=0.5):
    n=int(d*SR); p=max(2,int(round(SR/f))); buf=lp(rng.uniform(-1,1,p),2500+bright*5000).tolist(); out=[0.0]*n; j=0
    for i in range(n):
        a=buf[j]; b=buf[j+1 if j+1<p else 0]; out[i]=a; buf[j]=decay*(bright*a+(1-bright)*b); j+=1
        if j==p: j=0
    y=np.array(out)*np.minimum(1,np.arange(n)/(0.0015*SR)); return y/(np.max(np.abs(y))+1e-9)
RAT=[1,2**(240/1200),2**(480/1200),2**(720/1200),2**(960/1200)]   # slendro, ~240 cents per step
def sl(i,base=146.83): o,d=divmod(i,5); return base*(2**o)*RAT[d]

# instruments & foley
def dhung():
    t=tt(.4); f=92+70*np.exp(-t*28); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*8.5)+.15*lp(noise(.4),300)*np.exp(-t*20)
def tak():
    t=tt(.1); return bp(noise(.1),1200,6000)*np.exp(-t*60)*.9+np.sin(2*np.pi*460*t)*np.exp(-t*55)*.6
def ghost(): return tak()*.35
def knock():   # ulekan on cobek: stone thud + click + grit
    t=tt(.2); low=np.sin(2*np.pi*(62+45*np.exp(-t*45))*t)*np.exp(-t*20)
    return low*1.1+bp(noise(.2),700,2600)*np.exp(-t*80)+bp(noise(.2),2500,7000)*np.exp(-t*35)*.35
def grind(d):
    g=bp(noise(d),1200,4500); am=np.repeat(rng.uniform(0,1,int(d*200)+2),SR//200+1)[:len(g)]**3; return g*am
def glass_tap():
    t=tt(.15); return (np.sin(2*np.pi*2350*t)*np.exp(-t*45)+.6*np.sin(2*np.pi*3710*t)*np.exp(-t*60))*.5+hp(noise(.15),5000)*np.exp(-t*200)*.3
def crack():
    t=tt(.6); out=hp(noise(.6),3500)*np.exp(-t*60)+sum(np.sin(2*np.pi*f*t)*np.exp(-t*d) for f,d in [(2900,14),(4450,18),(6100,22),(7400,28)])*.25
    for _ in range(14):
        s=int(rng.uniform(.03,.45)*SR); t2=tt(.06); ping=np.sin(2*np.pi*rng.uniform(3500,8500)*t2)*np.exp(-t2*70)*rng.uniform(.08,.2)
        e=min(len(out),s+len(ping)); out[s:e]+=ping[:e-s]
    return out
def hiss(d,lo=3500,hi=9000): return bp(noise(d),lo,hi)
def whoosh(d,f0=300,f1=2400,peak=.5):
    t=tt(d); u=t/d; env=np.where(u<peak,(u/peak)**2,((1-u)/(1-peak))**1.5); return lp_sweep(noise(d),f0+(f1-f0)*np.sin(np.pi*u))*env*2.5
def sreng(d=1.9):   # sambal hits hot oil
    t=tt(d); env=np.minimum(1,t/.008)*(0.38+0.62*np.exp(-t*4.5))*np.minimum(1,(d-t)/.25); out=lp(hp(noise(d),2200),9000)*env*.8
    for _ in range(260):
        s=int((rng.uniform(0,1)**1.6)*(d-.02)*SR); c=hp(noise(.006),3000)*rng.uniform(.3,1.0); e=min(len(out),s+len(c)); out[s:e]+=c[:e-s]
    return out
def tear(d=.42):
    t=tt(d); g=np.repeat(rng.uniform(0,1,int(d*260)+2),SR//260+1)[:int(d*SR)]**2.2
    return bp(noise(d),700,5000)*g*np.minimum(1,t/.03)*np.minimum(1,(d-t)/.08)*1.6
def slap():
    t=tt(.12); return lp(noise(.12),2800)*np.exp(-t*85)+np.sin(2*np.pi*150*t)*np.exp(-t*45)*.6
def thump():   # rubber stamp on paper
    t=tt(.18); return np.sin(2*np.pi*(120+80*np.exp(-t*50))*t)*np.exp(-t*28)+lp(noise(.18),1500)*np.exp(-t*60)*.5
def rattle(d=.5):
    out=np.zeros(int(d*SR))
    for _ in range(90):
        s=int((rng.uniform(0,1)**1.4)*(d-.01)*SR); c=hp(noise(.004),4000)*rng.uniform(.2,.8); e=min(len(out),s+len(c)); out[s:e]+=c[:e-s]
    return out
def gong(d=3.2,f0=64.0):   # detuned partial pair -> ~3.3 Hz ombak
    t=tt(d); bend=1-0.006*np.exp(-t*2.5)
    parts=[(1.0,1.0,.75),(1+3.3/f0,.85,.75),(2.0,.45,1.3),(2.02,.25,1.3),(2.76,.3,1.9),(3.58,.18,2.6),(5.2,.1,3.8)]
    y=(sum(a*np.sin(2*np.pi*f0*r*bend*t)*np.exp(-t*dd) for r,a,dd in parts)+lp(noise(d),350)*np.exp(-t*25)*1.2)*np.minimum(1,t/.005)
    return y/np.max(np.abs(y))
def chime(f=880,d=1.4):
    t=tt(d); return (np.sin(2*np.pi*f*t)*np.exp(-t*3.2)+.4*np.sin(2*np.pi*f*2.76*t)*np.exp(-t*7)+.18*np.sin(2*np.pi*f*5.4*t)*np.exp(-t*13))*np.minimum(1,t/.002)
def scribble(d):
    n=bp(noise(d),2200,7500); st=np.zeros(len(n)); pos=0
    while pos<len(n):
        Ls=int(rng.uniform(.05,.12)*SR); env=np.sin(np.linspace(0,np.pi,Ls))**.7*rng.uniform(.5,1); e=min(len(n),pos+Ls); st[pos:e]=env[:e-pos]; pos+=Ls+int(rng.uniform(.01,.03)*SR)
    return n*st*np.repeat(rng.uniform(.4,1,int(d*400)+2),SR//400+1)[:len(n)]
def groove(t0,dh,tk,gh,g=1.0):
    for e in dh: put(dhung(),t0+e*E8,.8*g)
    for e in tk: put(tak(),t0+e*E8,.5*g,pan=.15)
    for e in gh: put(ghost(),t0+e*E8,1*g,pan=-.15)

# ---- music: kecapi ostinato (eighth notes) ----
bars=[[None,None,None,None,7,9,8,10],[5,7,8,7,5,7,6,4],[7,9,10,9,7,9,8,6],[5,7,8,7,5,7,6,4],[7,9,10,9,10,12,11,9],[10,None,9,7,8,None,5,None]]
for b,bar in enumerate(bars):
    for e,n in enumerate(bar):
        if n is None: continue
        t0=(b*8+e)*E8; put(ks(sl(n),1.3),t0,.30,pan=(-.35 if e%2 else .35))
        if b==4: put(ks(sl(n+5),.9,decay=.994),t0,.10,pan=(.35 if e%2 else -.35))
for n,p in [(5,-.2),(7,0),(9,.2)]: put(ks(sl(n),1.8,decay=.997),0.0,.22,pan=p)
for b,roots in [(1,[0,0]),(2,[2,1]),(3,[0,3]),(4,[2,4])]:
    for k,rn in enumerate(roots): put(ks(sl(rn,73.42),1.0,decay=.998,bright=.35),b*2.5+k*1.25,.32)

# ---- A. hook ----
put(dhung(),0.0,.9); put(gong(1.6,110.0),0.0,.22)
put(hiss(1.3,2500,8000)*np.minimum(1,tt(1.3)/.3),0.0,.10)
for tp in [.31,.94]: put(glass_tap(),tp,.35)
put(crack(),1.25,.8); put(dhung(),1.25,.9); put(whoosh(.7,400,3000,.35),1.25,.35)
put(ghost(),1.5625,1); put(tak(),1.875,.55); put(tak(),2.1875,.5)
put(whoosh(.45,300,1800,.8),2.1,.3)
# ---- B. ulek ----
for h in [2.5,3.125,3.75,4.375]: put(knock(),h,1.0); put(grind(.45),h+.12,.18)
for e in [3,7]: put(tak(),2.5+e*E8,.45,pan=.15)
for e in [1,5]: put(ghost(),2.5+e*E8,1,pan=-.15)
put(thump(),3.125,.6); put(scribble(.5),3.5,.12); put(whoosh(.3,200,1500,.5),4.72,.35)
# ---- C. tumis ----
put(sreng(1.95),5.0,.75); groove(5.0,[0,3],[2,5],[1,4]); put(thump(),5.625,.6)
put(whoosh(.36,250,2000,.5),6.70,.5); put(dhung(),6.875,.6); put(ghost(),7.1875,1)
# ---- D. kukus ----
h=hiss(1.8,3000,8000); put(h*np.sin(np.pi*np.linspace(0,1,len(h))),6.9,.12)
put(slap(),7.05,.35); put(thump(),8.125,.6); groove(7.5,[0],[],[2])
# ---- E. produk ----
put(tear(.45),8.75,.55); groove(7.5,[4],[6,7],[5]); put(slap(),9.1,.4)
put(tear(.16),9.375,.5); put(rattle(.6),9.375,.35); put(thump(),9.375,.5); put(whoosh(.3,300,2200,.4),9.72,.3)
# ---- F. montage (prints land on triplets) ----
groove(10.0,[0,3,6],[2,5,7],[1,4])
for j in range(9):
    td=10.625+j*BEAT/3; put(slap(),td+.12,.5,pan=float(rng.uniform(-.35,.35))); put(tak(),td,.3)
# ---- G. final ----
put(dhung(),12.5,.8); put(whoosh(.5,200,2600,.6),12.45,.45)
put(gong(3.0,64.0),13.125,1.2); put(scribble(.55),13.2,.22)
put(chime(sl(12)),14.375,.25); put(chime(sl(10)),14.375,.15)

mix=np.stack([L,R],1); fl=int(.35*SR); mix[-fl:]*=np.linspace(1,0,fl)[:,None]
peak=np.max(np.abs(mix)); mix=np.tanh(mix/peak*1.8)/np.tanh(1.8)*0.93
w=wave.open('track.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype(np.int16).tobytes()); w.close()
print('track.wav ok, peak before limiter %.2f'%peak)
