import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { W, H, FPS, inv, clamp } from './core.js';
import { makeEarth } from './setEarth.js';
import { makeRegion } from './setRegion.js';
import { makeSea } from './setSea.js';
import { makeLand } from './setLand.js';
import { drawHUD, hudCanvas } from './hud.js';

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const mkRT = () => new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const rtA = mkRT(), rtB = mkRT();
const hudTex = new THREE.CanvasTexture(hudCanvas); hudTex.colorSpace = THREE.SRGBColorSpace;

const composer = new EffectComposer(renderer);
const mix = new ShaderPass({
  uniforms: { a: { value: rtA.texture }, b: { value: rtB.texture }, k: { value: 0 }, dip: { value: 0 }, ea: { value: 1 }, eb: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D a,b; uniform float k,dip,ea,eb; varying vec2 vUv;
    void main(){ vec4 A=texture2D(a,vUv)*ea, B=texture2D(b,vUv)*eb; gl_FragColor=mix(A,B,k)*(1.-dip); }`
});
mix.needsSwap = true; composer.addPass(mix);
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.35, 0.6, 0.86); composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, hud: { value: hudTex }, time: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse,hud; uniform float time; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 uv=vUv; vec2 d=uv-.5;
      // subtle chromatic aberration at edges
      float ca=dot(d,d)*0.004; vec3 c;
      c.r=texture2D(tDiffuse,uv-d*ca).r; c.g=texture2D(tDiffuse,uv).g; c.b=texture2D(tDiffuse,uv+d*ca).b;
      c=vec3(1.)-exp(-c*1.05);             // filmic shoulder (linear HDR -> display)
      c=pow(c,vec3(1./2.2));
      // grade: teal shadows, warm highlights
      float l=dot(c,vec3(.299,.587,.114));
      c=mix(c*vec3(0.93,1.0,1.06),c*vec3(1.05,1.0,0.94),smoothstep(.35,.9,l));
      c=mix(vec3(l),c,1.05);
      c*=1.-dot(d,d)*0.55;                 // vignette
      c+=(h(uv*vec2(1920.,1080.)+floor(time*6.))-.5)*0.006; // fine grain
      vec4 u=texture2D(hud,vec2(uv.x,uv.y)); c=mix(c,u.rgb,u.a);
      gl_FragColor=vec4(c,1.); }`
});
composer.addPass(grade); grade.uniforms.hud.value = hudTex;

let SETS = {}, TL = null;
function renderSet(s, t, rt, opt) { s.update(t, opt); renderer.setRenderTarget(rt); renderer.toneMapping = s.toneMapping ?? THREE.NoToneMapping; renderer.render(s.scene, s.camera); }

async function init() {
  await document.fonts.load('700 20px M'); await document.fonts.load('300 20px M'); await document.fonts.load('500 20px M'); await document.fonts.load('800 20px M'); await document.fonts.load('600 20px M'); await document.fonts.load('400 20px M');
  SETS.earth = await makeEarth();
  SETS.earth.toneMapping = THREE.NoToneMapping;
  SETS.region = await makeRegion();
  SETS.sea = await makeSea();
  SETS.land = await makeLand();
  TL = [ { s: SETS.earth, a: 0, b: 8.6 }, { s: SETS.region, a: 7.4, b: 16.6, kind: 'region' }, { s: SETS.sea, a: 16.0, b: 28.4 }, { s: SETS.land, a: 27.6, b: 43.2, kind: 'land' }, { s: SETS.region, a: 42.4, b: 60, o: { mode: 'final' }, kind: 'final', e: 1.9 } ];
}
function frame(t) {
  const act = TL.filter(e => t >= e.a && t < e.b);
  const A = act[0], B = act[1];
  renderSet(A.s, t - A.a, rtA, A.o);
  let k = 0; if (B) { renderSet(B.s, t - B.a, rtB, B.o); k = clamp((t - B.a) / (A.b - B.a)); }
  mix.uniforms.a.value = rtA.texture; mix.uniforms.b.value = rtB.texture; mix.uniforms.k.value = k; mix.uniforms.ea.value = A.e || A.s.exposure || 1; mix.uniforms.eb.value = B ? (B.e || B.s.exposure || 1) : 1;
  const dom = B && k > 0.5 ? B : A; drawHUD(t, dom.kind === 'final' ? [] : (dom.s.labels || []), dom.kind); hudTex.needsUpdate = true; grade.uniforms.time.value = t;
  renderer.setRenderTarget(null); composer.render();
}
window.READY = init().then(() => true);
window.renderFrame = (i) => { frame(i / FPS); return renderer.domElement.toDataURL('image/jpeg', 0.94); };
window.renderAt = (t) => { frame(t); };
