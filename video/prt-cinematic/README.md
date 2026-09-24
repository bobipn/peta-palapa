# Palapa Ring Tengah — cinematic network visualization

`PRT_Cinematic_Ecosystem.mp4`: 1920×1080, 30 fps, 52 s, H.264 + AAC, 34 MB.

The film follows one continuous path: orbit → the real PRT backbone map → submarine cable (seabed, articulated pipe, layered cable cutaway) → beach manhole and cable landing station → buried duct and aerial fibre → PoP → 42 m BTS (4G/5G) → connected community → wide end shot with the end card.

It is rendered in real time with Three.js/WebGL (SwiftShader, CPU only). It is not path-traced, so it is not photorealistic.

## Data and assets
- **Satellite imagery:** NASA Blue Marble Next Generation (topo + bathymetry, July 2004), NASA cloud mosaic, and NASA Earth at Night. All are public domain from NASA Visible Earth.
- **Elevation:** GEBCO_08 via NASA Visible Earth.
- **PRT routes and landing points:** the KML export in `peta.html`.
- **Figures on screen:** from len-telko.co.id: 1,823.51 km marine, 1,320.15 km land, 3,143.66 km total (shown as 3,100+), 27 PoPs (17 service cities + 10 interconnection points), and 6 × 100 Gbps DWDM links.
- **Water normals:** three.js example texture (MIT licence).
- **Logo:** the LTI ring mark from len-telko.co.id.
- **Font:** Manrope (OFL).

## Rebuild
```
npm i three@0.169 playwright @fontsource/manrope   # run in the parent folder so ../node_modules/@fontsource resolves
node score.js                                      # soundtrack -> score.wav
FF=ffmpeg node drive.js stills 12,22,40            # preview frames -> shots/
FF=ffmpeg node drive.js video 0 52 video.mp4
ffmpeg -i video.mp4 -i score.wav -c:v libx264 -crf 22 -c:a aac -b:a 160k -shortest out.mp4
```
