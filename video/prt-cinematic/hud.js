import { W, H, sstep, clamp, lerp } from './core.js';
export const hudCanvas = document.createElement('canvas'); hudCanvas.width = W; hudCanvas.height = H;
const x = hudCanvas.getContext('2d');
const CYAN = '#5FD4FF', WHITE = '#F4F8FB', MUTED = 'rgba(214,230,242,0.72)', NAVY = 'rgba(4,18,34,0.62)';

// real LTI ring mark (background knocked out) -- loaded once
let LOGO = null; { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d');
  g.drawImage(im, 76, 78, 360, 360, 0, 0, 360, 360); const d = g.getImageData(0, 0, 360, 360);
  for (let i = 0; i < d.data.length; i += 4) { const r = d.data[i], gg = d.data[i + 1], b = d.data[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), s = mx ? (mx - mn) / mx : 0; d.data[i + 3] = s < 0.42 ? 0 : Math.min(255, (s - 0.42) * 1400); }
  g.putImageData(d, 0, 0); LOGO = c; }; im.src = 'logo512.png'; }
export const logoReady = () => !!LOGO;

const LAYERS = ['Submarine cable', 'Cable landing station', 'PRT fibre backbone', 'PoP / network node', 'Terrestrial fibre', 'BTS 4G / 5G', 'Enterprise · Gov · School · Hospital · Community', 'Digital services'];
// [start, end, layerIndex, chapter number, title, subtitle]
const CHAPTERS = [
  [8.6, 16.2, 2, '01', 'The Palapa Ring Tengah backbone', 'Kalimantan · Sulawesi · Maluku Utara'],
  [16.6, 27.8, 0, '02', 'Submarine fibre-optic cable', 'Armoured cable on the seabed, carrying light across the straits'],
  [28.4, 31.3, 1, '03', 'Cable landing station', 'Beach manhole → terminal station: sea meets land'],
  [31.3, 36.2, 4, '04', 'Terrestrial fibre backbone', 'Buried duct and aerial fibre along the road network'],
  [36.2, 38.4, 3, '05', 'PoP / network node', 'Point of Presence: where the backbone hands traffic to local networks'],
  [38.4, 40.7, 5, '06', 'BTS 4G / 5G', 'Fibre-fed towers turn light into mobile coverage'],
  [40.7, 43.2, 6, '07', 'Connected communities', 'Enterprise · government · schools · hospitals · households'],
  [43.4, 47.4, 7, '08', 'Digital services', 'One integrated ecosystem — submarine, terrestrial, mobile, digital'],
];
const STATS = [['3,100+ km', 'fibre backbone'], ['1,823 km', 'submarine cable'], ['1,320 km', 'terrestrial cable'], ['27', 'PoPs'], ['600 Gbps', 'DWDM capacity']];

function txt(s, px, py, { size = 24, weight = 500, color = WHITE, align = 'left', alpha = 1, track = 0 } = {}) {
  if (alpha <= 0) return; x.save(); x.globalAlpha = alpha; x.font = `${weight} ${size}px M`; x.fillStyle = color; x.textAlign = align; x.textBaseline = 'alphabetic';
  if (track) { x.letterSpacing = `${track}px`; } x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 8; x.fillText(s, px, py); x.restore(); }
function callout(l) {
  const a = l.a; if (a <= 0) return; x.save(); x.globalAlpha = a;
  const lx = l.x + 34, ly = l.y - 46; x.strokeStyle = 'rgba(200,236,255,0.85)'; x.lineWidth = 1.5;
  x.beginPath(); x.arc(l.x, l.y, 4, 0, 7); x.fillStyle = CYAN; x.fill(); x.beginPath(); x.moveTo(l.x, l.y); x.lineTo(lx, ly); x.lineTo(lx + 16, ly); x.stroke();
  x.font = '600 21px M'; const w = x.measureText(l.name).width; x.fillStyle = NAVY; x.fillRect(lx + 16, ly - 17, w + 22, 34); x.fillStyle = CYAN; x.fillRect(lx + 16, ly - 17, 3, 34);
  x.fillStyle = WHITE; x.textBaseline = 'middle'; x.fillText(l.name, lx + 28, ly + 1); x.restore();
}
function cityTag(l) { const a = l.a; if (a <= 0) return; x.save(); x.globalAlpha = a * 0.95; x.font = '600 17px M'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,.8)'; x.shadowBlur = 6; x.fillStyle = WHITE; x.fillText(l.name, l.x + 12, l.y - 12); x.restore(); }

