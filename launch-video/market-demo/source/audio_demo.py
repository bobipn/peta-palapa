import numpy as np, wave
from scipy.signal import butter, sosfilt

SR = 48000
DUR = 124.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)
def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype='low', fs=SR, output='sos'), x)
def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype='high', fs=SR, output='sos'), x)

def add(t, sig, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    if i < 0: sig = sig[-i:]; i = 0
    n = min(len(sig), N - i)
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L[i:i+n] += sig[:n] * gain * l * 1.414
    R[i:i+n] += sig[:n] * gain * r * 1.414

def tt(d): return np.arange(int(d * SR)) / SR
def env_exp(d, k): return np.exp(-tt(d) * k)
def noise(d): return rng.standard_normal(int(d * SR))

# ---------------- instruments ----------------
def kick(g=1.0):
    t = tt(0.45); f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7.5)
    s[:200] += np.linspace(1, 0, 200) * 0.5 * rng.standard_normal(200)
    return np.tanh(s * 1.6) * g
def clap():
    d = 0.22; n = bp(noise(d), 900, 5000)
    e = np.exp(-tt(d) * 22)
    for k in (0.0, 0.011, 0.022):
        i = int(k * SR); e[i:i+int(.004*SR)] += 0.8
    return n * e * 0.5
def hat(open_=False):
    d = 0.18 if open_ else 0.05
    return hp(noise(d), 7000) * np.exp(-tt(d) * (18 if open_ else 70)) * 0.35
def saw(f, d, det=0.0):
    t = tt(d); out = np.zeros_like(t)
    for k in range(1, 14):
        out += np.sin(2 * np.pi * f * k * (1 + det) * t) / k
    return out * 0.6
def bass(f, d):
    s = lp(saw(f, d), 520) * np.minimum(1, tt(d) * 200) * np.exp(-tt(d) * 3.2)
    s += np.sin(2 * np.pi * f / 2 * tt(d)) * 0.6 * np.exp(-tt(d) * 2.5)
    return s
def pluck(f, d=0.35):
    t = tt(d)
    s = (np.sin(2*np.pi*f*t) + 0.35*np.sin(2*np.pi*2*f*t) + 0.12*np.sin(2*np.pi*3*f*t)) * np.exp(-t * 11)
    return s * np.minimum(1, t * 800)
def pad(freqs, d, att=0.6, rel=1.0):
    t = tt(d); s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.004, 0.0, 0.005):
            s += lp(saw(f, d, det), 1400)
    e = np.minimum(1, t / att) * np.minimum(1, (d - t) / rel)
    return s * e / (len(freqs) * 3)
def whoosh(d=0.35, lo=400, hi=6000):
    n = noise(d); t = tt(d)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return bp(n, lo, hi) * e * 0.45
def riser(d=0.5):
    t = tt(d); n = noise(d)
    out = np.zeros_like(t); seg = int(0.02 * SR)
    for i in range(0, len(t), seg):
        fc = 300 + 7000 * (i / len(t)) ** 2
        out[i:i+seg] = bp(n[max(0, i-2000):i+seg], fc*0.7, min(fc*1.4, 20000))[-len(out[i:i+seg]):]
    f = 200 + 1800 * (t / d) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.15
    return (out * 0.5 + tone) * (t / d) ** 1.6
def impact(g=1.0):
    t = tt(1.6); f = 32 + 60 * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    s += lp(noise(1.6), 2500) * np.exp(-t * 9) * 0.5
    return np.tanh(s * 1.4) * g
def pop(f0=500, f1=1100, g=1.0):
    t = tt(0.09); f = f0 + (f1 - f0) * (t / 0.09) ** .5
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 45) * g
def click(g=1.0):
    d = 0.02; return (hp(noise(d), 2500) * 0.6 + np.sin(2*np.pi*2400*tt(d))*0.4) * np.exp(-tt(d) * 260) * g
def keycap():
    d = 0.08; return (bp(noise(d), 800, 4000) * np.exp(-tt(d) * 90) + np.sin(2*np.pi*180*tt(d)) * np.exp(-tt(d)*50) * 0.8)
def pencil(d):
    n = bp(noise(d), 2500, 7500)
    t = tt(d)
    gr = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * (18 + 6 * np.sin(t * 3)) * t)) ** 3
    e = np.minimum(1, t / 0.03) * np.minimum(1, (d - t) / 0.05)
    return n * gr * e * 0.22
def typing(d, rate=0.045):
    out = np.zeros(int(d * SR)); t = 0.0
    while t < d - 0.03:
        c = click(0.5 + rng.random() * 0.5); i = int(t * SR); n = min(len(c), len(out) - i); out[i:i+n] += c[:n]
        t += rate * (0.6 + rng.random() * 0.8)
    return out
