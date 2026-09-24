const fs=require('fs'),topo=require('topojson-client');
const land=JSON.parse(fs.readFileSync('node_modules/world-atlas/land-50m.json'));
const g=topo.feature(land,land.objects.land);
const B=[108,-9,134,7];
function rdp(pts,eps){if(pts.length<3)return pts;let dmax=0,idx=0;const[a,b]=[pts[0],pts[pts.length-1]];for(let i=1;i<pts.length-1;i++){const p=pts[i];const dx=b[0]-a[0],dy=b[1]-a[1];const L=Math.hypot(dx,dy)||1e-9;const d=Math.abs(dy*p[0]-dx*p[1]+b[0]*a[1]-b[1]*a[0])/L;if(d>dmax){dmax=d;idx=i}}if(dmax>eps){const l=rdp(pts.slice(0,idx+1),eps),r=rdp(pts.slice(idx),eps);return l.slice(0,-1).concat(r)}return[a,b]}
const polys=[];
for(const f of g.features){const mp=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
 for(const poly of mp){const ring=poly[0];let xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);
  if(Math.max(...xs)<B[0]||Math.min(...xs)>B[2]||Math.max(...ys)<B[1]||Math.min(...ys)>B[3])continue;
  const h=Math.floor(ring.length/2);const r=rdp(ring.slice(0,h+1),0.025).concat(rdp(ring.slice(h),0.025).slice(1)).map(p=>[+p[0].toFixed(3),+p[1].toFixed(3)]); if(r.length>=4)polys.push(r);}}
const routes=JSON.parse(fs.readFileSync('routes.json'));
const marine=[],inland=[];
for(const r of routes){const s=rdp(r.c,0.01);(/^\d\.\d/.test(r.n)?marine:inland).push(s)}
const cities={"Long Bagun":[115.242,0.514],"Sendawar":[115.666,-0.232],"Tentena":[120.659,-1.744],"Petasia":[121.34,-1.972],"Bungku":[121.965,-2.537],"Wanggudu":[122.116,-3.513],"Kendari":[122.497,-3.965],"Wawonii":[122.988,-4.05],"Raha":[122.716,-4.834],"Buranga":[122.984,-4.801],"Sawerigadi":[122.433,-4.791],"Lakudo":[122.531,-5.294],"Baubau":[122.561,-5.501],"Luwuk":[122.791,-0.995],"Salakan":[123.307,-1.308],"Banggai":[123.513,-1.595],"Taliabu":[124.388,-1.95],"Sanana":[125.977,-2.077],"Manado":[124.822,1.446],"Ondong Siau":[125.361,2.739],"Tahuna":[125.456,3.617],"Melonguane":[126.695,4.003],"Morotai":[128.312,2.062],"Tobelo":[128.009,1.733],"Ternate":[127.387,0.832],"Tidore":[127.453,0.694],"Sofifi":[127.569,0.739]};
// endpoint check for approximated cities
for(const r of routes){if(/Long Bagun|Petasia|Bungku|Wanggudu/.test(r.n))console.log(r.n,r.c[0],r.c[r.c.length-1])}
fs.writeFileSync('data.js','window.GEO='+JSON.stringify({polys,marine,inland,cities}));
console.log(polys.length,polys.reduce((a,p)=>a+p.length,0),marine.reduce((a,p)=>a+p.length,0),inland.reduce((a,p)=>a+p.length,0),fs.statSync('data.js').size);
