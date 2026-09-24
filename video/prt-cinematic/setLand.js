import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { rng, fbm, camPath, clamp, lerp, sstep, polySampler, W, H } from './core.js';
import { makeOcean } from './ocean.js';

// Coastal Sulawesi-style landscape. Metres. Sea at x<0, shoreline x=0, inland +x.
const R = rng(404);
const ROAD = [[70, -8], [160, -20], [330, 10], [560, 40], [820, 20], [1060, -30], [1300, -20], [1480, 10], [1620, 30], [1800, 20], [2050, -10], [2400, 0]];
const roadPts = ROAD.map(([x, z]) => new THREE.Vector2(x, z));
const roadCurve = new THREE.SplineCurve(roadPts);
const roadSamples = roadCurve.getSpacedPoints(600);
function distRoad(x, z) { let d = 1e9; for (let i = 0; i < roadSamples.length; i += 2) { const p = roadSamples[i]; const dd = (p.x - x) ** 2 + (p.y - z) ** 2; if (dd < d) d = dd; } return Math.sqrt(d); }

export const SITES = { bmh: [34, 6], cls: [120, -52], pop: [1475, -46], bts: [1560, 70], school: [1720, 110], hospital: [1860, -95], gov: [1690, -120], factory: [2150, 160], mosque: [1800, 70] };
const PADS = Object.values(SITES).map(([x, z]) => ({ x, z, r: 60 }));
function baseY(x, z) {
  if (x < 0) return x * 0.045 - 0.2 + (fbm(x * 0.02, z * 0.02, 3) - .5) * 0.6;
  const beach = Math.min(x, 60) * 0.035;
  const hills = (fbm(x * 0.0028 + 7, z * 0.0028, 5) - 0.35) * 42 * sstep(90, 700, x) * (1 - 0.7 * sstep(1350, 1550, x) * (1 - sstep(2250, 2500, x)));
  const mount = sstep(2300, 3600, x) * (fbm(x * 0.0012, z * 0.0015 + 3, 5) * 520);
  return 0.2 + beach + Math.max(hills, -2) + mount + (fbm(x * 0.03, z * 0.03, 2) - .5) * 1.2 * sstep(40, 200, x);
}
function landY(x, z) {
  let y = baseY(x, z);
  for (const p of PADS) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r * 1.8) y = lerp(baseY(p.x, p.z), y, sstep(p.r * 0.8, p.r * 1.8, d)); }
  return y;
}

