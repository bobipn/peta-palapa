const {chromium}=require('playwright');
const {spawn}=require('child_process');
const mode=process.argv[2]||'stills';
(async()=>{
  const b=await chromium.launch({args:['--allow-file-access-from-files','--disable-web-security']});
  const p=await b.newPage({viewport:{width:1920,height:1080}});
  p.on('console',m=>console.log('console:',m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('file://'+__dirname+'/anim.html');await p.evaluate(()=>window.ready());
  if(mode==='stills'){
    const ts=(process.argv[3]||'1.3,2.2,4.5,5.4,8,11.5,15,17,19.8,22.8,25.5,29').split(',');
    for(const t of ts){const d=await p.evaluate(i=>window.renderFrame(i),Math.round(parseFloat(t)*30));
      require('fs').writeFileSync(`still_${t}.jpg`,Buffer.from(d.split(',')[1],'base64'))}
  } else {
    const ff=spawn(process.env.FF,['-y','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf','28','-tune','animation','-pix_fmt','yuv420p','-an','video.mp4'],{stdio:['pipe','inherit','inherit']});
    for(let i=0;i<900;i++){const d=await p.evaluate(i=>window.renderFrame(i),i);
      if(!ff.stdin.write(Buffer.from(d.split(',')[1],'base64')))await new Promise(r=>ff.stdin.once('drain',r));
      if(i%100===0)console.log('frame',i)}
    ff.stdin.end();await new Promise(r=>ff.on('close',r));
  }
  await b.close();
})();
