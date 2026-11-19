# C-Ring Market: film produk sinematik (2:06)

`cring_market_film.mp4`: 1920×1080, 30 fps, 2:06, H.264 High + AAC 160 kbps, ~31 MB.

Film ini memakai alur demo sebelumnya (`../market-demo/`), tetapi digarap ulang dengan gaya sinematik gelap:
- Pembuka berupa bola bumi dot-matrix yang zoom ke Sulawesi, dengan jalur serat sebagai garis cahaya.
- UI memakai mode malam C-Ring Market dan ditampilkan sebagai panel melayang dengan cahaya lembut.
- Kartu bab berhuruf kapital ber-spasi lebar, dan keterangan berada di kiri bawah.
- Tipografi memakai IBM Plex, font brand situs. Logo diambil dari aset SVG situs.
- Musik ambient disintesis sendiri, tanpa sampel.

Batasan yang tetap berlaku:
- Hanya web market (tanpa portal utama dan NaaS).
- Rute Sulawesi saja, kapasitas 1G dan 10G.
- Tanpa harga dan tanpa link web.
- Kursor orb spiral.

## Alur

| Waktu | Bagian | Isi |
|---|---|---|
| 0:00–0:09 | Orbit | Bola bumi, zoom ke Sulawesi, jalur Makassar→Tentena dan Makassar→Manado menyala |
| 0:09–0:15 | Judul | Logo C-RING · MARKET |
| 0:15–0:33 | 01 Daftar | Buat akun perusahaan, kode 6 digit dari email |
| 0:33–0:53 | 02 Verifikasi | Data perusahaan, dokumen KYC (wajib: Akta keanggotaan APJII, NPWP), 8 langkah onboarding, Persetujuan LTI, notifikasi email + WA |
| 0:53–1:14 | 03 Pilih rute | Makassar→Tentena 1G (14 titik, 719 km), lalu Makassar→Manado 10G (11 titik, 2.034 km) |
| 1:14–1:23 | 04 Pesan | Modal "Pesan link ini", "Pesanan diajukan" |
| 1:23–1:41 | 05 Aktivasi | Tracker sampai Aktif; notifikasi "Semua vendor siap — aktivasi dimulai", "Layanan aktif, tagihan & kontrak", "Kontrak siap ditandatangani" |
| 1:41–1:56 | 06 Dokumen | Kontrak, BAA, BAST; Layanan Saya (Lapor gangguan, Unduh ringkasan, Riwayat) |
| 1:56–2:06 | Penutup | Kembali ke orbit, logo, "Daftar akun perusahaan" |

## Sumber dan catatan

- Label UI, langkah, dokumen KYC, angka rute (km, SLA ±99%, aktif ±3 hari, darat/laut), daftar titik bernomor, dan teks notifikasi diambil dari C-Ring Market di server baru (akun pelanggan contoh, 19 Nov 2026), dibaca tanpa mengirim pesanan atau mengubah data.
- Perusahaan, PIC, email, NPWP, nomor order, dan ID layanan di film adalah data fiktif atau disamarkan. Kode 482916 hanya contoh.
- Koordinat titik di peta adalah perkiraan pusat kota, bukan jalur kabel survei.
- Kotak masuk email dan chat WhatsApp adalah mockup generik.
- **Perlu dikonfirmasi:** fitur WhatsApp yang terlihat di market adalah opt-in "Info produk & penawaran lewat WhatsApp" dan nomor WhatsApp PIC. Pengiriman notifikasi status pesanan lewat WhatsApp belum terverifikasi.

## Rebuild

```bash
pip install numpy scipy imageio-ffmpeg
python3 audio_pro.py                                    # -> audio_pro.wav
FILM=film_pro.html node render.js "$(python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')" 3780   # -> video_hq.mp4
ffmpeg -i video_hq.mp4 -i audio_pro.wav -map 0:v -map 1:a -c:v libx264 -preset slower -crf 20 -profile:v high -level 4.1 \
  -pix_fmt yuv420p -r 30 -g 60 -c:a aac -b:a 160k -ar 48000 -movflags +faststart -shortest cring_market_film.mp4
```

`FILM=film_pro.html PREV=prev node preview.js 4 12 40 95` merender still untuk cek cepat.
