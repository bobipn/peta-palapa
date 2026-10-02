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

1920×1080, 30 fps, 45.0 s, H.264 High + AAC 160 kbps, ~17 MB. Sumber ada di `source45/` (`film.html`, `audio45.py`). Teks di layar berbahasa Indonesia, kecuali tagline penutup yang memakai bahasa Inggris sesuai brief awal.

| Waktu | Scene | Isi |
|---|---|---|
| 0–5.5 | Intro · Ctrl+K · Suite | "Introducing Portal Komersial", palet perintah, 15 modul — "Aplikasi kelas dunia. Satu platform." |
| 5.5–8.0 | Nilai | Banyak aplikasi terpisah ditarik kucing menjadi satu platform — "Satu platform. Tanpa biaya akses." |
| **8.0–28.0** | **Connectivity Market (20 dtk)**, tata letak mengikuti UI asli: tab di atas, panel kiri, peta gelap di kanan | |
| 8.0–9.0 | Bab 01 | Connectivity Market · rute · bandwidth · data center · global |
| 9.0–11.75 | Estimasi rute | Jenis layanan (Dark Fiber / Lit 1G / 10G / 100G), Makassar → Ternate INT (PRT), kontrak 1 tahun, "Cari Rute & Harga"; tombol Analisis di peta |
| 11.75–14.5 | Hasil | Termurah: Makassar → Manado INT → Ternate INT (Terrestrial, SMPCS Packet-1), DC terdekat NOC LTI Ternate · kolokasi 1U; kartu Terpendek & Diversitas (jalur keduanya **ilustrasi**) |
| 14.5–16.25 | Global | Makassar → Tokyo (Termurah · Terpendek) melalui sistem kabel ACC1 (RENCANA), MIC-1, EAC-C2C, SJC2 (RENCANA), SeaMeWe-3, FEA; DC terdekat DC Tokyo; peringatan "Melewati kabel berstatus RENCANA" — "dihitung dari jalur kabel nyata" |
| 16.25–17.75 | Keranjang | Tambah ke Keranjang → Keranjang Estimasi → Ajukan Penawaran Resmi (dengan disclaimer estimasi) |
| 17.75–20.75 | Pesan | LTI Link / Wave / Net; bandwidth 100 Mbps … 10 Gbps; masa kontrak 1 hari … 36 bln; rincian harga (nilai disamarkan) dengan **Biaya aktivasi: Gratis (kontrak ≥ 12 bln)**; Pesan Sekarang → "Pesanan diajukan" |
| 20.75–23.5 | Layanan | Bayar dari saldo → stepper bar Diajukan → Studi → Provisioning → Aktif, Riwayat dengan format log asli; Ubah bandwidth / Lapor gangguan / Unduh ringkasan |
| 23.5–28.0 | Ponsel · Tiket · Saldo | Tampilan mobile ("lengkap juga di ponsel"), tiket dengan dropdown Kategori/Prioritas dan contoh "Link down sejak 09.00 WITA", saldo prabayar, "Kredit SLA yang disetujui masuk sebagai saldo" |
| **28.0–40.0** | **All-in-one** | Hub 9 aplikasi untuk pelanggan, Peta Rute & Site, Helpdesk/Meeting/Jadwal, "Rp 0 · akses platform" + "Biaya aktivasi gratis untuk kontrak ≥ 12 bulan" |
| 40.0–45.0 | End card | Logo, tagline, komersiallti.my.id, "Daftar sekarang di market.komersiallti.my.id" |

**Brand C-RING (versi terbaru):** palet seluruh film mengikuti logo C-RING · Connex-Ring — navy `#0D2150` / `#0B1C3E`, aksen biru `#2E6BDB`, biru muda `#6FA3FF` untuk rute di peta gelap, latar ice `#F1F4F9`. App icon, mark dan wordmark diambil dari aset logo asli (`brand/`: `app_icon.png`, `mark.png`, `logo_word.png` — wordmark dibersihkan dari board logo dengan upscale + threshold) dan disematkan di `source45/brand.js`. Logo "L" diganti app icon C-RING (termasuk tag kalung maskot dan header market); intro dan end card memakai wordmark C-RING + "BACKBONE TO BUSINESS".

Fitur, label dan alur market diverifikasi dengan login ke market.komersiallti.my.id dan screenshot mobile dari pemilik akun (2–3 Okt 2026). Video tidak menampilkan saldo, nomor rekening, nomor order, ataupun angka harga.
