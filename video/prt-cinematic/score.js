// Cinematic ambient score, synced to the picture timeline (52 s). Writes score.wav (44.1 kHz stereo 16-bit).
const fs = require('fs');
const SR = 44100, D = 52, N = SR * D;
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- pad: detuned saws through a moving one-pole low-pass ----
function pad(t0, t1, notes, { vol = 0.05, att = 2.5, rel = 3, cut = 900, cut2 = null, wid = 0.6 } = {}) {
  const i0 = Math.floor(t0 * SR), i1 = Math.min(N, Math.floor((t1 + rel) * SR));
  notes.forEach((m, k) => {
    const f = hz(m); const dets = [-0.11, 0.0, 0.09]; const ph = dets.map(() => Math.random()); let lpL = 0, lpR = 0;
    const pan = ((k % 2) ? 1 : -1) * wid * (0.4 + 0.6 * (k / notes.length));
    for (let i = i0; i < i1; i++) {
      const t = i / SR; let s = 0;
      dets.forEach((d, j) => { ph[j] += f * Math.pow(2, d / 12) / SR; s += (ph[j] % 1) * 2 - 1; });
      s /= dets.length;
      const env = ss(t0, t0 + att, t) * (1 - ss(t1, t1 + rel, t));
      const c = cut2 ? cut + (cut2 - cut) * ss(t0, t1, t) : cut; const a = 1 - Math.exp(-2 * Math.PI * c / SR);
      lpL += (s - lpL) * a; lpR += (s - lpR) * a * 0.97;
      L[i] += lpL * env * vol * (1 - pan) * 0.7; R[i] += lpR * env * vol * (1 + pan) * 0.7;
    }
  });
}
function sine(t0, t1, f, { vol = 0.1, att = 1, rel = 1, trem = 0, pan = 0 } = {}) {
  const i0 = Math.floor(t0 * SR), i1 = Math.min(N, Math.floor((t1 + rel) * SR)); let ph = 0;
  for (let i = i0; i < i1; i++) { const t = i / SR; ph += f / SR; const env = ss(t0, t0 + att, t) * (1 - ss(t1, t1 + rel, t)) * (1 - trem * 0.5 * (1 + Math.sin(t * 2 * Math.PI * 0.23)));
    const s = Math.sin(ph * 2 * Math.PI) * env * vol; L[i] += s * (1 - pan); R[i] += s * (1 + pan); }
}
function noise(t0, t1, { vol = 0.05, cut = 400, cut2 = null, att = 0.5, rel = 0.5, hp = 0 } = {}) {
  const i0 = Math.floor(t0 * SR), i1 = Math.min(N, Math.floor((t1 + rel) * SR)); let a1 = 0, b1 = 0, h = 0;
  for (let i = i0; i < i1; i++) { const t = i / SR; const c = cut2 ? cut + (cut2 - cut) * ss(t0, t1, t) : cut; const a = 1 - Math.exp(-2 * Math.PI * c / SR);
    a1 += (rnd() - a1) * a; b1 += (rnd() - b1) * a; let x = a1, y = b1; if (hp) { h += (a1 - h) * 0.02; x = a1 - h; y = b1 - h; }
    const env = ss(t0, t0 + att, t) * (1 - ss(t1, t1 + rel, t)); L[i] += x * env * vol; R[i] += y * env * vol; }
}
function boom(t, vol = 0.5) { const n = Math.floor(3 * SR), i0 = Math.floor(t * SR); let ph = 0;
  for (let i = 0; i < n && i0 + i < N; i++) { const tt = i / SR; ph += (34 + 60 * Math.exp(-tt * 6)) / SR; const s = Math.sin(ph * 2 * Math.PI) * Math.exp(-tt * 1.6) * vol; L[i0 + i] += s; R[i0 + i] += s; } }
