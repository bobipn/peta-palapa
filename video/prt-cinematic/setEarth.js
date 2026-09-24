import * as THREE from 'three';
import { loadTex, rng, inv, lerp, eIOs } from './core.js';

// lon/lat -> direction consistent with THREE.SphereGeometry UVs (equirectangular textures)
export function ll2v(lon, lat, r = 1) {
  const phi = (lon + 180) / 360 * Math.PI * 2, th = (90 - lat) * Math.PI / 180;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(th) * r, Math.cos(th) * r, Math.sin(phi) * Math.sin(th) * r);
}

export async function makeEarth() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.5, 5000);
  const [day, night, clouds, wn] = await Promise.all([loadTex('globe.jpg'), loadTex('earth_lights_lrg.jpg'), loadTex('cloud_combined_2048.jpg', false), loadTex('waternormals.jpg', false)]);
  wn.wrapS = wn.wrapT = THREE.RepeatWrapping;
  const sun = new THREE.Vector3();
  const R = 100;
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { day: { value: day }, night: { value: night }, sunDir: { value: sun }, wn: { value: wn }, time: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D day,night,wn; uniform vec3 sunDir; uniform float time; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 c=texture2D(day,vUv).rgb; c=pow(c,vec3(2.2));
        // ocean mask from blue dominance of the topo-bathy texture
        float ocean=smoothstep(0.02,0.10,c.b-max(c.r,c.g)*0.9);
        vec3 deep=vec3(0.004,0.018,0.05); c=mix(c,mix(deep,c*0.55,0.35),ocean);
        vec3 n=normalize(vN);
        vec2 wuv=vUv*vec2(180.,90.); vec3 wnrm=texture2D(wn,wuv+time*0.002).rgb*2.-1.;
        vec3 nw=normalize(n+ocean*0.06*vec3(wnrm.x,0.,wnrm.y));
        float ndl=dot(n,sunDir); float lit=smoothstep(-0.08,0.25,ndl);
        vec3 V=normalize(cameraPosition-vW); vec3 Hh=normalize(sunDir+V);
        float spec=pow(max(dot(nw,Hh),0.),120.)*ocean*2.2*smoothstep(0.,0.2,ndl);
        float fres=pow(1.-max(dot(n,V),0.),4.);
        vec3 warm=mix(vec3(1.0,0.55,0.3),vec3(1.),smoothstep(0.0,0.35,ndl));
        vec3 col=c*lit*warm*1.35 + spec*vec3(1.,0.85,0.65) + fres*vec3(0.25,0.5,1.)*0.6*lit;
        vec3 nl=pow(texture2D(night,vUv).rgb,vec3(2.2))*vec3(1.,0.75,0.45)*2.0;
        col+=nl*(1.-smoothstep(-0.15,0.05,ndl));
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 256, 128), earthMat); scene.add(earth);
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: clouds }, sunDir: { value: sun }, fade: { value: 1 } }, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; varying vec3 vN; void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 sunDir; uniform float fade; varying vec2 vUv; varying vec3 vN;
      void main(){ float a=texture2D(map,vUv).r; a=smoothstep(0.35,0.95,a)*0.8*fade; float ndl=dot(normalize(vN),sunDir);
        float lit=smoothstep(-0.1,0.3,ndl); vec3 col=mix(vec3(1.,0.6,0.4),vec3(1.),smoothstep(0.,0.4,ndl))*lit*1.1;
        gl_FragColor=vec4(col,a*(0.25+0.75*lit));
        #include <colorspace_fragment>
      }`
  });
  const cl = new THREE.Mesh(new THREE.SphereGeometry(R * 1.006, 192, 96), cloudMat); scene.add(cl);
  const atmMat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: sun } }, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sunDir; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 V=normalize(cameraPosition-vW); vec3 n=normalize(vN);
        float i=pow(clamp(1.0+dot(n,V),0.,1.),7.);
        float lit=smoothstep(-0.3,0.4,dot(n,sunDir));
        gl_FragColor=vec4(vec3(0.3,0.6,1.)*i*lit*1.4,1.); }`
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 128, 64), atmMat));
  // stars
  const r = rng(7), sp = []; for (let i = 0; i < 4000; i++) { const v = new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize().multiplyScalar(2500); sp.push(v.x, v.y, v.z); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9fb4d0, size: 1.2, sizeAttenuation: false, transparent: true, opacity: .6 })));

  const target = ll2v(121.5, -1.0, R);
  function update(t) {
    earthMat.uniforms.time.value = t;
    // morning sun from the east, slowly rising over central Indonesia
    sun.copy(ll2v(lerp(165, 150, t / 8), 8, 1)).normalize();
    cl.rotation.y = t * 0.004;
    // camera: high orbit over the archipelago easing down toward Central Indonesia
    const k = eIOs(inv(0, 8.5, t));
    const lon = lerp(117, 121.5, k), lat = lerp(-2, -2.6, k);
    const dist = lerp(440, 128, k);
    camera.position.copy(ll2v(lon, lat, dist));
    const look = ll2v(121.5, -0.6, R * lerp(0.0, 1.0, Math.pow(k, 1.5)));
    cloudMat.uniforms.fade.value = 0.35 + 0.65 * (1 - k);
    camera.up.set(0, 1, 0); camera.lookAt(look);
  }
  return { scene, camera, update, target };
}
