// Generates the production bible (Markdown) from facts.js + script.js + rendered timelines,
// so every number, line of VO and timecode in the document matches the videos.
const fs = require('fs'), F = require('./facts.js'), S = require('./script.js');
const tl = v => { try { return JSON.parse(fs.readFileSync(`timeline_${v}.json`)); } catch { return []; } };
const rp = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const tc = s => { const m = Math.floor(s / 60), x = s - m * 60; return `${String(m).padStart(2, '0')}:${x.toFixed(1).padStart(4, '0')}`; };
const total = v => { const t = tl(v); return t.length ? t[t.length - 1].a + t[t.length - 1].D : 0; };

// per-view production notes: visual, visual prompt (for a live-action / 3D / AI-video team), camera, transition, music & SFX, on-screen text
const VIEW = {
  'plate:earth': { lvl: 'L1 Cinematic', vis: 'Globe dari orbit, matahari terbit di timur, zoom perlahan ke Indonesia Tengah.', prompt: 'Photorealistic orbital view of Earth at sunrise over the Indonesian archipelago, NASA Blue Marble textures, thin atmosphere rim, volumetric cloud layer, slow push-in toward Sulawesi, cinematic 35mm, deep navy space.', cam: 'Slow push-in 8 detik, sedikit tilt.', tr: 'Fade from black.', sfx: 'Sub-bass drone, pad hangat masuk perlahan.' },
  'map:traffic': { lvl: 'L2 Infographic', vis: 'Peta satelit Indonesia Tengah (gelap), busur trafik data antar kota makin padat; pertanyaan muncul.', prompt: 'Dark satellite map of Central Indonesia, glowing cyan data arcs between island cities multiplying over time, premium telecom infographic, no text except headline.', cam: 'Zoom 1.0 → 1.08.', tr: 'Dip to navy.', sfx: 'Ticks ritmis halus, pad naik.' },
  'plate:region': { lvl: 'L1 Cinematic', vis: 'Citra satelit 3D regional dengan rute riil PRT (KML) dan PoP menyala; judul PALAPA RING PAKET TENGAH.', prompt: 'Aerial 3D satellite terrain of Sulawesi, Kalimantan and North Maluku with real fibre routes glowing (subsea cyan, terrestrial warm white), cumulus clouds casting shadows, morning light, oblique drone move.', cam: 'Top-down → oblique tilt, dolly ke Sulawesi Tenggara.', tr: 'Cross-dip.', sfx: 'Whoosh lembut, pad Bm9.' },
  'metrics': { lvl: 'L2 Infographic', vis: 'Rute tergambar di peta; 6 kartu metrik (±3.102 km, ±1.304 km, ±1.798 km, 17, 10, 6 proyek) muncul berurutan.', prompt: 'Premium animated infographic cards over a dark satellite map, counters rising, legend (Titik Layanan / Titik Interkoneksi / fibre laut / darat).', cam: 'Slow zoom-in.', tr: 'Dip to navy.', sfx: 'Tick per kartu.' },
  'plate:cutaway': { lvl: 'L1 Cinematic', vis: 'Macro cutaway kabel laut: serat optik, tabung baja, konduktor tembaga, armor; pulsa cahaya di serat.', prompt: 'Macro cutaway of an armoured submarine fibre-optic cable on a sandy seabed, stepped layers revealed, cyan light pulses inside fibres, shallow depth of field, caustics.', cam: 'Macro dolly sepanjang kabel (slow-motion).', tr: 'Cross-dip.', sfx: 'Suara bawah air teredam, shimmer.' },
  'projects': { lvl: 'L2 Infographic', vis: 'Peta terbang dari P4 ke P8B; tiap proyek disorot dengan kartu km, laut/darat, titik layanan & interkoneksi.', prompt: 'Map fly-through highlighting six fibre projects in turn, others dimmed, clean side card with project statistics.', cam: 'Map camera cut per proyek (ease in-out).', tr: 'Dip to navy.', sfx: 'Whoosh kecil tiap proyek.' },
  'segments': { lvl: 'L2 Infographic', vis: 'Dua kartu mitra B2B + empat kartu potensi pemanfaatan dengan ikon garis.', prompt: 'Minimal navy UI, line icons for industry, village, government and community, cards sliding up.', cam: 'Statis, elemen masuk bertahap.', tr: 'Dip to navy.', sfx: 'Pop halus.' },
  'portfolio': { lvl: 'L2 Infographic', vis: 'Satu garis jaringan bercabang menjadi empat kartu produk.', prompt: 'A single glowing fibre line splitting into four product tiles, premium product portfolio reveal.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Riser pendek + hit lembut.' },
  'product:bw': { lvl: 'L2 Infographic', vis: 'Pipa fiber dengan 6 lajur; satu lajur DEDICATED menyala dari PoP ke pelanggan; chip port 1G/10G/STM-4/STM-16.', prompt: 'Stylised fibre pipe with multiple lanes, one dedicated lane glowing cyan carrying data pulses from PoP to customer network.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Pulse ritmis.' },
  'price:bw': { lvl: 'L3 Commercial UI', vis: 'Kartu hero "Mulai dari Rp 7.000.000 / bulan" + grid 6 kartu proyek (1G & 10G).', prompt: 'Clean commercial pricing cards on navy, large legible numerals, per-project grid.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Tick per kartu.' },
  'price:bundle': { lvl: 'L3 Commercial UI', vis: 'Dua kartu harga paket 6 proyek; di bawahnya jumlah tarif per proyek & selisih (dihitung).', prompt: 'Two hero pricing cards with comparison line underneath.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Hit lembut.' },
  'product:df': { lvl: 'L2 Infographic', vis: 'Penampang 22 core (11 pair, kode warna serat); strand menuju perangkat aktif pelanggan.', prompt: 'Fibre cable cross-section with 22 colour-coded cores, strands extending to a customer-owned active device.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Shimmer.' },
  'price:df': { lvl: 'L3 Commercial UI', vis: 'Kartu tarif darat & laut per km/tahun; peta segmen Sendawar – Long Bagun; strip total per proyek.', prompt: 'Pricing cards beside an inset satellite map with the highlighted segment, totals strip.', cam: 'Statis, inset map zoom halus.', tr: 'Dip to navy.', sfx: 'Tick.' },
  'price:dfaccess': { lvl: 'L3 Commercial UI', vis: 'Empat baris pengali (2,5× – 1×) sesuai proporsi jarak NOC/TS.', prompt: 'Clean multiplier ladder UI.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Tick per baris.' },
  'product:ppu': { lvl: 'L2 Infographic', vis: 'Grafik utilisasi 1 bulan, garis minimum 2,5G, titik peak ditandai (ilustrasi).', prompt: 'Monthly utilisation line chart with dashed 2.5G floor and highlighted peak.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Pulse.' },
  'price:ppu': { lvl: 'L3 Commercial UI', vis: 'Tangga 9 tier utilisasi (25%–100%); chip proyek berganti P4 → P8B, nilai Rupiah ikut berubah.', prompt: 'Tiered pricing ladder with animated project selector.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Click tiap ganti proyek.' },
  'product:colo': { lvl: 'L2 Infographic', vis: 'Rak 42U; slot 1U pelanggan menyala dengan label "1U · TANPA BIAYA"; badge daya 10A DC / 2A AC.', prompt: 'Clean isometric 42U rack in a NOC, one highlighted 1U slot with customer equipment LEDs.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Hum server lembut.' },
  'price:colo': { lvl: 'L3 Commercial UI', vis: 'Kartu biaya acuan indoor (1U/2U/20U/42U), tambahan daya, lahan terbuka, tower.', prompt: 'Pricing card system with section labels INDOOR / OUTDOOR / TOWER.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Tick.' },
  'price:coloformula': { lvl: 'L3 Commercial UI', vis: 'Rumus Biaya Acuan × Koefisien Hardship × Qty; chip hardship P4–P8; contoh Rp 1.800.000/bulan.', prompt: 'Equation animation with coloured terms and worked example.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Tick + hit.' },
  'bundle': { lvl: 'L2 Infographic', vis: 'Rantai: rak pelanggan → daya → sewa kapasitas → NOC/TS → backbone nasional; badge TANPA BIAYA*.', prompt: 'Connected node chain diagram with flowing data pulses.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Pulse.' },
  'journey': { lvl: 'L3 Commercial UI', vis: '5 langkah berlangganan pada garis waktu; langkah aktif menyala bergantian.', prompt: 'Horizontal customer journey stepper, active step highlighted.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Click per step.' },
  'billing': { lvl: 'L3 Commercial UI', vis: 'Dua kartu periode tarif (bulanan / tahunan) + 4 kartu ketentuan kolokasi.', prompt: 'Two-column billing period cards with terms chips.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Pad.' },
  'value': { lvl: 'L2 Infographic', vis: 'Empat pilar value di atas peta redup.', prompt: 'Four value pillars with line icons over a dimmed network map.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Hit lembut per pilar.' },
  'usecase:isp': { lvl: 'L2 Infographic', vis: 'Alur: Jaringan Backbone Nasional → Titik Interkoneksi → Titik Layanan → Tenant Router/ISP → pelanggan.', prompt: 'Topology flow using the PPT legend terms, pulses moving left to right.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Pulse.' },
  'plate:bts': { lvl: 'L1 Cinematic', vis: 'Menara BTS 42 m dengan antena sektor & microwave, fiber naik ke menara, gelombang radio sektoral.', prompt: 'Photoreal 42 m lattice BTS tower in a coastal Sulawesi town, sector antennas, subtle radio wavefronts, golden hour.', cam: 'Crane up menara.', tr: 'Cross-dip.', sfx: 'Arpeggio naik halus.' },
  'plate:bts+pop+town': { lvl: 'L1 Cinematic', vis: 'Menara BTS (crane up), PoP compound, lalu kota: sekolah, rumah sakit, kantor pemerintah, industri, warga.', prompt: 'Aerial of a PoP shelter compound then a small Indonesian town with school, hospital, government office, mosque and industry, data links to buildings.', cam: 'Aerial pull-back.', tr: 'Cross-dip.', sfx: 'Ambience kota lembut.' },
  'calc:isp': { lvl: 'L3 Commercial UI', vis: 'Kalkulator: kebutuhan 1G P8A, sewa Rp 30.000.000, kolokasi 1U Rp 0, total.', prompt: 'Calculator card with line items and total bar.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Count-up tick.' },
  'calc:ppu': { lvl: 'L3 Commercial UI', vis: 'Kalkulator PPU: peak 4,6 Gbps → tier 50% × Rp 152.000.000 = Rp 76.000.000.', prompt: 'Calculator card with tier logic.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Count-up tick.' },
  'decision': { lvl: 'L2 Infographic', vis: 'Lima kebutuhan melayang lalu konvergen ke logo cincin LTI + PALAPA RING PAKET TENGAH.', prompt: 'Five need-words converging into a single brand mark.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Riser → hit.' },
  'cta': { lvl: 'L3 Commercial UI', vis: 'Tiga tombol CTA + panel kontak (hotline, telepon, alamat, email tim komersial).', prompt: 'Commercial CTA screen with three buttons and contact panel.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Pad resolve.' },
  'end': { lvl: 'L1 Cinematic', vis: 'Aerial jaringan saat senja + logo LTI (lockup asli) + "Semua Berhak Terhubung".', prompt: 'Wide golden-hour aerial of the whole network, end card with official LTI logo lockup.', cam: 'Slow orbit.', tr: 'Fade to black.', sfx: 'Final chord + boom lembut.' },
  'offers': { lvl: 'L3 Commercial UI', vis: 'Empat kartu penawaran "mulai dari".', prompt: 'Four offer cards, bold starting prices.', cam: 'Statis.', tr: 'Dip to navy.', sfx: 'Tick per kartu.' },
};
const ONSCREEN = { // key on-screen text per view (exact strings rendered)
  'plate:earth': 'Konektivitas adalah fondasi / bagi bisnis, layanan publik, dan pertumbuhan ekonomi',
  'map:traffic': 'Tantangan wilayah kepulauan · Laut. Jarak. Medan. · Bagaimana bisnis mendapatkan konektivitas yang andal, dapat ditingkatkan, dan sesuai kebutuhan?',
  'plate:region': 'PALAPA RING PAKET TENGAH · PT Len Telekomunikasi Indonesia — Badan Usaha Pelaksana (BUP) yang ditunjuk Pemerintah melalui Kemkominfo',
  'metrics': 'JARINGAN · Beroperasi sejak 21 Desember 2018 · ±3.102 KM Total panjang kabel · ±1.304 KM Kabel darat · ±1.798 KM Kabel laut · 17 Kota Layanan / SLA · 10 Kota Interkoneksi · 6 Proyek · 17 kabupaten',
  'plate:cutaway': 'DWDM · 100 Gbps (expandable) · kapasitas pada setiap proyek',
  'projects': 'PROYEK n · wilayah · km · Laut/Darat · TITIK LAYANAN · TITIK INTERKONEKSI (per proyek, lihat Product Master Table)',
  'segments': 'Siapa yang terhubung? · Mitra B2B: Penyelenggara Telekomunikasi · Penyedia Layanan Internet (ISP) · POTENSI PEMANFAATAN: Industri Sektoral & Mikro · BUMDes · Layanan Publik · Masyarakat',
  'portfolio': 'Apa yang bisa diperoleh bisnis Anda? · 01 Sewa Kapasitas (Bandwidth) · 02 Sewa Core (Darkfiber) · 03 Kolokasi Perangkat Aktif Pelanggan · 04 PPU (Pay Per Use)',
  'price:bw': 'MULAI DARI · KAPASITAS 1 G · Rp 7.000.000 per bulan · Proyek 8B · MULAI DARI · KAPASITAS 10 G · Rp 56.000.000 · grid 6 proyek · Syarat & Ketentuan Berlaku',
  'price:bundle': 'Seluruh jaringan. Satu tarif. · Rp 90.400.000 / bulan (1 G) · Rp 723.000.000 / bulan (10 G) · Jumlah tarif bila dibeli per proyek … · Selisih …',
  'price:df': 'JALUR DARAT Rp 12.000.000 per km / tahun · JALUR LAUT Rp 36.000.000 per km / tahun · CONTOH SEGMEN · Sendawar – Long Bagun · 191,790 km darat · Rp 2.301.480.000 / tahun',
  'price:ppu': 'Tingkat utilisasi (Gbps) · % terhadap tarif · Dibayarkan · Proyek n · Tarif Normal 10 Gbps … · Utilisasi diukur dari perangkat Pay Per Use BAKTI',
  'price:colo': 'INDOOR 1U Rp 1.000.000 · 2U Rp 1.500.000 · Half rack 20U Rp 8.500.000 · Full rack 42U Rp 16.850.000 · TAMBAHAN DAYA · OUTDOOR · TOWER · Biaya kolokasi = Biaya Acuan × Koefisien Hardship × Qty',
  'journey': 'Cara berlangganan · STEP 01 Hubungi Kami · 02 Tentukan Layanan · 03 Penawaran · 04 Aktivasi & Interkoneksi · 05 Layanan Berjalan',
  'cta': 'Siap menghubungkan bisnis Anda? · JELAJAHI LAYANAN KAMI · CEK KETERSEDIAAN JARINGAN · BICARA DENGAN TIM KOMERSIAL · HOTLINE 1500-876 · TELEPON 021 22833872 · ALAMAT · TIM KOMERSIAL · EMAIL',
  'end': 'Logo LTI · PALAPA RING PAKET TENGAH · “Semua Berhak Terhubung” · Hotline 1500-876',
};

