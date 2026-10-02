const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const {spawn}=require('child_process');
(async()=>{
 const FF=process.argv[2];const N=+process.argv[3]||900;
 const ff=spawn(FF,['-y','-f','image2pipe','-framerate','30','-c:v','png','-i','-','-c:v','libx264','-preset','slow','-crf','12','-pix_fmt','yuv420p','video_hq.mp4'],{stdio:['pipe','ignore','inherit']});
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+__dirname+'/film.html');await p.evaluate(()=>window.ready);
 const t0=Date.now();
 for(let f=0;f<N;f++){const d=await p.evaluate(f=>{render(f/30);return document.getElementById('c').toDataURL('image/png')},f);
  const buf=Buffer.from(d.slice(22),'base64');if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));
  if(f%100===0)console.log('frame',f,((Date.now()-t0)/1000).toFixed(1)+'s');}
 ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('done',((Date.now()-t0)/1000).toFixed(1));
})();
