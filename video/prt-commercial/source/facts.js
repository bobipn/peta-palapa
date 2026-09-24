// Single source of truth: every figure below is transcribed from
// "Produk_Dan_Layanan_Paring_Tengah_2025__kolokasi.pptx" (slide number in `src`).
// Nothing here is estimated. Derived values (sums, examples) are marked `derived: true`.
const F = {
  tagline: 'Semua Berhak Terhubung', // s1, s27
  about: 'PT Len Telekomunikasi Indonesia adalah Badan Usaha Pelaksana (BUP) yang ditunjuk oleh Pemerintah yaitu Kemkominfo untuk membangun, mengelola dan memasarkan Jaringan Serat Optik Palapa Ring Paket Tengah', // s2
  network: { since: '21 Desember 2018', projects: 6, regencies: 17, landKm: '±1304', seaKm: '±1798', totalKm: '±3102', serviceCities: 17, interconnectCities: 10,
    spec: 'Teknologi DWDM terkini, kapasitas 100 Gbps (expandable) pada setiap proyek', src: 's4' },
  regions: 'Kalimantan Timur, Sulawesi (Tengah, Tenggara, Utara) dan Kepulauan Maluku Utara', // s4
  projects: [ // s6–s11
    { id: 'P4', region: 'Kalimantan Timur', km: 191, sea: 0, land: 191, mw: '6 hops / 156 km', ts: ['Long Bagun'], int: ['Sendawar'], use: ['Operator Telekomunikasi', 'Industri Kehutanan', 'Perkebunan Kelapa Sawit'] },
    { id: 'P5', region: 'Sulawesi Tengah & Tenggara', km: 634, sea: 0, land: 634, ts: ['Petasia', 'Bungku', 'Wanggudu'], int: ['Tentena', 'Kendari'], use: ['Operator Telekomunikasi', 'ISP Lokal', 'Pariwisata', 'Perikanan', 'Minyak dan Gas Bumi', 'Industri Pertanian dan Herbal'] },
    { id: 'P6', region: 'Sulawesi Tenggara', km: 557, sea: 182, land: 374, ts: ['Wawonii Barat', 'Buranga', 'Raha', 'Sawerigadi', 'Lakudo'], int: ['Kendari', 'Baubau'], use: ['Operator Telekomunikasi & ISP Lokal', 'Pariwisata', 'Perikanan', 'Minyak dan Gas Bumi', 'Industri Pertanian', 'Industri Herbal'] },
    { id: 'P7', region: 'Sulawesi Tengah & Maluku Utara', km: 678, sea: 621, land: 57, ts: ['Salakan', 'Banggai', 'Taliabu'], int: ['Luwuk', 'Sanana'], use: ['Operator Telekomunikasi & ISP Lokal', 'Pariwisata', 'Perikanan', 'Minyak dan Gas Bumi', 'Industri Tambang (batubara)', 'Industri Pertanian dan herbal'] },
    { id: 'P8A', region: 'Sulawesi Utara & Maluku Utara', km: 998, sea: 965, land: 32, ts: ['Ondong Siau', 'Melonguane', 'Tahuna', 'Morotai Selatan'], int: ['Manado', 'Tobelo'], use: ['Operator Telekomunikasi & ISP Lokal', 'Pariwisata', 'Perikanan', 'Minyak dan Gas Bumi', 'Tambang', 'Agrikultur'] },
    { id: 'P8B', region: 'Maluku Utara', km: 41, sea: 28, land: 12, ts: ['Tidore'], int: ['Ternate', 'Sofifi'], use: ['Operator Telekomunikasi & ISP Lokal', 'Pariwisata', 'Perikanan', 'Minyak dan Gas Bumi', 'Pertambangan (Nickel)', 'Industri Pertanian dan Herbal'] },
  ],
  segments: ['Industri Sektoral & Mikro — Pertambangan, Migas, Pariwisata, Perkebunan, dan Kelautan', 'BUMDes — Badan Usaha Milik Desa, Area 3T', 'Masyarakat — Pengguna smartphone, Internet Kabel, Wifi, dll', 'Layanan Publik — Pemerintah Daerah, layanan kesehatan, dll'], // s5
  scheme: 'Skema B2B dengan Mitra: Penyelenggara Telekomunikasi; Penyedia Layanan Internet (ISP)', // s5
  products: [ // s13 (verbatim names)
    { n: 1, name: 'Sewa Kapasitas (Bandwidth)', pts: ['Merupakan layanan berbasiskan sewa kapasitas', 'Kapasitas yang disediakan terjamin (Dedicated)', 'Harga terjangkau dengan kualitas tinggi', 'Port tersedia: 1G, 10G, STM-4, dan STM-16'] },
    { n: 2, name: 'Sewa Core (Darkfiber)', pts: ['Merupakan layanan berbasiskan sewa jaringan pasif Palapa Ring Paket Tengah', 'Skema sewa dapat per proyek, per segmen, atau per titik akses', 'Kapasitas tidak terbatas, manajemen jaringan dapat diatur sendiri penggunaannya oleh pelanggan melalui perangkat aktif milik pelanggan', 'Core Tersedia: 22 Core FO atau 11 pair pada setiap proyek Palapa Ring Paket Tengah'] },
    { n: 3, name: 'Kolokasi Perangkat Aktif Pelanggan', pts: ['Pelanggan dapat menempatkan perangkat aktif pada site kami untuk keperluan aktivasi dan integrasi layanan'] },
    { n: 4, name: 'PPU (Pay Per Use)', pts: ['Pay Per Use memberikan layanan yang lebih flexible bagi pelanggan karena penggunaan trafik dihitung berdasarkan jumlah penggunaan yaitu minimum di 2,5G dan perhitungan Maximum di peak trafik pada bulan tersebut'] },
  ],
  bandwidth: { unit: 'Rp per bulan', src: 's14', rows: [['P4', 9000000, 72000000], ['P5', 19000000, 152000000], ['P6', 26000000, 208000000], ['P7', 22000000, 176000000], ['P8A', 30000000, 240000000], ['P8B', 7000000, 56000000]],
    bundle6: [90400000, 723000000], bundleNote: 'Tarif (Rp) per bulan untuk pembelian 6 project sekaligus' },
  darkFiberKm: { unit: 'Rp per km / tahun', land: 12000000, sea: 36000000, src: 's14' },
  darkFiberSeg: { unit: 'Rp / tahun', src: 's15', projects: [
    ['Proyek-4', [['Sendawar – Long Bagun', 191.790, 0, 2301480000]], 2301480000],
    ['Proyek-5', [['Kendari – Wanggudu', 120.827, 0, 1449924000], ['Wanggudu – Bungku', 218.390, 0, 2620680000], ['Bungku – Petasia', 129.100, 0, 1549200000], ['Petasia – Tentena', 166.648, 0, 1999776000]], 7619580000],
    ['Proyek-6', [['Kendari – Wawonii', 19.777, 62.706, 2494740000], ['Wawonii – Raha', 29.692, 83.986, 3379800000], ['Raha – Buranga', 45.584, 18.693, 1219956000], ['Buranga – Baubau', 132.539, 0, 1590468000], ['Baubau – Lakudo', 19.710, 17.348, 861048000], ['Lakudo – Sawerigadi', 81.412, 0, 976944000], ['Sawerigadi – Raha', 46.028, 0, 552336000]], 11075292000],
    ['Proyek-7', [['Luwuk – Salakan', 19.831, 80.408, 3132660000], ['Salakan – Banggai', 25.214, 102.477, 3991740000], ['Banggai – Taliabu', 10.105, 115.345, 4273680000], ['Taliabu – Sanana', 2.333, 323.197, 11663088000]], 23061168000],
    ['Proyek-8A', [['Manado – Ondong Siau', 17.235, 203.376, 7528356000], ['Ondong Siau – Tahuna', 0.415, 131.688, 4745748000], ['Tahuna – Melonguane', 0.080, 283.648, 10212288000], ['Melonguane – Morotai', 6.185, 299.323, 10849848000], ['Morotai – Tobelo', 8.793, 47.296, 1808172000]], 35144412000],
    ['Proyek-8B', [['Ternate – Tidore', 4.711, 16.942, 666444000], ['Tidore – Sofifi', 7.479, 12.031, 522864000]], 1189308000]] },
  darkFiberAccess: { src: 's16', text: 'Tarif Dark Fiber untuk Akses dihitung secara proporsional berdasarkan jarak antara NOC/TS Palapa Ring dikali dengan harga Dark Fiber per kilometer', rows: [['≤ 25%', '2.5 x harga'], ['25% < x ≤ 50%', '2 x harga'], ['50% < x ≤ 75%', '1.5 x harga'], ['> 75%', '1 x harga']] },
  ppu: { src: 's17–s18', basis: 'Perhitungan tingkat utilisasi kapasitas bandwidth dihitung menggunakan data pengukuran utilisasi aktual dari perangkat Pay Per Use BAKTI.',
    tiers: [['x ≤ 2.5', 25], ['2,5 < x ≤ 3', 30], ['3 < x ≤ 4', 40], ['4 < x ≤ 5', 50], ['5 < x ≤ 6', 60], ['6 < x ≤ 7', 70], ['7 < x ≤ 8', 80], ['8 < x ≤ 9', 90], ['9 < x ≤ 10', 100]],
    table: { P4: [18000000, 21600000, 28800000, 36000000, 43200000, 50400000, 57600000, 64800000, 72000000], P5: [38000000, 45600000, 60800000, 76000000, 91200000, 106400000, 121600000, 136800000, 152000000],
      P6: [52000000, 62400000, 83200000, 104000000, 124800000, 145600000, 166400000, 187200000, 208000000], P7: [44000000, 52800000, 70400000, 88000000, 105600000, 123200000, 140800000, 158400000, 176000000],
      P8A: [60000000, 72000000, 96000000, 120000000, 144000000, 168000000, 192000000, 216000000, 240000000], P8B: [14000000, 16800000, 22400000, 28000000, 33600000, 39200000, 44800000, 50400000, 56000000] } },
  coloRef: { src: 's19–s20', note: 'Biaya Acuan* — *Monthly Charge (s24)', indoor: [['1U space', 1000000], ['2U space', 1500000], ['Half rack space / 20U', 8500000], ['Full rack space / 42U', 16850000], ['Tambahan daya per 10A DC power', 526000], ['Tambahan daya per 2A AC power', 460000]],
    outdoor: [['Lahan terbuka per 1m2', 500000]],
    tower: [['3M window (antena transmisi ≤ 1.2m)', 10500000], ['3M window (antena transmisi ≤ 1.8m)', 12500000], ['Antena MW ≤ 1.2m (tanpa 3M window)', 2121000], ['Antena MW 1.2–2.0m (tanpa 3M window)', 4316000], ['Antena MW 2.0–2.4m (tanpa 3M window)', 5315000], ['Antena MW 2.4–3.0m (tanpa 3M window)', 7984000],
      ['Tambahan antena MW ≤ 1.2m (pemilik 3M window)', 1414000], ['Tambahan antena MW 1.2–2.0m (pemilik 3M window)', 2880000], ['Tambahan antena MW 2.0–2.4m (pemilik 3M window)', 3545000], ['Tambahan antena MW 2.4–3.0m (pemilik 3M window)', 5325000], ['Tambahan per sectoral antena', 1100000]] },
  hardship: { P4: 1.2, P5: 1.0, P6: 1.1, P7: 1.1, P8: 1.2, src: 's23' },
  coloIndoorPerProject: { src: 's24', cols: ['P4', 'P5', 'P6', 'P7', 'P8A', 'P8B'], rows: [['1U space', [1200000, 1000000, 1100000, 1100000, 1200000, 1200000]], ['2U space', [1800000, 1500000, 1650000, 1650000, 1800000, 1800000]], ['Half rack space / 20U', [10200000, 8500000, 9350000, 9350000, 10200000, 10200000]], ['Full rack space / 42U', [20220000, 16850000, 18535000, 18535000, 20220000, 20220000]], ['Tambahan per 2A AC power', [552000, 460000, 506000, 506000, 552000, 552000]]] },
  coloFormula: 'Biaya layanan kolokasi = Biaya Acuan * Koefisien Hardship * Qty Layanan. Nilai ini merupakan biaya layanan kolokasi per bulan.', // s22–s23
  coloExample: 'Perangkat pasif OTB 2U (perangkat tambahan) di NOC/INT Sendawar Proyek 4: Rp.1,500,000 * 1.2 * 1 = Rp.1,800,000 per bulan', // s23
  coloFree: ['Setiap pelanggan Palapa Ring layanan kapasitas berhak menggunakan ruang penempatan perangkat tidak berbayar untuk keperluan aktivasi dengan ketentuan ruang 1U dan daya listrik maksimum setara 10A daya DC atau setara 2A daya AC.',
    'Setiap pelanggan Palapa Ring layanan dark fiber berhak menggunakan ruang penempatan perangkat pasif tidak berbayar untuk keperluan interkoneksi dengan ketentuan ruang 1U.'], // s21
  contact: { company: 'PT Len Telekomunikasi Indonesia', address: 'Gedung Menara MTH, Lantai M, Jl Letjen MT Haryono Kav 23, Tebet, Kota Jakarta Selatan, 12820', hotline: '1500-876', phone: '021 22833872',
    emails: ['bobi.panca@len-telko.co.id', 'farintya.yuniastiti@len-telko.co.id', 'novia.putri@len-telko.co.id', 'mutiara.azana@len-telko.co.id'],
    sales: [['Bobi Panca Nugraha'], ['Farintya Y'], ['Novia Putri Z'], ['Mutiara Azana']] /* mobile numbers in s26 intentionally omitted */ }, // s26
  pressRelease: 'https://www.kominfo.go.id/content/detail/18291/siaran-pers-no-90hmkominfo042019-tentang-tarif-jaringan-serat-optik-palapa-ring-tengah/0/siaran_pers', // s14 hyperlink
};
if (typeof module !== 'undefined') module.exports = F; else window.F = F;
