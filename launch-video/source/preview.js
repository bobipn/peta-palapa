const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs=require('fs');
(async()=>{
 const times=process.argv.slice(2).map(Number);
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
 p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('CERR',m.text())});
 await p.goto('file://'+__dirname+'/film.html');await p.evaluate(()=>window.ready);
 const D=process.env.PREV||'prev';fs.mkdirSync(D,{recursive:true});
 for(const t of times){const t0=Date.now();try{await p.evaluate(t=>render(t),t);}catch(e){console.log('ERR@',t,e.message)}const d=await p.evaluate(()=>document.getElementById('c').toDataURL('image/jpeg',.8));fs.writeFileSync(`${D}/${t.toFixed(2)}.jpg`,Buffer.from(d.split(',')[1],'base64'));console.log(t,Date.now()-t0,'ms')}
 await b.close();})();
