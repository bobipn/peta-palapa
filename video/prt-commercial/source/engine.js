// Motion-graphics engine for the Palapa Ring Tengah product & commercial film.
// Level 1 = cinematic plates (pre-rendered 3D), Level 2 = infographics, Level 3 = commercial UI.
const W = 1920, H = 1080, FPS = 30;
const cv = document.getElementById('c'), X = cv.getContext('2d');
const C = { bg: '#040E18', bg2: '#08213A', panel: 'rgba(9,30,52,0.78)', panel2: 'rgba(14,44,74,0.85)', line: 'rgba(130,200,240,0.22)', cyan: '#3CCBF4', white: '#F4F8FB', muted: '#9DB4C6', dim: '#5F7A90', red: '#E3262D', blue: '#1F6FC5', gold: '#F2C14E', green: '#3DD6A0' };
const G = window.GEO; // F (facts) and SCRIPT come from facts.js / script.js

// ---------- math / easing ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t, inv = (a, b, x) => clamp((x - a) / (b - a));
const eO = t => 1 - Math.pow(1 - clamp(t), 3), eIO = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }, eB = t => { t = clamp(t); const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function hash(a, b = 0) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
// ---------- formatting (Indonesian thousands separator; values unchanged from PPT) ----------
const rp = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const rpShort = n => n >= 1e9 ? 'Rp ' + (n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' miliar' : 'Rp ' + (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' juta';

// ---------- drawing primitives ----------
function T(s, x, y, o = {}) {
  const { size = 32, weight = 600, color = C.white, align = 'left', alpha = 1, track = 0, base = 'alphabetic', maxW = 0, shadow = false } = o;
  if (alpha <= 0.002 || s === '') return 0; X.save(); X.globalAlpha *= alpha; X.font = `${weight} ${size}px M`; X.fillStyle = color; X.textAlign = align; X.textBaseline = base; X.letterSpacing = track + 'px';
  if (shadow) { X.shadowColor = 'rgba(0,0,0,.6)'; X.shadowBlur = 14; }
  let w = X.measureText(s).width; if (maxW && w > maxW) { const k = maxW / w; X.font = `${weight} ${size * k}px M`; w = maxW; }
  X.fillText(s, x, y); X.restore(); return w;
}
function wrap(s, x, y, maxW, o = {}) { const size = o.size || 28, lh = o.lh || size * 1.35; X.save(); X.font = `${o.weight || 500} ${size}px M`; const words = s.split(' '); let line = '', yy = y, lines = [];
  for (const w of words) { const t2 = line ? line + ' ' + w : w; if (X.measureText(t2).width > maxW && line) { lines.push(line); line = w; } else line = t2; } lines.push(line); X.restore();
  lines.forEach((l, i) => T(l, x, yy + i * lh, o)); return lines.length * lh; }
function rr(x, y, w, h, r) { X.beginPath(); X.roundRect(x, y, w, h, r); }
function panel(x, y, w, h, o = {}) { X.save(); X.globalAlpha *= (o.alpha ?? 1); rr(x, y, w, h, o.r ?? 18); X.fillStyle = o.fill || C.panel; X.fill(); X.strokeStyle = o.stroke || C.line; X.lineWidth = o.lw || 1.5; X.stroke();
  if (o.accent) { X.fillStyle = o.accent; rr(x, y, 6, h, [o.r ?? 18, 0, 0, o.r ?? 18]); X.fill(); } X.restore(); }
function chip(s, x, y, o = {}) { const size = o.size || 22; X.save(); X.font = `${o.weight || 700} ${size}px M`; X.letterSpacing = (o.track ?? 1) + 'px'; const w = X.measureText(s).width + size * 1.4; X.restore();
  X.save(); X.globalAlpha *= (o.alpha ?? 1); rr(x - (o.align === 'center' ? w / 2 : 0), y, w, size * 1.8, size * 0.9); X.fillStyle = o.fill || 'rgba(60,203,244,0.14)'; X.fill(); X.strokeStyle = o.stroke || 'rgba(60,203,244,0.55)'; X.lineWidth = 1.5; X.stroke(); X.restore();
  T(s, x + (o.align === 'center' ? 0 : w / 2), y + size * 1.25, { size, weight: o.weight || 700, color: o.color || C.cyan, align: 'center', alpha: o.alpha ?? 1, track: o.track ?? 1 }); return w; }
function glowDot(x, y, r, col = C.cyan, a = 1) { if (!isFinite(x) || !isFinite(y)) return; X.save(); X.globalAlpha *= a; const g = X.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, col); g.addColorStop(0.25, col + '88'); g.addColorStop(1, col + '00'); X.fillStyle = g; X.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); X.beginPath(); X.arc(x, y, r, 0, 7); X.fillStyle = '#fff'; X.fill(); X.restore(); }
function line(pts, col, w, a = 1, dash = null) { if (pts.length < 2) return; X.save(); X.globalAlpha *= a; X.strokeStyle = col; X.lineWidth = w; X.lineCap = 'round'; X.lineJoin = 'round'; if (dash) X.setLineDash(dash); X.beginPath(); pts.forEach(([x, y], i) => i ? X.lineTo(x, y) : X.moveTo(x, y)); X.stroke(); X.restore(); }
const appear = (lt, t0, d = 0.6) => eO(inv(t0, t0 + d, lt));
function up(lt, t0, d = 0.6) { const k = appear(lt, t0, d); return { a: k, dy: (1 - k) * 26 }; }

// ---------- background ----------
function bgNavy(lt, o = {}) {
  const g = X.createRadialGradient(W * 0.62, H * 0.35, 80, W * 0.5, H * 0.5, W * 0.85); g.addColorStop(0, o.c1 || '#0B2B4A'); g.addColorStop(1, C.bg); X.fillStyle = g; X.fillRect(0, 0, W, H);
  X.save(); X.globalAlpha = 0.18; X.fillStyle = '#6FB9E6'; for (let i = 0; i < 44; i++) for (let j = 0; j < 25; j++) { const x = i * 45 + 12, y = j * 45 + 12; const d = Math.hypot(x - W * .62, y - H * .38) / W; const a = clamp(1.2 - d * 1.8) * (0.4 + 0.6 * hash(i, j)); if (a > 0.05) { X.globalAlpha = 0.16 * a; X.fillRect(x, y, 2, 2); } } X.restore();
  // slow drifting light streaks (data)
  X.save(); X.globalCompositeOperation = 'lighter'; for (let i = 0; i < 9; i++) { const y = 120 + i * 105 + Math.sin(i * 7.3) * 30, s = ((lt * (40 + i * 9) + i * 400) % (W + 600)) - 300;
    const gr = X.createLinearGradient(s - 260, 0, s, 0); gr.addColorStop(0, 'rgba(60,203,244,0)'); gr.addColorStop(1, 'rgba(60,203,244,0.10)'); X.fillStyle = gr; X.fillRect(s - 260, y, 260, 1.5); } X.restore();
}
function vignette(a = 0.55) { const g = X.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); X.fillStyle = g; X.fillRect(0, 0, W, H); }

// ---------- assets ----------
const IMG = {}; function loadImg(k, src) { return new Promise(r => { const i = new Image(); i.onload = () => { IMG[k] = i; r(); }; i.onerror = () => r(); i.src = src; }); }
let MAPBASE = null, LOGO_RING = null;
function prepMap() { // darkened, cool-graded satellite base (lon 108..134, lat 8..-10)
  const im = IMG.region, c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d');
  x.filter = 'brightness(1.05) saturate(0.7) contrast(1.1)'; x.drawImage(im, 0, 0); x.filter = 'none';
  x.globalCompositeOperation = 'multiply'; x.fillStyle = '#A9C3DE'; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'source-over'; MAPBASE = c;
  const r = document.createElement('canvas'); r.width = r.height = 360; const g = r.getContext('2d'); g.drawImage(IMG.ring, 76, 78, 360, 360, 0, 0, 360, 360); const d = g.getImageData(0, 0, 360, 360);
  for (let i = 0; i < d.data.length; i += 4) { const R = d.data[i], Gg = d.data[i + 1], B = d.data[i + 2], mx = Math.max(R, Gg, B), mn = Math.min(R, Gg, B), s = mx ? (mx - mn) / mx : 0; d.data[i + 3] = s < 0.42 ? 0 : Math.min(255, (s - 0.42) * 1400); }
  g.putImageData(d, 0, 0); LOGO_RING = r;
}
// ---------- map ----------
const PROJ_OF = (() => { // classify real route polylines into projects by their centroid
  const cls = (lo, la) => lo < 117 ? 'P4' : (lo > 127.2 && lo < 127.7 && la > 0.55 && la < 0.95) ? 'P8B' : (la > 1.2 || (lo > 127.8 && la > 1.5)) ? 'P8A' : (la > -2.25 && lo > 122.6) ? 'P7' : (la < -3.9 && lo > 122.2) ? 'P6' : 'P5';
  const all = G.marine.map(p => ({ p, sea: true })).concat(G.inland.map(p => ({ p, sea: false })));
  all.forEach(r => { const n = r.p.length; let lo = 0, la = 0; r.p.forEach(([a, b]) => { lo += a; la += b; }); r.proj = cls(lo / n, la / n); }); return all; })();