let md = [];
const h = (n, s) => md.push('\n' + '#'.repeat(n) + ' ' + s + '\n'), p = s => md.push(s), tr = r => md.push('| ' + r.join(' | ') + ' |');
const table = (head, rows) => { md.push(''); tr(head); tr(head.map(() => '---')); rows.forEach(tr); md.push(''); };

md.push('# Palapa Ring Tengah: Product & Commercial Profile Video');
md.push('**Production bible.** Dibuat dari *Produk_Dan_Layanan_Paring_Tengah_2025__kolokasi.pptx* (27 slide). Semua angka ditranskripsi dari PPT dan diverifikasi otomatis: 119 pemeriksaan aritmetika, tidak ada selisih.\n');
table(['Versi', 'Durasi', 'File'], [['Main: Product & Commercial Profile', tc(total('MAIN')), '`PRT_Product_Commercial_Profile_MAIN.mp4`'], ['Commercial teaser', tc(total('TEASER')), '`PRT_Commercial_Teaser_90s.mp4`'], ['Sales campaign', tc(total('CAMPAIGN')), '`PRT_Sales_Campaign.mp4`']]);
p('> **Status:** *draft for review.* Voice-over di video adalah **guide VO sintetis** (TTS Bahasa Indonesia), bukan narator profesional. Naskah final ada di Bagian 5. Item bertanda **[NEEDS CONFIRMATION]** (Bagian 19) harus disetujui sebelum video dipublikasikan.');

