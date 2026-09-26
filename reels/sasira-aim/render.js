const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
 p.on('pageerror',e=>console.error('ERR',e.message));
 await p.goto('file://'+path.resolve('reel.html')+'?render');await p.evaluate(()=>window.ready);
 fs.mkdirSync('frames',{recursive:true});
 const only=process.argv[2]?process.argv[2].split(',').map(Number):null;
 const frames=only||[...Array(450).keys()];
 for(const f of frames){
   const d=await p.evaluate(f=>{render(f/30);return document.getElementById('c').toDataURL('image/png')},f);
   fs.writeFileSync(`frames/f${String(f).padStart(4,'0')}.png`,Buffer.from(d.split(',')[1],'base64'));
 }
 await b.close();
})();