export async function makeLand() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.3, 12000);
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 30), THREE.MathUtils.degToRad(125));
  const sky = new Sky(); sky.scale.setScalar(10000); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 3; su.rayleigh.value = 2.6; su.mieCoefficient.value = 0.003; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.85; su.sunPosition.value.copy(sunDir);
  scene.fog = new THREE.FogExp2(0xa9c2d8, 0.00016);
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.4); sun.position.copy(sunDir).multiplyScalar(800); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); const sc = sun.shadow.camera; sc.left = -260; sc.right = 260; sc.top = 260; sc.bottom = -260; sc.near = 10; sc.far = 2500; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  scene.add(new THREE.HemisphereLight(0xbcd8f2, 0x3b4a2c, 1.0));

  const ocean = makeOcean({ size: 3000, seg: 400 }); ocean.mat.uniforms.sunDir.value = sunDir; ocean.mat.uniforms.maxX.value = 12; scene.add(ocean.mesh);

  // ---------- terrain ----------
  const TW = 4600, TD = 3000, g = new THREE.PlaneGeometry(TW, TD, 460, 300).rotateX(-Math.PI / 2); g.translate(TW / 2 - 400, 0, 0);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const cSand = new THREE.Color(0xcbb58c), cWet = new THREE.Color(0x8e7c5d), cGrass = new THREE.Color(0x5f7f3a), cForest = new THREE.Color(0x2f4a22), cSoil = new THREE.Color(0x8a6e4b), cRock = new THREE.Color(0x6d6a5f), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const y = landY(x, z); pos.setY(i, y);
    const f = fbm(x * 0.006, z * 0.006, 4), dr = x > 40 && x < 2500 ? distRoad(x, z) : 999;
    tmp.copy(cGrass).lerp(cForest, sstep(0.42, 0.58, f)); const f2 = fbm(x * 0.0015 + 40, z * 0.0015, 3); tmp.lerp(new THREE.Color(0x8a9a4a), sstep(0.55, 0.7, f2) * 0.6); tmp.lerp(new THREE.Color(0x40602c), sstep(0.5, 0.3, f2) * 0.4);
    if (x < 55) tmp.copy(x < 6 ? cWet : cSand).lerp(tmp, sstep(35, 55, x));
    tmp.lerp(cSoil, (1 - sstep(4, 12, dr)) * 0.7); tmp.lerp(cRock, sstep(180, 400, y) * 0.6);
    for (const p of PADS) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r) tmp.lerp(cSoil, (1 - sstep(p.r * 0.5, p.r, d)) * 0.35); }
    tmp.offsetHSL(0, 0, (fbm(x * 0.05, z * 0.05, 2) - .5) * 0.06); col.set([tmp.r, tmp.g, tmp.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const detail = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const d = x.createImageData(256, 256);
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) { const n = 200 + (fbm(i * 0.08, j * 0.08, 4) - .5) * 90 + (R() - .5) * 40; const k = (j * 256 + i) * 4; d.data[k] = d.data[k + 1] = d.data[k + 2] = n; d.data[k + 3] = 255; }
    x.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(TW / 18, TD / 18); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const terrain = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.97 })); terrain.receiveShadow = true; scene.add(terrain);

  // ---------- road ----------
  const rw = 7, rv = [], ri = [], ruv = [];
  for (let i = 0; i < roadSamples.length; i++) { const p = roadSamples[i], q = roadSamples[Math.min(i + 1, roadSamples.length - 1)], o = roadSamples[Math.max(i - 1, 0)];
    const dx = q.x - o.x, dz = q.y - o.y, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    for (const s of [-1, 1]) { const x = p.x + nx * s * rw / 2, z = p.y + nz * s * rw / 2; rv.push(x, landY(x, z) + 0.12, z); ruv.push(s < 0 ? 0 : 1, i * 0.25); }
    if (i < roadSamples.length - 1) { const a = i * 2; ri.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(ruv, 2)); rg.setIndex(ri); rg.computeVertexNormals();
  const roadTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#3b3b3a'; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${R() > .5 ? 255 : 0},${R() > .5 ? 255 : 0},255,.05)`; x.fillRect(R() * 64, R() * 64, 1, 1); }
    x.fillStyle = '#d9d6c8'; x.fillRect(2, 0, 2, 64); x.fillRect(60, 0, 2, 64); x.fillStyle = '#e8e3d0'; x.fillRect(31, 0, 2, 30);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })();
  const road = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 })); road.receiveShadow = true; scene.add(road);
  const roadS = polySampler(roadSamples.map(p => new THREE.Vector3(p.x, landY(p.x, p.y) + 0.12, p.y)));

  // ---------- helpers ----------
  const std = (c, r = 0.8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const add = (mesh, x, y, z, ry = 0) => { mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(mesh); return mesh; };
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); return m; };
  function fence(grp, w, d, gate = 6) { const post = std(0x9aa0a4, 0.5, 0.7), mesh = std(0xb7bcbf, 0.6, 0.6);
    const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]];
    for (let k = 0; k < 4; k++) { const [x0, z0] = pts[k], [x1, z1] = pts[k + 1]; const L = Math.hypot(x1 - x0, z1 - z0); const n = Math.ceil(L / 3);
      for (let i = 0; i <= n; i++) { const t = i / n; grp.add(box(0.08, 2.2, 0.08, post, lerp(x0, x1, t), 0, lerp(z0, z1, t))); }
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(k === 0 ? L - gate : L, 2), new THREE.MeshStandardMaterial({ color: 0xc5cacc, transparent: true, opacity: 0.35, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 }));
      panel.position.set((x0 + x1) / 2 + (k === 0 ? gate / 2 : 0), 1.1, (z0 + z1) / 2); panel.rotation.y = -Math.atan2(z1 - z0, x1 - x0); grp.add(panel); } }
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x1c2a36, roughness: 0.15, metalness: 0.4 });
  function windowsRow(grp, w, y, z, n, face = 1, h = 1.3) { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w / n * 0.55, h), windowMat); m.position.set(-w / 2 + (i + 0.5) * w / n, y, z + face * 0.02); if (face < 0) m.rotation.y = Math.PI; grp.add(m); } }
  function acUnit(grp, x, y, z) { grp.add(box(0.9, 0.7, 0.35, std(0xe8e8e2, 0.6), x, y, z)); }
  function genset(grp, x, z, ry = 0) { const gg = new THREE.Group(); gg.add(box(4.5, 2.3, 2.1, std(0x2f5d3a, 0.6, 0.2))); gg.add(box(0.2, 1.2, 0.2, std(0x444444, .5, .8), -1.8, 2.3, 0)); gg.position.set(x, 0, z); gg.rotation.y = ry; grp.add(gg); }

  // ---------- BMH (beach manhole) + articulated pipe landing ----------
  const [bx, bz] = SITES.bmh, by = landY(bx, bz);
  const bmh = new THREE.Group(); bmh.add(box(3, 0.35, 3, std(0x9d9a92, 0.9))); bmh.add(box(0.9, 0.06, 0.9, std(0x3a3a3a, 0.5, 0.8), 0, 0.35, 0));
  add(bmh, bx, by - 0.1, bz);
  // cable in its split pipe running from the surf zone up the beach into the BMH
  const shoreCable = new THREE.CatmullRomCurve3([new THREE.Vector3(-90, landY(-90, 4) + 0.1, 4), new THREE.Vector3(-30, landY(-30, 5) + 0.1, 5), new THREE.Vector3(0, landY(0, 5) + 0.05, 5), new THREE.Vector3(20, landY(20, 6) - 0.05, 6), new THREE.Vector3(bx - 1.4, by - 0.1, bz)]);
  const pipe = new THREE.Mesh(new THREE.TubeGeometry(shoreCable, 200, 0.1, 12), std(0x3b3430, 0.85, 0.3)); pipe.castShadow = true; scene.add(pipe);

  // ---------- Cable Landing Station ----------
  const [cx, cz] = SITES.cls, cy = landY(cx, cz); const cls = new THREE.Group();
  fence(cls, 70, 48);
  const white = std(0xecebe6, 0.75), blue = std(0x0d4f8c, 0.6), grey = std(0x8c9196, 0.7);
  cls.add(box(30, 6.5, 16, white, -6, 0, -4)); cls.add(box(30.4, 0.9, 16.4, blue, -6, 6.5, -4)); cls.add(box(30.6, 0.6, 16.6, white, -6, 7.4, -4));
  cls.add(box(10, 4.2, 9, white, 14, 0, -7)); cls.add(box(10.2, 0.5, 9.2, blue, 14, 4.2, -7));
  const fw = new THREE.Group(); windowsRow(fw, 28, 3.6, 4.0, 9); fw.position.set(-6, 0, 0); cls.add(fw);
  for (let i = 0; i < 6; i++) acUnit(cls, -18 + i * 4.5, 7.8, -8);
  genset(cls, 14, 12, 0); genset(cls, 22, 12, 0);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 5, 20).rotateZ(Math.PI / 2), std(0xd8d8d0, 0.5, 0.3)); tank.position.set(26, 1.8, -12); cls.add(tank);
  // lightning / microwave mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 24, 8), std(0xb0b4b8, 0.4, 0.8)); mast.position.set(-26, 12, -16); cls.add(mast);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.5).rotateZ(-Math.PI / 2), std(0xf0f0f0, 0.4)); dish.position.set(-25.4, 19, -16); cls.add(dish);
  cls.add(box(4, 3, 3, white, 30, 0, 21)); // guard post
  cls.add(box(9, 0.1, 30, std(0x6f6f6c, 0.9), 8, 0, 8)); // driveway
  add(cls, cx, cy, cz, 0.05);

  // ---------- trees: palms near the beach, tropical broadleaf inland ----------
  const tr = rng(77), keep = (x, z) => { if (x > 40 && x < 2500 && distRoad(x, z) < 9) return false; for (const p of PADS) if (Math.hypot(x - p.x, z - p.z) < p.r) return false; return true; };
  const palmTrunk = new THREE.CylinderGeometry(0.14, 0.22, 9, 6); palmTrunk.translate(0, 4.5, 0);
  const frondParts = []; for (let k = 0; k < 9; k++) { const f = new THREE.PlaneGeometry(0.9, 4.2, 1, 4); f.translate(0, 2.1, 0);
    const p = f.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i); p.setZ(i, -Math.pow(yy / 4.2, 2) * 1.8); } f.rotateX(-1.0); f.rotateY(k / 9 * Math.PI * 2); f.translate(0, 9, 0); frondParts.push(f); }
  const frondG = mergeGeometries(frondParts);
  let canopyG = mergeVertices(new THREE.IcosahedronGeometry(1, 3)); { const p = canopyG.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(0.7 + fbm(v.x * 3 + 9, v.z * 3 + v.y * 2, 3) * 0.7); p.setXYZ(i, v.x, v.y * 0.75, v.z); } canopyG.computeVertexNormals(); }
  const trunkG = new THREE.CylinderGeometry(0.18, 0.3, 1, 5); trunkG.translate(0, 0.5, 0);
  const NP = 700, NT = 26000;
  const palmsT = new THREE.InstancedMesh(palmTrunk, std(0x7a6a55, 0.9), NP), palmsF = new THREE.InstancedMesh(frondG, new THREE.MeshStandardMaterial({ color: 0x5d8a3a, roughness: 0.8, side: THREE.DoubleSide }), NP);
  const treeT = new THREE.InstancedMesh(trunkG, std(0x5b4a38, 0.9), NT), treeC = new THREE.InstancedMesh(canopyG, std(0xffffff, 0.85), NT);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler(), C = new THREE.Color();
  let np = 0; while (np < NP) { const x = 14 + tr() * 170, z = -700 + tr() * 1400; if (!keep(x, z)) continue; const s = 0.8 + tr() * 0.5;
    E.set((tr() - .5) * 0.25, tr() * 6, (tr() - .5) * 0.25); Q.setFromEuler(E); M.compose(P.set(x, landY(x, z) - 0.2, z), Q, S.set(s, s, s)); palmsT.setMatrixAt(np, M); palmsF.setMatrixAt(np, M); np++; }
  let nt = 0, guard = 0; while (nt < NT && guard++ < 600000) { const x = 120 + tr() * 2700, z = -1100 + tr() * 2200; const f = fbm(x * 0.006, z * 0.006, 4);
    if (tr() > sstep(0.33, 0.52, f) * 0.97 + 0.03 || !keep(x, z)) continue;
    const h = 4 + tr() * 9, s = 3.2 + Math.pow(tr(), 1.5) * 6.5; const y = landY(x, z);
    M.compose(P.set(x, y - 0.3, z), Q.identity(), S.set(1, h * 0.6, 1)); treeT.setMatrixAt(nt, M);
    E.set(0, tr() * 6, 0); Q.setFromEuler(E); M.compose(P.set(x, y + h * 0.55 + s * 0.3, z), Q, S.set(s, s * 0.9, s)); treeC.setMatrixAt(nt, M);
    treeC.setColorAt(nt, C.setHSL(0.22 + tr() * 0.1, 0.35 + tr() * 0.3, 0.1 + tr() * 0.1)); nt++; }
  treeT.count = treeC.count = nt;
  [palmsT, palmsF, treeT, treeC].forEach(m => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });

  // ---------- OSP: route markers, handholes, pole line with aerial fibre ----------
  const marker = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 1.0, 0.18).translate(0, 0.5, 0), std(0xf07d2a, 0.6), 40);
  const hh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.2, 1.2).translate(0, 0.1, 0), std(0x9b9990, 0.9), 12);
  const roadOffset = (s, off) => { const a = roadS.at(s), b = roadS.at(s + 1); const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return new THREE.Vector3(a.x - dz / l * off, 0, a.z + dx / l * off); };
  const DUCT_END = 520; // metres along road where buried duct changes to aerial
  for (let i = 0; i < 40; i++) { const s = 30 + i * 12.5; const p = roadOffset(s, 6); M.makeTranslation(p.x, landY(p.x, p.z), p.z); marker.setMatrixAt(i, M); }
  for (let i = 0; i < 12; i++) { const s = 20 + i * 42; const p = roadOffset(s, 6.5); M.makeTranslation(p.x, landY(p.x, p.z) - 0.05, p.z); hh.setMatrixAt(i, M); }
  scene.add(marker, hh); marker.castShadow = true;
  const poles = [], span = 45; for (let s = DUCT_END; s < roadS.total - 250; s += span) { const p = roadOffset(s, 5.2); p.y = landY(p.x, p.z); poles.push(p); }
  const poleM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.16, 9, 8).translate(0, 4.5, 0), std(0xb9b7b0, 0.8), poles.length); poles.forEach((p, i) => { M.makeTranslation(p.x, p.y, p.z); poleM.setMatrixAt(i, M); });
  poleM.castShadow = true; scene.add(poleM);
  // catenary spans between poles (ADSS fibre at 8.2 m)
  const aerial = []; for (let i = 0; i < poles.length - 1; i++) { const a = poles[i], b = poles[i + 1]; for (let k = 0; k < 10; k++) { const t = k / 10; aerial.push(new THREE.Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t) + 8.2 - Math.sin(t * Math.PI) * 0.55, lerp(a.z, b.z, t))); } }
  aerial.push(poles[poles.length - 1].clone().setY(poles[poles.length - 1].y + 8.2));
  const lm = new LineMaterial({ color: 0x1a1a1a, linewidth: 1.6 }); lm.resolution.set(W, H);
  const ag = new LineGeometry(); ag.setPositions(aerial.flatMap(p => [p.x, p.y, p.z])); scene.add(new Line2(ag, lm));

  // ---------- PoP / network node ----------
  const [px, pz] = SITES.pop, py = landY(px, pz); const pop = new THREE.Group(); fence(pop, 34, 26, 5);
  pop.add(box(12, 3.2, 3.6, white, -4, 0.4, -3)); pop.add(box(12.2, 0.25, 3.8, blue, -4, 3.6, -3)); pop.add(box(12, 0.4, 4, grey, -4, 0, -3));
  for (let i = 0; i < 3; i++) acUnit(pop, -8 + i * 4, 1.4, -0.9);
  for (let i = 0; i < 3; i++) pop.add(box(1.2, 1.9, 0.8, std(0xd6d8d6, 0.6, 0.2), 6 + i * 1.6, 0, -6));
  genset(pop, 8, 6, Math.PI / 2);
  pop.add(box(3, 0.08, 14, std(0x6f6f6c, 0.9), 0, 0, 7));
  add(pop, px, py, pz, 0.1);

  // ---------- BTS: 42 m four-legged lattice tower ----------
  const [tx, tz] = SITES.bts, ty = landY(tx, tz); const bts = new THREE.Group(); fence(bts, 22, 22, 4);
  const Ht = 42, red = std(0xd23a2a, 0.55, 0.3), wht = std(0xf2f2ee, 0.55, 0.3);
  const legPts = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const halfW = y => lerp(3.2, 0.8, y / Ht);
  const beam = (a, b, r, mat) => { const d = new THREE.Vector3().subVectors(b, a); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 5), mat);
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; };
  const NS = 14; for (let s = 0; s < NS; s++) { const y0 = s / NS * Ht, y1 = (s + 1) / NS * Ht, mat = Math.floor(s / 2) % 2 ? wht : red;
    for (let k = 0; k < 4; k++) { const [ax, az] = legPts[k], [bx2, bz2] = legPts[(k + 1) % 4];
      const A0 = new THREE.Vector3(ax * halfW(y0), y0, az * halfW(y0)), A1 = new THREE.Vector3(ax * halfW(y1), y1, az * halfW(y1));
      const B0 = new THREE.Vector3(bx2 * halfW(y0), y0, bz2 * halfW(y0)), B1 = new THREE.Vector3(bx2 * halfW(y1), y1, bz2 * halfW(y1));
      bts.add(beam(A0, A1, 0.09, mat)); bts.add(beam(A0, B1, 0.035, mat)); bts.add(beam(B0, A1, 0.035, mat)); bts.add(beam(A1, B1, 0.04, mat)); } }
  // platform, sector antennas, RRUs, microwave dishes
  bts.add(box(3.4, 0.12, 3.4, std(0x9aa0a4, 0.5, 0.8), 0, Ht - 3.2, 0));
  const antMat = std(0xefefea, 0.5), rru = std(0x9ea3a6, 0.5, 0.6); const sectors = [0, 2.094, 4.189];
  sectors.forEach((a, k) => { for (const off of [-0.45, 0.45]) { const m = box(0.34, 2.4, 0.14, antMat); const r = 1.9; m.position.set(Math.cos(a) * r - Math.sin(a) * off, Ht - 2.6, Math.sin(a) * r + Math.cos(a) * off); m.rotation.y = -a + Math.PI / 2; m.rotation.x = 0.05; bts.add(m);
    const u = box(0.3, 0.5, 0.2, rru); u.position.set(Math.cos(a) * 1.5 - Math.sin(a) * off, Ht - 3.9, Math.sin(a) * 1.5 + Math.cos(a) * off); bts.add(u); } });
  [[0.8, Ht - 9], [-0.6, Ht - 13]].forEach(([a, y]) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.35, 20).rotateZ(Math.PI / 2), std(0xe8e8e4, 0.5)); d.position.set(Math.cos(a) * 1.9, y, Math.sin(a) * 1.9); d.rotation.y = -a; bts.add(d); });
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3020 })); light.position.set(0, Ht + 0.3, 0); bts.add(light);
  bts.add(box(2.4, 2.0, 1.0, std(0xdadcdc, 0.6, 0.2), -6, 0, 5)); bts.add(box(2.4, 2.0, 1.0, std(0xdadcdc, 0.6, 0.2), -3, 0, 5));
  add(bts, tx, ty, tz, 0.3);
  const antennaWorld = new THREE.Vector3(tx, ty + Ht - 2.6, tz);

  // ---------- town: houses, school, hospital, government office, mosque, factory ----------
  const houseN = 420, hw = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), std(0xffffff, 0.85), houseN);
  const roofG = new THREE.CylinderGeometry(0.75, 0.75, 1, 3, 1).rotateZ(Math.PI / 2); roofG.rotateX(Math.PI / 2); roofG.rotateZ(Math.PI / 2); roofG.scale(1, 0.55, 1); roofG.translate(0, 0.2, 0);
  const hr = new THREE.InstancedMesh(roofG, std(0xffffff, 0.7), houseN); const wallCols = [0xf1ece0, 0xe7dcc4, 0xd9e3e6, 0xf3e3c3, 0xe9e9e9, 0xcfe0d0], roofCols = [0xa4492e, 0xb35a36, 0x7e3a2a, 0x8e9396, 0x6f7477, 0x3f5c7a];
  let nh = 0; guard = 0; while (nh < houseN && guard++ < 50000) { const s = 1380 + tr() * 1100; const p = roadOffset(Math.min(s, roadS.total - 2), (tr() > .5 ? 1 : -1) * (12 + Math.pow(tr(), 1.5) * 260));
    const x = p.x + (tr() - .5) * 30, z = p.z + (tr() - .5) * 30; if (!keep(x, z) || distRoad(x, z) < 11) continue;
    const w = 6 + tr() * 5, d = 7 + tr() * 5, h = 3 + tr() * (tr() > .85 ? 3.5 : 0.6), ry = Math.atan2(p.z, p.x) * 0 + (tr() > .5 ? 0 : Math.PI / 2) + (tr() - .5) * 0.2, y = landY(x, z) - 0.2;
    Q.setFromEuler(E.set(0, ry, 0)); M.compose(P.set(x, y, z), Q, S.set(w, h, d)); hw.setMatrixAt(nh, M); hw.setColorAt(nh, C.set(wallCols[nh % 6]));
    M.compose(P.set(x, y + h, z), Q, S.set(w * 1.12, 2.6, d * 1.08)); hr.setMatrixAt(nh, M); hr.setColorAt(nh, C.set(roofCols[(nh * 7) % 6])); nh++; }
  hw.count = hr.count = nh; [hw, hr].forEach(m => { m.castShadow = m.receiveShadow = true; scene.add(m); });
  function building(key, parts) { const [x, z] = SITES[key]; const grp = new THREE.Group(); parts(grp); add(grp, x, landY(x, z) - 0.1, z, grp.userData.ry || 0); return grp; }
  building('school', g0 => { g0.add(box(40, 4, 9, std(0xf4f1e8), 0, 0, 0)); g0.add(box(41, 0.6, 10, std(0xa4492e), 0, 4, 0)); g0.add(box(9, 4, 26, std(0xf4f1e8), -16, 0, 14)); g0.add(box(10, 0.6, 27, std(0xa4492e), -16, 4, 14));
    const f = new THREE.Group(); windowsRow(f, 38, 2.2, 4.6, 12); g0.add(f); g0.add(box(30, 0.05, 22, std(0x7c8f4a), 8, 0, 22)); g0.add(box(0.12, 9, 0.12, std(0xcccccc, .4, .8), 16, 0, 12));
    const flag = box(1.8, 1.2, 0.02, std(0xd62020), 16.9, 7.6, 12); g0.add(flag); g0.add(box(1.8, 0.6, 0.021, std(0xf6f6f6), 16.9, 7.6, 12)); });
  building('hospital', g0 => { g0.add(box(34, 13, 18, std(0xf2f4f5, 0.6))); g0.add(box(34.4, 0.8, 18.4, std(0x1f8a6f), 0, 13, 0)); for (let f = 0; f < 3; f++) { const w = new THREE.Group(); windowsRow(w, 32, 2.4 + f * 4, 9.05, 11, 1, 1.6); g0.add(w); }
    g0.add(box(14, 4, 10, std(0xf2f4f5), -22, 0, 4)); g0.add(box(3.2, 1, 0.3, std(0xffffff), 0, 11.2, 9.2)); g0.add(box(1, 3, 0.31, std(0xd62020), 0, 10.2, 9.2)); g0.add(box(3, 1, 0.32, std(0xd62020), 0, 11.2, 9.2)); g0.userData.ry = 0.2; });
  building('gov', g0 => { g0.add(box(36, 8, 16, std(0xf1eee4))); g0.add(box(38, 0.8, 18, std(0x6d4c35), 0, 8, 0)); for (let i = 0; i < 8; i++) g0.add(box(0.8, 8, 0.8, std(0xffffff), -14 + i * 4, 0, 8.6));
    g0.add(box(0.14, 12, 0.14, std(0xcccccc, .4, .8), 0, 0, 18)); g0.add(box(2.4, 0.8, 0.02, std(0xd62020), 1.2, 11, 18)); g0.add(box(2.4, 0.8, 0.021, std(0xf6f6f6), 1.2, 10.2, 18)); g0.userData.ry = -0.15; });
  building('mosque', g0 => { g0.add(box(20, 7, 20, std(0xf6f4ec))); const dome = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0x2f8f6a, 0.4, 0.3)); dome.position.y = 7; g0.add(dome);
    const mn = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 26, 12), std(0xf6f4ec)); mn.position.set(12, 13, 12); g0.add(mn); const top = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 12), std(0x2f8f6a, 0.4, 0.3)); top.position.set(12, 27.5, 12); g0.add(top); });
  building('factory', g0 => { for (let i = 0; i < 4; i++) { g0.add(box(18, 10, 60, std(0xc9cdd0, 0.6, 0.3), -30 + i * 19, 0, 0)); const r = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 60, 3, 1, false, 0, Math.PI), std(0x8b98a3, 0.5, 0.5)); r.rotation.x = Math.PI / 2; r.rotation.z = Math.PI / 2; r.scale.set(1, 1, 0.35); r.position.set(-30 + i * 19, 10, 0); g0.add(r); }
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 18, 20), std(0xdadde0, 0.4, 0.6)); s.position.set(45, 9, -20 + i * 10); g0.add(s); }
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 30, 12), std(0xb44a36, 0.6)); ch.position.set(40, 15, 22); g0.add(ch); g0.userData.ry = 0.4; });

  // ---------- life: vehicles, people ----------
  const carG = mergeGeometries([new THREE.BoxGeometry(4.3, 1.0, 1.8).translate(0, 0.75, 0), new THREE.BoxGeometry(2.4, 0.75, 1.65).translate(-0.2, 1.6, 0)]);
  const truckG = mergeGeometries([new THREE.BoxGeometry(2.2, 2.2, 2.3).translate(2.6, 1.4, 0), new THREE.BoxGeometry(5.4, 2.6, 2.4).translate(-1.4, 1.6, 0)]);
  const bikeG = mergeGeometries([new THREE.BoxGeometry(1.8, 0.7, 0.4).translate(0, 0.55, 0), new THREE.BoxGeometry(0.45, 0.8, 0.4).translate(-0.1, 1.3, 0)]);
  const fleet = [[carG, 30, [0xe9e9e9, 0x1d1d1f, 0xa8adb3, 0x8c1f22, 0x2b4f7d]], [truckG, 8, [0xe8e2d0, 0x3b6ea5, 0xd8a33a]], [bikeG, 40, [0x222222, 0x993030, 0x2a2a60]]];
  const vehicles = []; fleet.forEach(([geo, n, cols]) => { const im = new THREE.InstancedMesh(geo, std(0xffffff, 0.35, 0.4), n); for (let i = 0; i < n; i++) { im.setColorAt(i, C.set(cols[i % cols.length])); vehicles.push({ im, i, s0: tr() * roadS.total, v: (8 + tr() * 8) * (tr() > .5 ? 1 : -1), lane: 0 }); } im.castShadow = true; scene.add(im); });
  vehicles.forEach(v => v.lane = v.v > 0 ? -1.8 : 1.8);
  const personG = mergeGeometries([new THREE.CapsuleGeometry(0.22, 1.1, 3, 6).translate(0, 0.8, 0), new THREE.SphereGeometry(0.16, 8, 6).translate(0, 1.62, 0)]);
  const peopleN = 260, people = new THREE.InstancedMesh(personG, std(0xffffff, 0.8), peopleN); const folks = [];
  const shirt = [0xd23a2a, 0x2a5aa8, 0xf2f2f2, 0x3a8a4a, 0xe0b030, 0x6a3a8a, 0x222222];
  for (let i = 0; i < peopleN; i++) { const s = 1400 + tr() * 900; folks.push({ s, off: (tr() > .5 ? 1 : -1) * (4.6 + tr() * 1.2), v: (0.8 + tr() * 0.8) * (tr() > .5 ? 1 : -1) }); people.setColorAt(i, C.set(shirt[i % shirt.length])); }
  people.castShadow = true; scene.add(people);
  // phone screens glinting when coverage arrives
  const phoneG = new THREE.BufferGeometry(), phoneP = new Float32Array(peopleN * 3); phoneG.setAttribute('position', new THREE.BufferAttribute(phoneP, 3));
  const phoneMat = new THREE.PointsMaterial({ color: 0xbfefff, size: 3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  const phones = new THREE.Points(phoneG, phoneMat); phones.frustumCulled = false; scene.add(phones);

  // ---------- signal path: sea -> BMH -> CLS -> duct -> aerial -> PoP -> BTS ----------
  const sig = [];
  shoreCable.getPoints(40).forEach(p => sig.push(p.clone().setY(p.y + 0.15)));
  sig.push(new THREE.Vector3(cx - 4, cy + 0.3, cz + 8)); // into the CLS
  const s0 = 10; for (let s = s0; s <= DUCT_END; s += 8) { const p = roadOffset(s, 6); sig.push(new THREE.Vector3(p.x, landY(p.x, p.z) + 0.3, p.z)); }
  aerial.forEach(p => sig.push(p.clone()));
  sig.push(new THREE.Vector3(px - 4, py + 2, pz)); // PoP shelter
  sig.push(new THREE.Vector3(tx - 3, ty + 1.5, tz + 5), new THREE.Vector3(tx - 1.6, ty + 3, tz + 1.6), new THREE.Vector3(tx - 0.9, ty + Ht - 3.5, tz + 0.9)); // up the tower
  const sigS = polySampler(sig);
  // faint overlay of buried duct route (shown X-ray style)
  const dm = new LineMaterial({ color: 0x5fd4ff, linewidth: 2.2, transparent: true, opacity: 0.55, dashed: true, dashSize: 3, gapSize: 2, depthTest: false }); dm.resolution.set(W, H);
  const dg = new LineGeometry(); const ductPts = sig.filter((p, i) => i >= 41 && i < 41 + Math.floor((DUCT_END - s0) / 8) + 2); dg.setPositions(ductPts.flatMap(p => [p.x, p.y + 0.2, p.z]));
  const ductLine = new Line2(dg, dm); ductLine.computeLineDistances(); ductLine.renderOrder = 9; scene.add(ductLine);
  const pulseN = 160, pg = new THREE.BufferGeometry(), pp = new Float32Array(pulseN * 3); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pmat = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { op: { value: 1 } },
    vertexShader: `varying float vD; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_PointSize=clamp(900./vD,5.,22.); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float op; void main(){ float d=length(gl_PointCoord-.5)*2.; float g=exp(-d*d*6.)+exp(-d*d*40.); gl_FragColor=vec4(vec3(0.5,0.88,1.)*g*op*0.8,1.); }` });
  const pulses = new THREE.Points(pg, pmat); pulses.frustumCulled = false; pulses.renderOrder = 10; scene.add(pulses);

  // ---------- radio: sectorised wavefronts from the antennas ----------
  const radioMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, op: { value: 0 }, center: { value: antennaWorld } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float time,op; uniform vec3 center; varying vec3 vW;
      void main(){ vec3 d=vW-center; float r=length(d.xz); float el=atan(d.y,r);
        float band=fract(r/55.-time*0.9); float ring=smoothstep(0.0,0.02,band)*(1.-smoothstep(0.02,0.07,band));
        float beam=exp(-pow((el+0.05)/0.12,2.)); float fade=(1.-smoothstep(120.,520.,r))*smoothstep(8.,40.,r);
        gl_FragColor=vec4(vec3(0.62,0.9,1.)*ring*beam*fade*op*0.1,1.); }` });
  // radial wavefront surfaces: a stack of horizontal discs gives the sectorised shells volume
  const radioDiscs = new THREE.Group(); for (let k = 0; k < 3; k++) { const d = new THREE.Mesh(new THREE.CircleGeometry(600, 128).rotateX(-Math.PI / 2), radioMat); d.position.set(antennaWorld.x, antennaWorld.y - 8 - k * 10, antennaWorld.z); radioDiscs.add(d); }
  scene.add(radioDiscs);
  // data links antenna -> key buildings
  const linkTargets = ['school', 'hospital', 'gov', 'factory', 'mosque'].map(k => { const [x, z] = SITES[k]; return new THREE.Vector3(x, landY(x, z) + 10, z); });
  const linkMat = new LineMaterial({ color: 0x9fe6ff, linewidth: 1.4, transparent: true, opacity: 0, depthTest: false }); linkMat.resolution.set(W, H);
  linkTargets.forEach(tg => { const lg = new LineGeometry(); const mid = antennaWorld.clone().lerp(tg, 0.5); mid.y += 15; const cv = new THREE.QuadraticBezierCurve3(antennaWorld, mid, tg);
    lg.setPositions(cv.getPoints(30).flatMap(p => [p.x, p.y, p.z])); const l = new Line2(lg, linkMat); l.renderOrder = 9; scene.add(l); });

  // ---------- camera ----------
  const path = camPath([
    { t: 0.0, pos: [-64, 1.2, 12], look: [60, 3, 0], fov: 46 },
    { t: 1.6, pos: [-30, 14, 40], look: [50, 1, 0], fov: 44 },
    { t: 3.4, pos: [40, 42, 70], look: [120, 4, -45], fov: 42 },
    { t: 5.4, pos: [260, 55, 90], look: [420, 4, 30], fov: 40 },
    { t: 7.6, pos: [760, 36, 70], look: [900, 8, 10], fov: 40 },
    { t: 9.6, pos: [1400, 40, 40], look: [1475, 4, -46], fov: 40 },
    { t: 11.2, pos: [1535, 12, 120], look: [1560, 22, 70], fov: 44 },
    { t: 12.8, pos: [1545, 52, 105], look: [1560, 40, 70], fov: 44 },
    { t: 15.2, pos: [1480, 150, 360], look: [1800, 0, 0], fov: 42 },
  ]);

  const labels = []; const v = new THREE.Vector3();
  const tags = [
    { name: 'Beach Manhole (BMH)', p: new THREE.Vector3(bx, by + 1, bz), a: [0.6, 3.2] },
    { name: 'Cable Landing Station', p: new THREE.Vector3(cx - 6, cy + 9, cz - 4), a: [2.0, 5.0] },
    { name: 'Buried duct route · route markers', p: roadOffset(300, 6).setY(landY(roadOffset(300, 6).x, roadOffset(300, 6).z) + 1), a: [4.2, 6.6] },
    { name: 'Aerial fibre on poles', p: aerial[40].clone(), a: [6.4, 8.8] },
    { name: 'PoP / Network Node', p: new THREE.Vector3(px, py + 5, pz), a: [8.6, 10.6] },
    { name: 'BTS 4G / 5G', p: new THREE.Vector3(tx, ty + Ht + 2, tz), a: [10.8, 13.6] },
    { name: 'School', p: new THREE.Vector3(...[SITES.school[0], landY(...SITES.school) + 6, SITES.school[1]]), a: [13.2, 16] },
    { name: 'Hospital', p: new THREE.Vector3(SITES.hospital[0], landY(...SITES.hospital) + 15, SITES.hospital[1]), a: [13.4, 16] },
    { name: 'Government office', p: new THREE.Vector3(SITES.gov[0], landY(...SITES.gov) + 10, SITES.gov[1]), a: [13.6, 16] },
    { name: 'Industry', p: new THREE.Vector3(SITES.factory[0], landY(...SITES.factory) + 20, SITES.factory[1]), a: [13.8, 16] },
    { name: 'Community & mobile users', p: new THREE.Vector3(1640, landY(1640, -10) + 6, -10), a: [14.0, 16] },
  ];
  function update(t) {
    path(t, camera); camera.updateMatrixWorld();
    const tgt = new THREE.Vector3(); camera.getWorldDirection(tgt); tgt.multiplyScalar(Math.min(200, camera.position.y * 3 + 60)).add(camera.position); tgt.y = landY(tgt.x, tgt.z);
    sun.target.position.copy(tgt); sun.position.copy(tgt).addScaledVector(sunDir, 900);
    ocean.mat.uniforms.time.value = t + 45; ocean.mat.uniforms.center.value.set(Math.min(camera.position.x, -200), camera.position.z);
    const o = new THREE.Object3D();
    vehicles.forEach(vh => { const s = ((vh.s0 + vh.v * t) % roadS.total + roadS.total) % roadS.total; const p = roadOffset(s, vh.lane), p2 = roadOffset(s + Math.sign(vh.v), vh.lane);
      o.position.set(p.x, landY(p.x, p.z) + 0.1, p.z); o.rotation.set(0, -Math.atan2(p2.z - p.z, p2.x - p.x), 0); o.updateMatrix(); vh.im.setMatrixAt(vh.i, o.matrix); });
    new Set(vehicles.map(vh => vh.im)).forEach(im => im.instanceMatrix.needsUpdate = true);
    const phoneOn = sstep(12.6, 13.6, t);
    folks.forEach((f, i) => { const s = clamp(f.s + f.v * t, 2, roadS.total - 3); const p = roadOffset(s, f.off); o.position.set(p.x, landY(p.x, p.z), p.z); o.rotation.set(0, 0, 0); o.updateMatrix(); people.setMatrixAt(i, o.matrix);
      phoneP.set([p.x, o.position.y + 1.25, p.z], i * 3); });
    people.instanceMatrix.needsUpdate = true; phoneG.attributes.position.needsUpdate = true; phoneMat.opacity = phoneOn * (0.6 + 0.4 * Math.sin(t * 9));
    // signal pulses along the whole chain; the head of the stream leads the camera
    const head = sstep(0, 12.5, t) * sigS.total + 60;
    for (let i = 0; i < pulseN; i++) { const s = head - i * 16 - ((t * 60) % 16); if (s < 0) { pp.set([0, -999, 0], i * 3); continue; } sigS.at(s, v); pp.set([v.x, v.y + 0.3, v.z], i * 3); }
    pg.attributes.position.needsUpdate = true;
    dm.opacity = 0.55 * sstep(3.6, 4.6, t);
    radioMat.uniforms.time.value = t; radioMat.uniforms.op.value = sstep(11.6, 12.6, t);
    linkMat.opacity = 0.55 * sstep(13.2, 14.0, t);
    labels.length = 0;
    tags.forEach(tg => { const a = sstep(tg.a[0], tg.a[0] + 0.5, t) * (1 - sstep(tg.a[1] - 0.4, tg.a[1], t)); if (a <= 0) return; v.copy(tg.p).project(camera);
      if (v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1) labels.push({ name: tg.name, x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, a }); });
  }
  return { scene, camera, update, labels, exposure: 1.0, shadows: true };
}