def thump(f=110, g=1.0):
    t = tt(0.25); return (np.sin(2*np.pi*np.cumsum(f*(1+np.exp(-t*30)))/SR) * np.exp(-t*16)) * g
def plug():
    s = thump(140, 0.9); c = click(0.9); s[:len(c)] += c; return s
def stamp():
    s = thump(80, 1.2); n = lp(noise(0.25), 1500) * np.exp(-tt(0.25) * 25) * 0.6; return s + n
def zip_(d):
    t = tt(d); f = 600 + 900 * t / d
    s = bp(noise(d), 1500, 6000) * (0.5 + 0.5 * np.sign(np.sin(2*np.pi*np.cumsum(np.full_like(t, 38))/SR)))
    return s * np.minimum(1, t / 0.05) * np.minimum(1, (d - t) / 0.08) * 0.25 + np.sin(2*np.pi*np.cumsum(f)/SR) * 0.03
def meow(d=0.5, base=1.0):
    t = tt(d); u = t / d
    f0 = base * (430 + 420 * np.sin(np.pi * np.clip(u * 1.1, 0, 1)) - 120 * u)
    f0 *= 1 + 0.012 * np.sin(2 * np.pi * 6 * t)
    ph = 2 * np.pi * np.cumsum(f0) / SR
    form = 900 + 1500 * np.sin(np.pi * np.clip(u * 1.3, 0, 1))  # "mi-aa-u"
    s = np.zeros_like(t)
    for k in range(1, 12):
        fk = f0 * k
        w = np.exp(-((fk - form) / 700) ** 2) + 0.25 * np.exp(-((fk - 3000) / 900) ** 2)
        s += np.sin(ph * k) * w
    e = np.minimum(1, t / 0.04) * np.clip((d - t) / 0.15, 0, 1)
    s += bp(noise(d), 2000, 6000) * 0.04
    return s * e * 0.28
def shimmer(d=1.6):
    t = tt(d); s = np.zeros_like(t)
    for f in (1760, 2217, 2637, 3520):
        s += np.sin(2*np.pi*f*t + rng.random()*6) * np.exp(-t * (2 + rng.random()))
    return s * 0.08 * np.minimum(1, t / 0.01)




# ---------------- music: calm, premium, 2-minute bed ----------------
BEAT = 0.5
roots = {'Am': 110.0, 'F': 87.31, 'C': 130.81, 'G': 98.0}
tones = {'Am': [440.0, 523.25, 659.25, 880.0], 'F': [349.23, 440.0, 523.25, 698.46],
         'C': [392.0, 523.25, 659.25, 783.99], 'G': [392.0, 493.88, 587.33, 783.99]}