h(2, '1. Video Concept');
p('**“FROM NETWORK TO BUSINESS.”** Film dibuka dengan tantangan wilayah kepulauan, memperkenalkan jaringan riil Palapa Ring Paket Tengah, lalu mengubah jaringan itu menjadi empat layanan yang bisa dibeli. Setiap layanan dijelaskan dengan harga yang tercantum di PPT, dilanjutkan cara berlangganan dan simulasi biaya, dan ditutup dengan ajakan menghubungi tim komersial.');
p('\nAlur cerita: **NETWORK → PRODUCT → SOLUTION → PRICE → SUBSCRIBE → CONNECT → GROW**. Film menggunakan tiga level visual yang tidak dicampur dalam satu frame:');
table(['Level', 'Dipakai untuk', 'Perlakuan'], [['L1 Cinematic', 'Indonesia, jaringan, infrastruktur (laut, CLS, PoP, BTS, kota)', 'Footage 3D (citra satelit NASA, rute KML riil), teks minimal'], ['L2 Infographic', 'Metrik jaringan, proyek, produk, value, use case', 'Peta satelit gelap + kartu data + ikon garis'], ['L3 Commercial UI', 'Harga, formula, kalkulator, journey, CTA', 'Kartu harga bersih, angka besar, kontras tinggi']]);

