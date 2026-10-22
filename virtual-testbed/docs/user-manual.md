# Panduan Pengguna — C-Ring Virtual Testbed

Aplikasi: `https://virtual.komersiallti.my.id`
Semua data (provider, kabel, kapasitas, harga, pembayaran, metrik) adalah **SIMULASI**. Tidak ada yang terhubung ke jaringan, provider, billing, atau payment gateway sungguhan.

Label tombol dan menu di aplikasi berbahasa Inggris; panduan ini menuliskannya **persis** seperti di layar.

---

## 0. Cek kesehatan dulu (1 menit)

Buka `https://virtual.komersiallti.my.id/api/health`. Harus tampil:

```json
{"status":"ok", ..., "checks": {"sessionCookieUsable": true, "hint": null, ...}}
```

- `sessionCookieUsable: false` → login akan "berhasil" tapi langsung terlempar/semua aksi gagal. Lihat bagian **Troubleshooting** no. 2.
- Halaman tidak terbuka / 503 → aplikasi Node tidak jalan. Lihat Troubleshooting no. 5.

---

## 1. Akun dan peran

Semua akun memakai password yang sama = nilai `DEMO_PASSWORD` yang Anda isi di cPanel.

| Email | Peran | Bisa apa |
|---|---|---|
| `customer.a@demo.local` | Customer (pembeli A) | **Memesan layanan**, bayar (simulasi), melihat order & layanan miliknya |
| `customer.b@demo.local` | Customer (pembeli B) | Sama, terpisah dari A |
| `alpha@`, `bravo@`, `charlie@`, `echo@demo.local` | Cable owner | Menerima order otomatis (auto-accept), atur harga wholesale |
| `delta@demo.local` | Cable owner | Harus **menerima/menolak manual** |
| `noc@demo.local` | NOC | Topologi, simulasi gangguan, alarm, insiden, SLA |
| `commercial@demo.local` | Commercial | Settlement / revenue |
| `auditor@demo.local` | Auditor | Hanya baca, termasuk audit log |
| `admin@demo.local` | Admin | Pengaturan, reset demo |

> **Penting:** hanya akun **Customer** yang punya menu **Marketplace** dan bisa memesan. Admin/NOC **tidak bisa** membuat order — ini disengaja (RBAC), bukan error.

---

## 2. Memesan layanan (akun Customer) — langkah demi langkah

1. Buka situs → isi **Email** `customer.a@demo.local` dan **Password** → klik **Sign in**.
2. Klik menu **Marketplace** di sidebar kiri.
3. Isi formulir:
   | Field | Contoh pertama yang pasti berhasil |
   |---|---|
   | A-end | Jakarta (ID) |
   | B-end | Ternate (ID) |
   | Bandwidth (Mbps) | `1000` |
   | Service type | EPL |
   | SLA profile | Domestic Premium (DEMO) |
   | Protection | Unprotected (auto-reroute) — atau 1+1 protected |
   | Optimise for | Lowest latency |
   | Term (months) | 12 |
4. Klik **Search routes**. Muncul tabel **Candidate routes** (jalur, latency, panjang, provider, harga, SLA).
   - Pilih salah satu baris (radio button). Rincian harga tampil di kanan.
5. Klik **Request quote for selected route** → muncul kotak biru **Quote qt-…** dengan harga dan masa berlaku.
6. Klik **Accept quote → checkout** → Anda pindah ke halaman **Order ord-…** berstatus `PENDING PAYMENT`.
7. Klik **Pay Rp … (SIMULATED)** (tombol biru kanan atas). Tidak ada uang yang berpindah.
8. Tunggu ±10–20 detik **di halaman yang sama** (halaman memperbarui sendiri). Status bergerak:
   `CONFIRMED → PROVIDER ACCEPTANCE → RESOURCE RESERVED → PROVISIONING → TESTING → ACTIVE`
   Selesai bila tertulis **Service is active**.
9. Klik **Service →** lalu tab **Activation tests**: semua tes harus `PASS` atau `NOT RUN` (berlabel SIMULATED).
10. Tab **Monitoring** menampilkan grafik latency/loss/jitter/throughput. Grafik baru terisi setelah jam simulasi berjalan (otomatis 1 tick tiap 5 detik, atau NOC menekan **+10**).

### Pesan yang wajar muncul (bukan error aplikasi)
| Pesan | Arti | Yang dilakukan |
|---|---|---|
| `No feasible route: INSUFFICIENT_CAPACITY … 10000 Mbps` | Bandwidth melebihi kapasitas (mis. 20 Gbps ke Ternate) | Klik tombol **Use 10 Gbps** atau turunkan bandwidth |
| `SLA_NOT_MET` | Jalur tercepat masih lebih lambat dari target SLA (mis. Jakarta–Tokyo dengan Domestic Premium 30 ms) | Pilih SLA **Regional Standard** atau **Global Standard** |
| `NO_DIVERSE_PATH` | Tidak ada jalur cadangan yang benar-benar terpisah | Pilih **Unprotected** |
| `A and B must differ` | A-end = B-end | Ganti salah satu |
| Order berhenti di `PROVIDER ACCEPTANCE` | Rute memakai provider **Delta** (Australia: Darwin/Perth/Sydney) yang harus menerima manual | Lihat bagian 3 |

**Kombinasi uji yang disarankan**
| A → B | SLA profile | Yang terlihat |
|---|---|---|
| Jakarta → Ternate, 1+1 protected | Domestic Premium | Jalur utama + jalur proteksi terpisah, 2 provider |
| Bali → Tokyo | Regional Standard | Multi-provider (3 provider) |
| Singapore → Los Angeles | Global Standard | Rute trans-Pasifik |
| Kendari → Sydney | Regional Standard | Butuh persetujuan manual Delta |

