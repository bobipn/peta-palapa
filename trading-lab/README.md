# trading-lab

Kerangka riset dan **paper trading** kripto yang bisa di-backtest dengan jujur.
Ini versi "opsi B" dari prompt viral "24/7 autonomous trading agent". Bagian yang
masuk akal dipertahankan, bagian yang berbahaya dibuang.

| Prompt aslinya | Di sini |
|---|---|
| LLM ("Jev") memutuskan setiap candle | Logistic regression biasa: deterministik, bisa di-backtest, bisa diukur kalibrasinya |
| Install AgenKit + API key pihak ketiga | Nol dependensi: Python 3.9+ stdlib saja. Data dari endpoint publik Coinbase tanpa key |
| Eksekusi otomatis ke uang riil | **Tidak ada adapter order.** Hanya simulasi. Itu sengaja |
| Model menulis ulang strateginya sendiri setiap malam | `review` hanya membuat laporan. Perubahan config wajib diputuskan manusia |
| Eskalasi ke LLM saat krisis | Rezim `crisis` langsung membuat posisi flat |
| Kelly dari "confidence" model | Kelly biner dari p hasil model + rata-rata win/loss historis, **setelah biaya**, dengan ¼ Kelly |

## Cara pakai

```bash
cd trading-lab
python3 -m unittest discover -s tests -t .                 # 20 tes, ~5 detik

python3 -m tradinglab fetch --product BTC-USD --days 730 --out data/BTC-USD_1h.csv
python3 -m tradinglab backtest --data data/BTC-USD_1h.csv --report reports/btc.md
python3 -m tradinglab backtest --data data/BTC-USD_1h.csv --config my.json   # salin config.example.json

python3 -m tradinglab paper --product BTC-USD --state state/   # loop live, poll 60 detik
python3 -m tradinglab paper --product BTC-USD --state state/ --once   # satu langkah (untuk cron)
python3 -m tradinglab review --state state/
touch KILL      # kill switch: posisi flat pada eksekusi berikutnya, halt permanen
```

## Arsitektur

```
data.py       Bar, CSV, fetcher Coinbase (candle yang belum tutup dibuang)
features.py   fitur kausal: feature_row(bars, i) hanya membaca bars[0..i]
regime.py     trending / mean_reverting / high_vol / crisis, berbasis aturan
model.py      logistic regression L2 (Newton/IRLS), stdlib
sizing.py     fractional Kelly setelah biaya
risk.py       batas keras: DD 15% (latched), rugi harian 3%, posisi maks, kill switch
portfolio.py  spot long-only, fee + slippage, kas tidak pernah negatif
engine.py     loop bar-demi-bar yang dipakai BERSAMA oleh backtest dan paper
backtest.py   walk-forward, stress biaya 2×, kalibrasi, vonis otomatis
paper.py      paper trading live + review harian
research/     template tesis fundamental (riset manual, bukan kode)
results/      laporan backtest yang pernah dijalankan
```

Alur waktu per bar `i`: order yang diputuskan di close bar `i-1` dieksekusi di **open** bar `i`
(kill switch dicek ulang di titik ini). Lalu mark-to-market di close, lalu keputusan baru hanya
dengan data sampai bar `i`. Label training `open[j+1] → open[j+1+h]` hanya dipakai bila
`j+1+h ≤ i`.

Jaminan anti-lookahead diuji di `tests/test_no_lookahead.py`: dua deret yang identik sampai bar `k`
lalu berbeda liar sesudahnya harus menghasilkan keputusan, probabilitas, dan trade yang identik
sampai `k`. `tests/test_honesty.py` memastikan sistem **menolak** mengklaim edge pada random walk.

## Hasil pertama (2026-09-26, 1 jam, ~2 tahun data, config default)

| | BTC-USD | ETH-USD |
|---|---:|---:|
| Return strategi (OOS) | +2.95% | −11.46% |
| Buy & hold | +21.22% | +8.00% |
| Trade | 2 | 38 |
| Brier skill score | −0.0032 | −0.0013 |
| Vonis | **tidak ada edge** | **tidak ada edge** |

Detail lengkap ada di `results/`. Hasil ini sesuai perkiraan: fitur teknikal sederhana pada bar
1 jam tidak mengalahkan base rate. Hitungannya: rata-rata gerak BTC per jam sekitar ±0.31%. Dengan
p = 0.55, ekspektasi edge hanya 0.55×0.31% − 0.45×0.31% ≈ 0.03% per bar, sedangkan biaya round-trip
0.30%, sepuluh kali lipat. **Kerangka ini bekerja justru karena ia mengatakan "tidak".**

## WHAT COULD I BE WRONG ABOUT?

1. **Biaya.** 10 bps fee + 5 bps slippage per sisi hanya asumsi. Fee exchange lokal, spread IDR,
   dan kedalaman order book altcoin bisa jauh lebih buruk. Ukur dari order book riil sebelum percaya.
2. **Data Coinbase USD ≠ tempat Anda akan trading.** Harga, likuiditas, dan jam sibuk di exchange
   Indonesia bisa berbeda. Ada 10 bar hilang, dan jendela fitur berbasis indeks mengabaikan gap itu.
3. **Multiple testing.** Setiap kali config diubah lalu backtest diulang di data yang sama,
   hasilnya makin bias ke atas. Kalau Anda mencoba 20 variasi, satu akan terlihat bagus karena
   kebetulan. Sisihkan data terakhir sebagai holdout yang disentuh **sekali**.
4. **t-stat mengabaikan autokorelasi** dan volatility clustering. Nilai 2.0 di sini lebih lemah
   daripada kelihatannya.
5. **Drawdown diukur di close.** Gap atau crash intrabar bisa menembus batas 15% sebelum risk layer
   bereaksi. Paper mode juga bergantung pada satu sumber data. Kalau data basi, sistem hanya memberi
   peringatan, tidak otomatis flat.
6. **Rezim berbasis aturan** memakai ambang yang saya pilih (vol ratio 1.5/2.5, DD 15%), bukan hasil
   estimasi. Ambang itu belum divalidasi.
7. **Hanya long/flat spot.** Tidak ada short, funding, atau leverage. Ini mengurangi risiko tetapi
   juga peluang.
8. **Regulasi dan pajak** perdagangan aset kripto di Indonesia (pengawasan OJK, PPh/PPN) belum
   dibahas. Perlu verifikasi terkini sebelum memakai uang riil.

## Langkah berikut yang jujur

- Uji horizon lebih panjang (`horizon`, `bar_seconds` 4 jam/harian) di mana biaya relatif lebih kecil,
  **dengan holdout yang dikunci lebih dulu**.
- Ganti fitur harga murni dengan fitur yang punya dasar ekonomi (funding, basis, arus stablecoin),
  tetap lewat engine yang sama.
- Uang riil hanya dipertimbangkan setelah: vonis lolos di holdout, lalu paper trading beberapa minggu
  dengan hasil yang konsisten dengan backtest. Adapter order riil dibangun terpisah, dengan API key
  **tanpa izin withdrawal**.