h(2, '2. Core Message');
p('*“Palapa Ring Paket Tengah bukan hanya fiber optic infrastructure. Ia adalah connectivity platform: kapasitas dedicated, dark fiber, kolokasi, dan Pay Per Use, dengan tarif yang jelas per proyek, per segmen, dan per tingkat utilisasi.”*');
p('\nPesan penutup: **“Palapa Ring Paket Tengah — Semua Berhak Terhubung.”** (tagline dari slide 1 & 27).');

h(2, '3. Target Audience');
table(['Segmen', 'Dasar di PPT', 'Relevansi utama'], [
  ['Penyelenggara Telekomunikasi / Operator', 's5 Skema B2B; s6–s11 Potensi Pemanfaatan', 'Sewa Kapasitas, Sewa Core, kolokasi tower (3M window, antena MW)'],
  ['ISP (termasuk ISP Lokal)', 's5 Skema B2B; s7–s11', 'Sewa Kapasitas, PPU, kolokasi 1U'],
  ['Industri: pertambangan (batubara, nickel), migas, perkebunan kelapa sawit, kehutanan, perikanan, pariwisata, pertanian & herbal', 's5, s6–s11', 'Konektivitas lokasi terpencil (melalui mitra B2B)'],
  ['Layanan Publik: Pemerintah Daerah, layanan kesehatan', 's5', 'Perluasan layanan publik digital'],
  ['BUMDes / Area 3T, Masyarakat', 's5', 'Penerima manfaat melalui mitra'],
  ['Data Center, Cloud/Digital SP, Content Provider, System Integrator, Financial Institution', 'Tidak disebut di PPT', 'Hanya disapa secara umum ("bisnis Anda"); tidak dibuat klaim khusus'],
]);
p('Decision maker yang disasar: CEO, CTO, CIO, CFO, Procurement, Network/IT Manager, BD, Commercial Manager. Bahasanya B2B dengan istilah resmi dari PPT (Titik Layanan, Titik Interkoneksi, NOC/TS, Biaya Acuan, Koefisien Hardship).');

