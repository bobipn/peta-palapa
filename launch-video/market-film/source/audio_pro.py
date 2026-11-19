"""C-Ring Market cinematic film — synthesized score + UI sound design (no samples)."""
import numpy as np, wave
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
DUR = 126.0
N = int(SR * DUR)
rng = np.random.default_rng(11)
BUS = {k: np.zeros((N, 2)) for k in ('music', 'fx', 'dry')}

def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, f, o=2): return sosfilt(butter(o, f, btype='low', fs=SR, output='sos'), x, axis=0)
def hp(x, f, o=2): return sosfilt(butter(o, f, btype='high', fs=SR, output='sos'), x, axis=0)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], btype='band', fs=SR, output='sos'), x, axis=0)
def noise(d): return rng.standard_normal(int(d * SR))
def add(bus, t, sig, g=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    if i < 0: sig = sig[-i:]; i = 0
    n = min(len(sig), N - i)
    l = np.cos((pan + 1) * np.pi / 4) * 1.414; r = np.sin((pan + 1) * np.pi / 4) * 1.414
    if sig.ndim == 1:
        BUS[bus][i:i+n, 0] += sig[:n] * g * l; BUS[bus][i:i+n, 1] += sig[:n] * g * r
    else:
        BUS[bus][i:i+n] += sig[:n] * g

def env(d, a, r):
    t = tt(d); return np.minimum(1, t / max(a, 1e-3)) * np.clip((d - t) / max(r, 1e-3), 0, 1)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)

# ---------- instruments ----------
def pad(notes, d, a=2.0, r=2.5, bright=1600):
    t = tt(d); out = np.zeros((len(t), 2))
    for m in notes:
        f = mtof(m)
        for k, det in enumerate((-0.006, -0.002, 0.003, 0.007)):
            ph = rng.random() * 6.28
            s = np.zeros_like(t)
            for h in range(1, 7):
                s += np.sin(2 * np.pi * f * h * (1 + det) * t + ph * h) / h ** 1.3
            out[:, k % 2] += s
    out = lp(out, bright)
    return out * env(d, a, r)[:, None] / (len(notes) * 3.5)

def sub(f, d, a=1.5, r=2.0):
    t = tt(d); return (np.sin(2 * np.pi * f * t) + .25 * np.sin(4 * np.pi * f * t)) * env(d, a, r) * .5

def bell(f, d=2.4, g=1.0):
    t = tt(d)
    s = (np.sin(2*np.pi*f*t) + .45*np.sin(2*np.pi*f*2.01*t)*np.exp(-t*3) + .2*np.sin(2*np.pi*f*3.98*t)*np.exp(-t*6))
    return s * np.exp(-t * 2.2) * np.minimum(1, t * 600) * g * .35

def pluck(f, d=1.2):
    t = tt(d); s = np.sin(2*np.pi*f*t) + .3*np.sin(2*np.pi*2*f*t)*np.exp(-t*8)
    return s * np.exp(-t * 4.5) * np.minimum(1, t * 900) * .3

def soft_kick(g=1.0):
    t = tt(.7); f = 38 + 70 * np.exp(-t * 22)
    return np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t * 5) * g

def boom(g=1.0):
    t = tt(4.0); f = 28 + 50 * np.exp(-t * 3)
    s = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t * 1.1)
    s += lp(noise(4.0), 900) * np.exp(-t * 2.5) * .35
    return np.tanh(s * 1.3) * g

def riser(d=2.5):
    t = tt(d); n = noise(d); out = np.zeros_like(t); seg = int(.02 * SR)
    for i in range(0, len(t), seg):
        fc = 200 + 6000 * (i / len(t)) ** 2.2
        out[i:i+seg] = bp(n[max(0, i-3000):i+seg], fc * .7, min(fc * 1.5, 20000))[-len(out[i:i+seg]):]
    return out * (t / d) ** 2.2 * .5

def air(d=1.6, lo=500, hi=7000):
    t = tt(d); return bp(noise(d), lo, hi) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2 * .35

def tickc(g=1.0):
    d = .03; return (hp(noise(d), 3000) * .5 + np.sin(2*np.pi*2600*tt(d)) * .5) * np.exp(-tt(d) * 220) * g

def key(g=1.0):
    d = .06; return (bp(noise(d), 1200, 5000) * np.exp(-tt(d) * 110) + np.sin(2*np.pi*240*tt(d)) * np.exp(-tt(d) * 70) * .5) * g

