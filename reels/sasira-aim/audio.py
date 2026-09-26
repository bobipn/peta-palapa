import math,random,wave,array
SR=44100;D=15;N=SR*D;buf=[0.0]*N;random.seed(3)
def add(t0,dur,fn,g=1.0):
    s=int(t0*SR)
    for i in range(int(dur*SR)):
        j=s+i
        if 0<=j<N: buf[j]+=fn(i/SR)*g
def kick(t): f=45+90*math.exp(-t*30); return math.sin(2*math.pi*f*t)*math.exp(-t*9)
ph={'p':0}
def noise(): return random.uniform(-1,1)
def hat(t): return noise()*math.exp(-t*60)
def clap(t): return noise()*(math.exp(-t*25))*(1 if t>0.01 or int(t*1000)%3 else .3)
def boom(t): return math.sin(2*math.pi*(35+60*math.exp(-t*6))*t)*math.exp(-t*2.5)+noise()*math.exp(-t*12)*.4
def whoosh(dur):
    lp={'y':0}
    def f(t):
        env=math.sin(math.pi*min(t/dur,1));a=.05+.4*env
        lp['y']+= a*(noise()-lp['y']); return lp['y']*env*2.2
    return f
def bass(freq):
    return lambda t: (math.sin(2*math.pi*freq*t)+.35*math.sin(4*math.pi*freq*t))*min(1,t*80)*math.exp(-t*3)
# drums: 120bpm, stop drums in steam section for contrast, then slam back
for b in range(30):
    t=b*0.5
    in_break=12.0<=t<13.4
    if not in_break: add(t,.45,kick,.9)
    if not in_break: add(t+.25,.08,hat,.18)
    if b%2==1 and not in_break: add(t,.2,clap,.35)
    if t<12 or t>=13.4:
        notes=[55,55,65.4,49]; add(t,.45,bass(notes[(b//2)%4]),.35)
for t in [0.0,13.4]: add(t,1.4,boom,1.0)
for t in [1.2,3.4,5.6,7.8,10.0,12.0]: add(t-.25,.4,whoosh(.4),.6)
# sizzle bed
lp={'y':0}
def sizz(t):
    lp['y']=.9*lp['y']+.1*noise(); hp=noise()-lp['y']
    crack = noise()*3 if random.random()<.002 else 0
    return (hp*.35+crack)*min(1,t*4,(2.2-t)*4)
add(3.4,2.2,sizz,.35)
# riser into ending
add(12.0,1.4,lambda t:(math.sin(2*math.pi*(200+t*t*600)*t)*.4+noise()*.3)*(t/1.4)**2,.45)
# final shimmer
add(14.5,.5,lambda t:sum(math.sin(2*math.pi*f*t) for f in (1760,2217,2637))*math.exp(-t*5)*.2,.5)
m=max(abs(v) for v in buf);out=array.array('h',(int(math.tanh(v/m*1.4)*30000) for v in buf))
w=wave.open('track.wav','wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(out.tobytes());w.close();print('ok')
