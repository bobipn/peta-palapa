import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { loadTex, rng, camPath, polySampler, inv, lerp, W, H, clamp, sstep, fbm } from './core.js';

// region.jpg / elev.png cover lon 108..134, lat 8..-10
const LON0 = 108, LON1 = 134, LAT0 = 8, LAT1 = -10, U = 100, CLON = 121, CLAT = -1;
const EXAG = 16; // vertical exaggeration applied to 0..255 elevation
export const ll = (lon, lat, y = 0) => new THREE.Vector3((lon - CLON) * U, y, -(lat - CLAT) * U);

export function cloudTexture(seed, soft = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const r = rng(seed);
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7) * 70, px = 128 + Math.cos(a) * d * 1.3, py = 140 + Math.sin(a) * d * 0.6 - r() * 20, rad = 22 + r() * 40 * soft;
    const g = x.createRadialGradient(px, py, 0, px, py, rad); const s = 0.5 + r() * 0.5;
    g.addColorStop(0, `rgba(255,255,255,${0.16 * s})`); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function makeRegion() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, W / H, 1, 20000);
  const [map, elev, wn] = await Promise.all([loadTex('region.jpg'), loadTex('elev.png', false), loadTex('waternormals.jpg', false)]);
  wn.wrapS = wn.wrapT = THREE.RepeatWrapping;
  // elevation sampler on CPU (for route heights & cloud placement)
  const ec = document.createElement('canvas'); ec.width = elev.image.width; ec.height = elev.image.height;
  const ex = ec.getContext('2d'); ex.drawImage(elev.image, 0, 0); const ed = ex.getImageData(0, 0, ec.width, ec.height).data;
  const hAt = (lon, lat) => { const u = (lon - LON0) / (LON1 - LON0), v = (LAT0 - lat) / (LAT0 - LAT1);
    const px = clamp(Math.round(u * (ec.width - 1)), 0, ec.width - 1), py = clamp(Math.round(v * (ec.height - 1)), 0, ec.height - 1);
    return ed[(py * ec.width + px) * 4] / 255 * EXAG; };

  const Wd = (LON1 - LON0) * U, Hd = (LAT0 - LAT1) * U;
  const geo = new THREE.PlaneGeometry(Wd, Hd, 900, 623); geo.rotateX(-Math.PI / 2);
  geo.translate(((LON0 + LON1) / 2 - CLON) * U, 0, -((LAT0 + LAT1) / 2 - CLAT) * U);
  const terr = new THREE.MeshStandardMaterial({ map, displacementMap: elev, displacementScale: EXAG, roughness: 0.93, metalness: 0 });
  const terrShadowU = { sunDirS: { value: null } };
  terr.onBeforeCompile = sh => { // lift land slightly; soft cloud shadows projected along the sun direction
    Object.assign(sh.uniforms, terrShadowU); sh.uniforms.sunDirS.value = sunDir;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWp; uniform sampler2D ctex; uniform vec2 cOff; uniform vec4 cb; uniform vec3 sunDirS;
      vec2 cUV(vec2 xz){ return vec2((xz.x-cOff.x-cb.x)/(cb.y-cb.x),(xz.y-cOff.y-cb.z)/(cb.w-cb.z)); }`)
    .replace('#include <map_fragment>', `#include <map_fragment>
      float oc=smoothstep(0.02,0.10,diffuseColor.b-max(diffuseColor.r,diffuseColor.g)*0.9);
      diffuseColor.rgb=mix(diffuseColor.rgb*vec3(1.08,1.1,0.95)*1.35, diffuseColor.rgb, oc);
      vec2 sp=vWp.xz+sunDirS.xz/max(sunDirS.y,0.15)*(${24}.0-vWp.y);
      float sh=texture2D(ctex,cUV(sp)).a; diffuseColor.rgb*=1.0-0.45*smoothstep(0.05,0.7,sh);`);
  };
  const ground = new THREE.Mesh(geo, terr); scene.add(ground);

  // ocean surface: transparent, fresnel + sun glint, coastline from imagery
  const sunDir = new THREE.Vector3();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(Wd * 3, Hd * 3).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: map }, wn: { value: wn }, time: { value: 0 }, sunDir: { value: sunDir }, sky: { value: new THREE.Color(0x9fc3e0) }, bounds: { value: new THREE.Vector4(LON0, LON1, LAT0, LAT1) } }]),
    vertexShader: `varying vec3 vW; #include <fog_pars_vertex>
      void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition; #include <fog_vertex> }`.replace(/#include <(\w+)>/g, '\n#include <$1>\n'),
    fragmentShader: `uniform sampler2D map,wn; uniform float time; uniform vec3 sunDir,sky; uniform vec4 bounds; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        vec2 ll=vec2(vW.x/${U.toFixed(1)}+${CLON.toFixed(1)}, -vW.z/${U.toFixed(1)}+${CLAT.toFixed(1)});
        vec2 uv=vec2((ll.x-bounds.x)/(bounds.y-bounds.x),(bounds.z-ll.y)/(bounds.z-bounds.w));
        vec3 c=texture2D(map,uv).rgb; float oc=smoothstep(0.02,0.09,c.b-max(c.r,c.g)*0.9);
        if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.) oc=1.;
        vec2 p=vW.xz*0.02; vec3 n1=texture2D(wn,p+vec2(time*0.01,time*0.007)).rbg*2.-1.; vec3 n2=texture2D(wn,p*0.37-vec2(time*0.006,-time*0.004)).rbg*2.-1.;
        vec3 n=normalize(vec3(0.,1.,0.)+(n1+n2)*vec3(0.18,0.,0.18));
        vec3 V=normalize(cameraPosition-vW); float fr=0.02+0.98*pow(1.-max(dot(n,V),0.),5.);
        vec3 Hh=normalize(sunDir+V); float sp=pow(max(dot(n,Hh),0.),260.)*6.;
        float shallow=smoothstep(0.3,0.55,c.b);
        vec3 deep=mix(vec3(0.004,0.022,0.06),vec3(0.02,0.16,0.20),shallow);
        vec3 col=mix(deep,sky*0.9,fr)+sp*vec3(1.,0.86,0.66);
        float a=oc*mix(mix(0.96,0.55,shallow),1.0,fr);
        gl_FragColor=vec4(col,a);
        #include <fog_fragment>
      }`
  }));
  water.position.y = 0.12; water.renderOrder = 1; scene.add(water);

  const sky = new Sky(); sky.scale.setScalar(18000); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 6; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.85;
  scene.fog = new THREE.FogExp2(0xb9cbe0, 0.00011);
  const sunL = new THREE.DirectionalLight(0xffe2c0, 3.2); scene.add(sunL, sunL.target);
  const hemi = new THREE.HemisphereLight(0xbcd6f5, 0x2b3a2a, 0.7); scene.add(hemi);

  // procedural cumulus field (domain-warped fbm), denser over land; casts shadows on terrain & sea
  const CW = 2080, CH = 1440, cc = document.createElement('canvas'); cc.width = CW; cc.height = CH;
  const cx2 = cc.getContext('2d'), cimg = cx2.createImageData(CW, CH), dens = new Float32Array(CW * CH);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const lon = LON0 + x / CW * (LON1 - LON0), lat = LAT0 - y / CH * (LAT0 - LAT1);
    const qx = x * 0.06, qy = y * 0.06; const wx = fbm(qx * 0.5 + 3.1, qy * 0.5 + 1.7, 3) * 2.2, wy = fbm(qx * 0.5 - 2.3, qy * 0.5 + 5.2, 3) * 2.2;
    dens[y * CW + x] = fbm(qx + wx, qy + wy, 5) + (hAt(lon, lat) > 0.2 ? 0.03 : 0) + fbm(x * 0.004, y * 0.004, 2) * 0.22;
  }
  const smp = []; for (let i = 0; i < dens.length; i += 97) smp.push(dens[i]); smp.sort((p, q) => p - q);
  const th = smp[Math.floor(smp.length * 0.925)], th2 = smp[Math.floor(smp.length * 0.995)];
  for (let i = 0; i < dens.length; i++) { const d = clamp((dens[i] - th) / (th2 - th)); cimg.data[i * 4] = cimg.data[i * 4 + 1] = cimg.data[i * 4 + 2] = 255; cimg.data[i * 4 + 3] = d * 255; }
  cx2.putImageData(cimg, 0, 0); const cloudTex = new THREE.CanvasTexture(cc); cloudTex.wrapS = cloudTex.wrapT = THREE.ClampToEdgeWrapping;
  const CLOUD_Y = 24;
  const cloudU = { ctex: { value: cloudTex }, cOff: { value: new THREE.Vector2() }, cb: { value: new THREE.Vector4((LON0 - CLON) * U, (LON1 - CLON) * U, -(LAT0 - CLAT) * U, -(LAT1 - CLAT) * U) } };
  const cloudUV = `vec2 cUV(vec2 xz){ return vec2((xz.x-cOff.x-cb.x)/(cb.y-cb.x),(xz.y-cOff.y-cb.z)/(cb.w-cb.z)); }`;
  const cloudMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { sunCol: { value: new THREE.Color(1, 1, 1) }, op: { value: 1 }, sunDir: { value: sunDir } }]),
    vertexShader: `varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}`,
    fragmentShader: `uniform sampler2D ctex; uniform vec2 cOff; uniform vec4 cb; uniform vec3 sunCol,sunDir; uniform float op; varying vec3 vW; ${cloudUV}\n#include <fog_pars_fragment>\n
      void main(){ vec2 uv=cUV(vW.xz); float d=texture2D(ctex,uv).a; float d2=texture2D(ctex,uv+sunDir.xz*0.004).a;
        float shade=clamp(1.0-(d2-d)*2.2,0.55,1.15); vec3 col=sunCol*mix(0.78,1.08,smoothstep(0.1,0.9,d))*shade;
        float a=smoothstep(0.02,0.6,d)*op; gl_FragColor=vec4(col*0.8,a*0.9);\n#include <fog_fragment>\n}` });
  cloudMat.uniforms.ctex = cloudU.ctex; cloudMat.uniforms.cOff = cloudU.cOff; cloudMat.uniforms.cb = cloudU.cb;
  const cloudLayer = new THREE.Mesh(new THREE.PlaneGeometry(Wd, Hd).rotateX(-Math.PI / 2), cloudMat);
  cloudLayer.position.set(((LON0 + LON1) / 2 - CLON) * U, CLOUD_Y, -((LAT0 + LAT1) / 2 - CLAT) * U); cloudLayer.renderOrder = 3; scene.add(cloudLayer);
  Object.assign(terrShadowU, cloudU);

  // ---- PRT backbone routes (real KML geometry) ----
  const G = window.GEO, routes = [];
  const lineMat = (col, w, op) => { const m = new LineMaterial({ color: col, linewidth: w, transparent: true, opacity: op, depthTest: false }); m.resolution.set(W, H); return m; };
  const matMarine = lineMat(0xbfeeff, 2.4, 0.95), matLand = lineMat(0xffe7c2, 2.4, 0.95);
  const matHalo = lineMat(0x2aa8e0, 7, 0.22);
  const addRoute = (coords, marine) => {
    const pts = coords.map(([lo, la]) => ll(lo, la, marine ? 0.4 : hAt(lo, la) + 0.8));
    const flat = []; pts.forEach(p => flat.push(p.x, p.y, p.z));
    const g = new LineGeometry(); g.setPositions(flat);
    const halo = new Line2(g, matHalo); halo.renderOrder = 5; scene.add(halo);
    const ln = new Line2(g, marine ? matMarine : matLand); ln.renderOrder = 6; ln.computeLineDistances(); scene.add(ln);
    routes.push({ pts, marine, samp: polySampler(pts), g });
  };
  G.marine.forEach(c => addRoute(c, true)); G.inland.forEach(c => addRoute(c, false));
  // order routes by rough west->east so the network "draws on"
  routes.forEach(r => r.key = r.pts[0].x + r.pts[0].z * 0.3);
  const order = [...routes].sort((a, b) => a.key - b.key); order.forEach((r, i) => r.rank = i / order.length);

  // pulses: pixel-sized glowing points travelling along routes
  const pulses = []; routes.forEach((r, i) => { const n = Math.max(1, Math.round(r.samp.total / 40)); for (let k = 0; k < n; k++) pulses.push({ r, off: k / n + (i * 0.137) % 1 }); });
  const pg = new THREE.BufferGeometry(); const pp = new Float32Array(pulses.length * 3), pa = new Float32Array(pulses.length);
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('alpha', new THREE.BufferAttribute(pa, 1));
  const pmat = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { size: { value: 16 } },
    vertexShader: `attribute float alpha; varying float vA; uniform float size; void main(){ vA=alpha; gl_PointSize=size; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float g=exp(-d*d*6.)+exp(-d*d*40.)*1.5; gl_FragColor=vec4(vec3(0.55,0.9,1.)*g*vA,1.); }` });
  const pts = new THREE.Points(pg, pmat); pts.renderOrder = 7; pts.frustumCulled = false; scene.add(pts);

  // PoPs: ground rings + dots (labels drawn by HUD)
  const popMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false }), ringMat = new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: .8, depthTest: false, side: THREE.DoubleSide });
  const pops = Object.entries(G.cities).map(([name, [lo, la]], i) => {
    const y = Math.max(0.5, hAt(lo, la) + 0.9); const g = new THREE.Group(); g.position.copy(ll(lo, la, y));
    const dot = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), popMat); g.add(dot);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.1, 40).rotateX(-Math.PI / 2), ringMat); g.add(ring);
    g.renderOrder = 8; dot.renderOrder = 8; ring.renderOrder = 8; scene.add(g);
    return { name, g, dot, ring, i };
  });

  // ---------- cameras ----------
  const intro = camPath([
    { t: 0, pos: [50, 1850, 330], look: [50, 0, -20], fov: 32 },
    { t: 3.2, pos: [120, 900, 380], look: [110, 0, -40], fov: 32 },
    { t: 6.2, pos: [330, 260, 560], look: [175, 0, 285], fov: 34 },
    { t: 9.0, pos: [190, 16, 330], look: [175, 0, 290], fov: 40 },
  ]);
  const finale = camPath([
    { t: 0, pos: [520, 560, 700], look: [180, 0, 60], fov: 38 },
    { t: 9.5, pos: [-120, 900, 820], look: [160, 0, -40], fov: 38 },
  ]);

  const labels = []; const v = new THREE.Vector3();
  function update(t, opt = {}) {
    const fin = opt.mode === 'final';
    (fin ? finale : intro)(t, camera); camera.updateMatrixWorld();
    // sun: morning in the intro, golden late-afternoon for the finale
    const elevDeg = fin ? 12 : lerp(28, 16, t / 9), az = fin ? 250 : 95;
    const phi = THREE.MathUtils.degToRad(90 - elevDeg), th = THREE.MathUtils.degToRad(az);
    sunDir.setFromSphericalCoords(1, phi, th); su.sunPosition.value.copy(sunDir);
    sunL.position.copy(sunDir).multiplyScalar(3000); sunL.color.set(fin ? 0xffc48a : 0xffe6c8); sunL.intensity = fin ? 2.6 : 3.2;
    water.material.uniforms.sunDir.value.copy(sunDir); water.material.uniforms.time.value = t + (fin ? 50 : 0);
    water.material.uniforms.sky.value.set(fin ? 0xa7b6c8 : 0x9fc3e0);
    scene.fog.color.set(fin ? 0xb9b4b0 : 0xb9cbe0); scene.fog.density = fin ? 0.0002 : 0.00011;
    cloudU.cOff.value.set(t * 1.5 + (fin ? 20 : 0), 0);
    cloudMat.uniforms.sunCol.value.set(fin ? 0xffe2c8 : 0xfff4e6);
    cloudMat.uniforms.op.value = sstep(2, 20, Math.abs(camera.position.y - CLOUD_Y)) * (fin ? 0.3 : 1);
    // network draw-on & pulses
    const draw = fin ? 1 : sstep(1.2, 5.5, t);
    routes.forEach(r => { const vis = clamp((draw - r.rank * 0.8) * 5); r.vis = vis; r.g.instanceCount = Infinity; });
    [matMarine, matLand].forEach(m => m.opacity = 0.95 * (fin ? 1 : sstep(1.2, 2.2, t)));
    matHalo.opacity = 0.22 * (fin ? 1 : sstep(1.2, 2.2, t));
    pulses.forEach((p, i) => { const r = p.r; const s = ((t * 0.28 + p.off) % 1) * r.samp.total; r.samp.at(s, v);
      pp[i * 3] = v.x; pp[i * 3 + 1] = v.y + 0.2; pp[i * 3 + 2] = v.z; pa[i] = r.vis * (fin ? 1 : sstep(2.0, 3.5, t)); });
    pg.attributes.position.needsUpdate = true; pg.attributes.alpha.needsUpdate = true;
    pmat.uniforms.size.value = clamp(2600 / camera.position.y, 10, 26);
    // PoP markers scale to stay readable
    labels.length = 0;
    pops.forEach(p => { const k = fin ? 1 : sstep(3.0 + p.i * 0.06, 3.6 + p.i * 0.06, t); const s = camera.position.distanceTo(p.g.position) * 0.0032 * Math.max(0.001, k);
      p.g.scale.setScalar(s); v.copy(p.g.position).project(camera);
      if (k > 0 && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1) labels.push({ name: p.name, x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, a: k }); });
  }
  return { scene, camera, update, labels, exposure: 1.45, hAt, ll };
}
