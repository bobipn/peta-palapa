// Collab film: Palapa Ring Tengah × Hari Bhakti Postel ke-81 (27 September 2026), tema T3 — Terhubung, Tumbuh, Terjaga.
// Size-agnostic: ?v=9x16 (1080×1920) or default 16:9 (1920×1080). Level-1 plates come from the clean 3D renders.
// Facts used: Hari Bhakti Postel history & T3 (Komdigi, via ANTARA 2026); PRT figures from the product PPT (facts.js).
const VERT = location.search.includes('9x16'), W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080, FPS = 30;
const cv = document.getElementById('c'); cv.width = W; cv.height = H; const X = cv.getContext('2d');
const C = { navy: '#040E18', cyan: '#3CCBF4', white: '#F6F8FA', muted: '#B7C9D8', red: '#D7262E', gold: '#F2C14E' };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t, inv = (a, b, x) => clamp((x - a) / (b - a));
const eO = t => 1 - Math.pow(1 - clamp(t), 3), eIO = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const ap = (lt, t0, d = 0.6) => eO(inv(t0, t0 + d, lt));
const U = VERT ? 1 : 0.92; // type scale
function T(s, x, y, o = {}) { const { size = 40, weight = 700, color = C.white, align = 'left', alpha = 1, track = 0, maxW = 0, shadow = true } = o; if (alpha <= 0.003) return 0;
  X.save(); X.globalAlpha *= alpha; X.font = `${weight} ${size * U}px M`; X.letterSpacing = track + 'px'; X.textAlign = align; X.fillStyle = color; if (shadow) { X.shadowColor = 'rgba(0,0,0,.55)'; X.shadowBlur = 16; }
  let w = X.measureText(s).width; if (maxW && w > maxW) { X.font = `${weight} ${size * U * maxW / w}px M`; w = maxW; } X.fillText(s, x, y); X.restore(); return w; }
function wrap(s, x, y, maxW, o = {}) { const size = (o.size || 34) * U, lh = o.lh || size * 1.32; X.save(); X.font = `${o.weight || 500} ${size}px M`; const L = []; let l = '';
  s.split(' ').forEach(w => { const t = l ? l + ' ' + w : w; if (X.measureText(t).width > maxW && l) { L.push(l); l = w; } else l = t; }); L.push(l); X.restore();
  L.forEach((q, i) => T(q, x, y + i * lh, { ...o, size: o.size || 34 })); return L.length * lh; }
function fill(c, a = 1) { X.save(); X.globalAlpha = a; X.fillStyle = c; X.fillRect(0, 0, W, H); X.restore(); }
function grad(a0, a1, dir = 'bottom') { const g = dir === 'bottom' ? X.createLinearGradient(0, H, 0, H * 0.25) : X.createLinearGradient(0, 0, 0, H * 0.45); g.addColorStop(0, `rgba(3,10,18,${a0})`); g.addColorStop(1, `rgba(3,10,18,${a1})`); X.fillStyle = g; X.fillRect(0, 0, W, H); }
// ---- plates (cover-fit, frame-blended) ----
const P = { earth: [0.4, 8.4, 0.62], region: [9.0, 16.0, 0.55], cutaway: [21.0, 23.8, 0.6], pop: [36.0, 38.4, 0.5], bts: [38.4, 41.0, 0.5], town: [41.0, 43.3, 0.5], finale: [43.4, 47.3, 0.55] }; // [t0, t1, focusX]
const cache = new Map(); function frame(n) { n = clamp(n, 0, 1559) | 0; if (cache.has(n)) return cache.get(n); const p = new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = `plates/f_${String(n).padStart(5, '0')}.jpg`; }); cache.set(n, p); if (cache.size > 80) cache.delete(cache.keys().next().value); return p; }
async function plate(names, lt, D, zoom = 1) { const list = names.split('+'), tot = list.reduce((a, k) => a + P[k][1] - P[k][0], 0); let pt = clamp(lt / D) * tot, k = 0; while (k < list.length - 1 && pt > P[list[k]][1] - P[list[k]][0]) { pt -= P[list[k]][1] - P[list[k]][0]; k++; }
  const [t0, , fx] = P[list[k]], f = (t0 + pt) * FPS, f0 = Math.floor(f), fr = f - f0, [a, b] = await Promise.all([frame(f0), frame(f0 + 1)]);
  const s = Math.max(W / 1920, H / 1080) * zoom, dw = 1920 * s, dh = 1080 * s, dx = VERT ? clamp(W / 2 - dw * fx, W - dw, 0) : (W - dw) / 2, dy = (H - dh) / 2;
  fill(C.navy); if (a) X.drawImage(a, dx, dy, dw, dh); if (b && fr > .02) { X.save(); X.globalAlpha = fr; X.drawImage(b, dx, dy, dw, dh); X.restore(); } }
