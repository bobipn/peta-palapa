// Scene script for the three cuts. `vo` = what the narrator says (on-paper form),
// `say` = TTS text (numbers spelled out so the synthetic guide voice reads them correctly).
// `view` = renderer scene; `lvl` 1 cinematic / 2 infographic / 3 commercial UI.
// Every price/metric referenced here exists in facts.js (transcribed from the PPT).
const MAIN = [
  // ---------- ACT 1 — WHY CONNECTIVITY MATTERS ----------
  { id: 'M01', act: 'ACT 1 — Why Connectivity Matters', lvl: 1, view: 'plate:earth', title: '',
    vo: 'Di era digital, konektivitas bukan lagi sekadar infrastruktur. Konektivitas menjadi fondasi bagi bisnis, layanan publik, dan pertumbuhan ekonomi.',
    say: 'Di era digital, konektivitas bukan lagi sekadar infrastruktur. Konektivitas menjadi fondasi bagi bisnis, layanan publik, dan pertumbuhan ekonomi.' },
  { id: 'M02', act: 'ACT 1 — Why Connectivity Matters', lvl: 2, view: 'map:traffic',
    vo: 'Di wilayah kepulauan, laut dan jarak menjadi tantangan. Bagaimana bisnis mendapatkan konektivitas yang andal, dapat ditingkatkan, dan sesuai kebutuhan?',
    say: 'Di wilayah kepulauan, laut dan jarak menjadi tantangan. Bagaimana bisnis mendapatkan konektivitas yang andal, dapat ditingkatkan, dan sesuai kebutuhan?' },
  // ---------- ACT 2 — INTRODUCING PALAPA RING TENGAH ----------
  { id: 'M03', act: 'ACT 2 — Introducing Palapa Ring Tengah', lvl: 1, view: 'plate:region',
    vo: 'Inilah Palapa Ring Paket Tengah, dibangun, dikelola, dan dipasarkan oleh PT Len Telekomunikasi Indonesia, Badan Usaha Pelaksana yang ditunjuk Pemerintah melalui Kemkominfo.',
    say: 'Inilah Palapa Ring Paket Tengah, dibangun, dikelola, dan dipasarkan oleh PT Len Telekomunikasi Indonesia, Badan Usaha Pelaksana yang ditunjuk Pemerintah melalui Kemkominfo.' },
  { id: 'M04', act: 'ACT 2 — Introducing Palapa Ring Tengah', lvl: 2, view: 'metrics',
    vo: 'Beroperasi sejak 21 Desember 2018: 6 proyek, 17 kabupaten, dan ±3.102 kilometer kabel, yaitu ±1.304 kilometer darat dan ±1.798 kilometer laut, dengan 17 kota layanan dan 10 kota interkoneksi.',
    say: 'Beroperasi sejak dua puluh satu Desember dua ribu delapan belas: enam proyek, tujuh belas kabupaten, dan sekitar tiga ribu seratus dua kilometer kabel, yaitu seribu tiga ratus empat kilometer darat dan seribu tujuh ratus sembilan puluh delapan kilometer laut, dengan tujuh belas kota layanan dan sepuluh kota interkoneksi.' },
  { id: 'M05', act: 'ACT 2 — Introducing Palapa Ring Tengah', lvl: 1, view: 'plate:cutaway',
    vo: 'Menggunakan teknologi DWDM terkini, dengan kapasitas 100 Gbps yang dapat ditingkatkan pada setiap proyek.',
    say: 'Menggunakan teknologi DWDM terkini, dengan kapasitas seratus gigabit per detik yang dapat ditingkatkan pada setiap proyek.' },
  { id: 'M06', act: 'ACT 2 — Introducing Palapa Ring Tengah', lvl: 2, view: 'projects',
    vo: 'Enam proyek terbentang dari Long Bagun di Kalimantan Timur, melintasi Sulawesi Tengah dan Tenggara, hingga Sulawesi Utara dan Kepulauan Maluku Utara.',
    say: 'Enam proyek terbentang dari Long Bagun di Kalimantan Timur, melintasi Sulawesi Tengah dan Tenggara, hingga Sulawesi Utara dan Kepulauan Maluku Utara.' },
  { id: 'M07', act: 'ACT 2 — Introducing Palapa Ring Tengah', lvl: 2, view: 'segments',
    vo: 'Dengan skema B2B, jaringan ini melayani penyelenggara telekomunikasi dan ISP, serta membuka peluang bagi industri, BUMDes, layanan publik, dan masyarakat.',
    say: 'Dengan skema bisnis ke bisnis, jaringan ini melayani penyelenggara telekomunikasi dan I S P, serta membuka peluang bagi industri, BUMDes, layanan publik, dan masyarakat.' },
  // ---------- ACT 3 — FROM NETWORK TO PRODUCT ----------
  { id: 'M08', act: 'ACT 3 — From Network to Product', lvl: 2, view: 'portfolio',
    vo: 'Apa yang bisa diperoleh bisnis Anda dari jaringan ini? Empat layanan: Sewa Kapasitas, Sewa Core, Kolokasi, dan Pay Per Use.',
    say: 'Apa yang bisa diperoleh bisnis Anda dari jaringan ini? Empat layanan: Sewa Kapasitas, Sewa Core, Kolokasi, dan Pay Per Use.' },
  // ---------- ACT 4/5 — DEEP DIVE + PRICING: 1. SEWA KAPASITAS ----------
  { id: 'M09', act: 'ACT 4 — Sewa Kapasitas (Bandwidth)', lvl: 2, view: 'product:bw',
    vo: 'Sewa Kapasitas: kapasitas dedicated yang terjamin, dengan port 1G, 10G, STM-4, dan STM-16.',
    say: 'Sewa Kapasitas: kapasitas dedicated yang terjamin, dengan port satu G, sepuluh G, S T M empat, dan S T M enam belas.' },
  { id: 'M10', act: 'ACT 5 — Pricing: Sewa Kapasitas', lvl: 3, view: 'price:bw',
    vo: 'Tarif ditetapkan per bulan, per proyek. Kapasitas 1G mulai dari Rp7 juta per bulan, dan kapasitas 10G mulai dari Rp56 juta per bulan.',
    say: 'Tarif ditetapkan per bulan, per proyek. Kapasitas satu G mulai dari tujuh juta rupiah per bulan, dan kapasitas sepuluh G mulai dari lima puluh enam juta rupiah per bulan.' },
  { id: 'M11', act: 'ACT 5 — Pricing: Paket 6 Proyek', lvl: 3, view: 'price:bundle',
    vo: 'Untuk seluruh jaringan, pembelian 6 proyek sekaligus: Rp90,4 juta per bulan untuk 1G, dan Rp723 juta untuk 10G.',
    say: 'Untuk seluruh jaringan, pembelian enam proyek sekaligus: sembilan puluh koma empat juta rupiah per bulan untuk satu G, dan tujuh ratus dua puluh tiga juta rupiah untuk sepuluh G.' },
  // ---------- 2. SEWA CORE (DARKFIBER) ----------
  { id: 'M12', act: 'ACT 4 — Sewa Core (Darkfiber)', lvl: 2, view: 'product:df',
    vo: 'Ingin mengelola jaringan sendiri? Sewa Core memberi akses jaringan pasif: 22 core atau 11 pair per proyek, disewa per proyek, per segmen, atau per titik akses. Kapasitasnya tidak terbatas, dengan perangkat aktif milik Anda.',
    say: 'Ingin mengelola jaringan sendiri? Sewa Core memberi akses jaringan pasif: dua puluh dua core atau sebelas pair per proyek, disewa per proyek, per segmen, atau per titik akses. Kapasitasnya tidak terbatas, dengan perangkat aktif milik Anda.' },
  { id: 'M13', act: 'ACT 5 — Pricing: Sewa Core', lvl: 3, view: 'price:df',
    vo: 'Tarif dark fiber backbone: Rp12 juta per kilometer per tahun untuk darat, dan Rp36 juta untuk laut. Contoh: segmen Sendawar – Long Bagun, Rp2,30 miliar per tahun.',
    say: 'Tarif dark fiber backbone: dua belas juta rupiah per kilometer per tahun untuk darat, dan tiga puluh enam juta untuk laut. Contoh: segmen Sendawar ke Long Bagun, dua koma tiga miliar rupiah per tahun.' },
  { id: 'M14', act: 'ACT 5 — Pricing: Dark Fiber Akses', lvl: 3, view: 'price:dfaccess',
    vo: 'Untuk akses, tarif dihitung proporsional berdasarkan jarak antara NOC atau TS, dengan pengali 2,5 kali hingga 1 kali harga per kilometer.',
    say: 'Untuk akses, tarif dihitung proporsional berdasarkan jarak antara NOC atau T S, dengan pengali dua setengah kali hingga satu kali harga per kilometer.' },
  // ---------- 3. PPU ----------
  { id: 'M15', act: 'ACT 4 — PPU (Pay Per Use)', lvl: 2, view: 'product:ppu',
    vo: 'Butuh fleksibilitas? Pay Per Use menghitung trafik berdasarkan penggunaan: minimum 2,5G, dihitung pada puncak trafik bulan tersebut, dari data pengukuran perangkat Pay Per Use BAKTI.',
    say: 'Butuh fleksibilitas? Pay Per Use menghitung trafik berdasarkan penggunaan: minimum dua koma lima G, dihitung pada puncak trafik bulan tersebut, dari data pengukuran perangkat Pay Per Use BAKTI.' },
  { id: 'M16', act: 'ACT 5 — Pricing: PPU', lvl: 3, view: 'price:ppu',
    vo: 'Tagihan mengikuti utilisasi: dari 25 persen tarif normal 10G, hingga 100 persen pada 9 sampai 10 Gbps. Di Proyek 8B, mulai Rp14 juta per bulan.',
    say: 'Tagihan mengikuti utilisasi: dari dua puluh lima persen tarif normal sepuluh G, hingga seratus persen pada sembilan sampai sepuluh gigabit. Di Proyek delapan B, mulai empat belas juta rupiah per bulan.' },
  // ---------- 4. KOLOKASI ----------
  { id: 'M17', act: 'ACT 4 — Kolokasi Perangkat Aktif Pelanggan', lvl: 2, view: 'product:colo',
    vo: 'Untuk aktivasi, tempatkan perangkat Anda di site kami. Pelanggan kapasitas mendapat ruang 1U dan daya setara 10A DC atau 2A AC tanpa biaya. Pelanggan dark fiber mendapat 1U tanpa biaya untuk perangkat pasif.',
    say: 'Untuk aktivasi, tempatkan perangkat Anda di site kami. Pelanggan kapasitas mendapat ruang satu U dan daya setara sepuluh ampere D C atau dua ampere A C tanpa biaya. Pelanggan dark fiber mendapat satu U tanpa biaya untuk perangkat pasif.' },
  { id: 'M18', act: 'ACT 5 — Pricing: Kolokasi', lvl: 3, view: 'price:colo',
    vo: 'Kebutuhan tambahan tersedia dengan biaya acuan bulanan: mulai Rp1 juta untuk 1U, hingga Rp16,85 juta untuk full rack. Tersedia juga lahan terbuka dan ruang pada menara.',
    say: 'Kebutuhan tambahan tersedia dengan biaya acuan bulanan: mulai satu juta rupiah untuk satu U, hingga enam belas koma delapan lima juta rupiah untuk full rack. Tersedia juga lahan terbuka dan ruang pada menara.' },
  { id: 'M19', act: 'ACT 5 — Pricing: Formula Kolokasi', lvl: 3, view: 'price:coloformula',
    vo: 'Rumusnya: biaya acuan, kali koefisien hardship proyek, kali jumlah layanan. Contoh: tambahan 2U di Sendawar, Proyek 4: Rp1,8 juta per bulan.',
    say: 'Rumusnya: biaya acuan, kali koefisien hardship proyek, kali jumlah layanan. Contoh: tambahan dua U di Sendawar, Proyek empat: satu koma delapan juta rupiah per bulan.' },
  // ---------- ACT 6 — BUNDLE ----------
  { id: 'M20', act: 'ACT 6 — Product Bundle', lvl: 2, view: 'bundle',
    vo: 'Hasilnya, satu paket konektivitas yang utuh: kapasitas dedicated, ruang dan daya aktivasi tanpa biaya, serta interkoneksi langsung dengan jaringan Palapa Ring.',
    say: 'Hasilnya, satu paket konektivitas yang utuh: kapasitas dedicated, ruang dan daya aktivasi tanpa biaya, serta interkoneksi langsung dengan jaringan Palapa Ring.' },
  // ---------- ACT 7/8 — SUBSCRIPTION & COMMERCIAL JOURNEY ----------
  { id: 'M21', act: 'ACT 7 — How to Subscribe', lvl: 3, view: 'journey',
    vo: 'Cara berlangganan: hubungi tim komersial kami, tentukan layanan dan lokasi, terima penawaran, lakukan aktivasi di NOC Palapa Ring, dan layanan berjalan.',
    say: 'Cara berlangganan: hubungi tim komersial kami, tentukan layanan dan lokasi, terima penawaran, lakukan aktivasi di NOC Palapa Ring, dan layanan berjalan.' },
  { id: 'M22', act: 'ACT 8 — Commercial Journey', lvl: 3, view: 'billing',
    vo: 'Kapasitas, Pay Per Use, dan kolokasi bertarif bulanan. Dark fiber bertarif tahunan. Syarat dan ketentuan berlaku.',
    say: 'Kapasitas, Pay Per Use, dan kolokasi bertarif bulanan. Dark fiber bertarif tahunan. Syarat dan ketentuan berlaku.' },
  // ---------- ACT 9 — CUSTOMER VALUE ----------
  { id: 'M23', act: 'ACT 9 — Why Palapa Ring Tengah', lvl: 2, view: 'value',
    vo: 'Mengapa Palapa Ring Paket Tengah? Kapasitas dedicated yang dapat ditingkatkan, jangkauan hingga wilayah 3T, pilihan layanan yang lengkap, dan tarif yang jelas.',
    say: 'Mengapa Palapa Ring Paket Tengah? Kapasitas dedicated yang dapat ditingkatkan, jangkauan hingga wilayah tiga T, pilihan layanan yang lengkap, dan tarif yang jelas.' },
  // ---------- ACT 10 — USE CASES ----------
  { id: 'M24', act: 'ACT 10 — Use Case: ISP', lvl: 2, view: 'usecase:isp',
    vo: 'Untuk ISP lokal: ambil kapasitas di kota layanan Palapa Ring, lalu salurkan internet ke pelanggan di wilayah Anda.',
    say: 'Untuk ISP lokal: ambil kapasitas di kota layanan Palapa Ring, lalu salurkan internet ke pelanggan di wilayah Anda.' },
  { id: 'M25', act: 'ACT 10 — Use Case: Operator, Industri & Layanan Publik', lvl: 1, view: 'plate:bts+pop+town',
    vo: 'Untuk operator: hubungkan BTS ke backbone, dan tempatkan antena di menara kami. Untuk industri dan layanan publik: hubungkan lokasi Anda, hingga wilayah 3T.',
    say: 'Untuk operator: hubungkan B T S ke backbone, dan tempatkan antena di menara kami. Untuk industri dan layanan publik: hubungkan lokasi Anda, hingga wilayah tiga T.' },
  // ---------- ACT 11 — CALCULATOR ----------
  { id: 'M27', act: 'ACT 11 — Commercial Calculator', lvl: 3, view: 'calc:isp',
    vo: 'Simulasi: ISP di Tahuna, Proyek 8A, butuh kapasitas 1G: Rp30 juta per bulan, dengan kolokasi 1U tanpa biaya.',
    say: 'Simulasi: I S P di Tahuna, Proyek delapan A, butuh kapasitas satu G: tiga puluh juta rupiah per bulan, dengan kolokasi satu U tanpa biaya.' },
  { id: 'M28', act: 'ACT 11 — Commercial Calculator', lvl: 3, view: 'calc:ppu',
    vo: 'Pay Per Use di Proyek 5, dengan puncak trafik 4,6 Gbps: 50 persen dari Rp152 juta, yaitu Rp76 juta untuk bulan itu.',
    say: 'Pay Per Use di Proyek lima, dengan puncak trafik empat koma enam gigabit: lima puluh persen dari seratus lima puluh dua juta rupiah, yaitu tujuh puluh enam juta rupiah untuk bulan itu.' },
  // ---------- ACT 12 — DECISION ----------
  { id: 'M29', act: 'ACT 12 — Decision Moment', lvl: 2, view: 'decision',
    vo: 'Apa yang dibutuhkan jaringan Anda? Kapasitas, jangkauan, keandalan, infrastruktur, atau skalabilitas. Semuanya bertemu di satu jaringan: Palapa Ring Paket Tengah.',
    say: 'Apa yang dibutuhkan jaringan Anda? Kapasitas, jangkauan, keandalan, infrastruktur, atau skalabilitas. Semuanya bertemu di satu jaringan: Palapa Ring Paket Tengah.' },
  // ---------- ACT 13 — CTA ----------
  { id: 'M30', act: 'ACT 13 — Call to Action', lvl: 3, view: 'cta',
    vo: 'Siap menghubungkan bisnis Anda? Cek ketersediaan jaringan, dan bicarakan kebutuhan Anda dengan tim komersial kami di hotline 1500-876.',
    say: 'Siap menghubungkan bisnis Anda? Cek ketersediaan jaringan, dan bicarakan kebutuhan Anda dengan tim komersial kami di hotline satu lima nol nol, delapan tujuh enam.' },
  { id: 'M31', act: 'ACT 13 — Call to Action', lvl: 1, view: 'end',
    vo: 'Palapa Ring Paket Tengah. Semua Berhak Terhubung.',
    say: 'Palapa Ring Paket Tengah. Semua berhak terhubung.' },
];

