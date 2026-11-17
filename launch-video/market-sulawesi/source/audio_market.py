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



# ---------------- music: calm, premium ----------------
BEAT = 0.5
roots = {'Am': 110.0, 'F': 87.31, 'C': 130.81, 'G': 98.0}
tones = {'Am': [440.0, 523.25, 659.25, 880.0], 'F': [349.23, 440.0, 523.25, 698.46],
         'C': [392.0, 523.25, 659.25, 783.99], 'G': [392.0, 493.88, 587.33, 783.99]}
prog_ = ['C', 'G', 'Am', 'F']
def chord_at(t): return prog_[int(t // 2) % 4]
add(0.0, pad([261.6, 329.6, 392.0], 4.3, att=0.8, rel=0.8), 0.45)
for i in range(16):
    t = i * 0.25
    if i % 2 == 0: add(t, pluck(tones[chord_at(t)][(i // 2) % 4] * 2, 0.5), 0.06, pan=0.3 if i % 4 else -0.3)
t = 4.0
while t < 39.5 - 1e-6:
    b = round((t - 4.0) / BEAT)
    if not (39.0 <= t < 39.5):
        add(t, kick(), 0.6)
        if b % 2 == 1: add(t, clap(), 0.25, pan=0.05)
        add(t + 0.25, hat(open_=(b % 8 == 7)), 0.3, pan=0.25)
        c = chord_at(t)
        add(t, bass(roots[c], 0.45), 0.3)
    if b % 8 == 0: add(t, pad([f / 2 for f in tones[chord_at(t)][:3]], 4.0, att=0.5, rel=1.0), 0.16)
    for k in range(2):
        tk = t + k * 0.25; idx = b * 2 + k
        if idx % 2 == 0: add(tk, pluck(tones[chord_at(tk)][idx % 4] * 2, 0.35), 0.05, pan=0.4 if idx % 4 else -0.4)
    t += BEAT
add(39.0, riser(0.52), 0.45); add(39.5, impact(0.8), 0.8); add(39.5, shimmer(1.4), 0.9)
add(39.5, pad([261.6, 329.6, 392.0, 523.3], 2.6, att=0.1, rel=0.8), 0.5)
add(41.9, pad([220, 261.6, 329.6, 440], 1.8, att=0.2, rel=0.6), 0.45)
add(43.4, pad([174.6, 261.6, 349.2, 523.3], 1.6, att=0.1, rel=1.2), 0.5)
for i in range(18):
    tk = 39.5 + i * 0.3; c = 'C' if tk < 41.9 else ('Am' if tk < 43.4 else 'F')
    add(tk, pluck(tones[c][i % 4] * 2, 0.5), 0.05, pan=0.35 if i % 2 else -0.35)
add(43.0, shimmer(1.8), 0.8)

# ---------------- SFX ----------------
def oclick(tk, pan=0.0): add(tk, click(0.8), 0.45, pan); add(tk, pop(900, 1500), 0.18, pan)
def swoosh(tk): add(tk, whoosh(0.5, 300, 6000), 0.55)
# intro
add(0.1, pop(400, 900), 0.4); add(0.7, zip_(1.2), 0.3); add(0.75, whoosh(1.1, 600, 5000), 0.25)
add(1.9, shimmer(0.9), 0.5); add(2.2, pop(700, 1300), 0.25); add(2.5, pop(500, 1000), 0.2)
swoosh(3.7)
# sulawesi map
for i in range(9): add(4.5 + i * 0.08, pop(700 + i * 50, 1400), 0.12, -0.3 + i * 0.08)
add(5.0, zip_(0.9), 0.25, -0.2); add(5.2, zip_(1.4), 0.25, 0.3)
for i in range(2): add(5.5 + i * 0.15, pop(500, 1000), 0.2)
swoosh(7.7)
# search
for tk in (8.55, 9.3, 9.95, 10.4, 10.8, 11.5): oclick(tk, 0.1)
add(8.7, typing(0.35, 0.045), 0.6, -0.2); add(9.45, typing(0.3, 0.045), 0.6, 0.2)
add(11.6, whoosh(0.4, 500, 7000), 0.4)
# result Tentena 1G
add(12.7, zip_(1.4), 0.25, -0.3); add(13.0, pop(500, 1000), 0.35, 0.3)
for i in range(4): add(13.2 + i * 0.06, pop(900 + i * 80, 1700), 0.12, 0.4)
# switch to Manado 10G
for tk in (17.95, 18.4, 18.8, 20.95): oclick(tk, 0.3)
add(18.35, typing(0.3, 0.045), 0.6, 0.3); add(19.0, zip_(1.2), 0.25, -0.3); add(19.1, pop(500, 1000), 0.3, 0.3)
# order modal
add(21.55, pop(300, 700), 0.4); add(22.05, typing(0.5, 0.05), 0.5)
oclick(22.8); oclick(23.5); add(23.95, whoosh(0.35, 500, 6000), 0.35)
add(24.35, pop(600, 1200), 0.45); add(24.38, shimmer(0.9), 0.6)
# tracker until active
for i, tk in enumerate((25.8, 27.0, 28.4, 29.8)): add(tk, pop(500 + i * 120, 1000 + i * 180), 0.4); add(tk, click(0.6), 0.25)
for i in range(3): add(26.0 + i * 0.15, pop(800, 1500), 0.12, -0.4 + i * 0.4)
add(29.8, shimmer(1.2), 0.7)
# documents
for i in range(4): add(31.8 + i * 0.16, whoosh(0.25, 800, 7000), 0.2, -0.5 + i * 0.33); add(31.85 + i * 0.16, pop(500 + i * 70, 1000), 0.2, -0.5 + i * 0.33)
oclick(34.3, -0.5)
# service active
oclick(35.8, -0.6); add(35.9, zip_(0.8), 0.2)
for i in range(5): add(36.0 + i * 0.08, pop(700, 1300), 0.1)
# end
add(41.6, pop(400, 900), 0.35); oclick(42.6, 0.2); add(42.65, shimmer(1.0), 0.6)
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
