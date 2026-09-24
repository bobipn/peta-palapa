# Introducing Palapa Ring Tengah — launch video

`Introducing_Palapa_Ring_Tengah.mp4`: 1920×1080, 30 fps, 30 s, H.264 + AAC, about 7 MB.

This is a hand-drawn canvas animation. Clawd (8-bit) stands in for PRT, and the colours follow LTI branding.

## Rebuild
```
npm i && npm i playwright imageio   # plus an ffmpeg with libx264 on PATH as $FF
node prep.js        # routes.json + world-atlas coastline -> data.js
node synth.js       # chiptune soundtrack -> music.wav
FF=ffmpeg node render.js stills 5,15,25   # preview frames
FF=ffmpeg node render.js video            # -> video.mp4 (silent)
ffmpeg -i video.mp4 -i music.wav -c:v copy -c:a aac -b:a 96k -shortest -movflags +faststart out.mp4
```

## Sources for the figures
- len-telko.co.id: 1,320.15 km land, 1,823.51 km marine, 3,143.66 km total, 17 regencies, 17 service cities + 10 interconnection cities, DWDM, 100 Gbps per project, online since 21 Dec 2018, KPBU/BOOT agreement dated 4 Mar 2016.
- Network map on len-telko.co.id: 6 projects (P4, P5, P6, P7, P8A, P8B), which gives 600 Gbps.
- Internal figures: about 50% utilisation, so about 300 Gbps is still open.
- Route geometry comes from `peta.html` (the KML export). The coastline is Natural Earth 50m, taken from the `world-atlas` package.
