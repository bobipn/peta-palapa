import numpy as np, wave
from scipy.signal import butter, sosfilt

SR = 48000
DUR = 30.0
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
BPM = 120; BEAT = 0.5
roots = {'Am': 110.0, 'F': 87.31, 'C': 130.81, 'G': 98.0}
tones = {'Am': [440.0, 523.25, 659.25, 880.0], 'F': [349.23, 440.0, 523.25, 698.46],
         'C': [392.0, 523.25, 659.25, 783.99], 'G': [392.0, 493.88, 587.33, 783.99]}
prog = ['Am', 'F', 'C', 'G']
def chord_at(t): return prog[int(t // 2) % 4]
drops = [(5.0, 5.5), (11.5, 12.0), (18.5, 19.0), (25.0, 25.5)]
def in_drop(t): return any(a <= t < b for a, b in drops)

# intro pad + sparse arp
add(0.0, pad([220, 261.6, 329.6], 3.4, att=0.4, rel=0.5), 0.5)
for i in range(int(3.25 / 0.25)):
    t = i * 0.25
    if i % 2 == 0:
        c = chord_at(t); f = tones[c][(i // 2) % 4]
        add(t, pluck(f * 2 if i % 4 == 2 else f), 0.10, pan=0.3 if i % 4 else -0.3)
# main groove
t = 3.25
while t < 25.5 - 1e-6:
    b = round((t - 3.25) / BEAT)
    if not in_drop(t):
        add(t, kick(), 0.85)
        if b % 2 == 1: add(t, clap(), 0.55, pan=0.05)
        add(t + 0.25, hat(open_=(b % 4 == 3)), 0.5, pan=0.25)
        add(t, hat(), 0.22, pan=-0.25)
        c = chord_at(t)
        add(t, bass(roots[c], 0.24), 0.36); add(t + 0.25, bass(roots[c], 0.24), 0.30)
    for k in range(2):
        tk = t + k * 0.25; c = chord_at(tk); idx = (b * 2 + k)
        f = tones[c][idx % 4] * (2 if idx % 8 >= 6 else 1)
        add(tk, pluck(f, 0.3), 0.075 if not in_drop(tk) else 0.05, pan=0.4 if idx % 2 else -0.4)
    t += BEAT
# chapter / drop risers & impacts
for a, b_ in drops:
    add(a, riser(b_ - a + 0.02), 0.55)
    add(b_, impact(), 0.9)
    add(b_, shimmer(1.2), 0.8)
# outro
add(25.5, pad([220, 261.6, 329.6, 440], 2.0, att=0.05, rel=0.6), 0.55)
add(27.4, pad([174.6, 220, 261.6, 349.2], 1.6, att=0.1, rel=0.5), 0.5)
add(28.9, pad([196, 261.6, 329.6, 392, 523.3], 1.1, att=0.1, rel=0.9), 0.55)
for i in range(18):
    tk = 25.5 + i * 0.25; c = 'Am' if tk < 27.4 else ('F' if tk < 28.9 else 'C')
    add(tk, pluck(tones[c][i % 4] * (2 if i % 4 == 3 else 1), 0.4), 0.07, pan=0.35 if i % 2 else -0.35)
for tk in (26.5, 27.5, 28.5):
    add(tk, kick(0.7), 0.5)
add(29.0, shimmer(1.0), 1.0)

# ---------------- SFX (synced to film.html timeline) ----------------
add(0.05, pencil(0.5), 1.0, -0.4)                  # ground line
add(0.22, whoosh(0.38, 300, 3000), 0.6)             # cat falls
add(0.60, thump(90, 1.0), 0.9); add(0.6, click(), 0.3)
add(0.86, meow(0.42), 1.0)
add(0.90, pop(420, 880), 0.35)                      # monogram
add(0.95, pencil(0.45), 1.0, 0.2)                   # "Introducing"
for i in range(16): add(1.22 + i * 0.03, click(0.45 + 0.3 * (i % 2)), 0.5, pan=-0.3 + i * 0.04)
add(1.72, pencil(0.33), 1.1, 0.3)                   # underline scribble
add(1.85, pencil(0.35), 0.6, 0.1)
add(2.15, riser(0.35), 0.35); add(2.2, whoosh(0.32, 500, 8000), 0.8)
add(2.55, keycap(), 0.8, -0.2); add(2.66, keycap(), 0.8, 0.2)
add(2.80, pop(300, 700), 0.6); add(2.8, whoosh(0.2, 1000, 8000), 0.4)
for i in range(8): add(2.92 + i * 0.043, click(0.5), 0.45, 0.1)
add(3.20, whoosh(0.3, 600, 9000), 0.7)
order = [7, 2, 11, 0, 13, 4, 9, 1, 14, 6, 3, 10, 5, 12, 8]
for k in range(15):
    add(3.25 + k * 0.05 + 0.02, pop(380 + (k * 53) % 400, 900 + (k * 71) % 500), 0.28, pan=-0.6 + (order[k] % 5) * 0.3)
add(3.45, pencil(0.5), 0.9)
add(4.00, zip_(1.3), 0.8)
for k in range(15): add(4.0 + 1.3 * (k + 0.5) / 15, click(0.4), 0.35, pan=-0.6 + (k % 5) * 0.3)
add(5.22, whoosh(0.4, 300, 7000), 0.9)             # wipe into ch.1
for i in range(16): add(5.58 + i * 0.022, click(0.4), 0.35)
add(5.95, pencil(0.33), 1.0, 0.2)
add(6.05, pencil(0.3), 0.6, 0.2)
add(6.50, whoosh(0.2, 800, 9000), 0.6)              # cut to target
add(6.52, pencil(0.45), 1.0, 0.3)
add(6.95, whoosh(0.28, 200, 2500), 0.5, -0.3)       # windup
add(7.15, whoosh(0.3, 800, 6000), 0.8, 0.3)         # dart flight
add(7.45, stamp(), 0.9, 0.4); add(7.45, click(), 0.5, 0.4)
for i in range(4): add(7.55 + i * 0.12, pop(700, 1400), 0.35, -0.5); add(7.57 + i * 0.12, pencil(0.1), 0.8, -0.5)
add(8.25, whoosh(0.2, 800, 9000), 0.6)              # cut to kanban
add(8.55, pop(300, 600), 0.5)                       # pick up
for tk in (9.0, 9.4, 9.8): add(tk, pop(600, 1200), 0.45)
for tk in (8.72, 8.84, 9.14, 9.26, 9.52, 9.64): add(tk, click(0.3), 0.3)
add(10.05, stamp(), 1.0); add(10.07, shimmer(0.6), 0.6)
add(10.50, whoosh(0.2, 800, 9000), 0.6)             # cut to calendar
for i in range(5): add(10.80 + i * 0.2, pencil(0.14), 1.0, 0.3); add(10.86 + i * 0.2, pop(500, 1000), 0.3, 0.3)
add(11.72, whoosh(0.4, 300, 7000), 0.9)             # wipe into ch.2
for i in range(19): add(12.08 + i * 0.022, click(0.4), 0.35)
add(12.45, pencil(0.33), 1.0)
add(13.00, whoosh(0.2, 800, 9000), 0.6)
for i in range(5): add(13.0 + i * 0.06, pop(400, 800), 0.25, -0.6)
add(13.15, pop(200, 500), 0.4); add(13.25, pop(300, 700), 0.3, 0.5)
add(13.25, whoosh(0.2, 300, 2000), 0.4)             # cat drops in
for i in range(5):
    tp = 13.6 + i * 0.4
    add(tp - 0.2, whoosh(0.18, 500, 4000), 0.3)
    add(tp, plug(), 0.8, -0.3); add(tp + 0.05, zip_(0.25), 0.5)
for i in range(3): add(15.45 + i * 0.1, zip_(0.25), 0.5, 0.4)
for i in range(10): add(15.75 + i * 0.024, click(0.3), 0.25, 0.4)
add(16.00, whoosh(0.2, 800, 9000), 0.6)
add(16.03, typing(0.65, 0.03), 0.9)
add(16.75, whoosh(0.25, 500, 8000), 0.7)
for i in range(12): add(16.9 + i * 0.037, pop(800 + i * 40, 1600), 0.15, 0.4)
add(17.50, whoosh(0.25, 500, 8000), 0.7); add(17.52, shimmer(0.7), 0.8)
add(17.8, typing(0.35, 0.05), 0.4)
add(18.25, whoosh(0.25, 500, 8000), 0.7)
for i in range(4): add(18.35 + i * 0.05, pop(300, 600), 0.3)
add(18.60, keycap(), 0.7); add(18.62, click(), 0.6)
add(18.72, whoosh(0.4, 300, 7000), 0.9)             # wipe into ch.3
for i in range(20): add(19.08 + i * 0.022, click(0.4), 0.35)
add(19.45, pencil(0.33), 1.0)
add(20.00, whoosh(0.2, 800, 9000), 0.6)
add(20.00, pencil(0.5), 0.5)                        # coastline
add(20.05, pencil(1.55), 0.9, 0.2)                  # routes
for i in range(20): add(21.0 + i * 0.04, pop(900, 1700), 0.12, -0.5 + (i % 5) * 0.25)
add(21.3, pencil(0.3), 0.6, -0.4); add(21.45, pencil(0.3), 0.6, -0.1); add(21.6, pencil(0.3), 0.6, 0.4)
add(22.75, whoosh(0.2, 800, 9000), 0.6)
add(23.10, zip_(0.75), 0.6)
for i in range(6): add(23.05 + i * 0.35, click(0.4), 0.3, -0.5)
add(24.50, whoosh(0.35, 300, 5000), 0.7, 0.4)
add(24.87, stamp(), 0.9, 0.4)
add(25.22, whoosh(0.4, 300, 7000), 0.9)             # wipe into end
add(25.70, pop(260, 620), 0.6)                      # monogram
add(25.85, typing(0.6, 0.05), 0.8)
add(26.40, whoosh(0.4, 400, 5000), 0.7, 0.5)        # cat jump
add(26.80, thump(120, 0.8), 0.8, 0.3)
add(26.90, meow(0.5, 1.12), 1.0, 0.3)
for tk in (27.4, 27.75, 28.1): add(tk, pencil(0.3), 0.9); add(tk + 0.15, pencil(0.25), 0.6)
add(28.40, pop(300, 800), 0.5)
add(28.85, click(1.0), 0.9, 0.2)

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
