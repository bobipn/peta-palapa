// node mix.js VERSION  -> mix_VERSION.wav (VO placed on the timeline + ducked ambient score) and VERSION.srt
const fs = require('fs'), S = require('./script.js');
const V = process.argv[2], TL = JSON.parse(fs.readFileSync(`timeline_${V}.json`)), SR = 44100;
const total = TL[TL.length - 1].a + TL[TL.length - 1].D, N = Math.ceil(total * SR);
const L = new Float32Array(N), R = new Float32Array(N), VO = new Float32Array(N);
function readWav(f) { const b = fs.readFileSync(f); let o = 12, fmt, data; while (o < b.length) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4); if (id === 'fmt ') fmt = { sr: b.readUInt32LE(o + 12), ch: b.readUInt16LE(o + 10) }; if (id === 'data') data = b.subarray(o + 8, o + 8 + sz); o += 8 + sz + (sz & 1); }
  const n = data.length / 2 / fmt.ch, out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = data.readInt16LE(i * 2 * fmt.ch) / 32768; return { sr: fmt.sr, s: out }; }
// --- place VO (linear resample to 44.1k), light high-pass + gentle compression
const srt = []; TL.forEach((e, k) => { const w = readWav(`vo/${e.id}.wav`), ratio = w.sr / SR, n = Math.floor(w.s.length / ratio), i0 = Math.floor(e.vo * SR); let hp = 0, prev = 0;
  for (let i = 0; i < n && i0 + i < N; i++) { const x = i * ratio, j = Math.floor(x), f = x - j; let v = w.s[j] * (1 - f) + (w.s[j + 1] || 0) * f; hp = 0.995 * (hp + v - prev); prev = v; v = hp; v = Math.tanh(v * 1.6) / 1.2; VO[i0 + i] += v; }
  const s = S[V].find(x => x.id === e.id); srt.push({ a: e.vo, b: e.vo + n / SR, t: s.vo }); });
// --- ambient score (D major world), follows total length
let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
const hz = m => 440 * Math.pow(2, (m - 69) / 12), ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const prog = [[50, 57, 62, 64, 66, 69], [47, 54, 59, 61, 62, 66], [43, 50, 55, 57, 59, 62], [45, 52, 57, 59, 62, 66]], BAR = 8;
for (let bar = 0; bar * BAR < total + 4; bar++) { const t0 = bar * BAR, ch = prog[bar % 4];
  ch.forEach((m, k) => { const f = hz(m), ph = [Math.random(), Math.random(), Math.random()], dets = [-0.1, 0, 0.08], pan = (k % 2 ? 1 : -1) * 0.5; let lp = 0;
    for (let i = Math.floor(t0 * SR); i < Math.min(N, Math.floor((t0 + BAR + 3) * SR)); i++) { const t = i / SR; let s = 0; dets.forEach((d, j) => { ph[j] += f * Math.pow(2, d / 12) / SR; s += (ph[j] % 1) * 2 - 1; }); s /= 3;
      lp += (s - lp) * (1 - Math.exp(-2 * Math.PI * (700 + 500 * Math.sin(t * 0.07 + k)) / SR)); const env = ss(t0, t0 + 3, t) * (1 - ss(t0 + BAR, t0 + BAR + 3, t)) * 0.035; L[i] += lp * env * (1 - pan); R[i] += lp * env * (1 + pan); } });
  // soft sub + ticks on data scenes
  for (let i = Math.floor(t0 * SR); i < Math.min(N, Math.floor((t0 + BAR) * SR)); i++) { const t = i / SR, s = Math.sin(2 * Math.PI * hz(ch[0] - 24) * t) * 0.05 * ss(t0, t0 + 2, t) * (1 - ss(t0 + BAR - 2, t0 + BAR, t)); L[i] += s; R[i] += s; } }
TL.forEach(e => { if (!['metrics', 'price', 'calc', 'projects', 'journey', 'offers'].includes(e.kind)) return; for (let t = e.a + 0.5; t < e.a + e.D - 0.4; t += 0.5) { const i0 = Math.floor(t * SR); let ph = 0; for (let i = 0; i < 1300 && i0 + i < N; i++) { ph += 2600 / SR; const s = Math.sin(ph * 2 * Math.PI) * Math.exp(-i / SR * 170) * 0.012; L[i0 + i] += s; R[i0 + i] += s * 0.8; } } });
// transition whooshes & end boom
TL.forEach((e, k) => { if (!k) return; const i0 = Math.floor((e.a - 0.35) * SR), n = Math.floor(0.7 * SR); let lp = 0; for (let i = 0; i < n && i0 + i < N; i++) { const p = i / n; lp += (rnd() - lp) * (0.02 + 0.3 * p); const s = lp * Math.sin(Math.PI * p) * 0.05; if (i0 + i >= 0) { L[i0 + i] += s; R[i0 + i] += s; } } });
{ const e = TL[TL.length - 1], i0 = Math.floor((e.a + 0.3) * SR); let ph = 0; for (let i = 0; i < 3 * SR && i0 + i < N; i++) { const tt = i / SR; ph += (36 + 50 * Math.exp(-tt * 6)) / SR; const s = Math.sin(ph * 2 * Math.PI) * Math.exp(-tt * 1.5) * 0.35; L[i0 + i] += s; R[i0 + i] += s; } }
// --- sidechain ducking from VO envelope, then mix & master
let env = 0; const out = Buffer.alloc(44 + N * 4); let peak = 0; const mixL = new Float32Array(N), mixR = new Float32Array(N);
for (let i = 0; i < N; i++) { const a = Math.abs(VO[i]); env = a > env ? env + (a - env) * 0.01 : env * 0.99992; const duck = 1 - 0.62 * Math.min(1, env * 6); const t = i / SR, fade = ss(0, 1.5, t) * (1 - ss(total - 1.6, total, t));
  mixL[i] = (L[i] * duck + VO[i] * 0.9) * fade; mixR[i] = (R[i] * duck + VO[i] * 0.9) * fade; peak = Math.max(peak, Math.abs(mixL[i]), Math.abs(mixR[i])); }
const g = 0.9 / peak; let o = 44; for (let i = 0; i < N; i++) { out.writeInt16LE(Math.round(Math.tanh(mixL[i] * g) * 32767), o); out.writeInt16LE(Math.round(Math.tanh(mixR[i] * g) * 32767), o + 2); o += 4; }
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
fs.writeFileSync(`mix_${V}.wav`, out);
const ts = s => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${x.toFixed(3).replace('.', ',').padStart(6, '0')}`; };
fs.writeFileSync(`${V}.srt`, srt.map((c, i) => `${i + 1}\n${ts(c.a)} --> ${ts(c.b)}\n${c.t}\n`).join('\n'));
console.log(V, 'total', total.toFixed(1), 's, peak', peak.toFixed(2));