def typing(d, rate=.07):
    out = np.zeros(int(d * SR)); t = 0.0
    while t < d - .04:
        c = key(.4 + rng.random() * .4); i = int(t * SR); n = min(len(c), len(out) - i); out[i:i+n] += c[:n]; t += rate * (.6 + rng.random() * .8)
    return out

def chime(t0, pan=0.0, g=1.0):
    add('fx', t0, bell(1318.5, 1.8, g), .5, pan); add('fx', t0 + .11, bell(1975.5, 2.0, g), .42, pan)

def success(t0, g=1.0):
    for i, m in enumerate((74, 78, 81, 86)): add('fx', t0 + i * .07, bell(mtof(m), 2.2, g), .32, -.3 + i * .2)

def click(t0, pan=0.0, g=1.0): add('dry', t0, tickc(g), .5, pan); add('fx', t0, bell(2637, .25, .5), .12, pan)

# ---------- score ----------
# harmony (MIDI roots): D minor colour → Bb maj7 → F → C sus; 8 s per chord
CH = [[50, 57, 62, 65, 69], [46, 53, 58, 62, 69], [41, 53, 57, 60, 65], [48, 55, 60, 62, 67]]
SUBF = [mtof(38), mtof(34), mtof(29), mtof(36)]
def section_gain(t):
    if t < 9: return .58
    if t < 15: return 1.0
    if t < 115.8: return .62
    return 1.0
t = 0.0; i = 0
while t < DUR - 1:
    d = min(8.6, DUR - t + .5)
    g = section_gain(t)
    add('music', t, pad(CH[i % 4], d, a=2.2 if t else 3.5, r=2.4, bright=1300 if t < 9 else 1800), .9 * g)
    add('music', t, sub(SUBF[i % 4], d, a=1.8, r=2.2), .55 * g)
    t += 8.0; i += 1

