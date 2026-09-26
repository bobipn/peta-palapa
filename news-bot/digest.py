#!/usr/bin/env python3
"""
digest.py — Ringkasan berita harian infrastruktur digital Indonesia.

Alur:  Google News RSS  ->  filter & dedup  ->  ringkasan Claude  ->  Telegram + Gmail

Topik diatur di topics.json. Semua kredensial dibaca dari environment variable:

  ANTHROPIC_API_KEY    kunci Claude API (opsional; tanpa ini dikirim daftar judul saja)
  CLAUDE_MODEL         opsional, default "claude-opus-5"
  CLAUDE_EFFORT        opsional, default "medium" (low|medium|high)
  TELEGRAM_BOT_TOKEN   token dari @BotFather
  TELEGRAM_CHAT_ID     chat id tujuan (lihat: python digest.py --get-chat-id)
  GMAIL_USER           alamat Gmail pengirim
  GMAIL_APP_PASSWORD   App Password Gmail (bukan password biasa)
  EMAIL_TO             penerima, pisahkan dengan koma (default = GMAIL_USER)
  LOOKBACK_HOURS       jendela berita, default 30 jam
  STATE_FILE           file berita yang sudah terkirim, default news-bot/.state/seen.json

Pemakaian:
  python digest.py               # ambil, ringkas, kirim
  python digest.py --dry-run     # tidak mengirim; simpan preview ke news-bot/out/
  python digest.py --get-chat-id # tampilkan chat id dari pesan terbaru ke bot
"""

import argparse
import hashlib
import html
import json
import os
import re
import smtplib
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, parsedate_to_datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
WIB = timezone(timedelta(hours=7))
UA = "Mozilla/5.0 (compatible; peta-palapa-news-digest/1.0)"

LOCALES = {
    "id": {"hl": "id", "gl": "ID", "ceid": "ID:id"},
    "en": {"hl": "en-ID", "gl": "ID", "ceid": "ID:en"},
    "sg": {"hl": "en-SG", "gl": "SG", "ceid": "SG:en"},
}

MAX_ITEMS_PER_TOPIC = 35   # batas item yang dikirim ke Claude per topik
SEEN_RETENTION_DAYS = 14
TG_LIMIT = 3900            # batas aman < 4096 karakter per pesan Telegram