h(2, '4. Video Structure');
for (const v of ['MAIN', 'TEASER', 'CAMPAIGN']) { const t = tl(v); p(`\n**${v === 'MAIN' ? 'Main' : v === 'TEASER' ? 'Teaser 90 detik' : 'Sales campaign'}**: total ${tc(total(v))}`);
  table(['#', 'TC in', 'Durasi', 'Act / Adegan', 'Level'], S[v].map((s, i) => [s.id, t[i] ? tc(t[i].a) : '', t[i] ? t[i].D.toFixed(1) + ' dtk' : '', s.act || s.view, (VIEW[s.view] || {}).lvl || ''])); }

h(2, '5. Full Voice-Over');
p('Nada: profesional, tenang, kredibel, hangat, **tidak hard-selling**. Angka dibaca lengkap dalam Bahasa Indonesia; kolom "on paper" adalah bentuk tertulis untuk narator.');
for (const v of ['MAIN', 'TEASER', 'CAMPAIGN']) { const t = tl(v); h(3, v === 'MAIN' ? 'Main' : v === 'TEASER' ? 'Teaser 90 detik' : 'Sales campaign');
  S[v].forEach((s, i) => p(`**${s.id}** \`${t[i] ? tc(t[i].vo) : ''}\` ${s.vo}\n`)); }

h(2, '6. Scene-by-Scene Storyboard (Main)');
{ const t = tl('MAIN'); S.MAIN.forEach((s, i) => { const m = VIEW[s.view] || {}; h(3, `${s.id} · ${s.act}`);
  table(['Item', 'Isi'], [['Timecode', t[i] ? `${tc(t[i].a)} – ${tc(t[i].a + t[i].D)}` : ''], ['Level', m.lvl || ''], ['Visual', m.vis || ''], ['On-screen text', ONSCREEN[s.view] || '(lihat visual)'], ['Voice-over', s.vo], ['Kamera', m.cam || ''], ['Transisi', m.tr || ''], ['Music / SFX', m.sfx || '']]); }); }

h(2, '7. Visual Prompt per Scene');
p('Prompt untuk tim 3D/CGI atau generator video AI bila shot L1 akan ditingkatkan ke fotorealistik. Semua prompt: 16:9, tanpa teks di dalam gambar, tanpa logo pihak ketiga.');
table(['Scene', 'Prompt'], S.MAIN.map(s => [s.id, (VIEW[s.view] || {}).prompt || '']));

h(2, '8. Product Visualization');
table(['Produk (nama resmi s13)', 'Poin resmi', 'Visualisasi di film'], F.products.map(pr => [pr.name, pr.pts.join('; '), { 1: 'Pipa fiber multi-lajur, satu lajur DEDICATED menyala; chip port 1G / 10G / STM-4 / STM-16', 2: 'Penampang 22 core (11 pair) berkode warna → strand ke perangkat aktif pelanggan', 3: 'Rak 42U, slot 1U pelanggan menyala "1U · TANPA BIAYA", badge daya 10A DC / 2A AC', 4: 'Grafik utilisasi bulanan, garis minimum 2,5G, titik peak (ilustrasi)' }[pr.n]]));

