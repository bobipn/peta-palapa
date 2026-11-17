# C-Ring Market — demo produk (pendaftaran → aktivasi → dokumen)

`cring_market_demo.mp4`: 1920×1080, 30 fps, 2:04, H.264 High + AAC 160 kbps. Ditujukan untuk calon pelanggan di wilayah Sulawesi.

Seluruh film menampilkan web market saja. Portal utama, NaaS, harga, link web, dan rute internasional tidak ditampilkan. Kapasitas yang ditampilkan hanya 1G dan 10G. Kursor memakai orb spiral, bukan maskot kucing.

## Alur

| Waktu | Bab | Isi |
|---|---|---|
| 0:00–0:04 | Intro | Logo C-RING · Market |
| 0:04–0:11 | Peta | Jaringan Sulawesi (Makassar→Tentena, Makassar→Manado) dan agenda 6 langkah |
| 0:11–0:30 | 01 Daftar | Form "Buat akun perusahaan": Isi data → Kode email → Lengkapi data; kode 6 digit masuk ke email ("Kode berlaku 15 menit") |
| 0:30–0:52 | 02 Verifikasi & KYC | Data perusahaan (NPWP, NIB, segmen, kota), unggah NIB / NPWP / Akta, 8 langkah menuju layanan aktif, Persetujuan LTI; notifikasi "Status verifikasi" lewat portal, email, dan WhatsApp |
| 0:52–1:11 | 03 Cari & pilih | Makassar → Tentena 1G, lalu Makassar → Manado 10G |
| 1:11–1:20 | 04 Pesan | Modal "Pesan link ini", setujui Syarat Layanan, "Kirim pesanan" → "Pesanan diajukan" |
| 1:20–1:41 | 05 Aktivasi & notifikasi | Tracker Dipesan → Vendor konfirmasi → Aktivasi → Aktif; notifikasi tiap tahap di email dan WhatsApp (Vendor mengonfirmasi, Semua vendor siap, Ruas aktif, Layanan aktif + PDF) |
| 1:41–1:56 | 06 Dokumen rilis | Kontrak, SOF, Berita Acara Aktivasi, BAST; Layanan Saya AKTIF |
| 1:56–2:04 | Penutup | "Daftar akun perusahaan" |

## Data dan sumber

- Label form, langkah onboarding, dokumen KYC, tahap tracker, nama dokumen, dan isi notifikasi mengikuti market live (akun pelanggan contoh, 17 Nov 2026). Nominal, nomor order, ID layanan, dan data akun disamarkan atau diganti.
- Perusahaan pada demo adalah data fiktif ("PT Contoh Pelanggan", "Nama PIC", email/nomor disamarkan). Kode 482916 hanya contoh.
- Tampilan kotak masuk email dan chat WhatsApp adalah mockup generik, bukan tangkapan layar aplikasi email atau WhatsApp.
- **Perlu dikonfirmasi:** market memiliki preferensi komunikasi email & WhatsApp (opt-in, nomor WhatsApp wajib bila dipilih). Pengiriman notifikasi status pesanan lewat WhatsApp belum terverifikasi dari sisi pelanggan. Pengiriman lewat email sudah terverifikasi untuk kode registrasi dan invoice/kontrak PDF.
- Waktu proses dipadatkan untuk demo. Notifikasi menampilkan jam contoh, bukan SLA.

## Rebuild

```bash
pip install numpy scipy pillow imageio-ffmpeg
python3 audio_demo.py                                   # -> audio_demo.wav
FILM=film_demo.html node render.js "$(python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')" 3720   # -> video_hq.mp4
ffmpeg -i video_hq.mp4 -i audio_demo.wav -map 0:v -map 1:a -c:v libx264 -preset slower -tune animation -crf 22 \
  -profile:v high -level 4.1 -pix_fmt yuv420p -r 30 -g 60 -c:a aac -b:a 160k -ar 48000 -movflags +faststart -shortest cring_market_demo.mp4
```

`film_demo.html` sudah memuat semua scene (bagian `market6.js` di-inline). `FILM=film_demo.html PREV=prev node preview.js 20 50 95` merender still untuk cek cepat.
