# @sasira_aim, reel 15 detik (v2, artisan, narasi Bahasa Indonesia)

Animasi prosedural di canvas (gaya tinta gambar tangan, stop-motion 12 fps, tekstur kertas/kraft/batu) digabung dengan foto masakan asli dari grid profilnya. Musik dan efek suara disintesis: kecapi berlaras slendro, kendang, gong dengan ombak, dan foley dapur (ulekan, "sreng", kertas robek). Naskah, voice over dan caption ada di [NASKAH.md](NASKAH.md).

## Build ulang

Foto dan video hasil **tidak** disimpan di repo ini karena repo publik. Buat ulang dari screenshot grid profil:

```bash
pip install pillow numpy imageio-ffmpeg
python3 crop_tiles.py screenshot-profil.png          # -> img/*.jpg (12 tile)
NODE_PATH=$(npm root -g) node render.js              # -> frames/f0000..f0449.png (butuh playwright)
python3 audio.py                                      # -> track.wav
FF=$(python3 -c "import imageio_ffmpeg as i;print(i.get_ffmpeg_exe())")
$FF -framerate 30 -i frames/f%04d.png -i track.wav -c:v libx264 -preset slow -crf 19 \
    -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart sasira_aim_reel_v2_15s.mp4
```

`render.js` menyajikan folder ini lewat HTTP lokal supaya canvas tidak "tainted" oleh gambar. Buka `reel.html` lewat server lokal untuk pratinjau loop di browser.

Untuk versi final, ganti file di `img/` dengan foto asli resolusi penuh (nama file sama). Tile dari screenshot hanya 425 px lebar.

## Font

Fraunces Italic, Caveat, Montserrat (SIL Open Font License 1.1; lisensi ada di `OFL-*.txt`).