h(2, '9. Pricing Visualization — Product Master Table');
h(3, '9.1 Sewa Kapasitas (Bandwidth): tarif (Rp) per bulan (s14)');
table(['Proyek', 'Wilayah', 'Kapasitas 1 G', 'Kapasitas 10 G'], F.bandwidth.rows.map(([pj, a, b]) => [pj, F.projects.find(x => x.id === pj).region, rp(a), rp(b)]));
p(`Pembelian 6 project sekaligus: **${rp(F.bandwidth.bundle6[0])}** (1 G) · **${rp(F.bandwidth.bundle6[1])}** (10 G) per bulan.\n\n*Turunan (dihitung, bukan tertulis di PPT):* jumlah tarif per proyek adalah Rp 113.000.000 (1 G) dan Rp 904.000.000 (10 G) per bulan. Tarif paket setara 80,0% dan 79,98% dari jumlah itu. Port STM-4 / STM-16 tercantum tanpa tarif.`);
h(3, '9.2 Sewa Core (Darkfiber) backbone (s14–s15)');
p(`Tarif per km / tahun: Darat **${rp(F.darkFiberKm.land)}** · Laut **${rp(F.darkFiberKm.sea)}**.`);
table(['Proyek', 'Segmen', 'Darat (km)', 'Laut (km)', 'Harga (Rp) / tahun'], F.darkFiberSeg.projects.flatMap(([pj, segs, tot]) => segs.map(([n, l, s2, v]) => [pj, n, l.toLocaleString('id-ID', { minimumFractionDigits: 3 }), s2 ? s2.toLocaleString('id-ID', { minimumFractionDigits: 3 }) : '–', rp(v)]).concat([[pj, '**Total**', '', '', '**' + rp(tot) + '**']])));
h(3, '9.3 Dark Fiber untuk Akses (s16)');
p(F.darkFiberAccess.text + '.'); table(['Proporsi jarak antara NOC/TS', 'Tarif acuan pada Kepdirut Tarif'], F.darkFiberAccess.rows);
h(3, '9.4 PPU (Pay Per Use): dibayarkan per bulan (s17–s18)');
table(['Utilisasi (Gbps)', '% Tarif Normal 10 G', 'P4', 'P5', 'P6', 'P7', 'P8A', 'P8B'], F.ppu.tiers.map(([r, pc], i) => [r, pc + '%', ...['P4', 'P5', 'P6', 'P7', 'P8A', 'P8B'].map(pj => rp(F.ppu.table[pj][i]))]));
p(F.ppu.basis + ' Minimum 2,5G, perhitungan maksimum di peak trafik pada bulan tersebut (s13).');
h(3, '9.5 Kolokasi: biaya acuan* (s19–s20), *monthly charge (s24)');
table(['Kategori', 'Produk', 'Biaya acuan'], [...F.coloRef.indoor.map(([n, v]) => ['Indoor', n, rp(v)]), ...F.coloRef.outdoor.map(([n, v]) => ['Outdoor – Lahan terbuka', n, rp(v)]), ...F.coloRef.tower.map(([n, v]) => ['Outdoor – Tower', n, rp(v)])]);
p(`Formula (s22): **${F.coloFormula}** Koefisien Hardship LTI (s23): P4 1,2 · P5 1,0 · P6 1,1 · P7 1,1 · P8 1,2.`);
table(['Pricelist indoor per proyek (s24)', ...F.coloIndoorPerProject.cols], F.coloIndoorPerProject.rows.map(([n, vals]) => [n, ...vals.map(rp)]));
p('Contoh resmi (s23): ' + F.coloExample + '.');

h(2, '10. Subscription Journey');
p('PPT **tidak** memuat prosedur berlangganan, SLA, periode kontrak, siklus penagihan, termin pembayaran, maupun lead time instalasi. Journey di film hanya memakai langkah yang dapat ditelusuri ke PPT; langkah lain ditandai untuk konfirmasi.');
table(['Step', 'Di layar', 'Dasar di PPT'], [['01', 'Hubungi Kami: tim komersial PT LTI', '"Beberapa Operator sudah terkoneksi di kota ini. Silahkan menghubungi Kami" (s6–s11); kontak s26'], ['02', 'Tentukan Layanan: produk, kapasitas, lokasi (per proyek, per segmen, per titik akses)', 's13, s14–s15'], ['03', 'Penawaran: sesuai tarif yang berlaku', 'Daftar tarif s14–s24 · **[NEEDS CONFIRMATION]** bentuk & proses penawaran'], ['04', 'Aktivasi & Interkoneksi: perangkat pelanggan di NOC/TS (kolokasi)', 's13 produk 3; s21 T&C kolokasi'], ['05', 'Layanan Berjalan', '**[NEEDS CONFIRMATION]** mekanisme aktivasi, kontrak, SLA']]);
p('On-screen footnote: *"Detail kontrak dan jadwal aktivasi dikonfirmasi bersama tim komersial · Syarat & Ketentuan Berlaku."*');

h(2, '11. Customer Journey (Commercial)');
table(['Tahap', 'Konten', 'Status'], [['Customer need', 'Kapasitas / infrastruktur pasif / penempatan perangkat / fleksibilitas', 'Dari PPT'], ['Product selection', '4 produk resmi', 'Dari PPT'], ['Technical feasibility', 'Cek ketersediaan jaringan di kota layanan', '**[NEEDS CONFIRMATION]** (tidak dijelaskan di PPT)'], ['Quotation', 'Berdasarkan daftar tarif', 'Tarif dari PPT; proses **[NEEDS CONFIRMATION]**'], ['Negotiation / Contract', 'Tidak ditampilkan spesifik', '**[NEEDS CONFIRMATION]**'], ['Installation / Provisioning', 'Instalasi & material tanggung jawab pelanggan (s21)', 'Dari PPT'], ['Service activation', 'Aktivasi & integrasi di NOC/TS; kolokasi 1U tidak berbayar', 'Dari PPT'], ['Monthly service', 'Kapasitas, PPU, kolokasi: tarif bulanan; dark fiber: tarif tahunan', 'Periode tarif dari PPT; siklus tagihan **[NEEDS CONFIRMATION]**']]);

h(2, '12. Use Case');
table(['Use case', 'Alur', 'Produk', 'Dasar'], [['ISP lokal', 'Jaringan Backbone Nasional → Titik Interkoneksi → Titik Layanan (NOC/TS) → Tenant Router/ISP → pelanggan', 'Sewa Kapasitas, PPU, Kolokasi 1U', 'Legenda topologi s6–s11; s5'], ['Operator telekomunikasi', 'BTS → backbone PRT; antena di menara lokasi PRT', 'Sewa Kapasitas / Sewa Core; kolokasi tower (3M window, antena MW)', 's5, s20'], ['Industri & layanan publik', 'Lokasi operasional / layanan publik → mitra B2B → PRT', 'Melalui mitra B2B', 'Potensi Pemanfaatan s5–s11'], ['Data Center (use case 4 dari brief)', 'Tidak dibuat', '—', 'Tidak ada dasar di PPT']]);

