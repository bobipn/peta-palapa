# C-Ring (Connex-Ring) — aset brand

**Tagline:** BACKBONE TO BUSINESS

Konsep: wordmark kapital lebar dan monokrom. Sebuah garis orbit tipis menembus
huruf **C**: lewat di depan pada sisi kiri-bawah, lewat di belakang pada lengan
kanan-atas, lalu melengkung di atas "RING". Orbit melambangkan cincin backbone
Palapa Ring; titik masuk-keluarnya melambangkan *connex* (interkoneksi).

| File | Pakai untuk |
|---|---|
| `c-ring-logo-on-dark.svg/.png` | Logo + tagline di latar gelap (tinta putih) |
| `c-ring-logo-on-light.svg/.png` | Logo + tagline di latar terang (tinta navy `#0A1B3D`) |
| `c-ring-wordmark-on-*.svg/.png` | Logo tanpa tagline (header, kop, ukuran kecil) |
| `c-ring-mark-on-*.svg/.png` | Simbol C + orbit saja (avatar, watermark) |
| `c-ring-app-icon.svg`, `icon-192/512/1024.png` | Ikon aplikasi (PWA / home screen / presentasi) |
| `c-ring-avatar-1024.png` | Foto profil persegi penuh (WhatsApp, LinkedIn) |
| `icon-maskable-512.png` | Ikon Android adaptif (aman di safe-zone 80%) |
| `c-ring-og.png` | Gambar pratinjau tautan (WhatsApp/LinkedIn), 1200×630 |
| `/favicon.ico`, `/favicon.svg`, `/apple-touch-icon.png`, `/site.webmanifest` | Sudah ditautkan di `<head>` semua halaman |

Warna: navy `#0A1B3D`, putih `#FFFFFF`, latar ikon gradasi `#0E2452 → #050B1A`.
Font tagline: Sora Regular (SIL OFL), sudah dikonversi menjadi outline.

Aturan pakai:
- Jangan beri warna, bayangan, atau efek glow pada logo. Cukup satu warna tinta.
- Jarak bebas minimal setinggi huruf "I" di semua sisi.
- Di bawah lebar 160 px, pakai wordmark tanpa tagline. Di bawah 48 px, pakai ikon.

Generate ulang (misalnya setelah tagline diganti di `TAGLINE`):

```
python3 tools/brand/build_brand.py   # perlu fonttools, node + playwright, ImageMagick
```
