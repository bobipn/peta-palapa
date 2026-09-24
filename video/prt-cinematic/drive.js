// usage: node drive.js stills t1,t2,... | node drive.js video start end out.mp4
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const {spawn}=require('child_process');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');
const types={'.js':'text/javascript','.html':'text/html','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2','.json':'application/json'};
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});r.end(d)})}).listen(+(process.env.PORT||8765));
(async()=>{
  const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p=await b.newPage({viewport:{width:1920,height:1080}});
  p.on('console',m=>{if(m.type()!=='warning')console.log('console:',m.text())});p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('http://localhost:'+(process.env.PORT||8765)+'/cine/index.html');await p.waitForFunction(()=>window.READY,null,{timeout:120000});await p.evaluate(()=>window.READY);
  const mode=process.argv[2];
  if(mode==='stills'){for(const t of process.argv[3].split(',')){const t0=Date.now();const d=await p.evaluate(i=>window.renderFrame(i),Math.round(parseFloat(t)*30));
      fs.writeFileSync(path.join(__dirname,'shots',`s_${t}.jpg`),Buffer.from(d.split(',')[1],'base64'));console.log('t',t,Date.now()-t0,'ms')}}
  else{const a=parseFloat(process.argv[3]),e=parseFloat(process.argv[4]),out=process.argv[5];
    const ff=spawn(process.env.FF,['-y','-loglevel','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf',process.env.CRF||'20','-pix_fmt','yuv420p','-an',out],{stdio:['pipe','inherit','inherit']});
    const t0=Date.now();for(let i=Math.round(a*30);i<Math.round(e*30);i++){const d=await p.evaluate(i=>window.renderFrame(i),i);
      if(!ff.stdin.write(Buffer.from(d.split(',')[1],'base64')))await new Promise(r=>ff.stdin.once('drain',r));
      if(i%30===0)console.log('frame',i,((Date.now()-t0)/1000).toFixed(0)+'s')}
    ff.stdin.end();await new Promise(r=>ff.on('close',r))}
  await b.close();srv.close();
})();