// ---- brand bits ----
const IMG = {}; const load = (k, s) => new Promise(r => { const i = new Image(); i.onload = () => { IMG[k] = i; r(); }; i.onerror = r; i.src = s; });
function lti(cx, cy, w, a) { if (!IMG.lti || a <= 0) return; const h = w * IMG.lti.height / IMG.lti.width, pad = w * 0.09; X.save(); X.globalAlpha = a; X.beginPath(); X.roundRect(cx - w / 2 - pad, cy - h / 2 - pad * 0.8, w + pad * 2, h + pad * 1.6, 18); X.fillStyle = 'rgba(255,255,255,0.96)'; X.fill(); X.drawImage(IMG.lti, cx - w / 2, cy - h / 2, w, h); X.restore(); }
function redWhite(x, y, w, a) { X.save(); X.globalAlpha = a; X.fillStyle = C.red; X.fillRect(x, y, w, 6); X.fillStyle = '#fff'; X.fillRect(x, y + 6, w, 6); X.restore(); }
function t3Chip(x, y, a, active = -1) { const L = ['TERHUBUNG', 'TUMBUH', 'TERJAGA']; let xx = x; L.forEach((s, i) => { X.save(); X.globalAlpha = a * (active < 0 || active === i ? 1 : 0.38); X.font = `800 ${22 * U}px M`; X.letterSpacing = '4px'; const w = X.measureText(s).width;
  X.fillStyle = active === i ? C.cyan : '#fff'; X.fillText(s, xx, y); X.restore(); xx += w + 30 * U + 12; if (i < 2) { X.save(); X.globalAlpha = a * .5; X.fillStyle = '#fff'; X.fillRect(xx - 24 * U, y - 8, 6, 6); X.restore(); } }); }
function actTitle(word, n, lt, sub) { // big T3 word with number, positioned for both formats
  const a = ap(lt, 0.3, 0.7), y = VERT ? H * 0.56 : H * 0.60, x = VERT ? 72 : 110;
  T(`0${n}  /  T3`, x, y - (VERT ? 150 : 128), { size: 26, weight: 800, color: C.cyan, alpha: a, track: 6 });
  T(word, x, y + (1 - a) * 30, { size: VERT ? 150 : 150, weight: 800, alpha: a, track: -2, maxW: W - x * 2 });
  redWhite(x, y + 34, 120, ap(lt, 0.8)); const b = ap(lt, 1.0, 0.8); wrap(sub, x, y + (VERT ? 120 : 110) + (1 - b) * 20, VERT ? W - x * 2 : 1100, { size: VERT ? 40 : 36, weight: 500, color: '#E3ECF4', alpha: b, lh: (VERT ? 40 : 36) * 1.4 * U }); }
function stat(x, y, n, u, l, a) { T(n, x, y, { size: VERT ? 96 : 84, weight: 800, alpha: a, track: -1 }); X.save(); X.font = `800 ${(VERT ? 96 : 84) * U}px M`; X.letterSpacing = '-1px'; const w = X.measureText(n).width; X.restore();
  if (u) T(u, x + w + 10, y, { size: 34, weight: 800, color: C.cyan, alpha: a }); T(l, x, y + 46 * U, { size: 26, weight: 600, color: C.muted, alpha: a }); }

