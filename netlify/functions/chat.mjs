/**
 * chat.mjs — Netlify Function (v2)
 * ------------------------------------------------------------------
 * Proxy antara widget di browser dan Anthropic API.
 * Alasan keberadaannya: API key harus tinggal di server. Jika widget
 * memanggil api.anthropic.com langsung, key ikut terkirim ke setiap
 * pengunjung dan bisa dibaca dari DevTools dalam 10 detik.
 *
 * Variabel lingkungan yang dibutuhkan (Netlify → Site settings →
 * Environment variables):
 *   ANTHROPIC_API_KEY   wajib
 *   ALLOWED_ORIGIN      opsional, default ke domain produksi di bawah
 *   CHAT_MODEL          opsional, default di bawah
 * ------------------------------------------------------------------
 */

import { SYSTEM_PROMPT } from "./knowledge-base.mjs";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

// Verifikasi nama model di dokumentasi resmi sebelum deploy — string
// model berubah seiring rilis. Haiku jauh lebih murah untuk beban FAQ.
const MODEL = process.env.CHAT_MODEL || "claude-haiku-4-5-20251001";

const MAX_TOKENS = 700;
const MAX_TURNS = 12; // pasangan pesan terakhir yang dikirim ulang
const MAX_CHARS = 1500; // per pesan pengunjung

// Rate limit sederhana per IP. Catatan jujur: memori function bersifat
// per-instance dan hilang saat cold start, jadi ini hanya menahan spam
// kasar, bukan penyerang yang serius. Untuk perlindungan nyata pakai
// Netlify Edge rate limiting atau Turnstile/hCaptcha.
const WINDOW_MS = 60_000;
const MAX_REQ_PER_WINDOW = 12;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  rec.count += 1;
  if (hits.size > 5000) hits.clear(); // jaga memori
  return rec.count > MAX_REQ_PER_WINDOW;
}

function corsHeaders(origin) {
  const allowed = process.env.ALLOWED_ORIGIN || "https://petakomersil.netlify.app";
  const list = allowed.split(",").map((s) => s.trim());
  const ok = list.includes(origin) ? origin : list[0];
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function sanitize(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
}

export default async (req) => {
  const origin = req.headers.get("origin") || "";
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Layanan chat belum dikonfigurasi." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const ip =
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";

  if (rateLimited(ip)) {
    return new Response(
      JSON.stringify({
        error: "Terlalu banyak permintaan. Coba lagi sebentar lagi.",
      }),
      { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  let messages;
  try {
    const body = await req.json();
    messages = sanitize(body.messages);
  } catch {
    return new Response(JSON.stringify({ error: "Format permintaan tidak valid." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "Pesan kosong." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let upstream;
  try {
    upstream = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages,
        stream: true,
      }),
    });
  } catch (err) {
    console.error("Upstream fetch gagal:", err);
    return new Response(
      JSON.stringify({ error: "Tidak dapat menghubungi layanan chat." }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("Anthropic API error", upstream.status, detail);
    return new Response(
      JSON.stringify({ error: "Layanan chat sedang bermasalah." }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // Teruskan SSE apa adanya; widget yang mengurai delta teks.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
};

export const config = { path: "/api/chat" };