---

## 3. Menyetujui order sebagai pemilik kabel (Delta)

1. Logout → login `delta@demo.local`.
2. Menu **Cable Owners** → bagian **Sub-order inbox**.
3. Pada baris berstatus `PENDING`: isi catatan (opsional), klik **Accept** (atau **Reject** dengan alasan → order otomatis dibatalkan, kapasitas dilepas, pembayaran simulasi dikembalikan).
4. Batas waktu respons 10 menit; lewat dari itu order otomatis `FAILED` (tidak akan menggantung).

---

## 4. Simulasi gangguan (akun NOC)

1. Login `noc@demo.local` → menu **Simulation Lab**.
2. Klik **Pause auto-tick** agar demo terkendali.
3. Di tabel **Scenarios**, klik **Run** pada **Fiber cut Jakarta–Makassar**.
4. Klik tautan **Open incident …** → timeline menampilkan `FAULT INJECTED → PROTECTION SWITCH / SERVICE DOWN → ALARM RAISED → MITIGATED`.
5. Menu **Network Topology** → pilih layanan di **Show service path** → klik **Indonesia** untuk zoom; segmen putus bertanda ✕ merah.
6. Kembali ke **Simulation Lab** → **+10** (maju 10 menit simulasi) → lihat **SLA & Monitoring**.
7. Pulihkan: **Restore all faults** → **+10** → insiden menjadi `RESOLVED`.
8. Ulang dari awal: **Reset simulation** (order & layanan tetap ada). Admin juga punya **Full demo reset (re-seed)** yang menghapus semua data demo.

Skenario lain yang berguna: **Latency above SLA Jakarta–Makassar** (memicu pelanggaran SLA pada layanan Jakarta–Makassar), **Provisioning failure (Alpha)** (jalankan *sebelum* customer membayar — order akan gagal dan di-rollback), **Correlated failures — Sulawesi event**.

---

## 5. Menu lain

| Menu | Untuk |
|---|---|
| **Orders** | Daftar order & status; klik ID untuk timeline lengkap |
| **Services** | Inventori layanan, jalur aktif (PRIMARY/PROTECTION/REROUTE) |
| **Provisioning** | Detail tiap langkah workflow (percobaan, error, idempotency key) |
| **Alarms & Incidents** | Alarm aktif, insiden & dampaknya |
| **Revenue & Settlement** | Ledger simulasi; fee platform 10 % = konfigurasi DEMO |
| **Audit Logs** | Siapa melakukan apa, termasuk akses yang ditolak |
| **Settings** | Parameter platform, profil SLA, status integrasi (semua MOCK/SIMULATED) |

---

## 6. Troubleshooting — "tidak bisa order"

Saat gagal, aplikasi menampilkan kotak merah berisi **KODE: pesan**. Cocokkan dengan tabel ini.

| # | Gejala | Penyebab paling mungkin | Perbaikan |
|---|---|---|---|
| 1 | Tidak ada menu **Marketplace** | Login bukan sebagai Customer | Login `customer.a@demo.local` |
| 2 | Setelah login terlempar lagi ke halaman login, atau semua aksi `UNAUTHENTICATED`, atau muncul pesan "browser tidak menyimpan cookie sesi" | `COOKIE_SECURE=true` tetapi situs dibuka lewat `http://`, atau SSL subdomain belum aktif | Pasang SSL (cPanel → SSL/TLS Status → AutoSSL) dan buka via `https://`. Pastikan `TRUST_PROXY=true`. Untuk uji sementara tanpa SSL: `COOKIE_SECURE=false`, lalu Restart app |
| 3 | `CROSS_ORIGIN: Cross-origin request rejected` | Proxy cPanel mengubah header Host (versi sebelum perbaikan 22 Okt 2026) | Pasang bundle terbaru |
| 4 | `INVALID_CREDENTIALS` | Password ≠ `DEMO_PASSWORD` di cPanel, atau env belum terbaca | Cek variabel di Setup Node.js App → **Restart** |
| 5 | `RATE_LIMITED` saat login | >10 percobaan login/menit dari IP yang sama | Tunggu 1 menit |
| 6 | Order berhenti lama di `PROVIDER ACCEPTANCE` | Provider Delta (manual) atau skenario *Provider API timeout* sedang aktif | Accept sebagai Delta, atau **Restore all faults** di Simulation Lab |
| 7 | Order `FAILED` dengan `PROVISIONING_FAILED` / `PROVIDER_API_TIMEOUT` | Skenario gangguan masih aktif | Simulation Lab → **Restore all faults**, lalu pesan ulang |
| 8 | Order `FAILED` dengan `ROUTE_NO_LONGER_FEASIBLE` | Kapasitas habis/segmen putus antara quote dan bayar | Restore fault / pesan ulang dengan rute lain |
| 9 | Halaman 503 / "Incomplete response" / app sering restart | Proses Node kehabisan memori (±450 MB dengan database PGlite) | Cek batas memori paket hosting; lihat `DEPLOY.md` opsi VPS/PostgreSQL |
| 10 | Status order tidak bergerak sama sekali setelah bayar | Proses latar belakang tidak berjalan (proses dihentikan hosting saat idle) | Refresh halaman (membangunkan app); cek log di cPanel → Setup Node.js App → log file |

Jika masih gagal, kirimkan: (1) teks kotak merah persis, (2) isi `/api/health`, (3) langkah terakhir yang diklik.
