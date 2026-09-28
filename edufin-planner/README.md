# EduFin Planner

Perencana biaya pendidikan keluarga berbasis data — dari sekolah saat ini sampai lulus kuliah, terhubung ke arus kas, dana pensiun, dan net worth keluarga. Aplikasi dibangun untuk menjawab satu pertanyaan:

> *Dengan kondisi keuangan saya sekarang, sekolah mana yang dapat saya pilih tanpa merusak kesehatan keuangan keluarga dan target pensiun saya?*

Alurnya: **School Cost → Future Cost → Cash Flow → Funding Gap → Required Investment → Financial Decision.** Setiap angka punya tombol **"Cara hitung"** yang membuka Input, Formula, Assumption, dan Result.

> **Disclaimer (tampil di setiap halaman).** Aplikasi ini memberikan estimasi perencanaan keuangan dan analisis biaya pendidikan, bukan pengganti nasihat keuangan, pajak, hukum, atau investasi yang dipersonalisasi. Return investasi adalah asumsi, bukan jaminan. Biaya sekolah dapat berubah dan biaya aktual dapat berbeda dari proyeksi. EduFin Planner tidak disertifikasi atau disahkan oleh CFA Institute maupun lembaga sertifikasi perencana keuangan mana pun.

## Status

| Fase | Fitur | Status |
|---|---|---|
| Phase 1 — MVP | 1 Family profile · 2 Children · 3 School database · 4 School fee database · 5 Education inflation · 6 Education cost calculator · 7 Funding gap · 8 Monthly saving calculator · 9 School comparison · 10 Dashboard | Dibangun |
| Phase 2 | 11 Investment projection · 12 Scenario analysis · 13 Retirement trade-off · 14 Net worth · 15 Risk profiling | Dibangun |
| Phase 3 | 16 AI Financial Copilot · 17 School database marketplace · 18 Advisor dashboard · 19 Automated data verification · 20 API/data integration | **Belum dibangun** (sesuai prioritas MVP) |

Termasuk juga: onboarding wizard, admin dashboard (CRUD sekolah, import CSV, verifikasi, arsip data usang, master data, asumsi inflasi), laporan 17 bagian (PDF, Excel dengan formula, CSV), heatmap biaya multi-anak, sensitivity heatmap 5×5, mode gelap, dan navigasi mobile (bottom nav + FAB).

## Keterbatasan — baca dulu

1. **Data biaya belum lengkap dan harus dikonfirmasi ke sekolah.**
   - Database berisi 49 institusi di Kota Depok (24), Kabupaten Bogor (15), dan Kota Bogor (10). Ada 193 jadwal biaya: 80 *Verified*, 83 *Partially Verified*, 30 *Outdated*.
   - 68 jadwal bersumber dari media atau blog, bukan dokumen resmi sekolah.
   - Belum ada data biaya sekolah **negeri** tingkat SD–SMA. Asumsinya bebas SPP; lihat catatan kebijakan di bawah.
   - Universitas Pakuan dan Universitas Tazkia belum punya data biaya.
   - 13 jadwal ditandai *incomplete*, dan aplikasi memberi alert untuk itu.
2. **Asumsi inflasi default bersumber dari sampel kecil.** [Medium confidence]
   - Inflasi sekolah swasta 7% didasarkan pada median CAGR SPP 5,3%/tahun, ditambah margin. Median itu dihitung dari hanya 8 sekolah dengan sumber campuran.
   - Inflasi sekolah internasional 8% murni asumsi, karena belum ada data multi-tahun.
   - Pakai data historis sekolah spesifik bila ada. Aplikasi memberi alert bila histori sekolah melebihi asumsi.
