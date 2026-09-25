// node postel_drive.js 9x16|16x9 stills t1,t2 | video out.mp4
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const {spawn}=require('child_process');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');const types={'.js':'text/javascript','.html':'text/html','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'};const port=+(process.env.PORT||8950);
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});r.end(d)})}).listen(port);
(async()=>{const b=await chromium.launch();const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));const v=process.argv[2];
  await p.goto(`http://localhost:${port}/prod/postel.html?v=${v}`);await p.evaluate(()=>window.READY);const info=await p.evaluate(()=>window.info());console.log(JSON.stringify(info));fs.writeFileSync(path.join(__dirname,'postel_info.json'),JSON.stringify(info));
  if(process.argv[3]==='stills'){for(const t of process.argv[4].split(',')){const d=await p.evaluate(i=>window.renderFrame(i),Math.round(parseFloat(t)*30));fs.writeFileSync(path.join(__dirname,'shots',`P${v}_${t}.jpg`),Buffer.from(d.split(',')[1],'base64'))}}
  else{const n=Math.round(info.total*30);const ff=spawn(process.env.FF,['-y','-loglevel','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf','21','-pix_fmt','yuv420p','-an',process.argv[4]],{stdio:['pipe','inherit','inherit']});
    for(let i=0;i<n;i++){const d=await p.evaluate(i=>window.renderFrame(i),i);if(!ff.stdin.write(Buffer.from(d.split(',')[1],'base64')))await new Promise(r=>ff.stdin.once('drain',r))}ff.stdin.end();await new Promise(r=>ff.on('close',r))}
  await b.close();srv.close()})();