def log(msg):
    print(f"[digest] {msg}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------- fetch & parse

def http_get(url, timeout=20, retries=2):
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # jaringan / HTTP error — coba lagi
            last = e
            time.sleep(2 * (attempt + 1))
    raise last


def google_news_url(query, locale, lookback_hours):
    days = max(1, -(-lookback_hours // 24))  # pembulatan ke atas
    params = dict(LOCALES[locale])
    params["q"] = f"{query} when:{days}d"
    return "https://news.google.com/rss/search?" + urllib.parse.urlencode(params)


def norm_title(title):
    t = title.lower()
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def title_key(title):
    return hashlib.sha1(norm_title(title).encode()).hexdigest()[:16]


def parse_feed(xml_bytes):
    root = ET.fromstring(xml_bytes)
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        src_el = it.find("source")
        source = (src_el.text or "").strip() if src_el is not None else ""
        # Google News menulis judul "Judul - Sumber"; buang akhiran sumber
        if source and title.endswith(" - " + source):
            title = title[: -len(" - " + source)].strip()
        try:
            pub = parsedate_to_datetime(it.findtext("pubDate") or "")
            if pub.tzinfo is None:
                pub = pub.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            pub = None
        if title and link:
            yield {"title": title, "link": link, "source": source, "published": pub}


def relevance(title, keywords):
    """Jumlah kata kunci topik yang muncul di judul (pencocokan per kata)."""
    t = norm_title(title)
    return sum(1 for k in keywords if re.search(r"\b" + re.escape(norm_title(k)) + r"\b", t))


def collect(topics, default_lookback, seen):
    now = datetime.now(timezone.utc)
    taken = set()
    by_topic = {}
    for t in topics:
        lookback = int(t.get("lookback_hours") or default_lookback)
        cutoff = now - timedelta(hours=lookback)
        items = []
        for q in t["queries"]:
            url = google_news_url(q["q"], q.get("locale", "id"), lookback)
            try:
                entries = list(parse_feed(http_get(url)))
            except Exception as e:
                log(f"gagal ambil feed '{q['q']}': {e}")
                continue
            for e in entries:
                k = title_key(e["title"])
                if k in taken or k in seen:
                    continue
                if e["published"] and e["published"] < cutoff:
                    continue
                taken.add(k)
                e["key"] = k
                e["score"] = relevance(e["title"], t.get("keywords", []))
                items.append(e)
            time.sleep(1)  # sopan ke server
        # prioritaskan judul yang relevan, lalu yang terbaru
        items.sort(key=lambda e: (e["score"] > 0, e["published"] or cutoff), reverse=True)
        by_topic[t["key"]] = items[:MAX_ITEMS_PER_TOPIC]
        hits = sum(1 for e in by_topic[t["key"]] if e["score"] > 0)
        log(f"{t['key']}: {len(by_topic[t['key']])} berita baru ({hits} cocok kata kunci)")
    return by_topic


# ---------------------------------------------------------------- state

def load_seen(path):
    try:
        data = json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return {}
    cutoff = time.time() - SEEN_RETENTION_DAYS * 86400
    return {k: ts for k, ts in data.items() if ts >= cutoff}


def save_seen(path, seen, by_topic):
    now = time.time()
    for items in by_topic.values():
        for e in items:
            seen[e["key"]] = now
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(seen))


# ---------------------------------------------------------------- Claude

SYSTEM_PROMPT = """Anda analis intelijen pasar telekomunikasi untuk Manajer Komersial di operator \
backbone serat optik wholesale di Indonesia (Palapa Ring Tengah: Sulawesi, Kalimantan Timur, \
Maluku Utara). Tugas Anda menyusun ringkasan berita harian dalam Bahasa Indonesia yang ringkas, \
formal, dan faktual.

Aturan ketat:
- Sumber Anda HANYA judul berita, nama media, dan tanggal yang diberikan. Anda tidak membaca isi \
artikel. Jangan menambahkan angka, nama, tanggal, kapasitas, atau nilai investasi yang tidak \
tertulis di judul. Jika judul ambigu, tulis secara hati-hati ("dilaporkan", "menurut judul").
- Gabungkan berita yang membahas peristiwa sama menjadi satu poin dan cantumkan semua id-nya di refs.
- Buang berita yang tidak relevan dengan topik (mis. "kabel" listrik rumah tangga, promo paket data \
ritel, berita saham tanpa kaitan infrastruktur, hasil pencarian kata kunci yang salah sasaran).
- Sebuah berita boleh dipindah ke bagian lain bila lebih cocok, tetapi jangan diulang di dua bagian.
- Maksimal 6 poin per bagian, urutkan dari yang paling penting secara bisnis infrastruktur.
- Setiap poin 1–2 kalimat. Tanpa basa-basi, tanpa emoji.
- "sorotan": 1–2 kalimat inti hari ini. Jika tidak ada yang signifikan, katakan demikian.
- "implikasi": maksimal 3 butir tentang relevansinya bagi bisnis backbone/wholesale serat optik \
dan kawasan timur Indonesia. Ini interpretasi, jadi hanya tulis bila benar-benar ditopang judul \
berita; boleh kosong."""


def build_schema(topic_keys):
    point = {
        "type": "object",
        "properties": {
            "text": {"type": "string"},
            "refs": {"type": "array", "items": {"type": "integer"}},
        },
        "required": ["text", "refs"],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {
            "sorotan": {"type": "string"},
            "sections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "key": {"type": "string", "enum": topic_keys},
                        "points": {"type": "array", "items": point},
                    },
                    "required": ["key", "points"],
                    "additionalProperties": False,
                },
            },
            "implikasi": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["sorotan", "sections", "implikasi"],
        "additionalProperties": False,
    }


def build_prompt(topics, by_topic, index):
    lines = [f"Tanggal laporan: {datetime.now(WIB):%d %B %Y} (WIB).", ""]
    for t in topics:
        lines.append(f"## Bagian `{t['key']}` — {t['title']}")
        items = by_topic.get(t["key"], [])
        if not items:
            lines.append("(tidak ada berita baru)")
        for e in items:
            n = len(index)
            index.append(e)
            d = e["published"].astimezone(WIB).strftime("%d/%m %H:%M") if e["published"] else "-"
            lines.append(f"[{n}] {e['title']} — {e['source'] or '?'} ({d})")
        lines.append("")
    lines.append("Susun ringkasan sesuai skema JSON. refs berisi nomor id dalam kurung siku.")
    return "\n".join(lines)


