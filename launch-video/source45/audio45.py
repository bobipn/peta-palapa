import numpy as np, wave
from scipy.signal import butter, sosfilt

SR = 48000
DUR = 45.0
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


# ---------------- music ----------------
BEAT = 0.5
roots = {'Am': 110.0, 'F': 87.31, 'C': 130.81, 'G': 98.0}
tones = {'Am': [440.0, 523.25, 659.25, 880.0], 'F': [349.23, 440.0, 523.25, 698.46],
         'C': [392.0, 523.25, 659.25, 783.99], 'G': [392.0, 493.88, 587.33, 783.99]}
prog = ['Am', 'F', 'C', 'G']
def chord_at(t): return prog[int(t // 2) % 4]
drops = [(7.5, 8.0), (27.5, 28.0), (39.5, 40.0)]
def in_drop(t): return any(a <= t < b for a, b in drops)
add(0.0, pad([220, 261.6, 329.6], 3.4, att=0.4, rel=0.5), 0.5)
for i in range(13):
    t = i * 0.25
    if i % 2 == 0:
        c = chord_at(t); f = tones[c][(i // 2) % 4]
        add(t, pluck(f * 2 if i % 4 == 2 else f), 0.10, pan=0.3 if i % 4 else -0.3)
t = 3.25
while t < 40.0 - 1e-6:
    b = round((t - 3.25) / BEAT)
    if not in_drop(t):
        add(t, kick(), 0.85)
        if b % 2 == 1: add(t, clap(), 0.55, pan=0.05)
        add(t + 0.25, hat(open_=(b % 4 == 3)), 0.5, pan=0.25)
        add(t, hat(), 0.22, pan=-0.25)
        c = chord_at(t)
        add(t, bass(roots[c], 0.24), 0.36); add(t + 0.25, bass(roots[c], 0.24), 0.30)
    for k in range(2):
        tk = t + k * 0.25; c = chord_at(tk); idx = b * 2 + k
        f = tones[c][idx % 4] * (2 if idx % 8 >= 6 else 1)
        add(tk, pluck(f, 0.3), 0.075 if not in_drop(tk) else 0.05, pan=0.4 if idx % 2 else -0.4)
    t += BEAT
for a, b_ in drops:
    add(a, riser(b_ - a + 0.02), 0.55); add(b_, impact(), 0.9); add(b_, shimmer(1.2), 0.8)
add(40.0, pad([220, 261.6, 329.6, 440], 2.0, att=0.05, rel=0.6), 0.55)
add(41.9, pad([174.6, 220, 261.6, 349.2], 1.6, att=0.1, rel=0.5), 0.5)
add(43.4, pad([196, 261.6, 329.6, 392, 523.3], 1.6, att=0.1, rel=1.2), 0.55)
for i in range(20):
    tk = 40.0 + i * 0.25; c = 'Am' if tk < 41.9 else ('F' if tk < 43.4 else 'C')
    add(tk, pluck(tones[c][i % 4] * (2 if i % 4 == 3 else 1), 0.4), 0.07, pan=0.35 if i % 2 else -0.35)
for tk in (41.0, 42.0, 43.0): add(tk, kick(0.7), 0.5)
add(43.6, shimmer(1.2), 1.0)

# ---------------- SFX (synced to f45/film.html) ----------------
CUT = lambda t: (add(t, whoosh(0.2, 800, 9000), 0.6))
# intro / palette / grid (same as 30s cut)
add(0.05, pencil(0.5), 1.0, -0.4); add(0.22, whoosh(0.38, 300, 3000), 0.6)
add(0.60, thump(90, 1.0), 0.9); add(0.86, meow(0.42), 1.0); add(0.90, pop(420, 880), 0.35)
add(0.95, pencil(0.45), 1.0, 0.2)
for i in range(16): add(1.22 + i * 0.03, click(0.45 + 0.3 * (i % 2)), 0.5, pan=-0.3 + i * 0.04)
add(1.72, pencil(0.33), 1.1, 0.3); add(1.85, pencil(0.35), 0.6, 0.1)
add(2.15, riser(0.35), 0.35); add(2.2, whoosh(0.32, 500, 8000), 0.8)
add(2.55, keycap(), 0.8, -0.2); add(2.66, keycap(), 0.8, 0.2)
add(2.80, pop(300, 700), 0.6)
for i in range(8): add(2.92 + i * 0.043, click(0.5), 0.45, 0.1)
add(3.20, whoosh(0.3, 600, 9000), 0.7)
for k in range(15): add(3.27 + k * 0.05, pop(380 + (k * 53) % 400, 900 + (k * 71) % 500), 0.28, pan=-0.6 + (k % 5) * 0.3)
add(3.45, pencil(0.5), 0.9); add(4.00, zip_(1.3), 0.8)
# value: tangle -> one platform
CUT(5.5)
for i in range(9): add(5.5 + i * 0.04 + 0.05, pop(350 + i * 40, 800 + i * 50), 0.22, -0.6 + i * 0.15)
add(5.7, pencil(0.45), 0.7)
add(6.35, whoosh(0.25, 200, 2000), 0.7); add(6.45, thump(100, 0.8), 0.7)
add(6.5, whoosh(0.5, 600, 9000), 0.7)
for i in range(9): add(6.95 + i * 0.03, click(0.5), 0.4)
for i in range(14): add(6.95 + i * 0.018, click(0.4), 0.3, 0.3)
for i in range(18): add(7.2 + i * 0.02, click(0.4), 0.3, 0.3)
add(7.5, pencil(0.4), 0.6, 0.3)
# chapter 01 market
add(7.72, whoosh(0.4, 300, 7000), 0.9)
for i in range(20): add(8.08 + i * 0.022, click(0.4), 0.35)
add(8.45, pencil(0.33), 1.0); add(8.5, pencil(0.3), 0.6)
# route form
CUT(9.0)
for i in range(4): add(9.2 + i * 0.04, pop(500, 1000), 0.25)
for tk in (9.5, 9.62, 9.74, 9.86): add(tk, click(0.8), 0.5, 0.2)
add(10.0, typing(0.35, 0.035), 0.8, -0.2); add(10.45, typing(0.25, 0.035), 0.8, 0.2)
add(11.0, click(0.8), 0.5); add(11.0, pop(600, 1200), 0.3)
add(10.9, pencil(0.4), 0.6, 0.3)
add(11.55, keycap(), 0.9); add(11.58, click(), 0.6); add(11.6, riser(0.6), 0.25)
# route map
CUT(12.25); add(12.3, pencil(0.4), 0.5)
for i, tk in enumerate((12.55, 13.1, 13.65)): add(tk, zip_(0.6), 0.6, -0.3 + i * 0.3); add(tk + 0.25, pop(500 + i * 150, 1100 + i * 150), 0.4, 0.6)
add(13.15, pencil(0.5), 0.7)
add(14.35, pop(700, 1400), 0.5); add(14.55, pop(400, 900), 0.5, -0.4); add(14.75, pop(800, 1500), 0.4, 0.5)
# cart
CUT(15.75); add(16.0, keycap(), 0.8, -0.2); add(16.07, whoosh(0.45, 600, 6000), 0.6, 0.4)
add(16.5, pop(600, 1300), 0.7, 0.6); add(16.52, click(), 0.6, 0.6)
add(16.6, whoosh(0.3, 300, 5000), 0.6, 0.5)
add(17.25, keycap(), 0.9, 0.3); add(17.33, whoosh(0.42, 800, 9000), 0.7, 0.6)
# on-demand
CUT(17.75)
for i in range(3): add(17.8 + i * 0.08, pop(450 + i * 100, 900 + i * 100), 0.35, -0.4 + i * 0.4)
add(18.3, whoosh(0.3, 300, 3000), 0.5); add(18.5, pop(600, 1200), 0.5); add(18.62, thump(110, 0.7), 0.6)
add(18.75, zip_(0.4), 0.5); add(19.35, zip_(0.4), 0.5, 0.3); add(19.95, zip_(0.25), 0.4)
for tk in (20.05, 20.17, 20.29): add(tk, click(0.7), 0.45)
add(20.35, pencil(0.15), 0.9); add(20.75, keycap(), 0.9); add(20.75, stamp(), 0.5)
add(20.8, shimmer(0.5), 0.5)
# status
CUT(21.25)
for i, tk in enumerate((21.55, 22.15, 22.75, 23.35)): add(tk, pop(500 + i * 120, 1000 + i * 150), 0.55); add(tk, click(), 0.4)
add(21.6, zip_(1.7), 0.35)
add(23.35, meow(0.38, 1.2), 0.8); add(23.4, shimmer(0.8), 0.7)
for i in range(4): add(21.9 + i * 0.08, pop(300, 600), 0.2)
# tiket / tagihan / saldo
CUT(24.25); add(24.4, click(0.8), 0.5); add(24.45, typing(0.25, 0.04), 0.6)
add(24.55, typing(0.45, 0.035), 0.7); add(25.1, keycap(), 0.9); add(25.17, whoosh(0.35, 800, 9000), 0.7, 0.5)
CUT(25.5)
for i in range(3): add(25.55 + i * 0.08, pop(400 + i * 80, 800), 0.35)
add(26.35, keycap(), 0.9); add(26.4, pop(300, 700), 0.4)
CUT(26.75); add(26.97, keycap(), 0.9)
for i in range(4): add(27.1 + i * 0.13 + 0.3, click(1.0), 0.6, 0.3); add(27.1 + i * 0.13 + 0.3, pop(1200, 2400), 0.3, 0.3)
add(27.25, pencil(0.4), 0.6)
# chapter 02
add(27.72, whoosh(0.4, 300, 7000), 0.9)
for i in range(30): add(28.08 + i * 0.018, click(0.4), 0.3)
add(28.45, pencil(0.33), 1.0)
# hub
CUT(29.0); add(29.05, pop(260, 620), 0.6)
for i in range(9): add(29.35 + i * 0.12, zip_(0.3), 0.35, -0.6 + (i % 5) * 0.3); add(29.4 + i * 0.12, pop(400 + i * 60, 900 + i * 60), 0.3, -0.6 + (i % 5) * 0.3)
add(30.0, pencil(0.6), 0.8)
# network map
CUT(32.25); add(32.25, pencil(0.5), 0.5); add(32.3, pencil(1.55), 0.9, 0.2)
for i in range(16): add(33.25 + i * 0.04, pop(900, 1700), 0.12, -0.5 + (i % 5) * 0.25)
add(32.85, pencil(0.5), 0.7, 0.4)
# helpdesk / meeting / booking
CUT(35.0)
for i in range(4): add(35.02 + i * 0.06, pop(500, 1000), 0.3, -0.6)
add(35.3, zip_(0.5), 0.4); add(35.5, pencil(0.5), 0.6)
for i in range(3): add(35.6 + i * 0.15, click(0.8), 0.4)
add(35.9, pop(300, 800), 0.6, 0.5); add(36.0, meow(0.4, 1.3), 0.6, 0.5)
add(36.25, pop(500, 1000), 0.5, 0.5); add(36.7, click(1.0), 0.6, 0.5); add(36.8, pencil(0.15), 0.9, 0.5)
# free
CUT(37.5); add(37.52, pop(200, 500), 0.7)
add(38.05, whoosh(0.25, 200, 2500), 0.5); add(38.25, stamp(), 1.0); add(38.25, impact(0.5), 0.5); add(38.3, shimmer(0.8), 0.8)
for i in range(5): add(38.5 + i * 0.1, pencil(0.1), 0.8, 0.5); add(38.52 + i * 0.1, pop(700, 1400), 0.3, 0.5)
add(39.1, pencil(0.4), 0.4)
# end card (sEnd45 time map: local t'<=3 same, then half speed)
add(39.72, whoosh(0.4, 300, 7000), 0.9)
add(40.20, pop(260, 620), 0.6); add(40.35, typing(0.6, 0.05), 0.8)
add(40.90, whoosh(0.4, 400, 5000), 0.7, 0.5); add(41.30, thump(120, 0.8), 0.8, 0.3); add(41.40, meow(0.5, 1.12), 1.0, 0.3)
for tk in (41.9, 42.25, 42.6): add(tk, pencil(0.3), 0.9); add(tk + 0.15, pencil(0.25), 0.6)
add(42.9, pop(300, 800), 0.5); add(43.25, pencil(0.45), 0.8)
add(43.7, click(1.0), 0.9, 0.2)
# ---------------- master ----------------
fade = np.ones(N); nf = int(0.6 * SR); fade[-nf:] = np.linspace(1, 0, nf) ** 1.5
L *= fade; R *= fade
mix = np.stack([L, R], 1)
mix = hp(mix.T, 25).T
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix /= np.max(np.abs(mix)) / 0.89
pcm = (mix * 32767).astype(np.int16)
with wave.open('audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', pcm.shape, np.sqrt(np.mean(mix**2)))
