// node drive.js VERSION stills id1,id2@lt,... | node drive.js VERSION video out.mp4
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const {spawn}=require('child_process');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');const types={'.js':'text/javascript','.html':'text/html','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'};
const port=+(process.env.PORT||8900);
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});r.end(d)})}).listen(port);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('console',m.text())});
  await p.goto(`http://localhost:${port}/prod/index.html`);await p.evaluate(()=>window.READY);
  const ver=process.argv[2];const dur=JSON.parse(fs.readFileSync(path.join(__dirname,'vo/dur.json')));const tl=await p.evaluate(([v,d])=>window.build(v,d),[ver,dur]);
  fs.writeFileSync(path.join(__dirname,`timeline_${ver}.json`),JSON.stringify(tl,null,0));const total=tl[tl.length-1].a+tl[tl.length-1].D;console.log(ver,'total',total.toFixed(1),'s');
  if(process.argv[3]==='stills'){for(const spec of process.argv[4].split(',')){const [id,f]=spec.split('@');const e=tl.find(x=>x.id===id);const t=e.a+(f?parseFloat(f):e.D*0.75);
      const d=await p.evaluate(i=>window.renderFrame(i),Math.round(t*30));fs.writeFileSync(path.join(__dirname,'shots',`${ver}_${id}${f?'_'+f:''}.jpg`),Buffer.from(d.split(',')[1],'base64'))}}
  else{const out=process.argv[4];const n=Math.round(total*30);const ff=spawn(process.env.FF,['-y','-loglevel','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-c:v','libx264','-preset','medium','-crf',process.env.CRF||'20','-pix_fmt','yuv420p','-an',out],{stdio:['pipe','inherit','inherit']});
    const t0=Date.now();for(let i=0;i<n;i++){const d=await p.evaluate(i=>window.renderFrame(i),i);if(!ff.stdin.write(Buffer.from(d.split(',')[1],'base64')))await new Promise(r=>ff.stdin.once('drain',r));if(i%300===0)console.log('frame',i,'/',n,((Date.now()-t0)/1000).toFixed(0)+'s')}
    ff.stdin.end();await new Promise(r=>ff.on('close',r))}
  await b.close();srv.close()})();