def summarize(topics, by_topic):
    """Kembalikan (hasil_json, index_item) atau (None, index_item) bila gagal/tanpa API key."""
    index = []
    prompt = build_prompt(topics, by_topic, index)
    if not index:
        return None, index
    if not os.environ.get("ANTHROPIC_API_KEY"):
        log("ANTHROPIC_API_KEY kosong — kirim daftar judul tanpa ringkasan AI")
        return None, index

    import anthropic  # impor di sini agar --get-chat-id / tanpa API key tetap jalan

    client = anthropic.Anthropic(max_retries=3)
    model = os.environ.get("CLAUDE_MODEL") or "claude-opus-5"
    effort = os.environ.get("CLAUDE_EFFORT") or "medium"
    kwargs = dict(
        model=model,
        max_tokens=16000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
        thinking={"type": "adaptive"},
        output_config={
            "effort": effort,
            "format": {"type": "json_schema", "schema": build_schema([t["key"] for t in topics])},
        },
    )
    try:
        try:
            # fallback sisi server bila model menolak (refusal)
            resp = client.beta.messages.create(
                betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs
            )
        except anthropic.BadRequestError as e:
            log(f"fallbacks ditolak ({e.message}); ulangi tanpa fallbacks")
            resp = client.messages.create(**kwargs)
    except anthropic.APIError as e:
        log(f"Claude API gagal: {e}")
        return None, index

    if resp.stop_reason == "refusal":
        log("Claude menolak permintaan — kirim daftar judul saja")
        return None, index
    if resp.stop_reason == "max_tokens":
        log("output terpotong (max_tokens) — kirim daftar judul saja")
        return None, index
    text = next((b.text for b in resp.content if b.type == "text"), "")
    try:
        data = json.loads(text)
    except ValueError:
        log("output Claude bukan JSON valid — kirim daftar judul saja")
        return None, index
    log(f"ringkasan OK ({model}, in={resp.usage.input_tokens} out={resp.usage.output_tokens} token)")
    return data, index


# ---------------------------------------------------------------- render

def esc(s):
    return html.escape(s or "", quote=True)


def fallback_summary(topics, by_topic, index):
    """Tanpa AI: tiap judul yang cocok kata kunci jadi satu poin (maks 8 per topik)."""
    pos = {id(e): i for i, e in enumerate(index)}
    return {
        "sorotan": "",
        "sections": [
            {"key": t["key"],
             "points": [{"text": e["title"], "refs": [pos[id(e)]]}
                        for e in by_topic.get(t["key"], []) if e.get("score")][:8]}
            for t in topics
        ],
        "implikasi": [],
    }


def ordered_sections(topics, summary):
    got = {}
    for s in summary.get("sections", []):
        got.setdefault(s["key"], []).extend(s.get("points", []))
    return [(t, got.get(t["key"], [])) for t in topics]


def ref_links(refs, index, fmt):
    out = []
    for r in refs:
        if isinstance(r, int) and 0 <= r < len(index):
            e = index[r]
            out.append(fmt.format(url=esc(e["link"]), src=esc(e["source"] or "sumber")))
    return out


def render_telegram(topics, summary, index, ai):
    date = datetime.now(WIB).strftime("%d %b %Y")
    blocks = [f"<b>📰 Ringkasan Infrastruktur Digital — {date}</b>"]
    if not ai:
        blocks.append("<i>Mode tanpa AI: daftar judul terbaru.</i>")
    if summary.get("sorotan"):
        blocks.append(f"<b>Sorotan:</b> {esc(summary['sorotan'])}")
    for t, points in ordered_sections(topics, summary):
        lines = [f"<b>{t.get('emoji', '•')} {esc(t['title'])}</b>"]
        if not points:
            lines.append("<i>Tidak ada berita baru.</i>")
        for p in points:
            links = ref_links(p.get("refs", []), index, '<a href="{url}">{src}</a>')
            suffix = f" ({', '.join(links)})" if links else ""
            lines.append(f"• {esc(p['text'])}{suffix}")
        blocks.append("\n".join(lines))
    if summary.get("implikasi"):
        blocks.append("<b>💡 Implikasi (interpretasi AI)</b>\n" +
                      "\n".join(f"• {esc(x)}" for x in summary["implikasi"]))
    blocks.append("<i>Sumber: Google News RSS. Ringkasan AI berbasis judul berita — "
                  "verifikasi ke artikel asli sebelum dipakai.</i>")
    return blocks


