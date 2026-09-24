import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { rng, fbm, camPath, clamp, lerp, sstep, inv, W, H } from './core.js';
import { makeOcean } from './ocean.js';

// ---------- procedural textures ----------
function canvasTex(w, h, draw, srgb = true, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t;
}
function noiseImage(x, w, h, base, amp, seed, scale = 1) {
  const r = rng(seed), d = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const n = (fbm(i * 0.05 * scale, j * 0.05 * scale, 4) - 0.5) * amp + (r() - 0.5) * amp * 0.6; const k = (j * w + i) * 4;
    d.data[k] = base[0] + n; d.data[k + 1] = base[1] + n; d.data[k + 2] = base[2] + n * 0.8; d.data[k + 3] = 255; }
  x.putImageData(d, 0, 0);
}
// helical armour / yarn normal map (tangent-space); stripes run diagonally so the tube reads as helically laid wires
export function helixNormal(count = 40, slope = 0.35) {
  return canvasTex(256, 256, (x, w, h) => { const d = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const p = ((i / w) * slope + j / h) * count; const f = p - Math.floor(p); const s = Math.sin(f * Math.PI * 2);
      const k = (j * w + i) * 4; d.data[k] = 128; d.data[k + 1] = 128 + s * 90; d.data[k + 2] = 230; d.data[k + 3] = 255; }
    x.putImageData(d, 0, 0); }, false);
}

// ---------- seabed profile: deep offshore (x<0) rising to a beach at x ~ 300 ----------
export function seabedY(x, z) {
  const base = lerp(-38, 1.4, sstep(-230, 305, x));
  return base + (fbm(x * 0.04 + 10, z * 0.04, 4) - 0.5) * 2.4 + (fbm(x * 0.2, z * 0.2, 2) - 0.5) * 0.35;
}
export const cableZ = x => 5 * Math.sin(x * 0.011) + 1.6 * Math.sin(x * 0.029 + 1);