// 90-second commercial teaser
const TEASER = [
  { id: 'T01', lvl: 1, view: 'plate:earth', vo: 'Konektivitas adalah fondasi bisnis dan layanan publik.', say: 'Konektivitas adalah fondasi bisnis dan layanan publik.' },
  { id: 'T02', lvl: 1, view: 'plate:region', vo: 'Palapa Ring Paket Tengah: ±3.102 kilometer serat optik, 6 proyek, 17 kota layanan, dan 10 kota interkoneksi.', say: 'Palapa Ring Paket Tengah: sekitar tiga ribu seratus dua kilometer serat optik, enam proyek, tujuh belas kota layanan, dan sepuluh kota interkoneksi.' },
  { id: 'T02B', lvl: 1, view: 'plate:cutaway', vo: 'Teknologi DWDM, dengan kapasitas 100 Gbps yang dapat ditingkatkan di setiap proyek.', say: 'Teknologi DWDM, dengan kapasitas seratus gigabit per detik yang dapat ditingkatkan di setiap proyek.' },
  { id: 'T03', lvl: 2, view: 'portfolio', vo: 'Kini tersedia untuk bisnis Anda, dalam empat layanan.', say: 'Kini tersedia untuk bisnis Anda, dalam empat layanan.' },
  { id: 'T04', lvl: 3, view: 'price:bw', vo: 'Sewa Kapasitas dedicated: 1G mulai Rp7 juta per bulan.', say: 'Sewa Kapasitas dedicated: satu G mulai tujuh juta rupiah per bulan.' },
  { id: 'T05', lvl: 3, view: 'price:df', vo: 'Sewa Core dark fiber: Rp12 juta per kilometer per tahun untuk darat, Rp36 juta untuk laut.', say: 'Sewa Core dark fiber: dua belas juta rupiah per kilometer per tahun untuk darat, tiga puluh enam juta untuk laut.' },
  { id: 'T06', lvl: 3, view: 'price:ppu', vo: 'Pay Per Use: bayar sesuai utilisasi, mulai 25 persen dari tarif 10G.', say: 'Pay Per Use: bayar sesuai utilisasi, mulai dua puluh lima persen dari tarif sepuluh G.' },
  { id: 'T07', lvl: 2, view: 'product:colo', vo: 'Kolokasi 1U untuk aktivasi, tanpa biaya.', say: 'Kolokasi satu U untuk aktivasi, tanpa biaya.' },
  { id: 'T07B', lvl: 1, view: 'plate:bts', vo: 'Untuk operator, ISP, industri, dan layanan publik, hingga wilayah 3T.', say: 'Untuk operator, I S P, industri, dan layanan publik, hingga wilayah tiga T.' },
  { id: 'T08', lvl: 3, view: 'journey', vo: 'Hubungi tim kami, pilih layanan dan lokasi, aktivasi di NOC, dan layanan berjalan.', say: 'Hubungi tim kami, pilih layanan dan lokasi, aktivasi di NOC, dan layanan berjalan.' },
  { id: 'T09', lvl: 3, view: 'cta', vo: 'Siap menghubungkan bisnis Anda? Hotline 1500-876.', say: 'Siap menghubungkan bisnis Anda? Hotline satu lima nol nol, delapan tujuh enam.' },
  { id: 'T10', lvl: 1, view: 'end', vo: 'Palapa Ring Paket Tengah. Semua Berhak Terhubung.', say: 'Palapa Ring Paket Tengah. Semua berhak terhubung.' },
];