def split_messages(blocks, limit=TG_LIMIT):
    """Gabungkan blok (per bagian) ke pesan <= limit; pecah per baris hanya bila satu blok terlalu besar."""
    msgs, cur = [], ""
    for b in blocks:
        b = b.strip("\n")
        if cur and len(cur) + 2 + len(b) <= limit:
            cur += "\n\n" + b
            continue
        if len(b) <= limit:  # blok muat utuh di pesan baru
            if cur:
                msgs.append(cur)
            cur = b
            continue
        cur += "\n" if cur else ""
        for line in b.split("\n"):
            if cur and len(cur) + 1 + len(line) > limit:
                msgs.append(cur)
                cur = line
            else:
                cur = f"{cur}\n{line}" if cur else line
    if cur.strip():
        msgs.append(cur)
    return msgs


def render_email(topics, summary, index, by_topic, ai):
    date = datetime.now(WIB).strftime("%d %B %Y")
    css_h = "font-size:16px;margin:22px 0 6px;color:#0b3d62;border-bottom:1px solid #d6e2ec;padding-bottom:4px"
    parts = [
        '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:720px;margin:auto;color:#1c2833;line-height:1.5">',
        f'<h2 style="margin:0 0 4px;color:#0b3d62">Ringkasan Infrastruktur Digital</h2>'
        f'<div style="color:#5d6d7e;font-size:13px">{date} · Kabel laut · Data center · Operator · Trafik · AI</div>',
    ]
    if not ai:
        parts.append('<p style="color:#a04000"><i>Mode tanpa AI: daftar judul terbaru.</i></p>')
    if summary.get("sorotan"):
        parts.append(f'<p style="background:#eef5fb;padding:10px 12px;border-left:4px solid #1f6fa8">'
                     f'<b>Sorotan:</b> {esc(summary["sorotan"])}</p>')
    for t, points in ordered_sections(topics, summary):
        parts.append(f'<h3 style="{css_h}">{t.get("emoji", "")} {esc(t["title"])}</h3>')
        if not points:
            parts.append('<p style="color:#7f8c8d"><i>Tidak ada berita baru.</i></p>')
            continue
        parts.append('<ul style="padding-left:20px;margin:0">')
        for p in points:
            links = ref_links(p.get("refs", []), index, '<a href="{url}" style="color:#1f6fa8">{src}</a>')
            suffix = f' <span style="font-size:12px">({", ".join(links)})</span>' if links else ""
            parts.append(f'<li style="margin:4px 0">{esc(p["text"])}{suffix}</li>')
        parts.append("</ul>")
    if summary.get("implikasi"):
        parts.append(f'<h3 style="{css_h}">💡 Implikasi (interpretasi AI)</h3><ul style="padding-left:20px">')
        parts += [f"<li>{esc(x)}</li>" for x in summary["implikasi"]]
        parts.append("</ul>")

    # Lampiran: semua judul mentah per topik, agar tidak ada yang hilang oleh filter AI
    parts.append(f'<h3 style="{css_h}">Semua judul yang dipantau</h3>')
    for t in topics:
        items = by_topic.get(t["key"], [])
        if not items:
            continue
        parts.append(f'<p style="margin:10px 0 2px"><b>{esc(t["title"])}</b> ({len(items)})</p>'
                     '<ol style="font-size:13px;padding-left:22px;margin:0;color:#34495e">')
        for e in items:
            d = e["published"].astimezone(WIB).strftime("%d/%m %H:%M") if e["published"] else ""
            parts.append(f'<li><a href="{esc(e["link"])}" style="color:#1f6fa8">{esc(e["title"])}</a>'
                         f' — {esc(e["source"])} <span style="color:#95a5a6">{d}</span></li>')
        parts.append("</ol>")
    parts.append('<p style="font-size:12px;color:#7f8c8d;margin-top:24px">Sumber: Google News RSS. '
                 'Ringkasan AI disusun dari judul berita, bukan isi artikel — verifikasi ke sumber asli '
                 'sebelum dikutip.</p></div>')
    return "\n".join(parts)


def html_to_text(s):
    s = re.sub(r"<br\s*/?>|</p>|</li>|</h\d>", "\n", s)
    s = re.sub(r"<li[^>]*>", "- ", s)
    s = re.sub(r"<[^>]+>", "", s)
    return html.unescape(re.sub(r"\n{3,}", "\n\n", s)).strip()


# ---------------------------------------------------------------- delivery