// ======================= SCENES =======================
const S = [
  { D: 6.0, f: async (lt, D) => { // 1945
    fill('#07090C'); const g = X.createRadialGradient(W / 2, H * .45, 10, W / 2, H * .45, H * .8); g.addColorStop(0, 'rgba(120,60,40,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); X.fillStyle = g; X.fillRect(0, 0, W, H);
    // flag pole + Merah Putih rising (stylised, no archival imagery)
    const px = VERT ? W * 0.72 : W * 0.72, top = H * (VERT ? 0.16 : 0.14), bot = H * (VERT ? 0.52 : 0.86); X.save(); X.globalAlpha = ap(lt, 0.2); X.fillStyle = '#9aa3aa'; X.fillRect(px, top, 5, bot - top); X.restore();
    const fy = lerp(bot - 60, top + 4, eIO(inv(1.2, 4.2, lt))), wave = Math.sin(lt * 5) * 5, fw = VERT ? 190 : 210, fh = fw * 2 / 3; X.save(); X.globalAlpha = ap(lt, 1.0);
    for (let i = 0; i < 24; i++) { const xx = px + 5 + i * fw / 24, dy = Math.sin(lt * 4 + i * 0.35) * 4 * (i / 24); X.fillStyle = C.red; X.fillRect(xx, fy + dy + wave * 0, fw / 24 + 1, fh / 2); X.fillStyle = '#F4F4F4'; X.fillRect(xx, fy + fh / 2 + dy, fw / 24 + 1, fh / 2); } X.restore();
    const x = VERT ? 72 : 110, y = VERT ? H * 0.66 : H * 0.44; const a = ap(lt, 0.4, 0.8);
    T('27 SEPTEMBER 1945', x, y, { size: VERT ? 74 : 80, weight: 800, alpha: a, track: 3 }); redWhite(x, y + 30, 120, ap(lt, 0.9));
    wrap('Para pemuda Angkatan Muda Pos, Telegraf, dan Telepon (AMPTT) mengambil alih Kantor Pusat Jawatan PTT di Bandung dan mengibarkan Merah Putih.', x, y + 104, VERT ? W - 144 : 980, { size: VERT ? 38 : 34, weight: 500, color: '#DDE3E8', alpha: ap(lt, 1.4, 0.9), lh: (VERT ? 38 : 34) * 1.45 * U });
    T('Tonggak lahirnya Hari Bhakti Postel', x, y + (VERT ? 400 : 330), { size: 28, weight: 700, color: C.gold, alpha: ap(lt, 3.2) }); } },
  { D: 5.5, f: async (lt, D) => { // 81 years later
    await plate('earth', lt, D, 1.05); grad(0.85, 0); fill('#000', 0.15); const a = ap(lt, 0.3, 0.8), x = VERT ? 72 : 110, y = VERT ? H * 0.60 : H * 0.62;
    T('81 tahun kemudian,', x, y - (VERT ? 350 : 290), { size: VERT ? 48 : 46, weight: 600, color: '#E3ECF4', alpha: a });
    T('81', x - 8, y + (1 - ap(lt, 0.7, 0.9)) * 40, { size: VERT ? 400 : 330, weight: 800, alpha: ap(lt, 0.7, 0.9), track: -12, color: '#FFFFFF' });
    T('HARI BHAKTI POSTEL', x, y + (VERT ? 110 : 90), { size: VERT ? 58 : 54, weight: 800, alpha: ap(lt, 1.4), track: 6, maxW: W - x * 2 }); redWhite(x, y + (VERT ? 142 : 118), 140, ap(lt, 1.7));
    wrap('semangat menjaga jalur komunikasi bangsa terus hidup, kini melalui serat optik hingga pelosok negeri.', x, y + (VERT ? 222 : 186), VERT ? W - 144 : 1100, { size: VERT ? 36 : 32, weight: 500, color: '#E3ECF4', alpha: ap(lt, 2.2), lh: (VERT ? 36 : 32) * 1.4 * U }); } },
  { D: 7.5, f: async (lt, D) => { // TERHUBUNG — network
    await plate('region', lt, D, 1.02); grad(0.9, 0.05); actTitle('Terhubung', 1, lt, 'Palapa Ring Paket Tengah menghubungkan 17 kabupaten di Kalimantan Timur, Sulawesi, dan Kepulauan Maluku Utara.'); } },
  { D: 5.5, f: async (lt, D) => { // TERHUBUNG — metrics over cutaway
    await plate('cutaway', lt, D, 1.0); grad(0.92, 0.1); fill('#030A12', 0.2); const x = VERT ? 72 : 110, y0 = VERT ? H * 0.46 : H * 0.36, g = VERT ? 210 : 190;
    T('01  /  TERHUBUNG', x, y0 - 110, { size: 26, weight: 800, color: C.cyan, alpha: ap(lt, 0.2), track: 6 });
    [['±3.102', 'KM', 'serat optik darat & laut'], ['17', '', 'kota layanan'], ['10', '', 'kota interkoneksi']].forEach(([n, u, l], i) => stat(x + (VERT ? 0 : i * 420), y0 + (VERT ? i * g : 0), n, u, l, ap(lt, 0.5 + i * 0.4)));
    T('DWDM · 100 Gbps (expandable) pada setiap proyek', x, VERT ? y0 + 3 * g + 10 : y0 + 170, { size: 30, weight: 600, color: '#E3ECF4', alpha: ap(lt, 2.0), maxW: W - 2 * x }); } },
  { D: 7.5, f: async (lt, D) => { // TUMBUH
    await plate('pop+town', lt, D, 1.03); grad(0.92, 0.05); actTitle('Tumbuh', 2, lt, 'Konektivitas membuka ruang tumbuh bagi operator, ISP lokal, industri, BUMDes, layanan publik, dan masyarakat di wilayah 3T.'); } },
  { D: 7.0, f: async (lt, D) => { // TERJAGA
    await plate('bts', lt, D, 1.02); grad(0.92, 0.05); actTitle('Terjaga', 3, lt, 'Beroperasi sejak 21 Desember 2018, dikelola dan dijaga keberlanjutannya oleh PT Len Telekomunikasi Indonesia.'); } },
  { D: 9.5, f: async (lt, D) => { // close
    await plate('finale', lt, D, 1.02); fill('#030A12', 0.55); const cx = W / 2; const a = ap(lt, 0.2, 0.8);
    const y1 = VERT ? H * 0.24 : H * 0.20; ['Terhubung.', 'Tumbuh.', 'Terjaga.'].forEach((w, i) => T(w, cx, y1 + i * (VERT ? 120 : 92), { size: VERT ? 104 : 80, weight: 800, align: 'center', alpha: ap(lt, 0.3 + i * 0.35), color: i === 2 ? C.cyan : '#fff' }));
    const y2 = VERT ? H * 0.52 : H * 0.53; redWhite(cx - 70, y2 - 34, 140, ap(lt, 1.4));
    T('Selamat Hari Bhakti Postel ke-81', cx, y2 + 30, { size: VERT ? 56 : 52, weight: 800, align: 'center', alpha: ap(lt, 1.6), maxW: W - 120 });
    T('27 September 2026', cx, y2 + (VERT ? 96 : 88), { size: VERT ? 40 : 36, weight: 600, align: 'center', color: C.gold, alpha: ap(lt, 1.9) });
    wrap('Untuk seluruh insan pos, telekomunikasi, dan penyiaran Indonesia.', cx, y2 + (VERT ? 170 : 150), VERT ? W - 160 : 1040, { size: VERT ? 32 : 28, weight: 500, color: '#DDE7EF', alpha: ap(lt, 2.3), align: 'center' });
    lti(cx, VERT ? H * 0.78 : H * 0.83, VERT ? 520 : 400, ap(lt, 2.8, 0.8));
    T('PALAPA RING PAKET TENGAH  ·  “Semua Berhak Terhubung”', cx, VERT ? H * 0.78 + 170 : H * 0.83 + 118, { size: VERT ? 26 : 24, weight: 700, align: 'center', alpha: ap(lt, 3.3), track: 2, maxW: W - 100 }); } },
];
let TL = []; { let t = 0; S.forEach(s => { TL.push({ ...s, a: t }); t += s.D; }); }
const TOTAL = TL.reduce((a, s) => a + s.D, 0);
window.info = () => ({ W, H, total: TOTAL, cues: TL.map(s => s.a) });
window.renderFrame = async i => { const t = i / FPS, e = TL.find(e => t >= e.a && t < e.a + e.D) || TL[TL.length - 1], lt = t - e.a; X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1;
  await e.f(lt, e.D);
  // persistent collab bug + T3 progress (after the history scene)
  const k = TL.indexOf(e); if (k >= 1 && k <= 5) { const a = ap(t, TL[1].a + 0.6) * (1 - ap(lt, e.D - 0.3, 0.3) * (k === 5 ? 1 : 0)); T('PALAPA RING TENGAH  ×  HARI BHAKTI POSTEL KE-81', VERT ? 72 : 110, VERT ? 120 : 84, { size: 20, weight: 800, alpha: a, track: 4, color: '#fff', maxW: W - 144 });
    t3Chip(VERT ? 72 : 110, VERT ? 164 : 122, a * 0.95, k >= 2 && k <= 3 ? 0 : k === 4 ? 1 : k === 5 ? 2 : -1); }
  const fin = 1 - inv(0, 0.3, lt), fout = inv(e.D - 0.25, e.D, lt), first = k === 0, last = k === TL.length - 1;
  const dip = Math.max(first ? 1 - inv(0, 0.8, lt) : fin, last ? inv(e.D - 1.0, e.D, lt) : fout); if (dip > 0) fill('#020609', dip);
  return cv.toDataURL('image/jpeg', 0.92); };
window.READY = (async () => { await load('lti', 'assets/lti_lockup.png'); for (const w of [500, 600, 700, 800]) await document.fonts.load(`${w} 20px M`); return true; })();