// 30–60 second sales campaign
const CAMPAIGN = [
  { id: 'C01', lvl: 1, view: 'plate:region', vo: 'Butuh konektivitas di Kalimantan Timur, Sulawesi, atau Maluku Utara?', say: 'Butuh konektivitas di Kalimantan Timur, Sulawesi, atau Maluku Utara?' },
  { id: 'C02', lvl: 3, view: 'offers', vo: 'Sewa Kapasitas mulai Rp7 juta per bulan. Dark fiber Rp12 juta per kilometer per tahun. Pay Per Use mulai Rp14 juta per bulan. Kolokasi 1U untuk aktivasi tanpa biaya.', say: 'Sewa Kapasitas mulai tujuh juta rupiah per bulan. Dark fiber dua belas juta rupiah per kilometer per tahun. Pay Per Use mulai empat belas juta rupiah per bulan. Kolokasi satu U untuk aktivasi tanpa biaya.' },
  { id: 'C03', lvl: 3, view: 'cta', vo: 'Hubungi tim komersial Palapa Ring Paket Tengah. Hotline 1500-876.', say: 'Hubungi tim komersial Palapa Ring Paket Tengah. Hotline satu lima nol nol, delapan tujuh enam.' },
  { id: 'C04', lvl: 1, view: 'end', vo: 'Semua Berhak Terhubung.', say: 'Semua berhak terhubung.' },
];
const SCRIPT = { MAIN, TEASER, CAMPAIGN };
if (typeof module !== 'undefined') module.exports = SCRIPT; else window.SCRIPT = SCRIPT;
