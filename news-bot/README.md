# News Digest Harian — Infrastruktur Digital Indonesia

Bot yang setiap pagi (±06:17 WIB) mengirim ringkasan berita ke **Telegram** dan **Gmail** untuk 5 topik:

| # | Topik | Kunci di `topics.json` |
|---|---|---|
| 1 | Kabel laut (SKKL) Indonesia & kabel internasional yang melintas | `kabel_laut` |
| 2 | Pembangunan & progres data center di Indonesia | `data_center` |
| 3 | Ekspansi Telkom, TIF/InfraNexia, XLSmart, Indosat, Lintasarta | `operator` |
| 4 | Trafik data Indonesia & Singapura (jendela 7 hari, karena beritanya jarang) | `trafik` |
| 5 | Infrastruktur AI & data center AI di Indonesia | `ai` |

**Alur:** Google News RSS → buang duplikat & berita yang sudah pernah terkirim → urutkan menurut kata kunci →
Claude menyusun ringkasan per topik (Bahasa Indonesia) → Telegram (ringkas) + email (ringkasan + daftar semua judul).

Berjalan gratis di **GitHub Actions** (`.github/workflows/news-digest.yml`), tanpa server.

> **Batasan penting:** Google News RSS hanya memberi *judul, nama media, dan tanggal* — bukan isi artikel.
> Jadi ringkasan AI adalah sintesis judul. Prompt melarang Claude menambah angka/fakta di luar judul, tetapi
> **verifikasi ke artikel asli sebelum dikutip** di laporan resmi. Bagian "Implikasi" adalah interpretasi AI.

---

## Setup (±20 menit, sekali saja)

### 1. Buat bot Telegram
1. Di Telegram, buka **@BotFather** → kirim `/newbot` → ikuti instruksi → salin **token** (`123456:ABC...`).
2. Buka bot Anda, kirim `/start` (wajib, agar bot boleh mengirim pesan ke Anda).
   Untuk grup/channel: tambahkan bot ke grup/channel (channel: jadikan admin), lalu kirim satu pesan di sana.
3. Ambil **chat id** dari komputer Anda:
   ```bash
   TELEGRAM_BOT_TOKEN=123456:ABC... python news-bot/digest.py --get-chat-id
   ```
   Atau buka `https://api.telegram.org/bot<TOKEN>/getUpdates` di browser dan cari `"chat":{"id": ...}`.

### 2. Buat App Password Gmail
1. Akun Google harus memakai **Verifikasi 2 Langkah**.
2. Buka <https://myaccount.google.com/apppasswords> → buat app password (nama bebas, mis. "news digest") → salin 16 karakternya.
3. Jika akun kantor (Google Workspace) tidak menampilkan menu ini, admin IT kemungkinan menonaktifkannya —
   pakai akun Gmail pribadi sebagai pengirim, dan isi `EMAIL_TO` dengan alamat kantor.

### 3. Siapkan Claude API key
Buat di <https://platform.claude.com/> → API Keys. Tanpa key ini bot tetap jalan, tetapi hanya mengirim
daftar judul (tanpa ringkasan dan tanpa penyaringan berita yang tidak relevan).

### 4. Isi GitHub Secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Isi |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token dari BotFather |
| `TELEGRAM_CHAT_ID` | chat id (bisa beberapa, pisahkan koma) |
| `GMAIL_USER` | alamat Gmail pengirim |
| `GMAIL_APP_PASSWORD` | app password 16 karakter |
| `EMAIL_TO` | penerima, pisahkan koma (opsional; default = `GMAIL_USER`) |
| `ANTHROPIC_API_KEY` | Claude API key |

Opsional di tab **Variables**: `CLAUDE_MODEL` (default `claude-opus-5`), `CLAUDE_EFFORT` (default `medium`),
`LOOKBACK_HOURS` (default `30`).

### 5. Aktifkan
Jadwal cron GitHub **hanya berjalan dari branch default (`main`)** — merge branch ini ke `main` dulu.
Lalu uji manual: tab **Actions → News Digest Harian → Run workflow** (centang *dry_run* untuk uji tanpa
mengirim; preview bisa diunduh sebagai artefak `digest-preview`).

---

## Menjalankan di komputer sendiri
```bash
pip install -r news-bot/requirements.txt
export ANTHROPIC_API_KEY=...            # opsional
python news-bot/digest.py --dry-run     # preview di news-bot/out/email.html & telegram.txt
python news-bot/digest.py               # kirim (butuh TELEGRAM_* dan/atau GMAIL_*)
```

## Mengubah topik / kata kunci
Edit `news-bot/topics.json` — tidak perlu ubah kode. Tips:
- Pakai kueri sederhana: satu frasa dalam tanda kutip, atau 2–3 kata (dibaca AND). Kombinasi `OR` + `AND`
  di Google News sering mengembalikan 0 hasil.
- `keywords` menentukan prioritas: judul yang memuat kata kunci didahulukan sebelum dipotong ke 35 berita/topik.
- `lookback_hours` per topik untuk topik yang jarang muncul beritanya.

## Mengubah jam kirim
Edit `cron` di `.github/workflows/news-digest.yml`. Formatnya UTC: jam WIB − 7.
Contoh 07:30 WIB → `30 0 * * *`.

---

## Hal yang perlu diketahui
- **Biaya Claude:** per hari ±7–10 ribu token input + ±3–6 ribu token output (termasuk thinking). Dengan `claude-opus-5`
  (US$5/US$25 per juta token) perkiraannya ±US$0,1–0,2 per hari. Angka ini estimasi dari ukuran prompt, belum
  diukur pada run nyata — cek di dashboard Claude setelah seminggu. Untuk menekan biaya, set variable
  `CLAUDE_MODEL=claude-sonnet-5`.
- **Keterlambatan jadwal:** GitHub bisa menunda run terjadwal (umumnya menit, kadang >1 jam saat sibuk).
- **Repo publik:** GitHub menonaktifkan jadwal cron setelah 60 hari tanpa aktivitas repo; aktifkan lagi dari tab
  Actions bila itu terjadi. Log Actions bisa dilihat publik — script tidak mencetak secret atau alamat email.
- **Anti-duplikat:** daftar berita yang sudah terkirim disimpan 14 hari di cache Actions. Jika cache hilang
  (tidak dipakai >7 hari), beberapa berita lama bisa terkirim ulang sekali.
- **Ketentuan Google News RSS:** feed ini dinyatakan untuk penggunaan pribadi non-komersial. Untuk distribusi
  luas (mis. ke banyak orang di luar tim), pertimbangkan sumber berita berlisensi.
- **Kegagalan:** jika Claude gagal, bot tetap mengirim daftar judul. Jika Telegram/email gagal, run ditandai
  merah di Actions (GitHub akan mengirim notifikasi email kegagalan ke pemilik repo).
