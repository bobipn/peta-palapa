import * as THREE from 'three';
// Gerstner-wave ocean surface, correct from above (fresnel sky reflection + sun glint)
// and from below (Snell's window). World-space, y = 0 at mean sea level.
export const WAVES = [ // dir x, dir z, steepness, wavelength (m)
  [1.0, 0.25, 0.20, 34], [0.7, -0.7, 0.16, 19], [-0.3, 1.0, 0.12, 11], [0.9, 0.5, 0.08, 5.5], [0.2, -1.0, 0.06, 3.1]];
const glslWaves = WAVES.map(w => `vec4(${w.map(v => v.toFixed(3)).join(',')})`).join(',');
export function waveHeight(x, z, t) { // CPU approximation (vertical only)
  let y = 0; for (const [dx, dz, st, L] of WAVES) { const k = 2 * Math.PI / L, c = Math.sqrt(9.8 / k), l = Math.hypot(dx, dz); const f = k * ((dx / l) * x + (dz / l) * z - c * t); y += (st / k) * Math.sin(f); } return y;
}
export function makeOcean({ size = 3000, seg = 600, sky = new THREE.Color(0xa9c8e6), horizon = new THREE.Color(0xdfe7ee), deep = new THREE.Color(0x03243a), uwFog = new THREE.Color(0x0b4a63) } = {}) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: true, transparent: false,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sky: { value: sky }, horizon: { value: horizon }, deep: { value: deep },
      uwFog: { value: uwFog }, maxX: { value: 1e9 }, sunCol: { value: new THREE.Color(1, 0.92, 0.8) }, center: { value: new THREE.Vector2() } }]),
    vertexShader: `uniform float time; uniform vec2 center; varying vec3 vW; varying vec3 vN;
      #include <fog_pars_vertex>
      const vec4 WV[5]=vec4[5](${glslWaves});
      void main(){ vec3 p=position; p.xz+=center; vec3 pos=p; vec3 T=vec3(1.,0.,0.), B=vec3(0.,0.,1.);
        float fade=1.-smoothstep(300.,1400.,length(p.xz-center));
        for(int i=0;i<5;i++){ vec2 d=normalize(WV[i].xy); float st=WV[i].z*fade; float k=6.2831853/WV[i].w; float c=sqrt(9.8/k); float f=k*(dot(d,p.xz)-c*time); float a=st/k;
          pos.x+=d.x*a*cos(f); pos.z+=d.y*a*cos(f); pos.y+=a*sin(f);
          T+=vec3(-d.x*d.x*st*sin(f), d.x*st*cos(f), -d.x*d.y*st*sin(f));
          B+=vec3(-d.x*d.y*st*sin(f), d.y*st*cos(f), -d.y*d.y*st*sin(f)); }
        vN=normalize(cross(B,T)); vW=pos; vec4 mvPosition=viewMatrix*vec4(pos,1.); gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 sunDir,sky,horizon,deep,uwFog,sunCol; uniform float time,maxX; varying vec3 vW; varying vec3 vN;
      #include <fog_pars_fragment>
      float hh(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float ns(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y); }
      void main(){
        if(vW.x>maxX) discard;
        vec3 n=normalize(vN);
        // micro ripples
        vec2 q=vW.xz*1.3; float e=0.08; float h0=ns(q+time*0.8)+0.5*ns(q*2.3-time*1.1);
        float hx=ns(q+vec2(e,0.)+time*0.8)+0.5*ns((q+vec2(e,0.))*2.3-time*1.1), hz=ns(q+vec2(0.,e)+time*0.8)+0.5*ns((q+vec2(0.,e))*2.3-time*1.1);
        n=normalize(n+vec3(h0-hx,0.,h0-hz)*0.9);
        vec3 V=normalize(cameraPosition-vW); vec3 col;
        if(gl_FrontFacing){
          vec3 r=reflect(-V,n); r.y=abs(r.y);
          vec3 sk=mix(horizon,sky,pow(clamp(r.y,0.,1.),0.45));
          float fr=0.02+0.98*pow(1.-max(dot(n,V),0.),5.);
          float sss=pow(max(dot(V,-sunDir+n*0.3),0.),3.)*0.25;
          vec3 body=deep*(0.6+0.4*max(sunDir.y,0.))+vec3(0.0,0.09,0.1)*sss;
          vec3 Hh=normalize(sunDir+V); float sp=pow(max(dot(n,Hh),0.),900.)*40.+pow(max(dot(n,Hh),0.),90.)*0.6;
          col=mix(body,sk,fr)+sunCol*sp*step(0.,sunDir.y);
          gl_FragColor=vec4(col,1.);
          #include <fog_fragment>
        } else {
          // looking up from below: bright Snell's window overhead, darker total internal reflection outside it
          float up=clamp(-V.y,0.,1.);
          float snell=smoothstep(0.63,0.75,up);
          vec3 inside=mix(uwFog,vec3(0.75,0.92,1.0)*1.6,snell);
          inside+=pow(max(dot(normalize(vec3(-V.x,-V.y,-V.z)),sunDir),0.),60.)*vec3(1.,0.95,0.85)*4.;
          col=inside*(0.85+0.3*h0);
          float d=length(cameraPosition-vW); col=mix(uwFog,col,exp(-d*0.035));
          gl_FragColor=vec4(col,1.);
        }
      }`
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 2;
  return { mesh, mat: m };
}