prog_ = ['C', 'G', 'Am', 'F']
def chord_at(t): return prog_[int(t // 2) % 4]
END = 116.5
SLATES = [11, 30, 52, 71.5, 80.5, 101.5]
NOTIFY = [(45, 52), (91.5, 101.5)]
def in_slate(t): return any(s <= t < s + 3 for s in SLATES)
def in_notify(t): return any(a <= t < b for a, b in NOTIFY)
add(0.0, pad([261.6, 329.6, 392.0], 4.3, att=0.8, rel=0.8), 0.45)
for i in range(16):
    t = i * 0.25
    if i % 2 == 0: add(t, pluck(tones[chord_at(t)][(i // 2) % 4] * 2, 0.5), 0.06, pan=0.3 if i % 4 else -0.3)
t = 4.0
while t < END - 1e-6:
    b = round((t - 4.0) / BEAT); c = chord_at(t)
    quiet = in_slate(t); soft = in_notify(t)
    if not (END - 0.5 <= t < END):
        if not quiet:
            add(t, kick(), 0.45 if soft else 0.55)
            if b % 2 == 1: add(t, clap(), 0.18 if soft else 0.22, pan=0.05)
            add(t + 0.25, hat(open_=(b % 8 == 7)), 0.26, pan=0.25)
        add(t, bass(roots[c], 0.45), 0.22 if quiet else 0.28)
    if b % 8 == 0: add(t, pad([f / 2 for f in tones[c][:3]], 4.0, att=0.5, rel=1.0), 0.2 if quiet else 0.15)
    for k in range(2):
        tk = t + k * 0.25; idx = b * 2 + k
        if idx % 2 == 0: add(tk, pluck(tones[chord_at(tk)][idx % 4] * 2, 0.35), 0.05, pan=0.4 if idx % 4 else -0.4)
    t += BEAT
add(END - 0.5, riser(0.52), 0.45); add(END, impact(0.8), 0.8); add(END, shimmer(1.4), 0.9)
add(END, pad([261.6, 329.6, 392.0, 523.3], 3.0, att=0.1, rel=0.8), 0.5)
add(END + 2.6, pad([220, 261.6, 329.6, 440], 2.2, att=0.2, rel=0.6), 0.45)
add(END + 4.6, pad([174.6, 261.6, 349.2, 523.3], 2.9, att=0.1, rel=1.6), 0.5)
for i in range(24):
    tk = END + i * 0.3; c = 'C' if tk < END + 2.6 else ('Am' if tk < END + 4.6 else 'F')
    add(tk, pluck(tones[c][i % 4] * 2, 0.5), 0.05, pan=0.35 if i % 2 else -0.35)
add(END + 5.2, shimmer(1.8), 0.7)

# ---------------- SFX ----------------
def oclick(tk, pan=0.0): add(tk, click(0.8), 0.45, pan); add(tk, pop(900, 1500), 0.18, pan)
def swoosh(tk, g=0.55): add(tk, whoosh(0.5, 300, 6000), g)
def ding(tk, pan=0.0): add(tk, pluck(1567.98, 0.7), 0.22, pan); add(tk + 0.09, pluck(2093.0, 0.8), 0.2, pan)
def wa(tk, pan=0.5): add(tk, pop(700, 1250), 0.35, pan); add(tk + 0.07, pop(900, 1600), 0.25, pan)
def typed(a, b, pan=0.0): add(a, typing(b - a, 0.05), 0.5, pan)
def M(to, a0, ns, k): return ns + (to - a0) / k     # original-film time -> demo time
# intro + hero
add(0.1, pop(400, 900), 0.4); add(0.7, zip_(1.2), 0.3); add(0.75, whoosh(1.1, 600, 5000), 0.25)
add(1.9, shimmer(0.9), 0.5); add(2.2, pop(700, 1300), 0.25); add(2.5, pop(500, 1000), 0.2); swoosh(3.7)
k = 4 / 7
for i in range(9): add(M(4.5 + i * 0.08, 4, 4, k), pop(700 + i * 50, 1400), 0.12, -0.3 + i * 0.08)
add(M(5.0, 4, 4, k), zip_(1.6), 0.25, -0.2); add(M(5.2, 4, 4, k), zip_(2.4), 0.25, 0.3)
for i in range(6): add(7.6 + i * 0.25, pop(600 + i * 60, 1200), 0.16, -0.4 + i * 0.16)
swoosh(10.7)
# chapter slates
for s in SLATES: add(s + 0.05, whoosh(0.6, 400, 5000), 0.3); add(s + 0.2, pop(500, 1100), 0.3); add(s + 0.25, zip_(0.7), 0.12)
# registration (scene 14-24, local lt = t-2.1)
R0 = 14
oclick(R0 + 1.2); swoosh(R0 + 2.0, 0.35)
L0 = R0 + 2.1
oclick(L0 + 0.8, 0.3)
for a, b in ((1.4, 2.3), (2.5, 3.1), (3.3, 4.1), (4.3, 4.9), (5.1, 5.6)): oclick(L0 + a - 0.15, 0.2); typed(L0 + a, L0 + b, 0.2)
oclick(L0 + 6.3, 0.1); oclick(L0 + 7.3, 0.2); add(L0 + 7.8, pop(600, 1200), 0.45); add(L0 + 7.82, shimmer(0.9), 0.5)
# email code (24-30)
C0 = 24
ding(C0 + 0.45, 0.6); oclick(C0 + 2.0)
for i in range(6): add(C0 + 2.2 + i * 0.2, keycap(), 0.35, 0.1)
oclick(C0 + 3.6); add(C0 + 4.1, pop(600, 1200), 0.4); add(C0 + 4.12, shimmer(1.0), 0.55); swoosh(C0 + 5.6, 0.35)
# KYC (33-45)
K0 = 33
for a, b in ((0.4, 1.2), (1.4, 2.0), (2.2, 2.7), (3.6, 4.0)): oclick(K0 + a - 0.1, -0.2); typed(K0 + a, K0 + b, -0.2)
oclick(K0 + 3.0, -0.2); oclick(K0 + 4.5, -0.3)
for a in (5.2, 6.1, 7.0):
    oclick(K0 + a - 0.2, 0.5); add(K0 + a - 0.45, whoosh(0.4, 800, 7000), 0.25, 0.5); add(K0 + a, zip_(0.6), 0.18, 0.5); add(K0 + a + 0.6, pop(800, 1500), 0.25, 0.5)
for i, a in enumerate((4.8, 8.0, 10.6)): add(K0 + a, pop(500 + i * 150, 1000 + i * 200), 0.45, -0.1)
add(K0 + 10.6, shimmer(1.4), 0.7)
# notification: verified (45-52)
N0 = 45; swoosh(N0 - 0.1, 0.3); ding(N0 + 0.6, -0.3); wa(N0 + 0.75, 0.6)
for i in range(3): add(N0 + 0.5 + i * 0.15, pop(700, 1300), 0.1, -0.5 + i * 0.4)
# search / result / switch / order  (replayed from the 45 s cut at new speed)
for to in (8.55, 9.3, 9.95, 10.4, 10.8, 11.5): oclick(M(to, 8, 55, 4.5 / 5.5), 0.1)
typed(M(8.7, 8, 55, 4.5 / 5.5), M(9.1, 8, 55, 4.5 / 5.5), -0.2); typed(M(9.45, 8, 55, 4.5 / 5.5), M(9.8, 8, 55, 4.5 / 5.5), 0.2)
add(M(11.6, 8, 55, 4.5 / 5.5), whoosh(0.4, 500, 7000), 0.4)
k = 5 / 6
add(M(12.7, 12.5, 60.5, k), zip_(1.7), 0.25, -0.3); add(M(13.0, 12.5, 60.5, k), pop(500, 1000), 0.35, 0.3)
for i in range(4): add(M(13.2 + i * 0.06, 12.5, 60.5, k), pop(900 + i * 80, 1700), 0.12, 0.4)
k = 4 / 5
for to in (17.95, 18.4, 18.8, 20.95): oclick(M(to, 17.5, 66.5, k), 0.3)
typed(M(18.35, 17.5, 66.5, k), M(18.7, 17.5, 66.5, k), 0.3); add(M(19.0, 17.5, 66.5, k), zip_(1.5), 0.25, -0.3); add(M(19.1, 17.5, 66.5, k), pop(500, 1000), 0.3, 0.3)
k = 4 / 6
add(M(21.55, 21.5, 74.5, k), pop(300, 700), 0.4); typed(M(22.05, 21.5, 74.5, k), M(22.55, 21.5, 74.5, k))
oclick(M(22.8, 21.5, 74.5, k)); oclick(M(23.5, 21.5, 74.5, k)); add(M(23.95, 21.5, 74.5, k), whoosh(0.35, 500, 6000), 0.35)
add(M(24.35, 21.5, 74.5, k), pop(600, 1200), 0.45); add(M(24.38, 21.5, 74.5, k), shimmer(0.9), 0.6)
# tracker (83.5-91.5)
k = 6 / 8
for i, to in enumerate((25.8, 27.0, 28.4, 29.8)): tk = M(to, 25.5, 83.5, k); add(tk, pop(500 + i * 120, 1000 + i * 180), 0.4); add(tk, click(0.6), 0.25)
add(M(29.8, 25.5, 83.5, k), shimmer(1.2), 0.7)
# notifications per stage (91.5-101.5)
N1 = 91.5; swoosh(N1 - 0.1, 0.3)
for a in (0.6, 2.8, 5.0, 7.0): ding(N1 + a, -0.3); wa(N1 + a + 0.15, 0.6)
add(N1 + 7.0, shimmer(1.2), 0.5); oclick(N1 + 7.8, -0.4)
# documents (104.5-110.5)
k = 4 / 6
for i in range(4): tk = M(31.8 + i * 0.16, 31.5, 104.5, k); add(tk, whoosh(0.25, 800, 7000), 0.2, -0.5 + i * 0.33); add(tk + 0.05, pop(500 + i * 70, 1000), 0.2, -0.5 + i * 0.33)
oclick(M(34.3, 31.5, 104.5, k), -0.5)
# service (110.5-116.5)
oclick(M(35.8, 35.5, 110.5, k), -0.6); add(M(35.9, 35.5, 110.5, k), zip_(1.2), 0.2)
for i in range(5): add(M(36.0 + i * 0.08, 35.5, 110.5, k), pop(700, 1300), 0.1)
# end card (116.5-124, k=5.5/7.5)
k = 5.5 / 7.5
add(M(41.6, 39.5, 116.5, k), pop(400, 900), 0.35); oclick(M(42.6, 39.5, 116.5, k), 0.2); add(M(42.65, 39.5, 116.5, k), shimmer(1.0), 0.6)
# ---------------- master ----------------
fade = np.ones(N); nf = int(1.2 * SR); fade[-nf:] = np.linspace(1, 0, nf) ** 1.5
L *= fade; R *= fade
mix = np.stack([L, R], 1)
mix = hp(mix.T, 25).T
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix /= np.max(np.abs(mix)) / 0.89
pcm = (mix * 32767).astype(np.int16)
with wave.open('audio_demo.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', pcm.shape, np.sqrt(np.mean(mix**2)))