def telegram_api(token, method, payload):
    data = urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/{method}", data=data,
                                 headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:  # Telegram mengirim detail error di body
        return json.loads(e.read() or b"{}") | {"ok": False, "http_status": e.code}


def send_telegram(messages):
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    chat_ids = [c.strip() for c in os.environ["TELEGRAM_CHAT_ID"].split(",") if c.strip()]
    for chat in chat_ids:
        for m in messages:
            res = telegram_api(token, "sendMessage", {
                "chat_id": chat, "text": m, "parse_mode": "HTML",
                "disable_web_page_preview": "true",
            })
            if not res.get("ok"):
                raise RuntimeError(f"Telegram error: {res}")
            time.sleep(0.5)
    log(f"Telegram terkirim: {len(messages)} pesan ke {len(chat_ids)} chat")


def send_email(subject, html_body):
    user = os.environ["GMAIL_USER"]
    pwd = os.environ["GMAIL_APP_PASSWORD"].replace(" ", "")
    to = [x.strip() for x in (os.environ.get("EMAIL_TO") or user).split(",") if x.strip()]
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr(("News Digest Infrastruktur", user))
    msg["To"] = ", ".join(to)
    msg.attach(MIMEText(html_to_text(html_body), "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=60) as s:
        s.login(user, pwd)
        s.sendmail(user, to, msg.as_string())
    log(f"Email terkirim ke {len(to)} penerima")


def get_chat_id():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        sys.exit("Set TELEGRAM_BOT_TOKEN dulu.")
    res = telegram_api(token, "getUpdates", {})
    chats = {}
    for u in res.get("result", []):
        m = u.get("message") or u.get("channel_post") or u.get("my_chat_member") or {}
        c = m.get("chat")
        if c:
            chats[c["id"]] = c.get("title") or c.get("username") or c.get("first_name")
    if not chats:
        print("Belum ada pesan. Kirim /start ke bot (atau tambahkan bot ke grup/channel), lalu ulangi.")
    for cid, name in chats.items():
        print(f"TELEGRAM_CHAT_ID={cid}   ({name})")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="jangan kirim; simpan preview ke news-bot/out/")
    ap.add_argument("--get-chat-id", action="store_true", help="tampilkan chat id Telegram")
    args = ap.parse_args()

    if args.get_chat_id:
        return get_chat_id()

    topics = json.loads((HERE / "topics.json").read_text())["topics"]
    lookback = int(os.environ.get("LOOKBACK_HOURS") or 30)
    state_file = os.environ.get("STATE_FILE") or str(HERE / ".state" / "seen.json")
    seen = load_seen(state_file)
    log(f"{len(seen)} berita tercatat sudah terkirim sebelumnya")

    by_topic = collect(topics, lookback, seen)
    summary, index = summarize(topics, by_topic)
    ai = summary is not None
    if not ai:
        summary = fallback_summary(topics, by_topic, index)

    tg_messages = split_messages(render_telegram(topics, summary, index, ai))
    email_html = render_email(topics, summary, index, by_topic, ai)
    subject = f"[Digest] Infrastruktur Digital Indonesia — {datetime.now(WIB):%d %b %Y}"

    if args.dry_run:
        out = HERE / "out"
        out.mkdir(exist_ok=True)
        (out / "email.html").write_text(email_html)
        (out / "telegram.txt").write_text("\n\n----- pesan berikutnya -----\n\n".join(tg_messages))
        log(f"dry-run: preview disimpan di {out}/ ({len(tg_messages)} pesan Telegram)")
        return

    channels = []
    if os.environ.get("TELEGRAM_BOT_TOKEN") and os.environ.get("TELEGRAM_CHAT_ID"):
        channels.append(("telegram", lambda: send_telegram(tg_messages)))
    if os.environ.get("GMAIL_USER") and os.environ.get("GMAIL_APP_PASSWORD"):
        channels.append(("email", lambda: send_email(subject, email_html)))
    if not channels:
        sys.exit("Tidak ada kanal terkonfigurasi (set TELEGRAM_* dan/atau GMAIL_*).")

    failed = []
    for name, fn in channels:
        try:
            fn()
        except Exception as e:
            log(f"GAGAL kirim {name}: {e}")
            failed.append(name)

    if len(failed) < len(channels):
        save_seen(state_file, seen, by_topic)  # tandai terkirim hanya bila minimal satu kanal sukses
    if failed:
        sys.exit(f"Kanal gagal: {', '.join(failed)}")


if __name__ == "__main__":
    main()
