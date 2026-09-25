// Score for the Hari Bhakti Postel collab (48.5 s). Solemn minor for 1945 -> hopeful major from "81".
const fs = require('fs'); const info = JSON.parse(fs.readFileSync('postel_info.json')); const D = info.total, cues = info.cues, SR = 44100, N = Math.ceil(D * SR);
const L = new Float32Array(N), R = new Float32Array(N); const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let seed = 9; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
function pad(t0, t1, notes, vol = 0.035, cut = 900, att = 1.5, rel = 2) { notes.forEach((m, k) => { const f = hz(m), ph = [Math.random(), Math.random(), Math.random()], pan = (k % 2 ? 1 : -1) * 0.5; let lp = 0;
  for (let i = Math.floor(t0 * SR); i < Math.min(N, Math.floor((t1 + rel) * SR)); i++) { const t = i / SR; let s = 0; [-0.1, 0, 0.09].forEach((d, j) => { ph[j] += f * Math.pow(2, d / 12) / SR; s += (ph[j] % 1) * 2 - 1; }); s /= 3;
    lp += (s - lp) * (1 - Math.exp(-2 * Math.PI * cut / SR)); const e = ss(t0, t0 + att, t) * (1 - ss(t1, t1 + rel, t)) * vol; L[i] += lp * e * (1 - pan); R[i] += lp * e * (1 + pan); } }); }
function pluck(t, m, vol = 0.06, pan = 0, dec = 3.5) { const f = hz(m), i0 = Math.floor(t * SR), n = Math.floor(2.2 * SR); for (let i = 0; i < n && i0 + i < N; i++) { const tt = i / SR, e = Math.exp(-tt * dec) * Math.min(1, tt * 400);
  const s = (Math.sin(2 * Math.PI * f * tt) + 0.35 * Math.sin(4 * Math.PI * f * tt) + 0.12 * Math.sin(6 * Math.PI * f * tt)) * e * vol; L[i0 + i] += s * (1 - pan); R[i0 + i] += s * (1 + pan); } }
function kick(t, v = 0.5) { const i0 = Math.floor(t * SR); let ph = 0; for (let i = 0; i < 0.35 * SR && i0 + i < N; i++) { const tt = i / SR; ph += (48 + 90 * Math.exp(-tt * 28)) / SR; const s = Math.sin(ph * 2 * Math.PI) * Math.exp(-tt * 9) * v; L[i0 + i] += s; R[i0 + i] += s; } }
function swell(t0, t1, v = 0.06) { let lp = 0; for (let i = Math.floor(t0 * SR); i < Math.min(N, Math.floor(t1 * SR)); i++) { const p = (i / SR - t0) / (t1 - t0); lp += (rnd() - lp) * (0.01 + p * 0.4); const s = lp * p * p * v; L[i] += s; R[i] += s * 0.9; } }
function boom(t, v = 0.5) { const i0 = Math.floor(t * SR); let ph = 0; for (let i = 0; i < 3 * SR && i0 + i < N; i++) { const tt = i / SR; ph += (34 + 50 * Math.exp(-tt * 5)) / SR; const s = Math.sin(ph * 2 * Math.PI) * Math.exp(-tt * 1.4) * v; L[i0 + i] += s; R[i0 + i] += s; } }
// 1945: D minor, low & solemn
pad(0, 5.8, [38, 50, 53, 57], 0.04, 600, 2, 1.2); [0.8, 2.3, 3.8].forEach((t, i) => pluck(t, [62, 65, 69][i], 0.05, 0, 1.6));
swell(4.2, 6.0, 0.08); boom(6.0, 0.45);
// 81 -> hopeful D major progression, arpeggios build, kicks from TERHUBUNG
const prog = [[50, 57, 62, 66, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64]]; const BAR = 3.75, BEAT = BAR / 4; // 64 bpm feel, 128 bpm arps
for (let b = 0; 6 + b * BAR < D - 1.5; b++) { const t0 = 6 + b * BAR, ch = prog[b % 4]; pad(t0, t0 + BAR, ch, 0.03, 1100, 0.8, 1.2); pluck(t0, ch[0] - 12, 0.07, 0, 1.2);
  for (let s = 0; s < 8; s++) { const t = t0 + s * BEAT / 2; if (t > D - 2) break; pluck(t, ch[1 + (s % 4)] + 12, 0.028 * ss(6, 11.5, t), s % 2 ? .4 : -.4, 5); }
  if (t0 >= cues[2] - 0.1 && t0 < cues[6]) for (let q = 0; q < 4; q++) kick(t0 + q * BEAT, 0.28); }
[cues[2], cues[4], cues[5]].forEach(t => { swell(t - 1.2, t, 0.06); boom(t, 0.35); });
// finale: resolve on D major, bell tones for "Terhubung. Tumbuh. Terjaga."
swell(cues[6] - 1.4, cues[6], 0.07); boom(cues[6], 0.5); pad(cues[6], D - 1.2, [38, 50, 57, 62, 66, 69, 74], 0.035, 1600, 1, 1.6);
[0.3, 0.65, 1.0].forEach((d, i) => pluck(cues[6] + d, [74, 78, 81][i], 0.07, (i - 1) * .4, 1.2));
// master
let peak = 0; for (let i = 0; i < N; i++) { const t = i / SR, f = ss(0, 0.8, t) * (1 - ss(D - 1.6, D, t)); L[i] = Math.tanh(L[i] * 1.4) * f; R[i] = Math.tanh(R[i] * 1.4) * f; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
const g = 0.89 / peak, out = Buffer.alloc(44 + N * 4); let o = 44; for (let i = 0; i < N; i++) { out.writeInt16LE(Math.round(L[i] * g * 32767), o); out.writeInt16LE(Math.round(R[i] * g * 32767), o + 2); o += 4; }
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
fs.writeFileSync('postel_score.wav', out); console.log('ok', D);
