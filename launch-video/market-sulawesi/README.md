# C-Ring Market — film peluncuran untuk calon pelanggan Sulawesi

`cring_market_sulawesi.mp4`: 1920×1080, 30 fps, 45,0 detik, H.264 High + AAC 160 kbps, ~8,9 MB.

Seluruh film adalah **web market (C-Ring Market)**: proses pemesanan link kapasitas **1G dan 10G** di Sulawesi sampai layanan **aktif**. Film ini tidak memuat portal utama, NaaS, harga, nominal Rupiah, URL, maupun data akun. Maskot kucing diganti **kursor orb spiral** yang berputar dan memberi efek tekan serta riak saat klik. Garis digambar bersih, tanpa efek sketsa.

| Waktu | Scene | Isi |
|---|---|---|
| 0–4 | Intro | Orb menggambar wordmark C-RING · MARKET · "Marketplace konektivitas untuk pelanggan Sulawesi" |
| 4–8 | Sulawesi | Peta jaringan, kota (Makassar, Palopo, Tentena, Palu, Luwuk, Kendari, Bau-Bau, Gorontalo, Manado); "Link antar-kota Sulawesi, dalam satu pesanan"; Leased line 1G / 10G |
| 8–12.5 | Cari | Marketplace A→B: Makassar → Tentena, Leased line, kapasitas 1G, 12 bln, Termurah, Cari link |
| 12.5–17.5 | Pilih (1G) | 4 pilihan rute; 1 vendor · 1 ruas; 719 km · SLA ±99% · aktif ±3 hari · darat 713 km · laut 6 km |
| 17.5–21.5 | Pilih (10G) | Ganti ke 10G dan tujuan Manado; 2.034 km · SLA ±99% · aktif ±3 hari · darat 1.816 km · laut 218 km |
| 21.5–25.5 | Pesan | Jendela "Pesan link ini" (tanpa harga): vendor konfirmasi ≤ 24 jam, aktivasi tanpa menunggu pembayaran; setuju Syarat Layanan → Kirim pesanan → "Pesanan diajukan" |
| 25.5–31.5 | Aktif | Pesanan saya: Dipesan → Vendor konfirmasi 1/1 → Aktivasi 1/1 → Aktif; Vendor A "Ruas aktif" |
| 31.5–35.5 | Dokumen | Kontrak (tanda tangan sistem & pelanggan), Service Order Form, Berita Acara Aktivasi, BAST |
| 35.5–39.5 | Layanan Saya | C-Ring Leased Line 10G AKTIF, Kepatuhan SLA, Laporan SLA / Ubah bandwidth / Perpanjang / Lapor gangguan |
| 39.5–45 | Penutup | C-RING · MARKET, "Konektivitas antar-kota di Sulawesi.", "Cari · Pesan · Aktif — dalam satu portal.", tombol "Daftar akun perusahaan" |

**Sumber data:** hasil pencarian dan jendela pemesanan dicek pada 17 Nov 2026 dengan akun pelanggan contoh. Jendela pesanan hanya dibuka, tidak dikirim, sehingga tidak ada pesanan yang dibuat. Titik-titik rute di peta adalah perkiraan koordinat kota yang dilalui jalur sesuai daftar dari market. Status "Pesanan saya" mengikuti alur nyata pada pesanan yang sudah ada di akun contoh.

## Render

```bash
cd source
python3 audio_market.py                                  # -> audio.wav
FILM=film_market.html node render.js "$(python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')" 1350
ffmpeg -i video_hq.mp4 -i audio.wav -map 0:v -map 1:a -c:v libx264 -preset slower -tune animation -crf 22 \
  -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart -shortest cring_market_sulawesi.mp4
```