export function drawHUD(t, labels = [], kind = '') {
  x.clearRect(0, 0, W, H);
  // letterbox bars for a cinematic 2.2:1 feel during the opening, relaxing to full frame
  const lb = lerp(96, 0, sstep(7.5, 9.5, t)) + lerp(0, 60, sstep(47.2, 48.4, t)); if (lb > 0) { x.fillStyle = '#000'; x.fillRect(0, 0, W, lb); x.fillRect(0, H - lb, W, lb); }
  // ---- opening title ----
  const ta = sstep(1.4, 2.6, t) * (1 - sstep(6.2, 7.4, t));
  if (ta > 0) { txt('PALAPA RING TENGAH', W / 2, H / 2 - 10, { size: 64, weight: 800, align: 'center', alpha: ta, track: 14 });
    txt('Integrated fibre-optic backbone for Central Indonesia', W / 2, H / 2 + 44, { size: 26, weight: 300, align: 'center', color: MUTED, alpha: ta * sstep(2.2, 3.2, t), track: 2 });
    x.save(); x.globalAlpha = ta; x.fillStyle = CYAN; x.fillRect(W / 2 - 40, H / 2 + 72, 80, 2); x.restore(); }
  // ---- labels from the active set ----
  if (kind === 'region') labels.forEach(cityTag); else labels.forEach(callout);
  // ---- chapter titles + hierarchy rail ----
  const ch = CHAPTERS.find(c => t >= c[0] && t < c[1]);
  const railA = sstep(9.0, 10.0, t) * (1 - sstep(47.0, 47.8, t)) * (1 - 0.8 * sstep(21.0, 21.5, t) * (1 - sstep(23.4, 23.9, t)));
  if (railA > 0) { x.save(); x.globalAlpha = railA; const X0 = 64, Y0 = H - 72 - LAYERS.length * 34;
    x.fillStyle = 'rgba(4,18,34,0.42)'; x.fillRect(X0 - 22, Y0 - 44, 380, LAYERS.length * 34 + 60);
    txt('NETWORK ARCHITECTURE', X0, Y0 - 16, { size: 14, weight: 700, color: CYAN, track: 3 });
    LAYERS.forEach((L, i) => { const y = Y0 + 14 + i * 34; const on = ch && ch[2] === i; const past = ch && i < ch[2];
      x.strokeStyle = 'rgba(160,210,240,0.35)'; x.lineWidth = 1; if (i < LAYERS.length - 1) { x.beginPath(); x.moveTo(X0 + 5, y + 6); x.lineTo(X0 + 5, y + 28); x.stroke(); }
      x.beginPath(); x.arc(X0 + 5, y, on ? 6 : 4, 0, 7); x.fillStyle = on ? CYAN : past ? 'rgba(95,212,255,0.55)' : 'rgba(200,220,235,0.35)'; x.fill();
      txt(L.length > 30 && !on ? L.slice(0, 29) + '…' : L, X0 + 22, y + 6, { size: on ? 18 : 16, weight: on ? 700 : 500, color: on ? WHITE : MUTED }); });
    x.restore(); }
  if (ch) { const a = sstep(ch[0], ch[0] + 0.5, t) * (1 - sstep(ch[1] - 0.4, ch[1], t));
    x.save(); x.globalAlpha = a * 0.75; const gr = x.createLinearGradient(0, 0, 0, 220); gr.addColorStop(0, 'rgba(2,12,24,0.7)'); gr.addColorStop(1, 'rgba(2,12,24,0)'); x.fillStyle = gr; x.fillRect(0, 0, W, 220); x.restore();
    txt(ch[3], 64, 104, { size: 18, weight: 800, color: CYAN, alpha: a, track: 3 });
    txt(ch[4].toUpperCase(), 108, 104, { size: 30, weight: 800, alpha: a, track: 3 });
    txt(ch[5], 108, 140, { size: 21, weight: 400, color: MUTED, alpha: a }); }
  // ---- backbone stats strip (region chapter) ----
  const sa = sstep(10.2, 11.2, t) * (1 - sstep(15.6, 16.2, t));
  if (sa > 0) { const bw = 250, X0 = W - 64 - STATS.length * bw; x.save(); x.globalAlpha = sa; x.fillStyle = 'rgba(4,18,34,0.5)'; x.fillRect(X0 - 20, H - 170, STATS.length * bw + 20, 110); x.restore();
    STATS.forEach(([v, k], i) => { const a2 = sa * sstep(10.3 + i * 0.15, 10.9 + i * 0.15, t); txt(v, X0 + i * bw, H - 118, { size: 38, weight: 800, alpha: a2 }); txt(k.toUpperCase(), X0 + i * bw, H - 84, { size: 14, weight: 700, color: CYAN, alpha: a2, track: 2 }); }); }
  // ---- closing ----
  const ea = sstep(47.4, 48.6, t);
  if (ea > 0) { x.save(); x.globalAlpha = ea * 0.55; x.fillStyle = '#020b16'; x.fillRect(0, 0, W, H); x.restore();
    if (LOGO) { x.save(); x.globalAlpha = ea; x.drawImage(LOGO, W / 2 - 74, 250, 148, 148); x.restore(); }
    txt('Connecting Central Indonesia', W / 2, 500, { size: 56, weight: 800, align: 'center', alpha: ea, track: 2 });
    const b = sstep(48.2, 49.4, t);
    txt('through an integrated fibre-optic ecosystem —', W / 2, 566, { size: 30, weight: 300, align: 'center', color: WHITE, alpha: b });
    txt('submarine, terrestrial, mobile and digital infrastructure.', W / 2, 610, { size: 30, weight: 300, align: 'center', color: WHITE, alpha: b });
    const c = sstep(49.2, 50.2, t); x.save(); x.globalAlpha = c; x.fillStyle = CYAN; x.fillRect(W / 2 - 40, 660, 80, 2); x.restore();
    txt('PALAPA RING TENGAH', W / 2, 716, { size: 24, weight: 800, align: 'center', alpha: c, track: 8 });
    txt('PT Len Telekomunikasi Indonesia  ·  len-telko.co.id', W / 2, 756, { size: 20, weight: 500, align: 'center', color: MUTED, alpha: c, track: 1 }); }
  // global fade from/to black
  const fb = 1 - sstep(0, 1.2, t) + sstep(51.2, 52, t); if (fb > 0) { x.save(); x.globalAlpha = clamp(fb); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.restore(); }
}