const CITY_PROJ = {}; F.projects.forEach(p => { p.ts.forEach(c => CITY_PROJ[c] = [p.id, 'ts']); p.int.forEach(c => { if (!CITY_PROJ[c]) CITY_PROJ[c] = [p.id, 'int']; }); });
const CITY_ALIAS = { 'Wawonii': 'Wawonii Barat', 'Morotai': 'Morotai Selatan' };
function mapView(clon, clat, k) { return { clon, clat, k, px: lo => W / 2 + (lo - clon) * k, py: la => H / 2 - (la - clat) * k }; }
function drawMap(v, o = {}) {
  const { routes = 1, dimOthers = null, pops = true, labels = false, pulses = true, lt = 0, alpha = 1, glowSea = true, coast = 0.35 } = o;
  X.save(); X.globalAlpha = alpha; X.fillStyle = C.bg; X.fillRect(0, 0, W, H);
  const x0 = v.px(108), y0 = v.py(8), x1 = v.px(134), y1 = v.py(-10); X.drawImage(MAPBASE, x0, y0, x1 - x0, y1 - y0);
  // coastline glint
  X.save(); X.strokeStyle = `rgba(150,215,245,${coast})`; X.lineWidth = 1; X.beginPath(); for (const poly of G.polys) { poly.forEach(([lo, la], i) => i ? X.lineTo(v.px(lo), v.py(la)) : X.moveTo(v.px(lo), v.py(la))); X.closePath(); } X.stroke(); X.restore();
  vignette(0.5);
  // routes
  PROJ_OF.forEach((r, i) => { const hi = !dimOthers || dimOthers === r.proj; const pts = r.p.map(([lo, la]) => [v.px(lo), v.py(la)]); const n = Math.max(2, Math.floor(pts.length * clamp(routes * 1.15 - (i % 17) / 17 * 0.15)));
    const sub = pts.slice(0, n); if (sub.length < 2) return; const a = hi ? 1 : 0.18;
    X.save(); X.globalCompositeOperation = 'lighter'; line(sub, r.sea ? 'rgba(60,203,244,0.35)' : 'rgba(255,190,120,0.30)', 9, a); X.restore();
    line(sub, r.sea ? '#9FE6FF' : '#FFD9AE', 2.6, a, r.sea ? null : null);
    if (pulses && hi && routes >= 1) { let L = 0; const seg = []; for (let j = 1; j < pts.length; j++) { const d = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); seg.push(d); L += d; }
      const np = Math.max(1, Math.round(L / 90)); for (let q = 0; q < np; q++) { let s = ((lt * 70 + q * L / np + i * 37) % L); let j = 0; while (j < seg.length && s > seg[j]) { s -= seg[j]; j++; } if (j >= seg.length) continue;
        const f = seg[j] > 0 ? s / seg[j] : 0; glowDot(lerp(pts[j][0], pts[j + 1][0], f), lerp(pts[j][1], pts[j + 1][1], f), 2.2, '#8FE4FF', 0.9); } } });
  if (pops) Object.entries(G.cities).forEach(([name0, [lo, la]], i) => { const name = CITY_ALIAS[name0] || name0; const pj = CITY_PROJ[name] || ['', 'ts']; const hi = !dimOthers || dimOthers === pj[0];
    const a = (typeof pops === 'number' ? clamp(pops * 28 - i) : 1) * (hi ? 1 : 0.25); if (a <= 0) return; const x = v.px(lo), y = v.py(la);
    X.save(); X.globalAlpha *= a; X.beginPath(); X.arc(x, y, pj[1] === 'int' ? 7 : 5.5, 0, 7); X.fillStyle = pj[1] === 'int' ? C.cyan : C.gold; X.fill(); X.strokeStyle = '#051320'; X.lineWidth = 2; X.stroke(); X.restore();
    if (labels && hi) T(name, x + 11, y - 9, { size: 17, weight: 600, color: C.white, alpha: a * 0.95, shadow: true }); });
  X.restore();
}
function legend(x, y, a = 1) { panel(x, y, 330, 124, { alpha: a * 0.9 });
  [[C.gold, 'Titik Layanan (Kota Layanan)'], [C.cyan, 'Titik Interkoneksi'], ['#9FE6FF', 'Serat optik laut'], ['#FFD9AE', 'Serat optik darat']].forEach(([c, s], i) => { const yy = y + 26 + i * 25; if (i < 2) { X.save(); X.globalAlpha = a; X.beginPath(); X.arc(x + 24, yy - 6, 6, 0, 7); X.fillStyle = c; X.fill(); X.restore(); } else line([[x + 14, yy - 6], [x + 36, yy - 6]], c, 3, a); T(s, x + 48, yy, { size: 17, weight: 500, color: C.muted, alpha: a }); }); }