h(2, '13. On-Screen Text');
table(['View', 'Teks yang tampil (persis)'], Object.entries(ONSCREEN).map(([k, v]) => [k, v]));
p('Format angka di layar memakai pemisah ribuan Indonesia ("Rp 9.000.000"). PPT memakai dua format (9,000,000.00 di s14 dan 2.301.480.000 di s15); nilainya tidak diubah.');

h(2, '14. Camera Direction');
p('L1 memakai gerak kamera halus (push-in, crane, dolly, sinematik 24–35 mm), dengan slow-motion 0,5–0,8× hasil frame-blending dari render 3D. L2 hanya memakai zoom halus pada peta dan fly-through antar proyek. L3 statis: tidak ada gerak kamera pada layar harga, sehingga angka mudah dibaca, dan elemen masuk dengan fade-up 0,6 detik.');

h(2, '15. Transition');
p('Default *dip-to-navy* 0,3 detik antar adegan: bersih, korporat, dan menjaga keterbacaan harga. Adegan pertama fade from black, adegan terakhir fade to black 1,2 detik. Tidak memakai glitch, whip-pan, atau efek neon.');

h(2, '16. Music / SFX');
p('Skor ambient korporat disintesis khusus: pad D-mayor (Dmaj9 – Bm9 – Gmaj9 – A6sus), sub-bass, dan tick ritmis halus pada layar data. Musik otomatis *ducking* −6 hingga −9 dB saat VO berbicara, lalu naik di jeda dan end card. SFX: whoosh lembut di transisi L1, tick di kartu harga, dan boom rendah di end card.');

h(2, '17. CTA');
p(`Headline: **“Siap menghubungkan bisnis Anda?”** Tombol: *Jelajahi layanan kami · Cek ketersediaan jaringan · Bicara dengan tim komersial*. Kontak (hanya dari s26): Hotline **${F.contact.hotline}** · Telepon **${F.contact.phone}** · ${F.contact.company}, ${F.contact.address} · Email tim komersial: ${F.contact.sales.map(([n], i) => n + ' (' + F.contact.emails[i] + ')').join(', ')}.`);
p('\nWebsite dan QR code **tidak** ditampilkan karena tidak ada di PPT. Nomor ponsel sales ada di PPT tetapi **sengaja tidak ditampilkan** dalam video publik (lihat Bagian 19).');

h(2, '18. Fact-Check Table');
table(['Klaim di video', 'Nilai', 'Sumber PPT', 'Status'], [
  ['Tanggal operasi', F.network.since, 's4', 'OK'], ['Jumlah proyek / kabupaten', '6 / 17', 's4, s5', 'OK'],
  ['Panjang kabel darat / laut / total', `${F.network.landKm} / ${F.network.seaKm} / ${F.network.totalKm} KM`, 's4', 'OK · jumlah per proyek (s6–s11): 1.300 / 1.796 / 3.099 km (selisih pembulatan)'],
  ['Kota layanan / interkoneksi', '17 / 10', 's4', 'OK'], ['Kapasitas', '100 Gbps (expandable) per proyek, DWDM', 's4', 'OK · "600 Gbps" tidak dipakai karena tidak tertulis di PPT'],
  ['Wilayah', F.regions, 's4', 'OK'], ['Skema bisnis', 'B2B: Penyelenggara Telekomunikasi; ISP', 's5', 'OK'],
  ['4 produk & poinnya', 'Nama persis s13', 's13', 'OK'],
  ['Tarif 1G / 10G per proyek', 'lihat 9.1', 's14 = s17 (10G)', 'OK · konsisten di dua slide · rasio 10G/1G = 8× di semua proyek'],
  ['Paket 6 proyek', 'Rp 90.400.000 / Rp 723.000.000', 's14', 'OK'], ['Selisih paket vs per proyek', 'Rp 22.600.000 / Rp 181.000.000', 'Turunan dari s14', 'DIHITUNG · perlu persetujuan untuk ditampilkan'],
  ['Dark fiber per km/tahun', 'Rp 12.000.000 darat / Rp 36.000.000 laut', 's14', 'OK · 25 harga segmen s15 cocok dengan rumus km × tarif'],
  ['Contoh segmen', 'Sendawar – Long Bagun 191,790 km · Rp 2.301.480.000/tahun', 's15', 'OK'],
  ['Pengali akses dark fiber', '2,5× / 2× / 1,5× / 1×', 's16', 'OK · definisi "proporsi jarak" perlu konfirmasi'],
  ['PPU tier & nilai', 'lihat 9.4', 's17–s18', 'OK · 54 nilai = % × tarif 10G'], ['PPU minimum & peak', 'Minimum 2,5G; maksimum di peak trafik bulan tersebut', 's13', 'OK'],
  ['Kolokasi gratis kapasitas', '1U + daya maks. setara 10A DC atau 2A AC', 's21', 'OK'], ['Kolokasi gratis dark fiber', '1U perangkat pasif', 's21', 'OK'],
  ['Biaya acuan kolokasi', 'lihat 9.5', 's19–s20', 'OK'], ['Formula & hardship', 'Acuan × Hardship × Qty; P4 1,2 · P5 1,0 · P6 1,1 · P7 1,1 · P8 1,2', 's22–s23', 'OK · 30 nilai s24 cocok'],
  ['Contoh 2U Sendawar', 'Rp 1.800.000 / bulan', 's23', 'OK'],
  ['Simulasi ISP Tahuna (P8A 1G)', 'Rp 30.000.000 + kolokasi 1U Rp 0', 'Turunan s14, s21', 'ILUSTRASI · Tahuna = Titik Layanan P8A (s10)'],
  ['Simulasi PPU P5 peak 4,6 Gbps', '50% × Rp 152.000.000 = Rp 76.000.000', 'Turunan s18', 'ILUSTRASI · nilai cocok dengan tabel s18'],
  ['Kontak', 'Hotline 1500-876 · 021 22833872 · alamat · 4 email', 's26', 'OK'], ['Tagline', F.tagline, 's1, s27', 'OK'],
]);

