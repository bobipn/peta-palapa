// Usage: node render.js [comma-separated frame list]  -> frames/fNNNN.png
// Serves this folder over local HTTP so the photo tiles don't taint the canvas.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const http=require('http');
const TYPES={'.html':'text/html','.jpg':'image/jpeg','.ttf':'font/ttf','.png':'image/png'};
const srv=http.createServer((q,s)=>{const f=path.join(__dirname,decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);s.end();return}s.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream'});s.end(d)})});
srv.listen(0,'127.0.0.1',async()=>{
 const port=srv.address().port;
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
 let errs=0;p.on('pageerror',e=>{errs++;console.error('ERR',e.message)});
 await p.goto(`http://127.0.0.1:${port}/reel.html?render`);await p.evaluate(()=>window.ready);
 fs.mkdirSync('frames',{recursive:true});
 const frames=process.argv[2]?process.argv[2].split(',').map(Number):[...Array(450).keys()];
 const t0=Date.now();
 for(const f of frames){
   const d=await p.evaluate(f=>{render(f/30);return document.getElementById('c').toDataURL('image/png')},f);
   fs.writeFileSync(`frames/f${String(f).padStart(4,'0')}.png`,Buffer.from(d.split(',')[1],'base64'));
 }
 console.log('rendered',frames.length,'frames in',((Date.now()-t0)/1000).toFixed(1),'s; errors',errs);
 await b.close();srv.close();
});