// ---------- plates (clean 3D renders), with frame blending for slow motion ----------
const PLATES = { earth: [0.4, 8.4], region: [9.0, 16.0], dive: [16.3, 20.8], cutaway: [21.0, 23.8], chase: [23.8, 28.0], landing: [28.4, 31.4], route: [31.4, 36.0], pop: [36.0, 38.4], bts: [38.4, 41.0], town: [41.0, 43.3], finale: [43.4, 47.3] };
const plateCache = new Map();
function plateFrame(n) { const k = Math.max(0, Math.min(1559, n)); if (plateCache.has(k)) return plateCache.get(k); const p = new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = `plates/f_${String(k).padStart(5, '0')}.jpg`; }); plateCache.set(k, p); if (plateCache.size > 90) plateCache.delete(plateCache.keys().next().value); return p; }
async function drawPlate(list, lt, D) { // list of plate names played back-to-back across the scene
  const tot = list.reduce((a, k) => a + PLATES[k][1] - PLATES[k][0], 0); let pt = clamp(lt / D) * tot, k = 0;
  while (k < list.length - 1 && pt > PLATES[list[k]][1] - PLATES[list[k]][0]) { pt -= PLATES[list[k]][1] - PLATES[list[k]][0]; k++; }
  const t = PLATES[list[k]][0] + pt, f = t * FPS, f0 = Math.floor(f), fr = f - f0; const [a, b] = await Promise.all([plateFrame(f0), plateFrame(f0 + 1)]);
  X.fillStyle = C.bg; X.fillRect(0, 0, W, H); if (a) X.drawImage(a, 0, 0, W, H); if (b && fr > 0.02) { X.save(); X.globalAlpha = fr; X.drawImage(b, 0, 0, W, H); X.restore(); }
}
function scrim(a = 0.55, side = 'left') { const g = side === 'left' ? X.createLinearGradient(0, 0, W * 0.7, 0) : side === 'bottom' ? X.createLinearGradient(0, H, 0, H * 0.35) : X.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(3,12,22,${a})`); g.addColorStop(1, 'rgba(3,12,22,0)'); X.fillStyle = g; X.fillRect(0, 0, W, H); }

// ---------- section label (top-left, consistent across the film) ----------
function sectionLabel(s, lt, sub = '') { const u = up(lt, 0.15, 0.5); if (!s) return; X.save(); X.globalAlpha = u.a; X.fillStyle = C.cyan; X.fillRect(96, 92 + u.dy, 34, 3); X.restore();
  T(s.toUpperCase(), 144, 100 + u.dy, { size: 20, weight: 800, color: C.cyan, alpha: u.a, track: 4 }); if (sub) T(sub, 96, 136 + u.dy, { size: 20, weight: 500, color: C.muted, alpha: u.a }); }
function headline(s, x, y, lt, t0 = 0.3, o = {}) { const u = up(lt, t0, 0.7); return T(s, x, y + u.dy, { size: o.size || 64, weight: o.weight || 800, color: o.color || C.white, alpha: u.a * (o.alpha ?? 1), align: o.align || 'left', maxW: o.maxW || 0, track: o.track ?? -0.5, shadow: o.shadow }); }

// ======================================================================
// VIEWS  (lt = local time, D = scene duration, s = scene)
// ======================================================================
const V = {};
const MAPFULL = mapView(121.4, -0.75, 112);
const PLATE_CAP = {
  M01: ['Konektivitas adalah fondasi', 'bagi bisnis, layanan publik, dan pertumbuhan ekonomi'],
  M03: ['PALAPA RING PAKET TENGAH', 'PT Len Telekomunikasi Indonesia — Badan Usaha Pelaksana (BUP) yang ditunjuk Pemerintah melalui Kemkominfo'],
  M05: ['DWDM · 100 Gbps (expandable)', 'kapasitas pada setiap proyek'],
  M25: ['Operator · Industri · Layanan Publik', 'BTS → backbone Palapa Ring · kolokasi antena pada menara · tambang, migas, perkebunan, pariwisata, pemerintah daerah, layanan kesehatan'],
  T01: ['Konektivitas adalah fondasi', 'bisnis dan layanan publik'],
  T02: ['±3.102 km serat optik', '6 proyek · 17 kota layanan · 10 kota interkoneksi'],
  T02B: ['DWDM · 100 Gbps (expandable)', 'kapasitas pada setiap proyek'],
  T07B: ['Operator · ISP · Industri · Layanan Publik', 'hingga wilayah 3T (Terdepan, Terluar, Tertinggal)'],
  C01: ['Butuh konektivitas di', 'Kalimantan Timur · Sulawesi · Maluku Utara?'],
};
V.plate = async (lt, D, s, arg) => {
  await drawPlate(arg.split('+'), lt, D); scrim(0.7, 'left'); scrim(0.5, 'bottom'); vignette(0.45);
  const cap = PLATE_CAP[s.id]; if (!cap) return; const u = up(lt, 0.6, 0.9);
  T(cap[0], 96, 700 + u.dy, { size: cap[0].length > 22 ? 64 : 76, weight: 800, alpha: u.a, shadow: true, track: cap[0] === cap[0].toUpperCase() ? 4 : -0.5, maxW: 1300 });
  const u2 = up(lt, 1.1, 0.8); X.save(); X.globalAlpha = u2.a; X.fillStyle = C.cyan; X.fillRect(96, 740 + u2.dy, 64, 3); X.restore();
  wrap(cap[1], 96, 792 + u2.dy, 1150, { size: 30, weight: 500, color: '#D7E6F1', alpha: u2.a, shadow: true });
};
V['map'] = (lt, D, s, arg) => { // traffic: the archipelago lights up with rising digital traffic, then the question
  const z = lerp(1.0, 1.08, eIO(lt / D)); const v = mapView(121.4, -0.75, 112 * z); drawMap(v, { routes: 0, pops: false, lt });
  // traffic arcs between cities (conceptual, no figures)
  const cities = Object.values(G.cities); X.save(); X.globalCompositeOperation = 'lighter';
  const n = Math.floor(lerp(8, 60, eIO(lt / D))); for (let i = 0; i < n; i++) { const a = cities[Math.floor(hash(i, 1) * cities.length)], b = cities[Math.floor(hash(i, 2) * cities.length)]; if (a === b) continue;
    const ax = v.px(a[0]), ay = v.py(a[1]), bx = v.px(b[0]), by = v.py(b[1]), mx = (ax + bx) / 2, my = (ay + by) / 2 - Math.hypot(bx - ax, by - ay) * 0.3; const p = (lt * (0.35 + hash(i, 3) * 0.5) + hash(i, 4)) % 1;
    X.strokeStyle = 'rgba(60,203,244,0.13)'; X.lineWidth = 1.2; X.beginPath(); X.moveTo(ax, ay); X.quadraticCurveTo(mx, my, bx, by); X.stroke();
    const qx = (1 - p) * (1 - p) * ax + 2 * (1 - p) * p * mx + p * p * bx, qy = (1 - p) * (1 - p) * ay + 2 * (1 - p) * p * my + p * p * by; glowDot(qx, qy, 2, '#9FE6FF', 0.8); }
  X.restore(); cities.forEach(([lo, la]) => glowDot(v.px(lo), v.py(la), 2.4, C.gold, 0.7));
  scrim(0.75, 'left');
  const u = up(lt, 0.5, 0.8); T('Tantangan wilayah kepulauan', 96, 360 + u.dy, { size: 22, weight: 800, color: C.cyan, alpha: u.a, track: 4 });
  headline('Laut. Jarak. Medan.', 96, 450, lt, 0.8, { size: 78 });
  const q = up(lt, D * 0.45, 0.9); wrap('Bagaimana bisnis mendapatkan konektivitas yang andal, dapat ditingkatkan, dan sesuai kebutuhan?', 96, 560 + q.dy, 900, { size: 40, weight: 600, color: '#DCEAF5', alpha: q.a, lh: 54 });
};
V.metrics = (lt, D) => {
  const v = mapView(lerp(121.8, 121.4, eIO(lt / D)), -0.75, lerp(104, 112, eIO(lt / D))); drawMap(v, { routes: eIO(inv(0.2, 3.5, lt)), pops: inv(1.5, 4.5, lt), lt }); scrim(0.82, 'left');
  sectionLabel('Jaringan', lt, 'Beroperasi sejak 21 Desember 2018');
  const items = [['±3.102', 'KM', 'Total panjang kabel'], ['±1.304', 'KM', 'Kabel darat'], ['±1.798', 'KM', 'Kabel laut'], ['17', '', 'Kota Layanan / SLA'], ['10', '', 'Kota Interkoneksi'], ['6', '', 'Proyek · 17 kabupaten']];
  items.forEach(([n, u2, l], i) => { const col = i < 3 ? 0 : 1, row = i % 3, x = 96 + col * 400, y = 300 + row * 190, t0 = 0.8 + i * (D * 0.1), a = appear(lt, t0, 0.6);
    panel(x, y - 88 + (1 - a) * 20, 370, 160, { alpha: a, accent: i < 3 ? C.cyan : C.gold });
    T(n, x + 30, y + 10 + (1 - a) * 20, { size: i === 0 ? 76 : 68, weight: 800, alpha: a, track: -1 });
    const nw = (() => { X.save(); X.font = `800 ${i === 0 ? 76 : 68}px M`; X.letterSpacing = '-1px'; const w = X.measureText(n).width; X.restore(); return w; })();
    if (u2) T(u2, x + 40 + nw, y + 10 + (1 - a) * 20, { size: 30, weight: 700, color: C.cyan, alpha: a });
    T(l, x + 30, y + 52 + (1 - a) * 20, { size: 22, weight: 600, color: C.muted, alpha: a }); });
  const sp = up(lt, D * 0.72, 0.7); T('Kalimantan Timur · Sulawesi (Tengah, Tenggara, Utara) · Kepulauan Maluku Utara', 96, 930 + sp.dy, { size: 24, weight: 600, color: '#CFE0EC', alpha: sp.a });
  legend(W - 400, H - 190, appear(lt, 2, 0.6));
};
V.projects = (lt, D) => {
  const order = F.projects, per = (D - 1) / 6, idx = clamp(Math.floor((lt - 0.5) / per), 0, 5), p = order[idx];
  const views = { P4: [116.2, -0.1, 250], P5: [121.5, -2.6, 240], P6: [122.7, -4.7, 330], P7: [124.3, -1.6, 230], P8A: [126.4, 2.6, 210], P8B: [127.48, 0.76, 1500] };
  const a0 = views[p.id], prev = views[order[Math.max(0, idx - 1)].id], k = eIO(inv(0.5 + idx * per, 0.5 + idx * per + 0.9, lt));
  const v = mapView(lerp(prev[0], a0[0], k), lerp(prev[1], a0[1], k), Math.exp(lerp(Math.log(prev[2]), Math.log(a0[2]), k)));
  drawMap(v, { routes: 1, dimOthers: p.id, pops: true, labels: true, lt, coast: 0.25 }); scrim(0.85, 'left');
  sectionLabel('6 Proyek', lt, 'Palapa Ring Paket Tengah');
  const ca = appear(lt, 0.5 + idx * per, 0.5); const x = 96, y = 250;
  panel(x, y, 560, 560, { alpha: ca, accent: C.cyan });
  T('PROYEK ' + p.id.replace('P', ''), x + 40, y + 78, { size: 54, weight: 800, alpha: ca, track: 2 }); T(p.region, x + 40, y + 120, { size: 24, weight: 600, color: C.cyan, alpha: ca });
  T(p.km + ' km', x + 40, y + 205, { size: 60, weight: 800, alpha: ca }); T('panjang kabel fiber optik', x + 40, y + 240, { size: 20, weight: 500, color: C.muted, alpha: ca });
  T('Laut ' + p.sea + ' km  ·  Darat ' + p.land + ' km' + (p.mw ? '  ·  Microwave ' + p.mw : ''), x + 40, y + 285, { size: 21, weight: 600, color: '#D4E4EF', alpha: ca, maxW: 490 });
  T('TITIK LAYANAN', x + 40, y + 345, { size: 17, weight: 800, color: C.gold, alpha: ca, track: 3 }); wrap(p.ts.join(' · '), x + 40, y + 378, 480, { size: 24, weight: 600, alpha: ca });
  T('TITIK INTERKONEKSI', x + 40, y + 450, { size: 17, weight: 800, color: C.cyan, alpha: ca, track: 3 }); wrap(p.int.join(' · '), x + 40, y + 483, 480, { size: 24, weight: 600, alpha: ca });
  // progress rail
  order.forEach((q, i) => { const on = i === idx; chip(q.id, 96 + i * 96, 860, { size: 20, alpha: 1, fill: on ? 'rgba(60,203,244,0.35)' : 'rgba(255,255,255,0.05)', stroke: on ? C.cyan : 'rgba(255,255,255,0.18)', color: on ? '#fff' : C.muted }); });
};
V.segments = (lt, D) => {
  bgNavy(lt); sectionLabel('Skema Bisnis Pelanggan', lt, 'Skema B2B dengan Mitra');
  headline('Siapa yang terhubung?', 96, 250, lt, 0.3, { size: 60 });
  const partners = [['Penyelenggara Telekomunikasi', 'Mitra B2B'], ['Penyedia Layanan Internet (ISP)', 'Mitra B2B']];
  partners.forEach(([n, k], i) => { const a = appear(lt, 0.8 + i * 0.4); panel(96 + i * 640, 300, 610, 150, { alpha: a, accent: C.cyan, fill: C.panel2 }); T(k.toUpperCase(), 136 + i * 640, 352, { size: 17, weight: 800, color: C.cyan, alpha: a, track: 3 }); T(n, 136 + i * 640, 408, { size: 34, weight: 700, alpha: a, maxW: 540 }); });
  T('POTENSI PEMANFAATAN', 96, 530, { size: 18, weight: 800, color: C.gold, alpha: appear(lt, 2), track: 4 });
  const seg = [['Industri Sektoral & Mikro', 'Pertambangan, Migas, Pariwisata, Perkebunan, dan Kelautan', 'factory'], ['BUMDes', 'Badan Usaha Milik Desa, Area 3T', 'village'], ['Layanan Publik', 'Pemerintah Daerah, layanan kesehatan, dll', 'gov'], ['Masyarakat', 'Pengguna smartphone, Internet Kabel, Wifi, dll', 'people']];
  seg.forEach(([n, d, ic], i) => { const a = appear(lt, 2.3 + i * 0.45), x = 96 + i * 432, y = 560; panel(x, y, 410, 330, { alpha: a }); icon(ic, x + 60, y + 80, 44, a); T(n, x + 34, y + 190, { size: 30, weight: 700, alpha: a, maxW: 350 }); wrap(d, x + 34, y + 236, 350, { size: 21, weight: 500, color: C.muted, alpha: a, lh: 29 }); });
};
// simple line icons (drawn, no external assets)
function icon(k, x, y, s, a = 1) { X.save(); X.globalAlpha *= a; X.strokeStyle = C.cyan; X.fillStyle = C.cyan; X.lineWidth = 3; X.lineJoin = 'round'; X.lineCap = 'round'; X.beginPath();
  if (k === 'factory') { X.moveTo(x - s, y + s * .6); X.lineTo(x - s, y - s * .1); X.lineTo(x - s * .4, y + s * .2); X.lineTo(x - s * .4, y - s * .1); X.lineTo(x + s * .2, y + s * .2); X.lineTo(x + s * .2, y - s * .8); X.lineTo(x + s * .55, y - s * .8); X.lineTo(x + s * .55, y + s * .6); X.closePath(); X.moveTo(x + s, y + s * .6); X.lineTo(x - s * 1.1, y + s * .6); }
  else if (k === 'village') { X.moveTo(x - s, y + s * .6); X.lineTo(x - s, y - s * .1); X.lineTo(x - s * .45, y - s * .6); X.lineTo(x + s * .1, y - s * .1); X.lineTo(x + s * .1, y + s * .6); X.moveTo(x + s * .1, y + s * .1); X.lineTo(x + s * .55, y - s * .3); X.lineTo(x + s, y + s * .1); X.lineTo(x + s, y + s * .6); X.lineTo(x - s * 1.1, y + s * .6); }
  else if (k === 'gov') { X.moveTo(x - s, y + s * .6); X.lineTo(x + s, y + s * .6); X.moveTo(x - s * .9, y - s * .25); X.lineTo(x, y - s * .75); X.lineTo(x + s * .9, y - s * .25); X.closePath(); for (let i = -2; i <= 2; i++) { X.moveTo(x + i * s * .38, y - s * .15); X.lineTo(x + i * s * .38, y + s * .5); } }
  else if (k === 'people') { X.arc(x - s * .45, y - s * .35, s * .22, 0, 7); X.moveTo(x - s * .9 + s * .82, y + s * .6); X.arc(x - s * .45, y + s * .6, s * .45, 0, Math.PI, true); X.moveTo(x + s * .67, y - s * .35); X.arc(x + s * .45, y - s * .35, s * .22, 0, 7); X.moveTo(x + s * .9, y + s * .6); X.arc(x + s * .45, y + s * .6, s * .45, 0, Math.PI, true); }
  else if (k === 'bw') { for (let i = 0; i < 3; i++) { X.moveTo(x - s, y - s * .5 + i * s * .5); X.lineTo(x + s, y - s * .5 + i * s * .5); } X.moveTo(x + s * .6, y - s * .8); X.lineTo(x + s, y - s * .5); X.lineTo(x + s * .6, y - s * .2); }
  else if (k === 'df') { for (let i = 0; i < 5; i++) { X.moveTo(x - s, y - s * .6 + i * s * .3); X.bezierCurveTo(x - s * .2, y - s * .6 + i * s * .3, x + s * .1, y, x + s, y - s * .1 + i * s * .05); } }
  else if (k === 'colo') { X.rect(x - s * .6, y - s * .9, s * 1.2, s * 1.8); for (let i = 0; i < 5; i++) { X.moveTo(x - s * .45, y - s * .6 + i * s * .32); X.lineTo(x + s * .45, y - s * .6 + i * s * .32); } }
  else if (k === 'ppu') { X.moveTo(x - s, y + s * .6); X.lineTo(x - s, y - s * .8); X.moveTo(x - s, y + s * .6); X.lineTo(x + s, y + s * .6); X.moveTo(x - s * .8, y + s * .2); X.lineTo(x - s * .3, y - s * .1); X.lineTo(x + s * .1, y + s * .1); X.lineTo(x + s * .5, y - s * .6); X.lineTo(x + s * .9, y - s * .3); }
  else if (k === 'phone') { X.roundRect(x - s * .45, y - s * .85, s * .9, s * 1.7, 8); X.moveTo(x - s * .12, y + s * .6); X.lineTo(x + s * .12, y + s * .6); }
  else if (k === 'check') { X.arc(x, y, s * .8, 0, 7); X.moveTo(x - s * .38, y); X.lineTo(x - s * .08, y + s * .3); X.lineTo(x + s * .42, y - s * .3); }
  else if (k === 'map') { X.moveTo(x - s, y - s * .6); X.lineTo(x - s * .35, y - s * .8); X.lineTo(x + s * .35, y - s * .6); X.lineTo(x + s, y - s * .8); X.lineTo(x + s, y + s * .6); X.lineTo(x + s * .35, y + s * .8); X.lineTo(x - s * .35, y + s * .6); X.lineTo(x - s, y + s * .8); X.closePath(); X.moveTo(x - s * .35, y - s * .8); X.lineTo(x - s * .35, y + s * .6); X.moveTo(x + s * .35, y - s * .6); X.lineTo(x + s * .35, y + s * .8); }
  else if (k === 'doc') { X.moveTo(x - s * .6, y - s * .9); X.lineTo(x + s * .3, y - s * .9); X.lineTo(x + s * .65, y - s * .55); X.lineTo(x + s * .65, y + s * .9); X.lineTo(x - s * .6, y + s * .9); X.closePath(); for (let i = 0; i < 3; i++) { X.moveTo(x - s * .35, y - s * .25 + i * s * .35); X.lineTo(x + s * .4, y - s * .25 + i * s * .35); } }
  else if (k === 'plug') { X.moveTo(x - s * .3, y - s); X.lineTo(x - s * .3, y - s * .5); X.moveTo(x + s * .3, y - s); X.lineTo(x + s * .3, y - s * .5); X.roundRect(x - s * .6, y - s * .5, s * 1.2, s * .8, 8); X.moveTo(x, y + s * .3); X.lineTo(x, y + s); }
  else if (k === 'live') { X.arc(x, y, s * .25, 0, 7); X.moveTo(x + s * .6, y - s * .6); X.arc(x, y, s * .85, -0.8, 0.8); X.moveTo(x - s * .6, y + s * .6); X.arc(x, y, s * .85, Math.PI - 0.8, Math.PI + 0.8); }
  else if (k === 'scale') { X.moveTo(x - s, y + s * .7); X.lineTo(x + s, y + s * .7); for (let i = 0; i < 4; i++) { X.rect(x - s * .9 + i * s * .5, y + s * .7 - s * (0.4 + i * .35), s * .32, s * (0.4 + i * .35)); } }
  else if (k === 'reach') { X.arc(x, y, s * .9, 0, 7); X.moveTo(x - s * .9, y); X.lineTo(x + s * .9, y); X.moveTo(x, y - s * .9); X.bezierCurveTo(x - s * .6, y - s * .3, x - s * .6, y + s * .3, x, y + s * .9); X.moveTo(x, y - s * .9); X.bezierCurveTo(x + s * .6, y - s * .3, x + s * .6, y + s * .3, x, y + s * .9); }
  else if (k === 'price') { X.moveTo(x - s * .8, y - s * .2); X.lineTo(x - s * .1, y - s * .9); X.lineTo(x + s * .8, y - s * .9); X.lineTo(x + s * .8, y); X.lineTo(x + s * .1, y + s * .7); X.closePath(); X.moveTo(x + s * .5, y - s * .55); X.arc(x + s * .45, y - s * .55, s * .1, 0, 7); }
  X.stroke(); X.restore(); }
V.portfolio = (lt, D) => {
  bgNavy(lt, { c1: '#0C3050' }); sectionLabel('Produk & Layanan', lt, 'Palapa Ring Paket Tengah');
  headline('Apa yang bisa diperoleh bisnis Anda?', 96, 260, lt, 0.2, { size: 60, maxW: 1700 });
  const P = [['01', 'Sewa Kapasitas', '(Bandwidth)', 'bw', C.cyan], ['02', 'Sewa Core', '(Darkfiber)', 'df', '#8FA7FF'], ['03', 'Kolokasi Perangkat', 'Aktif Pelanggan', 'colo', C.gold], ['04', 'PPU', '(Pay Per Use)', 'ppu', C.red]];
  // network line splits into four products
  const sp = eIO(inv(0.8, 2.2, lt)); X.save(); X.globalCompositeOperation = 'lighter'; P.forEach((p, i) => { const x = 96 + i * 440 + 205; line([[W / 2, 380], [W / 2, 400 + 40 * sp], [lerp(W / 2, x, sp), 440], [x, 470]], 'rgba(60,203,244,0.5)', 2, sp); }); X.restore();
  P.forEach(([n, a1, a2, ic, col], i) => { const a = appear(lt, 1.6 + i * 0.45), x = 96 + i * 440, y = 480 + (1 - a) * 30; panel(x, y, 410, 420, { alpha: a, fill: C.panel2 }); X.save(); X.globalAlpha = a; X.fillStyle = col; X.fillRect(x, y, 410, 5); X.restore();
    T(n, x + 34, y + 78, { size: 26, weight: 800, color: col, alpha: a, track: 2 }); icon(ic, x + 340, y + 70, 30, a); T(a1, x + 34, y + 250, { size: 40, weight: 800, alpha: a, maxW: 350 }); T(a2, x + 34, y + 298, { size: 28, weight: 600, color: C.muted, alpha: a, maxW: 350 }); });
  glowDot(W / 2, 380, 4, C.cyan, appear(lt, 0.8));
};
// ---------- product deep-dive illustrations ----------
function needSolution(lt, need, sol, pts, col, x = 96) { const a1 = up(lt, 0.3), a2 = up(lt, 1.2), y = 250;
  T('KEBUTUHAN', x, y + a1.dy, { size: 17, weight: 800, color: C.muted, alpha: a1.a, track: 4 }); wrap(need, x, y + 50 + a1.dy, 700, { size: 36, weight: 600, color: '#DCEAF5', alpha: a1.a, lh: 48 });
  T('SOLUSI', x, y + 190 + a2.dy, { size: 17, weight: 800, color: col, alpha: a2.a, track: 4 }); T(sol, x, y + 252 + a2.dy, { size: 58, weight: 800, alpha: a2.a, maxW: 760 });
  let yy = y + 338; pts.forEach((p, i) => { const a = up(lt, 2.2 + i * 0.5); icon('check', x + 18, yy + a.dy, 16, a.a); const h = wrap(p, x + 54, yy + 10 + a.dy, 690, { size: 25, weight: 500, color: '#DCEAF5', alpha: a.a, lh: 32 }); yy += Math.max(62, h + 30); }); }
V.product = (lt, D, s, arg) => {
  bgNavy(lt, { c1: '#0B2E4E' }); const R = { x: 1000, y: 200, w: 820, h: 700 };
  if (arg === 'bw') { sectionLabel('Produk 01 · Sewa Kapasitas (Bandwidth)', lt); needSolution(lt, 'Kapasitas besar yang terjamin untuk jaringan Anda.', 'Sewa Kapasitas', ['Layanan berbasis sewa kapasitas', 'Kapasitas terjamin (Dedicated)', 'Harga terjangkau dengan kualitas tinggi'], C.cyan);
    // dedicated lane inside a fibre pipe, PoP -> customer
    const a = appear(lt, 0.8); panel(R.x, R.y, R.w, R.h, { alpha: a }); const py = R.y + 300;
    for (let i = 0; i < 6; i++) { const yy = py - 110 + i * 44, ded = i === 2; line([[R.x + 80, yy], [R.x + R.w - 80, yy]], ded ? C.cyan : 'rgba(150,190,220,0.18)', ded ? 8 : 4, a);
      if (ded) { for (let q = 0; q < 6; q++) { const p = ((lt * 0.5 + q / 6) % 1); glowDot(lerp(R.x + 80, R.x + R.w - 80, p), yy, 4, '#BFF1FF', a); } T('DEDICATED', R.x + R.w - 90, yy - 16, { size: 16, weight: 800, color: C.cyan, align: 'right', alpha: a, track: 3 }); } }
    T('Titik Layanan PoP', R.x + 80, py + 190, { size: 20, weight: 700, color: C.muted, alpha: a }); T('Jaringan Pelanggan', R.x + R.w - 80, py + 190, { size: 20, weight: 700, color: C.muted, alpha: a, align: 'right' });
    T('PORT TERSEDIA', R.x + 80, R.y + R.h - 150, { size: 17, weight: 800, color: C.cyan, alpha: appear(lt, 2.5), track: 4 }); let xx = R.x + 80; ['1G', '10G', 'STM-4', 'STM-16'].forEach((p, i) => { xx += chip(p, xx, R.y + R.h - 120, { size: 26, alpha: appear(lt, 2.8 + i * 0.25) }) + 16; }); }
  if (arg === 'df') { sectionLabel('Produk 02 · Sewa Core (Darkfiber)', lt); needSolution(lt, 'Mengelola jaringan sendiri, dengan perangkat sendiri.', 'Sewa Core', ['Sewa jaringan pasif Palapa Ring Paket Tengah', 'Skema per proyek, per segmen, atau per titik akses', 'Kapasitas tidak terbatas, dikelola dengan perangkat aktif milik pelanggan'], '#8FA7FF');
    const a = appear(lt, 0.8); panel(R.x, R.y, R.w, R.h, { alpha: a }); const cx = R.x + 250, cy = R.y + 330;
    // 22-core cross-section (11 pairs), fibre colour code
    const cols = ['#1f5fd6', '#f07a1a', '#1f9c3a', '#7a4a26', '#8b949c', '#f2f2f2', '#d62020', '#222', '#f5d515', '#7f3fbf', '#f29ab8'];
    X.save(); X.globalAlpha = a; X.beginPath(); X.arc(cx, cy, 170, 0, 7); X.fillStyle = '#0A1B2B'; X.fill(); X.strokeStyle = 'rgba(150,200,235,.5)'; X.lineWidth = 3; X.stroke(); X.restore();
    for (let i = 0; i < 22; i++) { const ring = i < 8 ? 0 : 1, n = ring ? 14 : 8, j = ring ? i - 8 : i, r = ring ? 125 : 62, an = j / n * Math.PI * 2 + (ring ? 0.1 : 0.3), k = appear(lt, 1.2 + i * 0.06, 0.3);
      X.save(); X.globalAlpha = a * k; X.beginPath(); X.arc(cx + Math.cos(an) * r, cy + Math.sin(an) * r, 17, 0, 7); X.fillStyle = cols[Math.floor(i / 2) % 11]; X.fill(); X.strokeStyle = '#051320'; X.lineWidth = 2; X.stroke(); X.restore(); }
    T('22 Core FO', cx, cy + 250, { size: 40, weight: 800, align: 'center', alpha: appear(lt, 2.4) }); T('atau 11 pair · setiap proyek', cx, cy + 290, { size: 22, weight: 600, color: C.muted, align: 'center', alpha: appear(lt, 2.4) });
    // strands to customer active equipment
    const sx = cx + 190; for (let i = 0; i < 4; i++) { const yy = cy - 60 + i * 40, p = eIO(inv(2.6, 3.6, lt)); line([[sx, yy], [lerp(sx, R.x + R.w - 150, p), yy]], cols[i], 4, a); }
    const ea = appear(lt, 3.4); panel(R.x + R.w - 170, cy - 110, 120, 200, { alpha: ea, fill: '#0E2A44' }); for (let i = 0; i < 5; i++) { X.save(); X.globalAlpha = ea; X.fillStyle = i % 2 ? C.green : '#2c4a64'; X.fillRect(R.x + R.w - 150, cy - 90 + i * 36, 80, 18); X.restore(); }
    T('Perangkat aktif', R.x + R.w - 110, cy + 130, { size: 18, weight: 700, color: C.muted, align: 'center', alpha: ea }); T('milik pelanggan', R.x + R.w - 110, cy + 154, { size: 18, weight: 700, color: C.muted, align: 'center', alpha: ea }); }
  if (arg === 'ppu') { sectionLabel('Produk 04 · PPU (Pay Per Use)', lt); needSolution(lt, 'Fleksibilitas: bayar sesuai trafik yang digunakan.', 'Pay Per Use', ['Minimum 2,5G', 'Perhitungan maksimum di peak trafik pada bulan tersebut', 'Diukur dengan data utilisasi aktual dari perangkat Pay Per Use BAKTI'], C.red);
    const a = appear(lt, 0.8); panel(R.x, R.y, R.w, R.h, { alpha: a }); const gx = R.x + 110, gy = R.y + 560, gw = R.w - 180, gh = 420;
    line([[gx, gy], [gx + gw, gy]], 'rgba(200,220,235,.4)', 2, a); line([[gx, gy], [gx, gy - gh]], 'rgba(200,220,235,.4)', 2, a);
    [0, 2.5, 5, 7.5, 10].forEach(g => { T(String(g).replace('.', ','), gx - 16, gy - g / 10 * gh + 7, { size: 18, weight: 600, color: C.muted, align: 'right', alpha: a }); if (g) line([[gx, gy - g / 10 * gh], [gx + gw, gy - g / 10 * gh]], 'rgba(200,220,235,.08)', 1, a); });
    T('Gbps', gx - 16, gy - gh - 22, { size: 16, weight: 700, color: C.muted, align: 'right', alpha: a }); T('1 bulan', gx + gw, gy + 36, { size: 18, weight: 600, color: C.muted, align: 'right', alpha: a });
    line([[gx, gy - 0.25 * gh], [gx + gw, gy - 0.25 * gh]], C.gold, 2, a * appear(lt, 2.2), [10, 8]); T('Minimum 2,5G', gx + gw - 10, gy - 0.25 * gh - 12, { size: 18, weight: 700, color: C.gold, align: 'right', alpha: appear(lt, 2.2) });
    const pts = [], pk = { v: 0, x: 0, y: 0 }, pr = eIO(inv(1.4, 3.8, lt)); for (let i = 0; i <= 120 * pr; i++) { const t = i / 120, v2 = 3.2 + 1.1 * Math.sin(t * 14) + 0.6 * Math.sin(t * 37 + 1) + (t > 0.62 && t < 0.7 ? 1.6 * Math.sin((t - 0.62) / 0.08 * Math.PI) : 0); const px = gx + t * gw, py = gy - v2 / 10 * gh; pts.push([px, py]); if (v2 > pk.v) Object.assign(pk, { v: v2, x: px, y: py }); }
    line(pts, C.cyan, 3, a); if (pr > 0.72) { glowDot(pk.x, pk.y, 6, C.red, appear(lt, 3.6)); T('Peak bulan ini: ' + pk.v.toFixed(1).replace('.', ',') + ' Gbps (ilustrasi)', pk.x - 14, pk.y - 22, { size: 20, weight: 700, color: '#FFD0D0', align: 'right', alpha: appear(lt, 3.7) }); } }
  if (arg === 'colo') { sectionLabel('Produk 03 · Kolokasi Perangkat Aktif Pelanggan', lt); needSolution(lt, 'Tempat untuk perangkat aktivasi dan integrasi layanan.', 'Kolokasi', ['Pelanggan layanan kapasitas: ruang 1U + daya maks. setara 10A DC atau 2A AC, tidak berbayar (untuk aktivasi)', 'Pelanggan dark fiber: ruang 1U tidak berbayar untuk perangkat pasif (interkoneksi)'], C.gold);
    rack(R.x + 60, R.y + 60, lt, appear(lt, 0.8)); }
};
function rack(x, y, lt, a) { // clean isometric-ish 42U rack with the customer's 1U highlighted
  const w = 300, h = 620; X.save(); X.globalAlpha = a; const g = X.createLinearGradient(x, y, x + w, y); g.addColorStop(0, '#14293C'); g.addColorStop(1, '#0B1826'); X.fillStyle = g; rr(x, y, w, h, 10); X.fill(); X.strokeStyle = 'rgba(160,210,240,.45)'; X.lineWidth = 2; X.stroke();
  X.fillStyle = '#0E1F30'; X.beginPath(); X.moveTo(x + w, y); X.lineTo(x + w + 60, y - 40); X.lineTo(x + w + 60, y + h - 40); X.lineTo(x + w, y + h); X.fill(); X.stroke();
  for (let u = 0; u < 42; u++) { const yy = y + 20 + u * 13.7; X.fillStyle = u % 7 === 0 ? '#1E3A55' : '#132A3E'; X.fillRect(x + 22, yy, w - 44, 11); }
  const hl = y + 20 + 20 * 13.7, pulse = 0.6 + 0.4 * Math.sin(lt * 4); X.fillStyle = C.cyan; X.globalAlpha = a * pulse; X.fillRect(x + 22, hl, w - 44, 11); X.globalAlpha = a;
  for (let i = 0; i < 6; i++) { X.fillStyle = i % 2 ? C.green : '#fff'; X.fillRect(x + 36 + i * 12, hl + 3, 6, 5); }
  X.restore(); const ca = appear(lt, 2.2);
  line([[x + w + 10, hl + 5], [x + w + 120, hl + 5]], C.cyan, 2, ca); chip('1U · TANPA BIAYA', x + w + 130, hl - 16, { size: 22, alpha: ca });
  const pa = appear(lt, 3.0); icon('plug', x + w + 150, hl + 110, 24, pa); T('Daya maks. setara', x + w + 190, hl + 104, { size: 20, weight: 600, color: C.muted, alpha: pa }); T('10A DC / 2A AC', x + w + 190, hl + 134, { size: 26, weight: 800, alpha: pa });
  T('NOC / TS Palapa Ring', x + w / 2, y + h + 44, { size: 20, weight: 700, color: C.muted, align: 'center', alpha: a });
}
// ---------- pricing ----------
function priceCard(x, y, w, h, o, a) { panel(x, y + (1 - a) * 24, w, h, { alpha: a, fill: o.hero ? 'rgba(20,70,110,0.9)' : C.panel2, stroke: o.hero ? C.cyan : C.line, accent: o.accent });
  const yy = y + (1 - a) * 24; T(o.k, x + 32, yy + 52, { size: 18, weight: 800, color: o.kc || C.cyan, alpha: a, track: 3, maxW: w - 60 }); if (o.sub) T(o.sub, x + 32, yy + 84, { size: 19, weight: 500, color: C.muted, alpha: a, maxW: w - 60 });
  T(o.v, x + 32, yy + h - (o.u ? 64 : 34), { size: o.vs || 44, weight: 800, alpha: a, maxW: w - 60, track: -0.5 }); if (o.u) T(o.u, x + 32, yy + h - 28, { size: 20, weight: 600, color: C.muted, alpha: a }); }
V.price = (lt, D, s, arg) => {
  bgNavy(lt, { c1: '#0A2944' });
  if (arg === 'bw') { sectionLabel('Tarif · Sewa Kapasitas (Bandwidth)', lt, 'Tarif (Rp) per bulan untuk penyediaan kapasitas pita lebar (bandwidth)');
    const ha = appear(lt, 0.4); priceCard(96, 200, 560, 300, { hero: true, k: 'MULAI DARI · KAPASITAS 1 G', v: rp(7000000), vs: 66, u: 'per bulan · Proyek 8B', accent: C.cyan }, ha);
    priceCard(96, 530, 560, 250, { k: 'MULAI DARI · KAPASITAS 10 G', v: rp(56000000), vs: 56, u: 'per bulan · Proyek 8B' }, appear(lt, 0.9));
    F.bandwidth.rows.forEach(([p, g1, g10], i) => { const a = appear(lt, 1.6 + i * 0.28), x = 720 + (i % 3) * 372, y = 200 + Math.floor(i / 3) * 300; const pj = F.projects.find(q => q.id === p);
      panel(x, y + (1 - a) * 20, 350, 280, { alpha: a }); const yy = y + (1 - a) * 20; T('PROYEK ' + p.replace('P', ''), x + 28, yy + 50, { size: 24, weight: 800, alpha: a, track: 2 }); T(pj.region, x + 28, yy + 80, { size: 16, weight: 500, color: C.muted, alpha: a, maxW: 300 });
      T('1 G', x + 28, yy + 135, { size: 17, weight: 800, color: C.cyan, alpha: a, track: 2 }); T(rp(g1), x + 28, yy + 172, { size: 32, weight: 800, alpha: a, maxW: 300 });
      T('10 G', x + 28, yy + 215, { size: 17, weight: 800, color: C.cyan, alpha: a, track: 2 }); T(rp(g10), x + 28, yy + 252, { size: 32, weight: 800, alpha: a, maxW: 300 }); });
    T('Tarif per bulan · Port tersedia: 1G, 10G, STM-4, STM-16', 720, 830, { size: 20, weight: 500, color: C.muted, alpha: appear(lt, 3.4) }); termsNote(lt); }
  if (arg === 'bundle') { sectionLabel('Tarif · Pembelian 6 Project Sekaligus', lt, 'Tarif (Rp) per bulan untuk pembelian 6 project sekaligus');
    headline('Seluruh jaringan. Satu tarif.', 96, 270, lt, 0.2, { size: 60 });
    const s1 = 113000000, s10 = 904000000; // derived: sum of per-project monthly tariffs (s14)
    [[0, 'KAPASITAS 1 G', 90400000, s1], [1, 'KAPASITAS 10 G', 723000000, s10]].forEach(([i, k, v, sum]) => { const a = appear(lt, 0.8 + i * 0.5), x = 96 + i * 880;
      priceCard(x, 340, 840, 330, { hero: true, k: k + ' · 6 PROYEK (P4, P5, P6, P7, P8A, P8B)', v: rp(v), vs: 84, u: 'per bulan', accent: C.cyan }, a);
      const b = appear(lt, 2.2 + i * 0.3); T('Jumlah tarif bila dibeli per proyek: ' + rp(sum) + ' / bulan', x, 730, { size: 22, weight: 600, color: C.muted, alpha: b });
      const diff = sum - v; T('Selisih ' + rp(diff) + ' / bulan', x, 770, { size: 26, weight: 800, color: C.green, alpha: b }); });
    T('Selisih dihitung dari tabel tarif per proyek pada dokumen yang sama.', 96, 880, { size: 19, weight: 500, color: C.dim, alpha: appear(lt, 3) }); termsNote(lt); }
  if (arg === 'df') { sectionLabel('Tarif · Sewa Core (Darkfiber) untuk Backbone', lt, 'Tarif Layanan (Rp) Penyediaan Serat Optik Pasif (dark fiber)');
    priceCard(96, 200, 520, 270, { hero: true, k: 'JALUR DARAT', v: rp(12000000), vs: 60, u: 'per km / tahun', accent: '#FFD9AE', kc: '#FFD9AE' }, appear(lt, 0.4));
    priceCard(96, 500, 520, 270, { hero: true, k: 'JALUR LAUT', v: rp(36000000), vs: 60, u: 'per km / tahun', accent: '#9FE6FF', kc: '#9FE6FF' }, appear(lt, 0.9));
    // segment example on the map (Sendawar – Long Bagun, P4)
    const ma = appear(lt, 1.6); X.save(); X.beginPath(); rr(680, 200, 1144, 570, 18); X.clip(); X.globalAlpha = ma; drawMap(mapView(115.5, 0.15, 520), { dimOthers: 'P4', labels: true, lt, pops: true }); X.restore(); panel(680, 200, 1144, 570, { alpha: ma, fill: 'rgba(0,0,0,0)' });
    const ea = appear(lt, 2.4); panel(1160, 560, 630, 180, { alpha: ea, fill: 'rgba(6,20,34,0.9)', accent: C.cyan }); T('CONTOH SEGMEN · PROYEK 4', 1192, 606, { size: 17, weight: 800, color: C.cyan, alpha: ea, track: 3 });
    T('Sendawar – Long Bagun · 191,790 km darat', 1192, 646, { size: 24, weight: 600, alpha: ea }); T(rp(2301480000) + ' / tahun', 1192, 710, { size: 44, weight: 800, alpha: ea });
    // per-project totals strip
    F.darkFiberSeg.projects.forEach(([p, segs, tot], i) => { const a = appear(lt, 3.2 + i * 0.15), x = 96 + i * 290; panel(x, 810, 270, 120, { alpha: a }); T(p.replace('Proyek-', 'PROYEK '), x + 22, 848, { size: 16, weight: 800, color: C.muted, alpha: a, track: 2 }); T(rpShort(tot), x + 22, 890, { size: 26, weight: 800, alpha: a, maxW: 230 }); T('total / tahun · ' + segs.length + ' segmen', x + 22, 918, { size: 15, weight: 500, color: C.dim, alpha: a }); });
    termsNote(lt); }
  if (arg === 'dfaccess') { sectionLabel('Tarif · Dark Fiber untuk Akses', lt);
    wrap(F.darkFiberAccess.text + '.', 96, 250, 1500, { size: 34, weight: 600, color: '#DCEAF5', lh: 46, alpha: appear(lt, 0.3) });
    T('Proporsi jarak antara NOC/TS', 96, 440, { size: 18, weight: 800, color: C.muted, alpha: appear(lt, 1), track: 3 }); T('Tarif acuan pada Kepdirut Tarif', 1100, 440, { size: 18, weight: 800, color: C.muted, alpha: appear(lt, 1), track: 3 });
    F.darkFiberAccess.rows.forEach(([r, m], i) => { const a = appear(lt, 1.4 + i * 0.4), y = 480 + i * 115, mult = [2.5, 2, 1.5, 1][i];
      panel(96, y, 1728, 96, { alpha: a }); T(r, 136, y + 62, { size: 34, weight: 700, alpha: a }); X.save(); X.globalAlpha = a; X.fillStyle = 'rgba(60,203,244,0.28)'; rr(620, y + 30, 420 * mult / 2.5 * eO(inv(1.4 + i * 0.4, 2.4 + i * 0.4, lt)), 36, 8); X.fill(); X.restore();
      T(m, 1100, y + 62, { size: 38, weight: 800, color: C.cyan, alpha: a }); });
    T('harga = harga Dark Fiber per kilometer', 96, 975, { size: 20, weight: 500, color: C.dim, alpha: appear(lt, 3) }); termsNote(lt); }
  if (arg === 'ppu') { sectionLabel('Tarif · Skema PPU (Pay Per Use)', lt, 'Tarif proporsional terhadap Tarif Normal 10 Gbps, per proyek');
    const pr = ['P4', 'P5', 'P6', 'P7', 'P8A', 'P8B'], cyc = Math.floor(clamp((lt - 2.5) / Math.max(0.8, (D - 3.5) / 6), 0, 5)), pj = lt < 2.5 ? 'P8B' : pr[cyc];
    pr.forEach((p, i) => chip(p, 1150 + i * 110, 180, { size: 20, fill: p === pj ? 'rgba(227,38,45,0.35)' : 'rgba(255,255,255,0.05)', stroke: p === pj ? C.red : 'rgba(255,255,255,0.2)', color: p === pj ? '#fff' : C.muted, alpha: appear(lt, 0.3) }));
    T('Tingkat utilisasi (Gbps)', 96, 250, { size: 18, weight: 800, color: C.muted, alpha: appear(lt, .4), track: 2 }); T('% terhadap tarif', 520, 250, { size: 18, weight: 800, color: C.muted, alpha: appear(lt, .4), track: 2 }); T('Dibayarkan · Proyek ' + pj.replace('P', ''), 1824, 250, { size: 18, weight: 800, color: C.red, align: 'right', alpha: appear(lt, .4), track: 2 });
    F.ppu.tiers.forEach(([r, pc], i) => { const a = appear(lt, 0.6 + i * 0.12, 0.4), y = 282 + i * 74; panel(96, y, 1728, 62, { alpha: a, r: 12, fill: i === 0 ? 'rgba(227,38,45,0.16)' : C.panel });
      T(r, 126, y + 42, { size: 26, weight: 700, alpha: a }); X.save(); X.globalAlpha = a; X.fillStyle = 'rgba(227,38,45,0.55)'; rr(520, y + 18, 700 * pc / 100 * eO(inv(0.6 + i * 0.12, 1.4 + i * 0.12, lt)), 26, 6); X.fill(); X.restore();
      T(pc + '%', 520 + 700 * pc / 100 + 16, y + 42, { size: 24, weight: 800, color: '#FFD0D0', alpha: a }); T(rp(F.ppu.table[pj][i]), 1794, y + 43, { size: 28, weight: 800, align: 'right', alpha: a }); });
    T('Tarif Normal 10 Gbps Proyek ' + pj.replace('P', '') + ': ' + rp(F.bandwidth.rows.find(r => r[0] === pj)[2]) + ' / bulan · Utilisasi diukur dari perangkat Pay Per Use BAKTI', 96, 975, { size: 20, weight: 500, color: C.muted, alpha: appear(lt, 2), maxW: 1728 }); termsNote(lt); }
  if (arg === 'colo') { sectionLabel('Tarif · Kolokasi', lt, 'Biaya Acuan · Monthly Charge');
    F.coloRef.indoor.slice(0, 4).forEach(([n, v], i) => priceCard(96 + i * 438, 200, 410, 260, { k: 'INDOOR', sub: n, v: rp(v), vs: 42, u: 'biaya acuan / bulan', accent: i === 0 ? C.gold : null }, appear(lt, 0.4 + i * 0.3)));
    const a2 = appear(lt, 2); panel(96, 500, 850, 200, { alpha: a2 }); T('TAMBAHAN DAYA', 128, 548, { size: 17, weight: 800, color: C.gold, alpha: a2, track: 3 });
    T('per 10A DC  ' + rp(526000), 128, 604, { size: 30, weight: 700, alpha: a2 }); T('per 2A AC   ' + rp(460000), 128, 652, { size: 30, weight: 700, alpha: a2 }); T('MCB & kabel disediakan pelanggan · NOC dengan sumber daya utama PLN', 128, 684, { size: 16, weight: 500, color: C.dim, alpha: a2, maxW: 790 });
    const a3 = appear(lt, 2.6); panel(974, 500, 850, 200, { alpha: a3 }); T('OUTDOOR · LAHAN TERBUKA', 1006, 548, { size: 17, weight: 800, color: C.gold, alpha: a3, track: 3 }); T(rp(500000) + ' / m²', 1006, 618, { size: 44, weight: 800, alpha: a3 }); T('Lahan terbuka kosong per ~1 m² · biaya acuan / bulan', 1006, 664, { size: 18, weight: 500, color: C.muted, alpha: a3 });
    const a4 = appear(lt, 3.2); panel(96, 730, 1728, 210, { alpha: a4 }); T('OUTDOOR · TOWER', 128, 778, { size: 17, weight: 800, color: C.gold, alpha: a4, track: 3 });
    [['3M window (antena transmisi ≤ 1,2 m)', 10500000], ['3M window (antena transmisi ≤ 1,8 m)', 12500000], ['Antena MW ≤ 1,2 m (tanpa 3M window)', 2121000], ['Tambahan per sectoral antena', 1100000]].forEach(([n, v], i) => { const x = 128 + i * 424; T(n, x, 830, { size: 18, weight: 600, color: C.muted, alpha: a4, maxW: 400 }); T(rp(v), x, 880, { size: 34, weight: 800, alpha: a4 }); T('biaya acuan / bulan', x, 912, { size: 16, weight: 500, color: C.dim, alpha: a4 }); });
    T('Biaya kolokasi = Biaya Acuan × Koefisien Hardship × Qty · Syarat & Ketentuan Berlaku', 96, 990, { size: 19, weight: 600, color: C.muted, alpha: appear(lt, 3.6) }); }
  if (arg === 'coloformula') { sectionLabel('Formula Biaya Kolokasi', lt, 'Nilai ini merupakan biaya layanan kolokasi per bulan');
    const parts = [['Biaya Acuan', C.white], ['×', C.dim], ['Koefisien Hardship', C.gold], ['×', C.dim], ['Qty Layanan', C.cyan]]; let x = 96; parts.forEach(([p, c], i) => { const a = appear(lt, 0.3 + i * 0.3); x += T(p, x, 330, { size: 58, weight: 800, color: c, alpha: a }) + 30; });
    T('KOEFISIEN HARDSHIP (FAKTOR TINGKAT KESULITAN)', 96, 430, { size: 17, weight: 800, color: C.gold, alpha: appear(lt, 1.8), track: 3 });
    [['Proyek 4', 1.2], ['Proyek 5', 1.0], ['Proyek 6', 1.1], ['Proyek 7', 1.1], ['Proyek 8', 1.2]].forEach(([p, v], i) => { const a = appear(lt, 2 + i * 0.15); panel(96 + i * 250, 460, 230, 120, { alpha: a }); T(p, 124 + i * 250, 502, { size: 20, weight: 700, color: C.muted, alpha: a }); T(v.toFixed(1).replace('.', ','), 124 + i * 250, 560, { size: 48, weight: 800, alpha: a }); });
    const ea = appear(lt, D * 0.45); panel(96, 630, 1728, 300, { alpha: ea, accent: C.cyan, fill: C.panel2 }); T('CONTOH', 136, 680, { size: 17, weight: 800, color: C.cyan, alpha: ea, track: 3 });
    wrap('Perangkat pasif OTB 2U — perangkat tambahan (bukan perangkat pertama) di NOC/INT Sendawar, Proyek 4', 136, 726, 1600, { size: 26, weight: 600, color: '#DCEAF5', alpha: ea });
    const eb = appear(lt, D * 0.6); T('Rp 1.500.000  ×  1,2  ×  1', 136, 830, { size: 50, weight: 800, alpha: eb }); const ec = appear(lt, D * 0.72); T('=  ' + rp(1800000) + ' / bulan', 900, 830, { size: 56, weight: 800, color: C.cyan, alpha: ec });
    T('Perangkat pertama di setiap NOC/INT mendapat 1U tidak berbayar.', 136, 894, { size: 21, weight: 500, color: C.muted, alpha: ec }); }
};
function termsNote(lt) { T('Syarat & Ketentuan Berlaku', W - 96, H - 60, { size: 18, weight: 600, color: C.dim, align: 'right', alpha: appear(lt, 1.5) }); }
V.bundle = (lt, D) => {
  bgNavy(lt, { c1: '#0C3050' }); sectionLabel('Paket Konektivitas', lt); headline('Satu paket konektivitas yang utuh', 96, 250, lt, 0.2, { size: 58 });
  const nodes = [['Rak pelanggan', 'Kolokasi 1U', 'colo', 'TANPA BIAYA*'], ['Daya aktivasi', 'maks. setara 10A DC / 2A AC', 'plug', 'TANPA BIAYA*'], ['Sewa Kapasitas', 'Dedicated · 1G / 10G / STM-4 / STM-16', 'bw', 'MULAI RP 7 JT / BLN'], ['NOC / TS', 'Titik Layanan Palapa Ring', 'map', ''], ['Jaringan Backbone Nasional', 'melalui Titik Interkoneksi', 'reach', '']];
  const y = 600, gap = 1728 / nodes.length; nodes.forEach(([n, d, ic, b], i) => { const a = appear(lt, 0.7 + i * 0.55), x = 96 + i * gap + gap / 2;
    if (i < nodes.length - 1) { const p = eO(inv(1.0 + i * 0.55, 1.6 + i * 0.55, lt)); line([[x + 70, y], [x + 70 + (gap - 140) * p, y]], C.cyan, 3, 0.8); for (let q = 0; q < 3; q++) if (p > 0.99) glowDot(x + 70 + (gap - 140) * ((lt * 0.6 + q / 3) % 1), y, 3, '#BFF1FF', 0.9); }
    X.save(); X.globalAlpha = a; X.beginPath(); X.arc(x, y, 64, 0, 7); X.fillStyle = C.panel2; X.fill(); X.strokeStyle = C.cyan; X.lineWidth = 2; X.stroke(); X.restore(); icon(ic, x, y, 30, a);
    T(n, x, y + 120, { size: 26, weight: 800, align: 'center', alpha: a, maxW: gap - 30 }); T(d, x, y + 160, { size: 20, weight: 500, color: C.muted, alpha: a, align: 'center', maxW: gap - 30 });
    if (b) chip(b, x, y - 140, { size: 18, align: 'center', alpha: appear(lt, 1.4 + i * 0.55), fill: b.startsWith('TANPA') ? 'rgba(61,214,160,0.18)' : undefined, stroke: b.startsWith('TANPA') ? C.green : undefined, color: b.startsWith('TANPA') ? C.green : undefined }); });
  T('*Untuk keperluan aktivasi (pelanggan layanan kapasitas). Pelanggan dark fiber: 1U tidak berbayar untuk perangkat pasif. Syarat & Ketentuan Berlaku.', 96, 960, { size: 19, weight: 500, color: C.dim, alpha: appear(lt, 3), maxW: 1728 });
};
V.journey = (lt, D) => {
  bgNavy(lt, { c1: '#0A2944' }); sectionLabel('How to Subscribe', lt); headline('Cara berlangganan', 96, 250, lt, 0.2, { size: 60 });
  const steps = [['01', 'Hubungi Kami', 'Tim komersial PT Len Telekomunikasi Indonesia', 'phone'], ['02', 'Tentukan Layanan', 'Produk, kapasitas, dan lokasi: per proyek, per segmen, atau per titik akses', 'map'], ['03', 'Penawaran', 'Sesuai tarif yang berlaku', 'doc'], ['04', 'Aktivasi & Interkoneksi', 'Perangkat pelanggan di NOC/TS Palapa Ring (kolokasi)', 'plug'], ['05', 'Layanan Berjalan', 'Konektivitas aktif untuk bisnis Anda', 'live']];
  const per = (D - 1.2) / steps.length, gap = 1728 / steps.length, y = 560;
  line([[96 + gap / 2, y], [96 + gap / 2 + (1728 - gap) * eIO(inv(0.8, D - 1, lt)), y]], C.cyan, 3, 0.9);
  steps.forEach(([n, t1, d, ic], i) => { const a = appear(lt, 0.8 + i * per, 0.5), x = 96 + i * gap + gap / 2, on = lt > 0.8 + i * per && lt < 0.8 + (i + 1) * per;
    X.save(); X.globalAlpha = a; X.beginPath(); X.arc(x, y, on ? 58 : 50, 0, 7); X.fillStyle = on ? 'rgba(60,203,244,0.3)' : C.panel2; X.fill(); X.strokeStyle = C.cyan; X.lineWidth = on ? 3 : 2; X.stroke(); X.restore(); icon(ic, x, y, 24, a);
    T('STEP ' + n, x, y - 96, { size: 18, weight: 800, color: C.cyan, align: 'center', alpha: a, track: 3 }); T(t1, x, y + 124, { size: 30, weight: 800, align: 'center', alpha: a, maxW: gap - 20 });
    X.save(); X.textAlign = 'center'; X.restore(); const lines = []; { X.save(); X.font = '500 20px M'; let l = ''; d.split(' ').forEach(w => { const t2 = l ? l + ' ' + w : w; if (X.measureText(t2).width > gap - 50 && l) { lines.push(l); l = w; } else l = t2; }); lines.push(l); X.restore(); }
    lines.forEach((l, j) => T(l, x, y + 168 + j * 30, { size: 21, weight: 500, color: C.muted, align: 'center', alpha: a })); });
  T('Detail kontrak dan jadwal aktivasi dikonfirmasi bersama tim komersial · Syarat & Ketentuan Berlaku', 96, 960, { size: 20, weight: 500, color: C.dim, alpha: appear(lt, D - 1.5) });
};
V.billing = (lt, D) => {
  bgNavy(lt); sectionLabel('Commercial Journey', lt, 'Periode tarif sesuai daftar tarif'); headline('Tarif yang jelas, sesuai layanan', 96, 250, lt, 0.2, { size: 58 });
  const a1 = appear(lt, 0.8); panel(96, 320, 850, 330, { alpha: a1, accent: C.cyan, fill: C.panel2 }); T('BULANAN', 136, 376, { size: 20, weight: 800, color: C.cyan, alpha: a1, track: 4 });
  ['Sewa Kapasitas (Bandwidth)', 'PPU (Pay Per Use) · berdasarkan peak trafik bulan tersebut', 'Kolokasi · biaya acuan × koefisien hardship × qty'].forEach((s, i) => { icon('check', 152, 440 + i * 64, 14, a1); T(s, 186, 450 + i * 64, { size: 26, weight: 600, alpha: a1, maxW: 720 }); });
  const a2 = appear(lt, 1.4); panel(974, 320, 850, 330, { alpha: a2, accent: '#8FA7FF', fill: C.panel2 }); T('TAHUNAN', 1014, 376, { size: 20, weight: 800, color: '#8FA7FF', alpha: a2, track: 4 });
  ['Sewa Core (Darkfiber) · per km / tahun', 'Per segmen · harga (Rp) / tahun'].forEach((s, i) => { icon('check', 1030, 440 + i * 64, 14, a2); T(s, 1064, 450 + i * 64, { size: 26, weight: 600, alpha: a2, maxW: 720 }); });
  T('KETENTUAN KOLOKASI', 96, 720, { size: 17, weight: 800, color: C.gold, alpha: appear(lt, 2.2), track: 3 });
  const tc = ['Hanya untuk pelanggan Palapa Ring, pada proyek yang sama', 'Instalasi & material: tanggung jawab pelanggan', 'Pemeliharaan perangkat: tanggung jawab pelanggan', 'Bukan untuk digunakan sebagai NOC pelanggan'];
  tc.forEach((s, i) => { const a = appear(lt, 2.4 + i * 0.3); panel(96 + i * 438, 750, 410, 150, { alpha: a }); wrap(s, 126 + i * 438, 810, 350, { size: 22, weight: 600, color: '#DCEAF5', alpha: a }); });
  T('Syarat & Ketentuan Berlaku', 96, 970, { size: 19, weight: 600, color: C.dim, alpha: appear(lt, 3) });
};
V.value = (lt, D) => {
  const v = mapView(121.4, -0.75, 112); drawMap(v, { lt, alpha: 0.5, labels: false }); X.fillStyle = 'rgba(4,14,24,0.72)'; X.fillRect(0, 0, W, H);
  sectionLabel('Why Palapa Ring Tengah', lt); headline('Mengapa Palapa Ring Paket Tengah?', 96, 250, lt, 0.2, { size: 60 });
  const P = [['scale', 'Kapasitas Dedicated', '100 Gbps (expandable) per proyek, kapasitas terjamin'], ['reach', 'Jangkauan 3T', '17 kabupaten · 17 kota layanan · 10 kota interkoneksi'], ['df', 'Pilihan Layanan', 'Kapasitas, dark fiber, kolokasi, hingga Pay Per Use'], ['price', 'Tarif Jelas', 'Per proyek, per segmen, dan per tingkat utilisasi']];
  const per = (D - 1) / 4; P.forEach(([ic, t1, d], i) => { const a = appear(lt, 0.8 + i * per * 0.8), x = 96 + i * 438; panel(x, 360, 410, 480, { alpha: a, fill: C.panel2 }); icon(ic, x + 70, 450, 36, a); T(t1, x + 36, 580, { size: 34, weight: 800, alpha: a, maxW: 350 }); wrap(d, x + 36, 630, 340, { size: 23, weight: 500, color: C.muted, alpha: a, lh: 32 }); });
};
V.usecase = (lt, D, s, arg) => {
  bgNavy(lt, { c1: '#0B2E4E' }); sectionLabel('Use Case · ISP', lt, 'Operator Telekomunikasi & ISP Lokal');
  headline('ISP lokal di kota layanan', 96, 250, lt, 0.2, { size: 60 });
  const nodes = [['Jaringan Backbone Nasional', 'reach'], ['Titik Interkoneksi', 'map'], ['Titik Layanan (NOC/TS)', 'colo'], ['Tenant Router · ISP', 'bw'], ['Pelanggan: rumah, kantor, sekolah', 'people']];
  const gap = 1728 / nodes.length, y = 560; nodes.forEach(([n, ic], i) => { const a = appear(lt, 0.8 + i * 0.6), x = 96 + i * gap + gap / 2;
    if (i < nodes.length - 1) { const p = eO(inv(1.1 + i * 0.6, 1.7 + i * 0.6, lt)); line([[x + 70, y], [x + 70 + (gap - 140) * p, y]], i === 1 ? C.gold : C.cyan, 3, 0.8); if (p > .99) for (let q = 0; q < 3; q++) glowDot(x + 70 + (gap - 140) * ((lt * 0.6 + q / 3) % 1), y, 3, '#BFF1FF', 0.9); }
    X.save(); X.globalAlpha = a; X.beginPath(); X.arc(x, y, 66, 0, 7); X.fillStyle = C.panel2; X.fill(); X.strokeStyle = i === 2 || i === 1 ? C.gold : C.cyan; X.lineWidth = 2; X.stroke(); X.restore(); icon(ic, x, y, 30, a);
    T(n, x, y + 124, { size: 24, weight: 700, align: 'center', alpha: a, maxW: gap - 20 }); });
  const b = appear(lt, D * 0.6); chip('Palapa Ring Paket Tengah', 96 + gap * 1.5 + gap / 2 - 60, y - 170, { size: 22, alpha: b, align: 'center' });
  T('Produk terkait: Sewa Kapasitas · PPU · Kolokasi 1U untuk aktivasi', 96, 930, { size: 22, weight: 600, color: C.muted, alpha: b });
};
V.calc = (lt, D, s, arg) => {
  bgNavy(lt, { c1: '#0A2944' }); sectionLabel('Commercial Calculator', lt, 'Ilustrasi berdasarkan daftar tarif');
  const isp = arg === 'isp'; headline(isp ? 'Simulasi: ISP di Tahuna' : 'Simulasi: Pay Per Use', 96, 250, lt, 0.2, { size: 58 });
  const rows = isp ? [['Kebutuhan', 'Kapasitas 1 G · Proyek 8A (Tahuna)', ''], ['Sewa Kapasitas 1 G', 'tarif per bulan, Proyek 8A', rp(30000000)], ['Kolokasi 1U', 'perangkat aktivasi pertama', 'Rp 0']]
    : [['Kebutuhan', 'PPU · Proyek 5 · peak trafik 4,6 Gbps (contoh)', ''], ['Tier utilisasi', '4 < x ≤ 5 Gbps → 50% × Tarif Normal 10 Gbps', '50%'], ['Tarif Normal 10 Gbps', 'Proyek 5, per bulan', rp(152000000)]];
  panel(96, 320, 1200, 560, { alpha: appear(lt, 0.4), fill: C.panel2 });
  rows.forEach(([k, d, v], i) => { const a = appear(lt, 0.9 + i * (D * 0.16)), y = 400 + i * 120; T(k, 140, y, { size: 30, weight: 800, alpha: a }); T(d, 140, y + 40, { size: 22, weight: 500, color: C.muted, alpha: a, maxW: 780 }); if (v) T(v, 1256, y + 12, { size: 40, weight: 800, align: 'right', alpha: a }); line([[140, y + 70], [1256, y + 70]], 'rgba(255,255,255,0.08)', 1, a); });
  const ta = appear(lt, D * 0.62); X.save(); X.globalAlpha = ta; X.fillStyle = 'rgba(60,203,244,0.16)'; rr(120, 760, 1156, 100, 14); X.fill(); X.restore();
  T(isp ? 'TOTAL PER BULAN' : 'TAGIHAN BULAN TERSEBUT', 150, 824, { size: 24, weight: 800, color: C.cyan, alpha: ta, track: 3 }); T(rp(isp ? 30000000 : 76000000), 1256, 830, { size: 54, weight: 800, align: 'right', alpha: ta });
  const na = appear(lt, D * 0.7); panel(1340, 320, 484, 560, { alpha: na });
  wrap(isp ? 'Setiap pelanggan layanan kapasitas berhak atas ruang 1U dan daya maks. setara 10A DC / 2A AC tidak berbayar untuk aktivasi.' : 'Utilisasi dihitung dari data pengukuran aktual perangkat Pay Per Use BAKTI, pada peak trafik bulan tersebut. Minimum 2,5G.', 1376, 400, 420, { size: 23, weight: 500, color: '#DCEAF5', alpha: na, lh: 33 });
  wrap('Ilustrasi berdasarkan daftar tarif. Nilai final mengikuti penawaran resmi. Syarat & Ketentuan Berlaku.', 1376, 780, 420, { size: 18, weight: 500, color: C.dim, alpha: na, lh: 26 });
};
V.decision = (lt, D) => {
  bgNavy(lt, { c1: '#0C3050' }); const words = ['Kapasitas', 'Jangkauan', 'Keandalan', 'Infrastruktur', 'Skalabilitas'];
  headline('Apa yang dibutuhkan jaringan Anda?', W / 2, 250, lt, 0.2, { size: 58, align: 'center' });
  const conv = eIO(inv(D * 0.5, D * 0.68, lt)); words.forEach((w, i) => { const an = -Math.PI / 2 + i / 5 * Math.PI * 2, r = 330, x0 = W / 2 + Math.cos(an) * r * 1.35, y0 = 610 + Math.sin(an) * r * 0.62; const a = appear(lt, 0.8 + i * 0.35) * Math.pow(1 - conv, 2);
    const x = lerp(x0, W / 2, conv), y = lerp(y0, 610, conv); T(w, x, y, { size: 46, weight: 800, align: 'center', alpha: a }); line([[x, y + 14], [W / 2, 610]], 'rgba(60,203,244,0.25)', 1.5, a * 0.8); });
  const fa = appear(lt, D * 0.64, 0.8); if (LOGO_RING) { X.save(); X.globalAlpha = fa; X.drawImage(LOGO_RING, W / 2 - 90, 470, 180, 180); X.restore(); }
  T('PALAPA RING PAKET TENGAH', W / 2, 740, { size: 44, weight: 800, align: 'center', alpha: fa, track: 8 });
};
V.cta = (lt, D, s) => {
  bgNavy(lt, { c1: '#0D3558' }); const short = s.id[0] !== 'M';
  headline('Siap menghubungkan bisnis Anda?', 96, 250, lt, 0.2, { size: 66 });
  ['Jelajahi layanan kami', 'Cek ketersediaan jaringan', 'Bicara dengan tim komersial'].forEach((b, i) => { const a = appear(lt, 0.7 + i * 0.3), x = 96 + i * 560; X.save(); X.globalAlpha = a; rr(x, 320, 530, 92, 46); X.fillStyle = i === 2 ? C.cyan : 'rgba(255,255,255,0.06)'; X.fill(); X.strokeStyle = i === 2 ? C.cyan : 'rgba(255,255,255,0.35)'; X.lineWidth = 2; X.stroke(); X.restore(); T(b.toUpperCase() + '  →', x + 265, 377, { size: 22, weight: 800, align: 'center', color: i === 2 ? '#04202F' : C.white, alpha: a, track: 1.5, maxW: 480 }); });
  const a = appear(lt, 1.6); panel(96, 470, 1728, 460, { alpha: a, fill: C.panel2 });
  T('HOTLINE', 146, 540, { size: 18, weight: 800, color: C.cyan, alpha: a, track: 4 }); T(F.contact.hotline, 146, 640, { size: 110, weight: 800, alpha: a, track: 2 });
  T('TELEPON', 146, 700, { size: 18, weight: 800, color: C.cyan, alpha: a, track: 4 }); T(F.contact.phone, 146, 748, { size: 40, weight: 700, alpha: a });
  T('ALAMAT', 146, 810, { size: 18, weight: 800, color: C.cyan, alpha: a, track: 4 }); wrap(F.contact.company + ' · ' + F.contact.address, 146, 848, 820, { size: 21, weight: 500, color: '#DCEAF5', alpha: a, lh: 30 });
  const b = appear(lt, 2.2); T('TIM KOMERSIAL · EMAIL', 1030, 540, { size: 18, weight: 800, color: C.cyan, alpha: b, track: 4 });
  F.contact.sales.forEach(([n], i) => { T(n, 1030, 596 + i * 78, { size: 26, weight: 700, alpha: b }); T(F.contact.emails[i], 1030, 628 + i * 78, { size: 22, weight: 500, color: C.muted, alpha: b }); });
};
V.offers = (lt, D) => {
  bgNavy(lt, { c1: '#0A2944' }); sectionLabel('Produk & Layanan', lt, 'Palapa Ring Paket Tengah');
  const O = [['Sewa Kapasitas', 'MULAI DARI', rp(7000000), 'per bulan · 1 G · Proyek 8B', C.cyan, 'bw'], ['Sewa Core (Darkfiber)', 'DARAT', rp(12000000), 'per km / tahun · laut Rp 36.000.000', '#8FA7FF', 'df'], ['PPU (Pay Per Use)', 'MULAI DARI', rp(14000000), 'per bulan · ≤ 2,5 Gbps · Proyek 8B', C.red, 'ppu'], ['Kolokasi', 'UNTUK AKTIVASI', '1U tanpa biaya', 'pelanggan layanan kapasitas', C.gold, 'colo']];
  const per = (D - 1) / 4; O.forEach(([n, k, v, u, col, ic], i) => { const a = appear(lt, 0.4 + i * per * 0.9), x = 96 + i * 438; panel(x, 260 + (1 - a) * 30, 410, 600, { alpha: a, fill: C.panel2 }); X.save(); X.globalAlpha = a; X.fillStyle = col; X.fillRect(x, 260 + (1 - a) * 30, 410, 5); X.restore();
    const yy = 260 + (1 - a) * 30; icon(ic, x + 205, yy + 230, 58, a); T(n, x + 34, yy + 80, { size: 32, weight: 800, alpha: a, maxW: 350 }); T(k, x + 34, yy + 380, { size: 18, weight: 800, color: col, alpha: a, track: 3 }); T(v, x + 34, yy + 450, { size: 44, weight: 800, alpha: a, maxW: 350 }); wrap(u, x + 34, yy + 500, 350, { size: 20, weight: 500, color: C.muted, alpha: a }); });
  termsNote(lt);
};
V.end = async (lt, D) => {
  await drawPlate(['finale'], lt, D); X.fillStyle = 'rgba(3,12,22,0.55)'; X.fillRect(0, 0, W, H); vignette(0.6);
  const a = appear(lt, 0.3, 0.9); X.save(); X.globalAlpha = a; rr(W / 2 - 330, 300, 660, 240, 26); X.fillStyle = 'rgba(255,255,255,0.96)'; X.fill(); if (IMG.lti) X.drawImage(IMG.lti, W / 2 - 290, 330, 580, 580 * IMG.lti.height / IMG.lti.width); X.restore();
  T('PALAPA RING PAKET TENGAH', W / 2, 640, { size: 42, weight: 800, align: 'center', alpha: appear(lt, 0.9), track: 10 });
  T('“Semua Berhak Terhubung”', W / 2, 712, { size: 46, weight: 600, align: 'center', color: C.cyan, alpha: appear(lt, 1.4) });
  T('Hotline ' + F.contact.hotline, W / 2, 800, { size: 28, weight: 700, align: 'center', color: '#DCEAF5', alpha: appear(lt, 1.8) });
};

// ======================================================================
// TIMELINE
// ======================================================================
let TL = [], TOTAL = 0;
const MIN = { plate: 5, map: 7, metrics: 11, projects: 12, segments: 9, portfolio: 8, product: 10, price: 9, bundle: 8, journey: 12, billing: 9, value: 10, usecase: 8, calc: 9, decision: 8, cta: 9, end: 5, offers: 9 };
window.build = (version, durs) => { TL = []; let t = 0; const list = window.SCRIPT[version];
  list.forEach(s => { const [kind, arg] = s.view.split(':'); const vd = durs[s.id] || 3; const lead = version === 'MAIN' ? 0.45 : 0.6, tail = kind === 'end' ? 2.4 : version === 'MAIN' ? 0.7 : 0.9;
    const D = Math.max(version === 'MAIN' ? (MIN[kind] || 6) * 0.62 : version === 'TEASER' ? 5.4 : 3.4, lead + vd + tail); TL.push({ s, kind, arg, a: t, D, vo: t + lead }); t += D; });
  TOTAL = t; return TL.map(e => ({ id: e.s.id, a: +e.a.toFixed(3), D: +e.D.toFixed(3), vo: +e.vo.toFixed(3), kind: e.kind })); };
window.renderFrame = async (i) => { const t = i / FPS; const e = TL.find(e => t >= e.a && t < e.a + e.D) || TL[TL.length - 1]; const lt = t - e.a;
  X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.globalCompositeOperation = 'source-over'; X.filter = 'none';
  await V[e.kind](lt, e.D, e.s, e.arg);
  // dip-to-navy transitions
  const fin = 1 - inv(0, 0.35, lt), fout = inv(e.D - 0.3, e.D, lt), first = e === TL[0], last = e === TL[TL.length - 1];
  const dip = Math.max(first ? 1 - inv(0, 1.0, lt) : fin, last ? inv(e.D - 1.2, e.D, lt) : fout); if (dip > 0) { X.fillStyle = `rgba(3,10,18,${dip})`; X.fillRect(0, 0, W, H); }
  return cv.toDataURL('image/jpeg', 0.92); };
window.READY = (async () => { await Promise.all([loadImg('region', 'assets/region.jpg'), loadImg('ring', 'assets/logo512.png'), loadImg('lti', 'assets/lti_lockup.png')]);
  for (const w of [400, 500, 600, 700, 800]) await document.fonts.load(`${w} 20px M`); prepMap(); return true; })();