h(2, '19. Items Requiring Confirmation');
[
  ['[NEEDS CONFIRMATION] Selisih harga paket 6 proyek', 'Film menampilkan "Selisih Rp 22.600.000 / Rp 181.000.000 per bulan" yang dihitung dari tabel s14. PPT tidak menyebutnya diskon. Setujui, atau hapus baris ini.'],
  ['[NEEDS CONFIRMATION] Spesifikasi daya kolokasi indoor', 's19 menulis "maks 10A DC / 2A AC power", sedangkan pricelist per proyek s24 menulis "max 2A AC power" saja. Tambahan 10A DC (Rp 526.000) tidak ada di pricelist per proyek. **PRICING CONFLICT — NEEDS CONFIRMATION.** Film memakai biaya acuan s19 dan menampilkan keduanya (10A DC dan 2A AC).'],
  ['[NEEDS CONFIRMATION] Tarif port STM-4 / STM-16', 'Port tercantum (s13) tanpa tarif. Film hanya menyebut port tersedia.'],
  ['[NEEDS CONFIRMATION] Definisi "Proporsi Jarak antara NOC/TS" (dark fiber akses)', 'Pembanding proporsi (terhadap apa?) dan dasar "Kepdirut Tarif" tidak dijelaskan. Film menampilkan tabel apa adanya.'],
  ['[NEEDS CONFIRMATION] Proses penawaran, kontrak, SLA, lead time, siklus tagihan, termin pembayaran, pajak', 'Tidak ada di PPT. Film tidak menyebut angka apa pun untuk hal-hal ini dan hanya menulis "dikonfirmasi bersama tim komersial". Film juga tidak menyatakan harga termasuk atau belum termasuk pajak.'],
  ['[NEEDS CONFIRMATION] Peran BAKTI pada kolokasi', 's21 menyatakan "Bakti hanya berkewajiban menyediakan layanan kolokasi…" dan persetujuan tambahan oleh Bakti. Film tidak menyebut pihak penyedia kolokasi.'],
  ['[NEEDS CONFIRMATION] Nomor ponsel pribadi sales', 'Ada di s26 tetapi tidak ditampilkan. Tampilkan hanya jika keempat orang yang bersangkutan setuju.'],
  ['[NEEDS CONFIRMATION] Penggunaan logo', 'Film memakai logo LTI resmi dari PPT. Logo BAKTI dan Kemkominfo sengaja tidak dipakai; butuh izin brand bila ingin ditampilkan.'],
  ['[NEEDS CONFIRMATION] Angka jaringan vs sumber lain', 'PPT: ±1304 / ±1798 / ±3102 km. Situs len-telko.co.id: 1.320,15 / 1.823,51 / 3.143,66 km. Film mengikuti PPT.'],
  ['[NEEDS CONFIRMATION] Data center, cloud, financial institution, content provider', 'Disebut di brief tetapi tidak ada di PPT. Tidak dibuat klaim atau use case khusus.'],
  ['[NEEDS CONFIRMATION] Status tarif 2025', 'Tautan press release tarif di s14 mengarah ke Siaran Pers Kominfo No. 90 (2019). Konfirmasi tarif ini masih berlaku saat video tayang (**live verification needed**).'],
  ['Guide VO', 'Suara di video adalah TTS sintetis sebagai panduan timing. Rekam ulang dengan narator profesional memakai naskah Bagian 5; timing per adegan tersedia di Bagian 4.'],
].forEach(([k, v], i) => p(`${i + 1}. **${k}**: ${v}`));
fs.writeFileSync('PRODUCTION_BIBLE.md', md.join('\n')); console.log('PRODUCTION_BIBLE.md', md.join('\n').length, 'chars');