function tick(t, vol = 0.03, f = 2400) { const i0 = Math.floor(t * SR), n = Math.floor(0.03 * SR); let ph = 0; for (let i = 0; i < n && i0 + i < N; i++) { ph += f / SR; const s = Math.sin(ph * 2 * Math.PI) * Math.exp(-i / SR * 180) * vol; L[i0 + i] += s * 0.8; R[i0 + i] += s; } }
function bubble(t, f0, vol = 0.05) { const i0 = Math.floor(t * SR), n = Math.floor(0.08 * SR); let ph = 0; for (let i = 0; i < n && i0 + i < N; i++) { const tt = i / SR; ph += f0 * (1 + tt * 18) / SR; const s = Math.sin(ph * 2 * Math.PI) * Math.exp(-tt * 40) * vol; L[i0 + i] += s; R[i0 + i] += s * 0.7; } }

// ---- harmony: D major world, warm and restrained ----
const Dmaj9 = [50, 57, 62, 64, 66, 69], Bm9 = [47, 54, 59, 61, 62, 66], Gmaj9 = [43, 50, 55, 57, 59, 62], A6sus = [45, 52, 57, 59, 62, 66];
// 0-8 s: orbit
sine(0, 16, hz(26), { vol: 0.16, att: 4, rel: 3 }); sine(0, 14, hz(38), { vol: 0.07, att: 5, rel: 3 });
pad(0.5, 8.5, Dmaj9, { vol: 0.045, att: 4, rel: 2.5, cut: 500, cut2: 1400 });
[81, 86, 88, 93].forEach((m, k) => sine(2 + k * 0.7, 9, hz(m), { vol: 0.012, att: 3, rel: 3, trem: 1, pan: k % 2 ? 0.5 : -0.5 }));
noise(5.8, 7.6, { vol: 0.05, cut: 300, cut2: 3500, att: 1.6, rel: 0.4 }); // transition swell
// 8-16 s: the backbone map comes alive
pad(7.8, 16.2, Bm9, { vol: 0.05, att: 2, rel: 1.5, cut: 900, cut2: 1800 });
for (let t = 9.0; t < 16; t += 0.25) tick(t, (Math.round(t * 4) % 4 === 0 ? 0.035 : 0.016) * ss(9, 10.5, t), 2600);
for (let t = 10.0; t < 16; t += 1) sine(t, t + 0.4, hz(74 + [0, 5, 7, 12][Math.round(t) % 4]), { vol: 0.02, att: 0.02, rel: 0.6, pan: 0.3 });
noise(14.8, 16.4, { vol: 0.06, cut: 400, cut2: 5000, att: 1.4, rel: 0.2 }); // dive riser
// 16-28 s: underwater (muffled)
sine(16, 28, hz(33), { vol: 0.12, att: 1.5, rel: 1.5 });
noise(16.3, 28.2, { vol: 0.09, cut: 160, att: 0.6, rel: 0.8 });
pad(16.2, 28.0, Gmaj9.map(m => m - 12).concat([62, 66]), { vol: 0.05, att: 2.5, rel: 1.5, cut: 380, cut2: 700 });
noise(17.7, 18.2, { vol: 0.25, cut: 2000, att: 0.02, rel: 0.5 }); // splash into water
for (let i = 0; i < 70; i++) { const t = 17.9 + Math.pow(Math.random(), 1.8) * 2.2; bubble(t, 350 + Math.random() * 900, 0.03 + Math.random() * 0.03); }
[21.2, 21.9, 22.6].forEach((t, k) => sine(t, t + 0.3, hz(86 + k * 3), { vol: 0.018, att: 0.01, rel: 1.4, pan: 0.2 })); // cutaway shimmer
for (let t = 21.0; t < 23.6; t += 0.5) tick(t, 0.02, 3200);
noise(26.4, 28.0, { vol: 0.07, cut: 300, cut2: 4000, att: 1.4, rel: 0.2 }); // surfacing
// 28-43 s: land, landing station -> BTS
noise(27.9, 28.6, { vol: 0.12, cut: 3000, att: 0.02, rel: 0.6 }); // breach the surface
noise(28, 33, { vol: 0.03, cut: 900, att: 1, rel: 2, hp: 1 }); // surf wash
pad(27.8, 35.5, A6sus, { vol: 0.05, att: 2, rel: 2, cut: 900, cut2: 2200 });
pad(35.2, 43.4, Dmaj9.concat([74]), { vol: 0.05, att: 2, rel: 2, cut: 1200, cut2: 2600 });
sine(28, 43, hz(38), { vol: 0.09, att: 2, rel: 2 });
for (let t = 30; t < 43; t += 0.5) tick(t, 0.02 * ss(30, 33, t), 2200);
for (let t = 33; t < 43; t += 1) { tick(t, 0.05 * ss(33, 35, t), 180); }
// radio waves at the BTS: gentle rising arpeggio
for (let i = 0; i < 24; i++) { const t = 39.2 + i * 0.16; sine(t, t + 0.12, hz([74, 78, 81, 86][i % 4] + (i > 12 ? 5 : 0)), { vol: 0.016, att: 0.01, rel: 0.5, pan: (i % 2 ? 0.4 : -0.4) }); }
noise(41.5, 43.2, { vol: 0.05, cut: 300, cut2: 3000, att: 1.4, rel: 0.2 });
// 43-52 s: resolution & end card
pad(42.8, 50.5, [38, 50, 57, 62, 64, 66, 69, 74, 78], { vol: 0.055, att: 2, rel: 2.5, cut: 1200, cut2: 3200, wid: 0.8 });
sine(43, 51, hz(26), { vol: 0.14, att: 2, rel: 1.5 });
noise(45.6, 47.4, { vol: 0.05, cut: 800, cut2: 8000, att: 1.7, rel: 0.05 }); // reverse swell
boom(47.4, 0.55); [86, 90, 93, 98].forEach((m, k) => sine(47.4 + k * 0.08, 50, hz(m), { vol: 0.014, att: 0.02, rel: 2, pan: k % 2 ? 0.5 : -0.5 }));