# arpeggio (title onward), softer under UI, fuller at the end
ARP = [[74, 77, 81, 84], [74, 77, 82, 86], [72, 77, 81, 84], [72, 74, 79, 84]]
step = 0.3
t = 9.0; k = 0
while t < 124:
    if t < 15 or t > 115.8: g = .9
    else: g = .42
    c = ARP[int(t // 8) % 4]
    f = mtof(c[k % 4])
    add('music', t, pluck(f, 1.4), .28 * g, pan=.45 if k % 2 else -.45)
    t += step; k += 1

# gentle pulse (heartbeat) under the product walkthrough
t = 17.6
while t < 115.4:
    add('dry', t, soft_kick(.9), .32)
    t += 0.6

# orbit opening: low swell & riser into the logo
add('music', 0.0, sub(mtof(26), 9.5, a=4, r=1.5), .3)
add('fx', 6.6, riser(2.4), .55)
add('dry', 9.0, boom(.9), .65); add('fx', 9.0, air(2.5, 300, 5000), .4)
success(10.0, .8)
# chapter transitions: airy whoosh + soft bell
for c in (15, 33.6, 53.2, 74, 82.6, 101.2):
    add('fx', c - .45, air(1.2, 400, 6000), .45)
    add('fx', c + .15, bell(mtof(86), 2.6, .8), .28)
    add('dry', c + .1, soft_kick(.8), .45)

# ---------- UI sound design (scene-relative) ----------
def at(s0, ts, fn):
    for x in ts: fn(s0 + x)
# registration 17.6
R0 = 17.6
at(R0, (.9, 1.4, 2.5, 3.3, 4.3, 5.1, 6.3, 7.3), lambda x: click(x, .25))
for a, b in ((1.5, 2.4), (2.6, 3.2), (3.4, 4.2), (4.4, 5.0), (5.2, 5.7)): add('dry', R0 + a, typing(b - a), .35, .25)
success(R0 + 7.85, .9)
# code 27.6
C0 = 27.6
chime(C0 + .45, .6); click(C0 + 2.0, .2)
for j in range(6): add('dry', C0 + 2.2 + j * .2, key(.8), .5, .2)
click(C0 + 3.6, .2); success(C0 + 4.1, .9)
# KYC 36.2
K0 = 36.2
at(K0, (.3, 1.3, 2.8, 3.3, 3.8, 4.5, 5.1, 6.2, 7.3), lambda x: click(x, -.2))
for a, b in ((.4, 1.2), (1.4, 2.0), (3.4, 3.8), (3.9, 4.4)): add('dry', K0 + a, typing(b - a), .32, -.2)
for a in (5.2, 6.3, 7.4): add('fx', K0 + a, air(.7, 1500, 8000), .25, .5); add('fx', K0 + a + .7, bell(mtof(81), .9, .7), .25, .5)
for j, a in enumerate((4.8, 8.2, 10.0)): add('fx', K0 + a, bell(mtof(79 + j * 3), 1.6), .35)
success(K0 + 10.0, 1.0)
# verified notification 47.2
chime(47.2 + .7, -.3); chime(47.2 + .9, .6, .8)
# search 55.8
S0 = 55.8
at(S0, (.6, 1.6, 2.1, 3.1, 3.6, 4.6), lambda x: click(x, .1))
add('dry', S0 + .7, typing(.6), .32, -.2); add('dry', S0 + 2.2, typing(.6), .32, .2)
add('fx', S0 + 4.7, air(.9, 600, 7000), .35)
# result Tentena 61.8 — stops pop in
for j in range(14): add('fx', 61.8 + .5 + j * .13, bell(mtof(84 + (j % 4) * 2), .5, .5), .14, -.4 + j * .06)
add('fx', 61.8 + .3, air(2.4, 300, 3000), .25)
# switch to Manado 68.8
at(68.8, (.5, .8, 4.1), lambda x: click(x, .3))
add('dry', 68.8 + .3, typing(.5), .3, .3)
for j in range(11): add('fx', 68.8 + 1.4 + j * .16, bell(mtof(84 + (j % 4) * 2), .5, .5), .14, -.4 + j * .08)
# order 76.6
O0 = 76.6
add('fx', O0 + .05, air(.6, 600, 6000), .3); add('dry', O0 + .75, typing(.75), .3)
click(O0 + .7); click(O0 + 1.8); click(O0 + 2.9); success(O0 + 4.0, 1.0)
# tracker 85.2
for j, a in enumerate((.4, 1.8, 3.4, 5.0)): add('fx', 85.2 + a, bell(mtof(76 + j * 3), 1.8), .4, -.2 + j * .15)
success(85.2 + 5.0, .9)
# notifications 92.2
for a in (.7, 3.4, 6.0): chime(92.2 + a, -.3); chime(92.2 + a + .2, .6, .8)
# docs 103.8
for j in range(3): add('fx', 103.8 + .6 + j * .25, air(.5, 900, 8000), .3, -.4 + j * .4); add('fx', 103.8 + .8 + j * .25, bell(mtof(81 + j * 2), 1.2, .7), .25)
click(103.8 + 3.6, -.4)
# service 109.8
click(109.8 + .35, -.5); success(109.8 + .9, .7)
# finale 115.8
add('fx', 113.6, riser(2.2), .5)
add('dry', 115.8, boom(.8), .5)
add('fx', 115.8 + 3.0, air(2.2, 300, 5000), .35)
success(115.8 + 3.6, 1.1)
click(115.8 + 6.6, .2)
add('music', 115.8 + 4.0, pad([50, 57, 62, 66, 69, 74], 6.4, a=1.0, r=4.0, bright=2400), .8)

# ---------- reverb & master ----------
def ir(d, decay, seed):
    r = np.random.default_rng(seed); t = tt(d)
    L = r.standard_normal(len(t)) * np.exp(-t * decay); R = r.standard_normal(len(t)) * np.exp(-t * decay)
    return lp(np.stack([L, R], 1), 6000)
def verb(x, d, decay, mix, seed):
    h = ir(d, decay, seed); h /= np.sqrt(np.sum(h ** 2, 0, keepdims=True))
    w = np.stack([fftconvolve(x[:, c], h[:, c])[:N] for c in range(2)], 1)
    return x * (1 - mix) + w * mix
music = verb(BUS['music'], 3.5, 1.4, .45, 1)
fx = verb(BUS['fx'], 2.4, 2.0, .38, 2)
mix = music + fx + BUS['dry']
mix = hp(mix, 28)
fade = np.ones(N); nf = int(1.6 * SR); fade[-nf:] = np.linspace(1, 0, nf) ** 2
fin = np.ones(N); ni = int(.4 * SR); fin[:ni] = np.linspace(0, 1, ni)
mix *= (fade * fin)[:, None]
mix = np.tanh(mix * 1.05) / np.tanh(1.05)
mix /= np.max(np.abs(mix)) / 0.89
pcm = (mix * 32767).astype(np.int16)
with wave.open('audio_pro.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', pcm.shape, float(np.sqrt(np.mean(mix ** 2))))