3. **Sinkronisasi Supabase belum diuji ke proyek Supabase sungguhan.**
   - Yang sudah diuji: skema, RLS, dan seed SQL di PostgreSQL 16 lokal (lihat [Pengujian](#pengujian)), serta mapping data dua arah lewat unit test.
   - Panggilan `supabase-js` (login Email/Google, push/pull) belum pernah dijalankan ke server nyata.
4. **Batas model.**
   - Return deterministik, tanpa Monte Carlo.
   - Pajak atas hasil investasi, beasiswa, dan uang pangkal saat pindah sekolah di tengah jenjang tidak dimodelkan.
   - Setoran tetap (level) ditentukan oleh pembayaran tersulit, sehingga tahun-tahun berikutnya bisa berlebih dana. Hitung ulang rencana setiap tahun.
5. **Ambang affordability hanya heuristik.** Batas 10/20/30/40% bisa diubah di Asumsi dan bukan standar resmi.
6. **Skor tidak menilai mutu akademik.** Affordability Score hanya mengukur keterjangkauan finansial.

## Menjalankan

Butuh Node.js ≥ 20.9.

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # static export ke out/
npm run check        # typecheck + lint + unit test
npm run smoke        # uji end-to-end Chromium terhadap out/ (jalankan build dulu)
```

- `npm run smoke` memakai `playwright-core` tanpa mengunduh browser. Bila Chromium bawaan Playwright tidak terpasang, arahkan ke browser yang ada, misalnya `CHROMIUM_PATH=/usr/bin/chromium npm run smoke`.
- Screenshot uji disimpan di `test-results/smoke/`.

Tanpa variabel lingkungan, aplikasi berjalan dalam **mode lokal**: data keluarga tersimpan di `localStorage` browser, dan perubahan admin menjadi lapisan di atas database riset bawaan. Tombol **"Coba dengan keluarga contoh"** memuat keluarga fiktif; datanya bukan data pribadi siapa pun.

## Arsitektur

```
src/
  app/                 rute App Router (static export, trailingSlash)
  components/          UI: AppShell, charts (Recharts), heatmaps, Explain, forms, pages/*
  lib/
    engine/            mesin perhitungan murni (tanpa React), diuji dengan Vitest
      tvm.ts             FV, PV, anuitas, CAGR, return riil (Fisher)
      inflation.ts       inflasi per komponen + statistik historis (YoY, CAGR 3/5 th, median, min, max)
      educationPath.ts   jalur pendidikan per anak (tahun ajaran, jenjang, kelas, usia)
      costs.ts           komponen biaya A–D, tier, jadwal, benchmark, proyeksi per tahun ajaran
      funding.ts         simulasi dana pendidikan, setoran minimum, funding gap
      cashflow.ts        arus kas rumah tangga bulanan ≥ 30 tahun + analisis pensiun
      plan.ts            menyatukan semuanya → PlanResult (dipakai semua halaman)
      analysis.ts        skenario A–F, sensitivitas, biaya menunda, trade-off, perbandingan, rekomendasi A/B/C
      alerts.ts, affordability.ts, risk.ts
    data/              seed database sekolah (hasil scripts/build-seed.mjs) + referensi makro
    export/            pdf.ts (jsPDF), excel.ts (ExcelJS, dengan formula hidup)
    supabase/          client, auth, mapping baris ↔ domain, sync
    store.ts           zustand + persist (localStorage)
data/research/*.json   catatan riset mentah dengan provenance (sumber data seed)
supabase/              migrasi Postgres + RLS, seed.sql, tes RLS
scripts/               build-seed, generate-seed-sql, smoke
```

Database efektif = **seed bawaan ⊕ data cloud (bila login) ⊕ lapisan lokal**. Data asli tidak pernah ditimpa. Pengguna non-admin yang mengubah jadwal bersumber membuat salinan dengan provenance kosong ("Salin & ubah"), sehingga sumber tidak salah atribusi.

## Mesin perhitungan

Semua rumus bisa dibuka lewat "Cara hitung". Konvensi utama:

- **Tahun ajaran (TA)** dimulai Juli dan diberi nama menurut tahun mulainya (TA 2026 = 2026/2027). Usia masuk SD dihitung per 1 Juli (default 6 tahun). Durasi jenjang: TK 2, SD 6, SMP 3, SMA/SMK 3, D3 3, S1 4, S2 2 tahun.
- **Biaya masa depan per komponen**: `Future = Current × (1 + i)^n`, dengan `n = TA − tahun data sumber`.
  - `i` dipilih per komponen: tarif jenis sekolah (swasta, internasional, perguruan tinggi), inflasi pendidikan, atau inflasi umum.
  - Biaya sekali bayar hanya dihitung saat masuk jenjang.
  - Komponen berbatas kelas (`fromGrade`/`toGrade`) hanya berlaku di kelas tersebut.
  - Tier yang saling eksklusif (mis. biaya putra/putri) dipilih berurutan: pilihan pengguna → gender anak → default → nilai tertinggi.
- **Pembayaran**:
  - Biaya TA berjalan dibayar dari arus kas secara pro-rata untuk sisa bulan.
  - Biaya TA berikutnya ditarik dari dana pendidikan setiap Juli.
  - Imbal hasil dimajemukkan bulanan: `r_m = (1 + r)^(1/12) − 1`.
- **Setoran minimum** (tanpa kekurangan dana) dihitung dalam dua tahap.
  1. Pembayaran sebelum setoran pertama hanya bisa memakai dana saat ini. Sisanya menjadi kebutuhan tunai (`unreachableShortfall`) dan **tidak** dibebankan lagi ke setoran.
  2. Untuk pembayaran berikutnya: `C = max_k (L_k − A_k) / S_k`.
     - `L_k` = nilai masa depan kumulatif pembayaran sampai k.
     - `A_k` = sisa dana tahap 1 yang terus bertumbuh.
     - `S_k` = nilai masa depan satu unit setoran (dengan step-up bila ada) sampai k.

  Metode PV (satu kendala di pembayaran terakhir) ditampilkan sebagai pembanding dan selalu ≤ angka strict. Setoran yang naik tiap tahun (step-up) didukung. Bila rencana memakai setoran tetap, aplikasi menampilkan ilustrasi step-up 5%/tahun; angka 5% ini asumsi, bukan proyeksi gaji.
- **Identitas funding gap**: `Kebutuhan = tertutup dana saat ini + tertutup setoran + gap`. Status 🟢 Fully Funded / 🟡 Partially Funded (funded ratio ≥ 75%) / 🔴 Funding Gap.
- **Invarian nilai kini** (diuji otomatis): `dana saat ini + PV(setoran) + PV(tunai kekurangan) − PV(sisa akhir) = PV(kebutuhan)`, untuk tanggal mulai berapa pun. Karena itu, biaya nyata menunda menabung adalah beban bulanan yang lebih tinggi dan kebutuhan tunai di depan.
- **Arus kas terintegrasi** dihitung bulanan dan diringkas per TA.
  - `Δportofolio = FCF + imbal hasil − penarikan pendidikan + defisit tak terdanai`.
  - Defisit ditutup berurutan dari kas → investasi umum → dana pensiun → dana pendidikan. Sisanya dicatat sebagai *unfunded* dan diberi flag.
- **Pensiun**:
  - Kebutuhan dana dihitung sebagai anuitas tumbuh yang dibayar di awal periode (*growing annuity-due*), sampai usia harapan hidup.
  - Kesiapan = dana tersedia / kebutuhan. Usia saat dana habis juga dilacak.
- **Affordability Score (0–100)** = `0,4 × S_rasio + 0,4 × S_beban + 0,2 × S_funding`.
  - `S_rasio` dari rasio puncak biaya pendidikan / pendapatan (ambang 10/20/30/40%).
  - `S_beban` dari kebutuhan investasi dibanding kapasitas menabung.
  - `S_funding` dari funded ratio.
- **Profil risiko**: 8 pertanyaan menilai kemampuan (*ability*) dan kesediaan (*willingness*) menanggung risiko. Profil yang dipakai adalah yang lebih konservatif, dan hanya sebagai parameter analisis, bukan rekomendasi produk.
- **Return riil (Fisher)**: `(1 + nominal) / (1 + inflasi) − 1`.

## Data biaya sekolah & provenance

**Aturan:** tidak ada angka tanpa sumber. Setiap jadwal biaya membawa field berikut:

| Field | Isi |
|---|---|
| `source` | Nama sumber |
| `sourceUrl` | Tautan sumber |
| `sourceType` | Jenis sumber, mis. `official_brochure_pdf`, `news_media` |
| `academicYear` | Tahun ajaran; bila hasil inferensi, ditandai `academicYearInferred` |
| `accessedDate` | Tanggal akses / terakhir diperiksa |
| `verificationStatus` | Salah satu status di bawah |
| `confidence` | `high` / `medium` / `low` |
| `evidence` | Cara bukti diambil: `curl_verbatim` / `webfetch_summary` / `search_snippet_only` / `manual` |

Status verifikasi:

- **Verified**: dokumen resmi dengan URL.
- **Partially Verified**
- **User Submitted**
- **Estimated**
- **Outdated**: TA lama, ditandai saat riset. Jadwal yang umurnya ≥ batas usia data (default 12 bulan) juga memicu alert "data usang".

Estimasi selalu dilabeli, tidak pernah dicampur dengan data aktual tanpa label. Contohnya benchmark median yang dipakai saat anak belum punya sekolah target, dan komponen yang frekuensinya disimpulkan. Komponen yang tidak disebut sumber tampil "tidak tercantum", bukan Rp0.

- **Membangun ulang seed**: `npm run build:seed` membaca `data/research/{depok,bogor,universities,macro}.json`, lalu menulis `src/lib/data/schools.seed.json` dan `references.json`. Tidak ada scraping. Setiap angka berasal dari catatan riset yang menyimpan URL dan kutipan buktinya.
- **Import CSV** (Admin → Import CSV).
  - Kolom wajib: `school_id, school_name, city, province, level, academic_year, entry_fee, monthly_tuition, annual_fee, transport_fee, meal_fee, book_fee, activity_fee, source, source_date, verification_status`.
  - Kolom opsional tercantum di template.
  - Baris tanpa `source` ditolak, dan status `verified` wajib `source_url`.
  - Baris dengan school_id + jenjang + TA (+ program) yang sama meng-update jadwal yang ada.

### Referensi makro & kebijakan (per riset 27 Sep 2026)

Semua butir di bawah perlu diverifikasi ulang secara live karena bisa sudah berubah. Detail sumber dan celah riset ada di `src/lib/data/references.json` (`gaps`).

- **Inflasi IHK nasional** Desember-yoy 2019–2025 rata-rata 2,70% (Bank Indonesia). Inflasi kelompok Pendidikan BPS 1,2–2,8% per tahun (dikutip media). Angka BPS ini didominasi sekolah negeri, jadi tidak mewakili kenaikan biaya sekolah swasta.
- **Pembanding return**:
  - BI-Rate 5,75% (23 Sep 2026).
  - Yield SBN 10 tahun 7,08%. Sumbernya agregator Trading Economics, bukan sumber primer.
  - Tingkat penjaminan LPS 3,75% berlaku untuk periode 1 Jul–30 Sep 2026. **Tarif mulai 1 Okt 2026 belum diperoleh.**
- **Kebijakan sekolah negeri**:
  - SMA/SMK negeri Jawa Barat tidak memungut SPP sejak TA 2025/2026. Nomor Surat Edaran Gubernur berbeda antar-sumber.
  - SD/SMP negeri dilarang memungut biaya satuan pendidikan.
  - Putusan MK 3/PUU-XXII/2024 mewajibkan pendidikan dasar tanpa biaya, termasuk di sekolah swasta. Belum ada laporan resmi pelaksanaannya; pemohon (JPPI, Mei 2026) menyatakan putusan itu belum dilaksanakan.

## Asumsi default

Semua bisa diubah di Asumsi & Settings atau Admin → Asumsi inflasi.

| Parameter | Default |
|---|---|
| Inflasi umum / pendidikan / sekolah swasta / internasional / perguruan tinggi | 3,5% / 6% / 7% / 8% / 5% |
| Return dana pendidikan / pensiun (sebelum · setelah pensiun) / investasi umum / kas | 8% / 8% · 6% / 7% / 3% |
| Skenario menabung (conservative / base / optimistic) | 5% / 8% / 11% |
| Ambang rasio biaya pendidikan / pendapatan | 10 / 20 / 30 / 40% |
| Dana darurat · usia harapan hidup · rasio pengeluaran saat pensiun | 6 bulan · 80 · 70% |
| Horizon proyeksi · batas usia data | 30 tahun · 12 bulan |

Skenario bawaan:

- **A**: base case (asumsi rencana).
- **B**: inflasi pendidikan 10%.
- **C**: return 5%.
- **D**: pendapatan −20%.
- **E**: biaya sekolah +30%.
- **F**: setoran mulai 3 tahun lagi.

## Supabase (opsional: login Email + Google dan sinkronisasi)

1. Buat proyek Supabase, lalu jalankan migrasi berurutan, baik lewat `supabase db push` maupun SQL Editor:
   - `supabase/migrations/20260927000000_init.sql`: tabel, enum, trigger audit `data_change_log`, dan constraint provenance (status *verified* wajib `source_url`, `source` tidak boleh kosong).
   - `supabase/migrations/20260927000100_rls.sql`: Row Level Security. Data keluarga hanya bisa diakses pemiliknya; data sekolah bisa dibaca semua orang, tetapi hanya admin yang boleh menulis.
2. Isi data referensi: `npm run seed:sql` (menulis ulang `supabase/seed.sql` dari seed JSON), lalu jalankan file itu.
3. **Auth**:
   - Aktifkan provider Email dan Google (Client ID/Secret dari Google Cloud Console).
   - Tambahkan URL situs dan `https://<domain>/<base-path>/auth/callback/` ke *Redirect URLs*.
4. **Env saat build** (lihat `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Anon key memang publik; keamanan data ditegakkan oleh RLS.
   - `NEXT_PUBLIC_BASE_PATH` bila aplikasi dipasang di sub-path.
5. **Jadikan admin**: `update public.users set role = 'admin' where email = '<email>';`

**Uji skema & RLS di PostgreSQL biasa (tanpa Supabase).** `supabase/tests/rls_test.sql` menguji:
- anon hanya bisa membaca data referensi;
- data keluarga privat per pemilik, termasuk penolakan insert lintas-keluarga;
- pengguna hanya bisa mengirim data berstatus *user_submitted* dan tidak bisa mengubah data riset;
- tidak ada eskalasi role;
- admin bisa memverifikasi; status *verified* wajib URL; perubahan tercatat di audit log.

`supabase/tests/local_auth_stub.sql` menyediakan skema `auth` dan role tiruan. **Jangan** jalankan stub ini di proyek Supabase.

```bash
createdb edufin_test
psql -d edufin_test -f supabase/tests/local_auth_stub.sql
psql -d edufin_test -f supabase/migrations/20260927000000_init.sql
psql -d edufin_test -f supabase/migrations/20260927000100_rls.sql
psql -d edufin_test -f supabase/seed.sql
psql -d edufin_test -f supabase/tests/rls_test.sql   # berakhir dengan "ALL RLS TESTS PASSED"
```

## Deploy

`npm run build` menghasilkan situs statis di `out/`, yang bisa dipasang di cPanel, Netlify, Cloudflare Pages, atau Vercel.

- Untuk sub-path, set `NEXT_PUBLIC_BASE_PATH=/edufin` sebelum build.
- Server statis perlu mengarahkan halaman tak dikenal ke `404.html`. Di cPanel/Apache: `ErrorDocument 404 /edufin/404.html` di `.htaccess`.

> ⚠️ **Perhatian untuk repo ini.** `.github/workflows/deploy.yml` menyinkronkan **seluruh isi repo** ke root cPanel (`server-dir: /`) setiap push ke `main`, tanpa langkah build.
> - Bila folder ini di-merge ke `main`, yang ter-upload adalah **kode sumber** `edufin-planner/`, bukan aplikasi hasil build.
> - Sebelum merge, pilih salah satu:
>   - tambahkan `exclude` untuk `edufin-planner/**`, atau
>   - tambahkan langkah build (`npm ci && npm run build` di folder ini) yang meng-upload `edufin-planner/out/` ke sub-path.

## Pengujian

- **Unit test** (`npm test`, Vitest, 80 test) mencakup:
  - rumus TVM terhadap nilai hitung tangan;
  - setoran minimum: minimal, tanpa kekurangan, delay, step-up, dan invarian PV;
  - identitas funding gap;
  - arus kas: rekonsiliasi Δportofolio;
  - jalur pendidikan, tier, dan komponen berbatas kelas;
  - skenario, sensitivitas, perbandingan, dan rekomendasi;
  - audit seed: tidak ada tier ganda terhitung, dan jadwal lengkap dipilih lebih dulu;
  - validasi CSV;
  - mapping Supabase dua arah.
- **End-to-end** (`npm run smoke`) menjalankan 27 rute di desktop 1440×900 dan mobile 390×844, dan memeriksa:
  - sheet "Cara hitung", bottom nav, dan FAB;
  - import CSV (1 baris valid, 2 ditolak);
  - laporan 17 bagian, PDF valid, Excel dengan formula, dan tiga CSV;
  - tidak ada error konsol, request gagal, atau overflow horizontal di mobile.
- **Skema database**: urutan perintah di atas lulus di PostgreSQL 16 lokal pada database baru. Belum diuji ke proyek Supabase sungguhan.
- **Reproduksibilitas seed**: `npm run build:seed` dan `npm run seed:sql` menghasilkan file yang identik byte per byte dengan yang di-commit.
