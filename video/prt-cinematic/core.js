import * as THREE from 'three';
export const W = 1920, H = 1080, FPS = 30;

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const sstep = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
export const eIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const eO = t => 1 - Math.pow(1 - t, 3);
export const eIOs = t => -(Math.cos(Math.PI * t) - 1) / 2; // sine in-out: gentle cinematic

// deterministic PRNG
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// value noise + fbm (deterministic, for terrain)
function h2(x, y) { let n = x * 374761393 + y * 668265263; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967295; }
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, oct = 5) { let s = 0, a = .5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s; }

export const texLoader = new THREE.TextureLoader();
export function loadTex(url, srgb = true) {
  return new Promise(r => texLoader.load(url, t => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; r(t); }));
}

// camera path helper: keyframes [{t, pos:[x,y,z], look:[x,y,z], fov}]
export function camPath(keys) {
  const P = new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(...k.pos)), false, 'centripetal');
  const L = new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(...k.look)), false, 'centripetal');
  const ts = keys.map(k => k.t);
  return (t, cam) => {
    // map t into curve parameter via piecewise-linear key times, eased per segment
    let i = 0; while (i < ts.length - 2 && t > ts[i + 1]) i++;
    const f = eIOs(inv(ts[i], ts[i + 1], t));
    const u = (i + f) / (ts.length - 1);
    cam.position.copy(P.getPoint(u)); cam.lookAt(L.getPoint(u));
    const fa = keys[i].fov || cam.fov, fb = keys[i + 1].fov || fa;
    const nf = lerp(fa, fb, f); if (Math.abs(nf - cam.fov) > 1e-3) { cam.fov = nf; cam.updateProjectionMatrix(); }
  };
}

// glowing pulse sprite texture
export function glowTex(inner = 'rgba(220,250,255,1)', outer = 'rgba(80,200,255,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(.18, 'rgba(150,230,255,.85)'); g.addColorStop(.45, 'rgba(60,170,255,.25)'); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const GLOW = glowTex();

// polyline -> arc-length sampler
export function polySampler(pts) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = L[L.length - 1];
  return { total, at(s, out = new THREE.Vector3()) {
    s = clamp(s, 0, total); let lo = 0, hi = L.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < s) lo = m; else hi = m; }
    const f = (s - L[lo]) / Math.max(1e-9, L[hi] - L[lo]); return out.copy(pts[lo]).lerp(pts[hi], f);
  } };
}

// text label as sprite (screen-size constant)
export function labelSprite(text, { size = 26, color = '#ffffff', weight = 600, bg = 'rgba(6,22,40,.72)', accent = '#35C8F0', sub = null } = {}) {
  const c = document.createElement('canvas'); const x = c.getContext('2d');
  const f = `${weight} ${size * 2}px M`; x.font = f; const w1 = x.measureText(text).width;
  let w2 = 0; const fs = `500 ${size * 1.5}px M`; if (sub) { x.font = fs; w2 = x.measureText(sub).width; }
  const pad = size * 1.1, w = Math.ceil(Math.max(w1, w2) + pad * 2 + 10), h = Math.ceil(size * 2.9 + (sub ? size * 2 : 0));
  c.width = w; c.height = h; x.font = f;
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = accent; x.fillRect(0, 0, 8, h);
  x.fillStyle = color; x.textBaseline = 'middle'; x.fillText(text, pad + 6, size * 1.45);
  if (sub) { x.font = fs; x.fillStyle = '#A9C7DB'; x.fillText(sub, pad + 6, size * 3.4); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false });
  const s = new THREE.Sprite(m); s.renderOrder = 999; s.userData.aspect = w / h; s.userData.px = h;
  s.center.set(0, 0); s.scale.set(h / H * 2 * w / h * 0.5, h / H * 2 * 0.5, 1); // pixel-exact at 1080p (half-res canvas)
  return s;
}