// ---- simple Schroeder reverb for space ----
function reverb(buf, mix = 0.25) { const combs = [1557, 1617, 1491, 1422].map(d => ({ d, b: new Float32Array(d), i: 0 })), aps = [225, 556].map(d => ({ d, b: new Float32Array(d), i: 0 }));
  const out = new Float32Array(buf.length); for (let n = 0; n < buf.length; n++) { let s = 0; for (const c of combs) { const y = c.b[c.i]; c.b[c.i] = buf[n] + y * 0.82; c.i = (c.i + 1) % c.d; s += y; }
    s *= 0.25; for (const a of aps) { const y = a.b[a.i]; const x = s + y * 0.5; a.b[a.i] = x; a.i = (a.i + 1) % a.d; s = y - x * 0.5; } out[n] = buf[n] * (1 - mix) + s * mix; } return out; }
const RL = reverb(L, 0.3), RR = reverb(R, 0.3);
// master: fades, soft limit, normalise
let peak = 0; for (let i = 0; i < N; i++) { const t = i / SR, f = ss(0, 1.5, t) * (1 - ss(50.6, 52, t)); RL[i] = Math.tanh(RL[i] * 1.6 * f); RR[i] = Math.tanh(RR[i] * 1.6 * f); peak = Math.max(peak, Math.abs(RL[i]), Math.abs(RR[i])); }
const g = 0.89 / peak, out = Buffer.alloc(44 + N * 4); let o = 44;
for (let i = 0; i < N; i++) { out.writeInt16LE(Math.round(RL[i] * g * 32767), o); out.writeInt16LE(Math.round(RR[i] * g * 32767), o + 2); o += 4; }
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
fs.writeFileSync('score.wav', out); console.log('score.wav', (out.length / 1e6).toFixed(1) + 'MB', 'peak', peak.toFixed(2));
