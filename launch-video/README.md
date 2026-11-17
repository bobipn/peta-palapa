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
| **8.0–28.0** | **C-Ring Market (20 dtk)**, dari akun pelanggan contoh per 17 Nov 2026 | |
| 8.0–9.0 | Bab 01 | C-Ring Market · cari · pesan · aktif · lunas |
| 9.0–11.5 | Cari link | Marketplace A→B: Bau-Bau → Manado, Leased line 1G, 12 bln, Termurah |
| 11.5–14.25 | Hasil nyata | 4 pilihan rute (Termurah · Tercepat aktif · SLA tertinggi · Terpendek), 2 vendor · 2 ruas, 2.298 km, SLA ±97.025%, aktif ±14 hari, tabel Komponen–Vendor, "Pesan rute ini" (harga disamarkan) |
| 14.25–16.25 | Pesanan saya | Dipesan → Vendor konfirmasi 2/2 → Aktivasi 2/2 → Aktif → Lunas; Vendor A/B "Ruas aktif"; "aktivasi dulu — tagihan terbit saat layanan aktif" |
| 16.25–18.25 | Dokumen otomatis | Kontrak (tanda tangan sistem & pelanggan), Service Order Form, Berita Acara Aktivasi, BAST, Invoice LUNAS |
| 18.25–20.25 | NaaS Hub | Dasbor terpadu, prompt "Backbone 2 Gbps Ternate ke Kendari 12 bulan" → Rancang, Topology studio |
| 20.25–22.75 | Layanan Saya | Kepatuhan SLA bulan ini, C-Ring Leased Line 1G AKTIF, Laporan SLA / Ubah bandwidth / Perpanjang / Hentikan / Dokumen |
| 22.75–24.75 | Cable owner | 5 langkah pendaftaran, unggah KML/KMZ, porsi owner dibayar otomatis setelah fee platform |
| 24.75–26.25 | Ponsel | Header C-RING · Market, kartu layanan |
| 26.25–28.0 | Perusahaan | Langkah menuju layanan aktif: registrasi → KYC → persetujuan LTI → … → layanan aktif |
| **28.0–40.0** | **All-in-one** | Hub 9 aplikasi untuk pelanggan, Peta Rute & Site, Helpdesk/Meeting/Jadwal, "Rp 0 · akses platform" + "Biaya aktivasi gratis untuk kontrak ≥ 12 bulan" |
| 40.0–45.0 | End card | Logo, tagline, komersiallti.my.id, "Daftar sekarang di market.komersiallti.my.id" |

**Brand C-RING (versi terbaru):** palet seluruh film mengikuti logo C-RING · Connex-Ring — navy `#0D2150` / `#0B1C3E`, aksen biru `#2E6BDB`, biru muda `#6FA3FF` untuk rute di peta gelap, latar ice `#F1F4F9`. App icon, mark dan wordmark diambil dari aset logo asli (`brand/`: `app_icon.png`, `mark.png`, `logo_word.png` — wordmark dibersihkan dari board logo dengan upscale + threshold) dan disematkan di `source45/brand.js`. Logo "L" diganti app icon C-RING (termasuk tag kalung maskot dan header market); intro dan end card memakai wordmark C-RING + "BACKBONE TO BUSINESS".

**Pembaruan 17 Nov 2026:** bagian market digambar ulang mengikuti C-Ring Market live: halaman publik `marketplace.php` (Cari Link A→B, Cara kerja, daftar cable owner) dan tata letak portal baru dengan rail menu (dirender dari `app.html` tanpa data akun, karena login kini memakai MFA). Pada tanggal itu pencarian publik yang diuji belum menemukan rangkaian ruas owner, jadi video **tidak** menampilkan hasil pencarian berharga; mekanisme multi-owner ditampilkan sebagai diagram konsep sesuai teks halaman.

**Revisi 17 Nov 2026 (akun pelanggan contoh):** bagian market memakai alur nyata dari akun pelanggan contoh. Tidak ada link web di layar: pill URL di grid, end card dan HUD diganti teks ("C-Ring · Portal LTI", "Daftar sekarang · C-Ring Market", "BACKBONE TO BUSINESS"). Nama akun, perusahaan, email, nomor order/dokumen, dan semua nominal Rupiah tidak ditampilkan. Klaim "biaya aktivasi gratis ≥ 12 bulan" dihapus karena hasil marketplace menampilkan biaya pasang; diganti "Aktivasi dulu, tagihan terbit saat layanan aktif".

Fitur, label dan alur market diverifikasi dengan login ke market.komersiallti.my.id dan screenshot mobile dari pemilik akun (2–3 Okt 2026). Video tidak menampilkan saldo, nomor rekening, nomor order, ataupun angka harga.
