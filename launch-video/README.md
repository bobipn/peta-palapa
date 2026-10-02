# Introducing Portal Komersial — launch film

`komersiallti_launch.mp4` — 1920×1080, 30 fps, 30.0 s, H.264 High + AAC 160 kbps, ~12.5 MB.

Hand-drawn canvas animation. Every frame is rendered deterministically by `source/film.html` (`render(t)`), and the sound is synthesized by `source/audio.py`. Nothing in the film comes from stock footage or stock audio.

## Storyboard

| Time | Scene | What happens |
|---|---|---|
| 0.0–2.5 | Intro | Pencil ground line, the cat drops in and meows, `L` monogram, "Introducing **Portal Komersial**" |
| 2.5–3.25 | Ctrl + K | Cat stomps `Ctrl` + `K` → the real *Palet Perintah LTI* list (Helpdesk, CRM, Panel Komersial …) |
| 3.25–5.5 | Suite | The 15 real modules pop in; the cat walks an orange thread that connects every app card |
| 5.5–6.5 | 01 | **Plan your goals.** |
| 6.5–8.25 | Target | Cat throws a dart at *Target FY*; Panel Komersial input fields get ticked (labels only, no values) |
| 8.25–10.5 | Pipeline | Cat carries a deal card Opportunity → Proposal → Negotiation → Closed · Win (real CRM stages, blank cards) |
| 10.5–12.0 | Kalender | Kalender Tim / Jadwal, with activities circled |
| 12.0–13.0 | 02 | **Connect your data.** |
| 13.0–16.0 | Architecture | Cat plugs CRM, Sales Cloud, Helpdesk, Kapasitas DWDM and Arsip into the API → Edge Workers / Database / AI; data packets flow |
| 16.0–19.0 | Montage | Code typing · XLSX/CSV import into the database · SOP & CS AI draft · cloud + 3-hour session login |
| 19.0–20.0 | 03 | **Trace your progress.** |
| 20.0–22.75 | Map | Real Palapa Ring Tengah inland (orange) and marine (dashed) routes on a coastline sketch; the cat walks the longest inland route |
| 22.75–25.5 | Monitoring | Panel Komersial sketch: backbone capacity (~50% hatched), *Realisasi terhadap target*, *Kecukupan pipeline*, Network live, Laporan BAKTI export |
| 25.5–30.0 | End card | `L` komersial**lti**, the cat lands on the wordmark · tagline · three promises · komersiallti.my.id |

## Sources for the content

- Module names, CRM stages, Panel Komersial labels and the command palette items come from the live site (komersiallti.my.id, logged in).
- Route geometry comes from `peta.html` (Leaflet layers `#ff8a3d` inland and `#2f8fff` marine). The orange `#FF8A3D` is the site's own inland-route color.
- The coastline is Natural Earth 50m, taken from the `world-atlas@2` package.
- The film shows no client names, figures, testimonials or performance claims. The progress bars have no numbers.

## Rebuild

```bash
pip install numpy scipy pillow imageio-ffmpeg
python3 audio.py                         # -> audio.wav
node render.js "$(python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')" 900   # -> video_hq.mp4
ffmpeg -i video_hq.mp4 -i audio.wav -map 0:v -map 1:a -c:v libx264 -preset slower -tune animation -crf 21 \
  -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart -shortest komersiallti_launch.mp4
```

`node preview.js 1.5 9.2 27` renders stills to `prev/` for quick checks.

---

# Versi 45 detik (customer cut) — `komersiallti_launch_45s.mp4`

1920×1080, 30 fps, 45.0 s, H.264 High + AAC 160 kbps, ~16 MB. Sumber ada di `source45/` (`film.html`, `audio45.py`). Teks di layar berbahasa Indonesia, kecuali tagline penutup yang memakai bahasa Inggris sesuai brief awal.

| Waktu | Scene | Isi |
|---|---|---|
| 0–5.5 | Intro · Ctrl+K · Suite | "Introducing Portal Komersial", palet perintah, 15 modul nyata — "Aplikasi kelas dunia. Satu platform." |
| 5.5–8.0 | Nilai | Banyak aplikasi terpisah ditarik kucing menjadi satu platform — "Satu platform. Tanpa biaya akses." |
| **8.0–28.0** | **Connectivity Market (20 dtk)** | |
| 8.0–9.0 | Bab 01 | Connectivity Market · market.komersiallti.my.id |
| 9.0–12.25 | Estimasi rute | Jenis layanan (Dark Fiber / Lit 1G / 10G / 100G), Titik Asal–Tujuan, Kontrak, "Cari Rute & Harga" |
| 12.25–15.75 | 3 opsi jalur | Termurah / Terpendek / Diversitas di atas jaringan kabel PRT nyata, DC terdekat + kolokasi (jalur opsi = **ilustrasi**) |
| 15.75–17.75 | Keranjang | Tambah ke Keranjang → Keranjang Estimasi → Ajukan Penawaran Resmi (dengan disclaimer estimasi) |
| 17.75–21.25 | On-Demand | LTI Link (L2) / LTI Wave (L1) / LTI Net (L3), slider bandwidth 100 Mbps–10 Gbps, kontrak 1–36 bulan, Pesan Sekarang |
| 21.25–24.25 | Layanan Saya | Diajukan → Studi kelayakan → Provisioning → Aktif; Ubah bandwidth / Perpanjang / Lapor gangguan / Unduh ringkasan |
| 24.25–28.0 | Self-service | Tiket · Tagihan · Saldo |
| **28.0–40.0** | **All-in-one** | |
| 28.0–29.0 | Bab 02 | Satu platform, semua aplikasi |
| 29.0–32.25 | Hub | 9 aplikasi untuk pelanggan terhubung ke komersiallti |
| 32.25–35.0 | Peta | Peta Rute & Site PRT — "lihat jaringan sebelum memesan" |
| 35.0–37.5 | Bantuan | Helpdesk (WhatsApp, Email, Web Chat, Telepon), Ruang Meeting, Jadwal / Booking |
| 37.5–40.0 | Gratis | Label "Rp 0 · akses platform" + stempel GRATIS; "Biaya hanya untuk layanan konektivitas yang Anda pesan." |
| 40.0–45.0 | End card | Logo, tagline, komersiallti.my.id, "Daftar sekarang di market.komersiallti.my.id" |

Fitur market diambil dari kode `market.komersiallti.my.id/app.html` (menu, label, tag opsi rute, alur status, produk). Kredensial portal tidak berlaku untuk login market, jadi layar hasil asli tidak bisa dilihat; semua layar market digambar ulang sebagai sketsa tanpa angka harga.