export async function makeSea() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, W / H, 0.02, 6000);
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 38), THREE.MathUtils.degToRad(115));

  // above-water sky
  const sky = new Sky(); sky.scale.setScalar(5000); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 5; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.85; su.sunPosition.value.copy(sunDir);
  // distant island on the horizon (the coast we are heading to)
  const isl = new THREE.PlaneGeometry(3000, 900, 200, 60).rotateX(-Math.PI / 2);
  { const p = isl.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const ridge = Math.max(0, 1 - Math.abs(z) / 450); p.setY(i, Math.pow(ridge, 1.6) * (120 + fbm(x * 0.004, z * 0.004, 5) * 260) - 6); } isl.computeVertexNormals(); }
  const island = new THREE.Mesh(isl, new THREE.MeshStandardMaterial({ color: 0x3f5a37, roughness: 1 })); island.position.set(1500, 0, 0); island.rotation.y = Math.PI / 2; scene.add(island);

  const ocean = makeOcean({ size: 2400, seg: 480 }); scene.add(ocean.mesh); ocean.mat.uniforms.sunDir.value = sunDir;

  // lights
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.0); sun.position.copy(sunDir).multiplyScalar(100); scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x9cc9ee, 0x1b2a2a, 0.9); scene.add(hemi);

  // seabed
  const bedGeo = new THREE.PlaneGeometry(700, 200, 700, 200).rotateX(-Math.PI / 2); bedGeo.translate(-10, 0, 0);
  { const p = bedGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, seabedY(p.getX(i), p.getZ(i))); bedGeo.computeVertexNormals(); }
  const sandTex = canvasTex(512, 512, (x, w, h) => noiseImage(x, w, h, [168, 154, 124], 60, 3, 1.6), true, [90, 26]);
  const ripple = canvasTex(256, 256, (x, w, h) => { const d = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const wv = Math.sin((i / w * 6 + fbm(i * 0.03, j * 0.03, 3) * 1.6) * Math.PI * 2); const k = (j * w + i) * 4;
      d.data[k] = 128 + wv * 70; d.data[k + 1] = 128; d.data[k + 2] = 235; d.data[k + 3] = 255; } x.putImageData(d, 0, 0); }, false, [120, 34]);
  const causticU = { time: { value: 0 }, cstr: { value: 1 } };
  const bedMat = new THREE.MeshStandardMaterial({ map: sandTex, normalMap: ripple, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1 });
  bedMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, causticU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform float time,cstr;
      float caust(vec2 p){ vec2 q=p; float c=0.; for(int i=0;i<3;i++){ q=vec2(q.x+sin(q.y*1.7+time*1.3+float(i)),q.y+sin(q.x*1.4-time*1.1)); c+=pow(abs(sin(q.x*1.6)*sin(q.y*1.6)),6.); } return c; }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      float cs=caust(vWp.xz*0.9)*0.9+caust(vWp.xz*0.45+3.)*0.6; float df=exp(vWp.y*0.045);
      reflectedLight.directDiffuse*=1.+cs*1.6*cstr*df;`);
  };
  const bed = new THREE.Mesh(bedGeo, bedMat); scene.add(bed);

  // rocks & coral heads scattered on the bed
  const rr = rng(21), rockG = new THREE.DodecahedronGeometry(1, 1);
  { const p = rockG.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(0.75 + fbm(v.x * 2 + 5, v.y * 2 + v.z, 3) * 0.6); p.setXYZ(i, v.x, v.y * 0.6, v.z); } rockG.computeVertexNormals(); }
  const rocks = new THREE.InstancedMesh(rockG, new THREE.MeshStandardMaterial({ color: 0x6b6558, roughness: 1 }), 900);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  for (let i = 0; i < 900; i++) { let x = -330 + rr() * 640, z = -90 + rr() * 180; if (Math.abs(z - cableZ(x)) < 1.5) z += 4 * Math.sign(z - cableZ(x) || 1);
    const s = 0.15 + Math.pow(rr(), 3) * 1.8; P.set(x, seabedY(x, z) - s * 0.2, z); q.setFromEuler(new THREE.Euler(rr() * 3, rr() * 3, rr() * 3)); S.set(s, s, s);
    M.compose(P, q, S); rocks.setMatrixAt(i, M); rocks.setColorAt(i, new THREE.Color().setHSL(0.08 + rr() * 0.06, 0.2 + rr() * 0.2, 0.25 + rr() * 0.15)); }
  scene.add(rocks);
  // seagrass in the shallows
  const bladeG = new THREE.PlaneGeometry(0.05, 0.7, 1, 4); bladeG.translate(0, 0.35, 0);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, side: THREE.DoubleSide, roughness: 0.9 });
  grassMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, causticU); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float time;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 ip=instanceMatrix*vec4(0.,0.,0.,1.); transformed.x+=sin(time*1.6+ip.x*0.7+ip.z)*0.12*position.y*position.y;'); };
  const grass = new THREE.InstancedMesh(bladeG, grassMat, 14000);
  for (let i = 0; i < 14000; i++) { const cx = 90 + rr() * 200, cz = -60 + rr() * 120; const x = cx + (rr() - .5) * 3, z = cz + (rr() - .5) * 3;
    if (fbm(x * 0.05, z * 0.05, 3) < 0.45 || Math.abs(z - cableZ(x)) < 1.2) { M.makeScale(0, 0, 0); grass.setMatrixAt(i, M); continue; }
    const s = 0.6 + rr() * 0.9; P.set(x, seabedY(x, z) - 0.05, z); q.setFromEuler(new THREE.Euler(0, rr() * 6, (rr() - .5) * 0.3)); S.set(1, s, 1); M.compose(P, q, S); grass.setMatrixAt(i, M); }
  scene.add(grass);

  // ---------- the submarine cable ----------
  const X0 = -330, X1 = 305, CUT = -205, CUTLEN = 0.8, PIPE0 = 150;
  const pts = []; for (let x = X0; x <= X1; x += 0.5) { const z = cableZ(x); pts.push(new THREE.Vector3(x, seabedY(x, z) + 0.028, z)); }
  // smooth the seabed-following centerline (cables drape, they do not follow every ripple)
  for (let it = 0; it < 6; it++) for (let i = 1; i < pts.length - 1; i++) pts[i].y = Math.max(pts[i].y, (pts[i - 1].y + pts[i + 1].y) / 2 - 0.01);
  const curve = new THREE.CatmullRomCurve3(pts);
  const RAD = 0.045;
  const armour = helixNormal(46, 0.25); armour.repeat.set((X1 - X0) / 0.28 * 1.0, 1);
  const cutU = { cutA: { value: 0 }, cutB: { value: 0 } };
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.62, metalness: 0.0, normalMap: armour, normalScale: new THREE.Vector2(0.9, 0.9) });
  cableMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, cutU); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float cutA,cutB;')
    .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if(vNormalMapUv.x>cutA&&vNormalMapUv.x<cutB) discard;'); };
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 5200, RAD, 14, false), cableMat); scene.add(cable);
  // arc-length parameter for any x
  const lengths = curve.getLengths(5200), total = lengths[lengths.length - 1];
  const uAtX = x => { const i = clamp(Math.round((x - X0) / (X1 - X0) * 5200), 0, 5200); return lengths[i] / total; };
  cutU.cutA.value = uAtX(CUT) * armour.repeat.x; cutU.cutB.value = (uAtX(CUT) + CUTLEN / total) * armour.repeat.x;

  // articulated (cast-iron split) pipe protection in the surf zone
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x3b3430, roughness: 0.85, metalness: 0.3 });
  const shell = new THREE.CylinderGeometry(0.09, 0.09, 0.46, 18, 1, false); shell.rotateZ(Math.PI / 2);
  const flange = new THREE.CylinderGeometry(0.115, 0.115, 0.05, 18); flange.rotateZ(Math.PI / 2);
  const pipeN = Math.floor((X1 - PIPE0) / 0.5);
  const pipes = new THREE.InstancedMesh(shell, pipeMat, pipeN), flanges = new THREE.InstancedMesh(flange, pipeMat, pipeN);
  const tmpT = new THREE.Vector3(), up = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < pipeN; i++) { const u = uAtX(PIPE0 + i * 0.5 + 0.25); curve.getPointAt(u, P); curve.getTangentAt(u, tmpT); q.setFromUnitVectors(up, tmpT);
    P.y += 0.04; M.compose(P, q, S.set(1, 1, 1)); pipes.setMatrixAt(i, M);
    curve.getPointAt(uAtX(PIPE0 + i * 0.5), P); P.y += 0.04; M.compose(P, q, S); flanges.setMatrixAt(i, M); }
  scene.add(pipes, flanges);

  // ---------- cutaway: layered anatomy of a shallow-water armoured cable ----------
  const cutGroup = new THREE.Group(); scene.add(cutGroup);
  const uc = uAtX(CUT), c0 = curve.getPointAt(uc), tan = curve.getTangentAt(uc);
  cutGroup.position.copy(c0); cutGroup.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tan);
  const layerMats = [];
  // each layer: full over [0, cut_i], bottom half only over [cut_i, CUTLEN]  (clip = top-half AND beyond cut_i)
  function clipped(mat, cutAt) { mat.side = THREE.DoubleSide; mat.clipIntersection = true; mat.userData.cutAt = cutAt; layerMats.push(mat); return mat; }
  const cyl = (r, mat) => { const g = new THREE.CylinderGeometry(r, r, CUTLEN, 64, 1, true); g.rotateZ(-Math.PI / 2); g.translate(CUTLEN / 2, 0, 0); return new THREE.Mesh(g, mat); };
  const yarn = helixNormal(46, 0.25); yarn.repeat.set(CUTLEN / 0.28, 1);
  cutGroup.add(cyl(RAD, clipped(new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.62, normalMap: yarn }), 0.0)));
  // armour wires
  function helixTubes(n, R, r, pitch, mat) { const grp = new THREE.Group();
    for (let k = 0; k < n; k++) { const a0 = k / n * Math.PI * 2; const c = new THREE.Curve(); c.getPoint = (t, o = new THREE.Vector3()) => { const s = t * CUTLEN, a = a0 + s / pitch * Math.PI * 2; return o.set(s, Math.cos(a) * R, Math.sin(a) * R); };
      grp.add(new THREE.Mesh(new THREE.TubeGeometry(c, 80, r, 8, false), mat)); } return grp; }
  cutGroup.add(helixTubes(22, 0.0385, 0.0052, 0.9, clipped(new THREE.MeshStandardMaterial({ color: 0xa8aeb3, metalness: 0.9, roughness: 0.35 }), 0.12)));
  cutGroup.add(cyl(0.0325, clipped(new THREE.MeshStandardMaterial({ color: 0x1d2730, roughness: 0.5 }), 0.22)));      // outer PE sheath
  cutGroup.add(cyl(0.0255, clipped(new THREE.MeshStandardMaterial({ color: 0xe8e6de, roughness: 0.45 }), 0.32)));      // PE insulation
  cutGroup.add(cyl(0.0125, clipped(new THREE.MeshStandardMaterial({ color: 0xc8743f, metalness: 1, roughness: 0.3 }), 0.42))); // copper conductor
  cutGroup.add(helixTubes(12, 0.0092, 0.0027, 0.5, clipped(new THREE.MeshStandardMaterial({ color: 0xc9ced2, metalness: 0.95, roughness: 0.25 }), 0.50))); // steel strength wires
  cutGroup.add(cyl(0.0058, clipped(new THREE.MeshStandardMaterial({ color: 0xd9dde0, metalness: 1, roughness: 0.18 }), 0.58)));  // stainless steel tube
  // 12 fibres (TIA-598 colour code) in gel
  const fibreCols = [0x1f5fd6, 0xf07a1a, 0x1f9c3a, 0x7a4a26, 0x8b949c, 0xf2f2f2, 0xd62020, 0x151515, 0xf5d515, 0x7f3fbf, 0xf29ab8, 0x33c9d6];
  const fibreCurves = [];
  fibreCols.forEach((col, k) => { const a = k / 12 * Math.PI * 2, rr2 = k < 6 ? 0.0022 : 0.0040; const c = new THREE.Curve();
    c.getPoint = (t, o = new THREE.Vector3()) => { const s = t * CUTLEN, aa = a + s * 3.0; return o.set(s, Math.cos(aa) * rr2, Math.sin(aa) * rr2); };
    fibreCurves.push(c); cutGroup.add(new THREE.Mesh(new THREE.TubeGeometry(c, 90, 0.00065, 6, false), new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, emissive: col, emissiveIntensity: 0.08 }))); });
  cutGroup.updateMatrixWorld(true);
  const gm = cutGroup.matrixWorld;
  layerMats.forEach(m => { // world-space clip planes: remove the top half (local +y) beyond cutAt
    const nTop = new THREE.Vector3(0, -1, 0).transformDirection(gm), pTop = new THREE.Vector3(0, 0, 0).applyMatrix4(gm);
    const nCut = new THREE.Vector3(-1, 0, 0).transformDirection(gm), pCut = new THREE.Vector3(m.userData.cutAt, 0, 0).applyMatrix4(gm);
    m.clippingPlanes = [new THREE.Plane().setFromNormalAndCoplanarPoint(nTop, pTop), new THREE.Plane().setFromNormalAndCoplanarPoint(nCut, pCut)]; });

  // ---------- optical signal ----------
  // (a) light pulses inside the exposed fibres
  const fpN = 12 * 5, fpg = new THREE.BufferGeometry(), fpp = new Float32Array(fpN * 3); fpg.setAttribute('position', new THREE.BufferAttribute(fpp, 3));
  const glowPts = (size, col) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { size: { value: size }, col: { value: new THREE.Color(col) }, op: { value: 1 } },
    vertexShader: `uniform float size; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size/(-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 col; uniform float op; void main(){ float d=length(gl_PointCoord-.5)*2.; float g=exp(-d*d*5.)+exp(-d*d*40.); gl_FragColor=vec4(col*g*op,1.); }` });
  const fibrePulse = new THREE.Points(fpg, glowPts(9, 0x9fe9ff)); fibrePulse.frustumCulled = false; cutGroup.add(fibrePulse);
  // (b) subtle travelling glow along the whole cable (light seen through the jacket)
  const cpN = 70, cpg = new THREE.BufferGeometry(), cpp = new Float32Array(cpN * 3); cpg.setAttribute('position', new THREE.BufferAttribute(cpp, 3));
  const cablePulse = new THREE.Points(cpg, glowPts(26, 0x3fb8ff)); cablePulse.frustumCulled = false; scene.add(cablePulse);

  // ---------- underwater atmosphere ----------
  const uwCol = new THREE.Color(0x0a4760), fogUW = new THREE.FogExp2(uwCol, 0.05), fogAir = new THREE.FogExp2(0xcfdbe6, 0.0009);
  // god rays
  const rayTex = canvasTex(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.15, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const g2 = x.createLinearGradient(0, 0, w, 0); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = g2; x.fillRect(0, 0, w, h); });
  const rays = new THREE.Group(); const rayMat = new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: 0xbfe9ff, fog: true });
  for (let i = 0; i < 90; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3 + rr() * 7, 40), rayMat); m.position.set(-330 + rr() * 600, -18, -30 + rr() * 60);
    m.rotation.set(0, rr() * Math.PI, 0); m.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0.3).normalize(), -0.35); m.userData.ph = rr() * 6; rays.add(m); }
  scene.add(rays);
  // marine snow around the camera
  const snowN = 5000, sg = new THREE.BufferGeometry(), sp = new Float32Array(snowN * 3); for (let i = 0; i < snowN; i++) { sp[i * 3] = (rr() - .5) * 30; sp[i * 3 + 1] = (rr() - .5) * 16; sp[i * 3 + 2] = (rr() - .5) * 30; }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snow = new THREE.Points(sg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying float vD; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_PointSize=clamp(40./vD,1.,5.); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying float vD; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=exp(-d*d*4.)*0.35*exp(-vD*0.08); gl_FragColor=vec4(vec3(0.75,0.9,1.)*a,1.); }` })); snow.frustumCulled = false; scene.add(snow);
  // small school of fish
  const fishG = new THREE.SphereGeometry(0.12, 10, 6); fishG.scale(2.4, 0.8, 0.5);
  const fish = new THREE.InstancedMesh(fishG, new THREE.MeshStandardMaterial({ color: 0x9fb3bf, metalness: 0.6, roughness: 0.35 }), 120); scene.add(fish);

  // ---------- camera ----------
  const cutC = c0.clone().add(tan.clone().multiplyScalar(CUTLEN * 0.5));
  const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
  const macro = cutC.clone().add(side.clone().multiplyScalar(0.22)).add(new THREE.Vector3(0, 0.2, 0)).add(tan.clone().multiplyScalar(-0.22));
  const path = camPath([
    { t: 0.0, pos: [-352, 9, 20], look: [-320, -1, 6], fov: 42 },
    { t: 1.8, pos: [-318, 1.6, 12], look: [-296, -4, 5], fov: 42 },
    { t: 2.6, pos: [-298, -6, 8], look: [-270, -20, 2], fov: 44 },
    { t: 4.0, pos: [-236, -33.6, 5.5], look: [-214, -36.5, 0.5], fov: 44 },
    { t: 5.6, pos: macro.toArray(), look: cutC.toArray(), fov: 34 },
    { t: 7.2, pos: macro.clone().add(tan.clone().multiplyScalar(0.3)).toArray(), look: cutC.clone().add(tan.clone().multiplyScalar(0.25)).toArray(), fov: 34 },
    { t: 8.4, pos: [-190, -34.4, 3.2], look: [-150, -32, 0], fov: 44 },
    { t: 10.0, pos: [30, -19, 7], look: [80, -13, 2], fov: 46 },
    { t: 11.4, pos: [200, -2.2, 7], look: [260, -0.5, 1], fov: 46 },
    { t: 12.4, pos: [248, 1.6, 8], look: [320, 3, 0], fov: 46 },
  ]);

  const v = new THREE.Vector3(), labels = [];
  const labelDefs = [['Optical fibres', 0.68, 0.0035], ['Stainless steel tube', 0.55, 0.0058], ['Steel strength wires', 0.47, 0.0092], ['Copper conductor', 0.37, 0.0125], ['PE insulation', 0.27, 0.0255], ['Steel armour wires', 0.16, 0.0385], ['Outer serving', 0.04, 0.045]];
  function update(t) {
    path(t, camera); camera.updateMatrixWorld();
    const uw = camera.position.y < 0.05;
    scene.fog = uw ? fogUW : fogAir; scene.background = uw ? uwCol : null; sky.visible = !uw; island.visible = !uw;
    // fog thickens with depth, clears toward the bright shallows
    fogUW.density = lerp(0.028, 0.06, sstep(-4, -30, camera.position.y));
    fogUW.color.copy(uwCol).multiplyScalar(lerp(1.0, 0.55, sstep(-3, -34, camera.position.y)));
    ocean.mat.uniforms.time.value = t + 30; ocean.mat.uniforms.center.value.set(camera.position.x, camera.position.z);
    ocean.mat.uniforms.uwFog.value.copy(fogUW.color);
    causticU.time.value = t; causticU.cstr.value = uw ? 1 : 0.4;
    sun.intensity = uw ? 2.4 : 3.0; hemi.color.set(uw ? 0x6fb8d8 : 0x9cc9ee); hemi.intensity = uw ? 1.3 : 0.9;
    rays.visible = uw; rays.children.forEach((r, i) => {  r.position.x += Math.sin(t * 0.4 + r.userData.ph) * 0.004; });
    snow.visible = uw; snow.position.copy(camera.position);
    // fish school drifting across the view offshore
    for (let i = 0; i < 120; i++) { const a = i * 2.39996, r = 1.2 + (i % 11) * 0.35; P.set(-250 + t * 3.2 + Math.cos(a) * r * 2, -29 + Math.sin(a * 1.3) * r * 0.5, -6 + Math.sin(a) * r);
      q.setFromEuler(new THREE.Euler(0, Math.sin(t * 3 + i) * 0.15, 0)); M.compose(P, q, S.set(1, 1, 1)); fish.setMatrixAt(i, M); }
    fish.instanceMatrix.needsUpdate = true;
    // fibre pulses (shoreward = +x in local frame)
    for (let k = 0; k < 12; k++) for (let j = 0; j < 5; j++) { const s = ((t * 0.55 + j / 5 + k * 0.083) % 1); fibreCurves[k].getPoint(s, v); fpp.set([v.x, v.y, v.z], (k * 5 + j) * 3); }
    fpg.attributes.position.needsUpdate = true;
    // cable glow pulses travelling toward shore, spaced every ~9 m
    for (let i = 0; i < cpN; i++) { const s = ((t * 16 + i * 9) % (total)) / total; curve.getPointAt(s, v); cpp.set([v.x, v.y + 0.02, v.z], i * 3); }
    cpg.attributes.position.needsUpdate = true;
    cablePulse.material.uniforms.op.value = uw ? 0.55 : 0;
    // cutaway callouts only during the macro shot
    labels.length = 0; const la = sstep(5.2, 5.9, t) * (1 - sstep(7.3, 7.8, t));
    if (la > 0) labelDefs.forEach(([name, s, r], i) => { v.set(s, r * 0.6, r * 0.8).applyMatrix4(gm).project(camera);
      labels.push({ name, x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, a: la * sstep(5.2 + i * 0.1, 5.6 + i * 0.1, t) }); });
  }
  return { scene, camera, update, labels, exposure: 1.25, clipping: true };
}
