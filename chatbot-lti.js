/**
 * chatbot-lti.js — widget chat PRT · LTI
 * ------------------------------------------------------------------
 * Cara pakai: taruh satu baris ini sebelum </body> di setiap halaman.
 *   <script src="/chatbot-lti.js" defer></script>
 *
 * Tidak ada dependensi. Seluruh tampilan dibungkus Shadow DOM sehingga
 * CSS website Anda dan CSS widget tidak saling menimpa.
 * ------------------------------------------------------------------
 */
(function () {
  "use strict";

  if (window.__ltiChatLoaded) return;
  window.__ltiChatLoaded = true;

  // Endpoint fungsi chat. Di Netlify cukup "/api/chat".
  // Di Cloudflare: ganti "/api/chat" di bawah dengan URL Worker chat Anda, mis:
  //   "https://lti-chat.NAMA-AKUN.workers.dev/api/chat"
  var ENDPOINT = (window.LTI_CHAT_ENDPOINT) || "/api/chat";
  var STORE_KEY = "lti_chat_v1";

  var GREETING =
    "Selamat datang di portal komersial **Palapa Ring Paket Tengah**. " +
    "Saya bisa menjelaskan cakupan jaringan, PoP, dan lini layanan LTI. " +
    "Untuk penawaran, saya arahkan ke tim komersial.";

  var CHIPS = [
    "Wilayah mana saja yang dilewati PRT?",
    "Apa saja layanan yang ditawarkan?",
    "Bagaimana cara minta penawaran?",
  ];

  /* ---------------- markup & style ---------------- */

  var CSS = `
  :host { all: initial; }
  *, *::before, *::after { box-sizing: border-box; }

  .root {
    --ink:#0A1520; --panel:#0F1D2B; --surface:#17293A; --raise:#1E3448;
    --line:rgba(125,180,210,.18); --text:#E6EFF5; --muted:#8CA7BA;
    --signal:#2FD6C0; --signal-soft:rgba(47,214,192,.12);
    position:fixed; right:20px; bottom:20px; z-index:2147483000;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,"Helvetica Neue",Arial,sans-serif;
    font-size:14px; line-height:1.6; color:var(--text);
  }

  /* ---- launcher: simpul & tautan jaringan, bukan balon obrolan ---- */
  .launcher {
    display:flex; align-items:center; gap:10px;
    height:52px; padding:0 20px 0 16px; border:1px solid var(--line);
    border-radius:26px; background:var(--panel); color:var(--text);
    font:inherit; font-weight:600; font-size:13.5px; letter-spacing:.01em;
    cursor:pointer; box-shadow:0 10px 30px -12px rgba(0,0,0,.7);
    transition:transform .18s ease, border-color .18s ease;
  }
  .launcher:hover { transform:translateY(-2px); border-color:rgba(47,214,192,.45); }
  .launcher:focus-visible { outline:2px solid var(--signal); outline-offset:3px; }
  .launcher svg { flex:none; }
  .root.open .launcher { display:none; }

  /* ---- panel ---- */
  .panel {
    display:none; flex-direction:column; overflow:hidden;
    width:384px; height:min(578px, calc(100vh - 40px));
    background:var(--panel); border:1px solid var(--line); border-radius:18px;
    box-shadow:0 24px 64px -20px rgba(0,0,0,.75);
  }
  .root.open .panel { display:flex; animation:rise .22s ease-out; }
  @keyframes rise { from{opacity:0; transform:translateY(10px)} to{opacity:1; transform:none} }

  .head { position:relative; padding:16px 16px 14px; background:var(--ink); flex:none; }
  .head-row { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
  .eyebrow {
    font-size:10px; font-weight:700; letter-spacing:.16em; text-transform:uppercase;
    color:var(--signal); margin:0 0 4px;
  }
  .title { margin:0; font-size:15px; font-weight:650; letter-spacing:-.01em; }
  .sub { margin:3px 0 0; font-size:11.5px; color:var(--muted); font-variant-numeric:tabular-nums; }
  .close {
    flex:none; width:30px; height:30px; display:grid; place-items:center;
    border:1px solid transparent; border-radius:8px; background:transparent;
    color:var(--muted); cursor:pointer;
  }
  .close:hover { background:var(--surface); color:var(--text); }
  .close:focus-visible { outline:2px solid var(--signal); outline-offset:2px; }

  /* Elemen tanda tangan: pulsa cahaya menyusuri serat saat bot mengetik. */
  .fiber { position:absolute; left:0; right:0; bottom:0; height:1px; background:var(--line); overflow:hidden; }
  .fiber::after {
    content:""; position:absolute; inset:0 auto 0 -40%; width:40%;
    background:linear-gradient(90deg,transparent,var(--signal),transparent);
    opacity:0; }
  .root.busy .fiber::after { opacity:1; animation:travel 1.5s linear infinite; }
  @keyframes travel { to { left:100%; } }

  /* ---- pesan ---- */
  .log { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:14px; scrollbar-width:thin; }
  .log::-webkit-scrollbar { width:8px; }
  .log::-webkit-scrollbar-thumb { background:var(--raise); border-radius:8px; }

  .msg { max-width:88%; }
  .msg.user { align-self:flex-end; background:var(--raise); border-radius:14px 14px 4px 14px; padding:9px 13px; }
  .msg.bot { align-self:flex-start; }
  .msg.bot .who {
    display:block; font-size:10px; font-weight:700; letter-spacing:.14em;
    text-transform:uppercase; color:var(--muted); margin-bottom:5px;
  }
  .msg p { margin:0 0 8px; }
  .msg p:last-child { margin-bottom:0; }
  .msg ul, .msg ol { margin:0 0 8px; padding-left:20px; }
  .msg li { margin-bottom:3px; }
  .msg strong { color:#fff; font-weight:650; }
  .msg code { background:var(--surface); padding:1px 5px; border-radius:4px; font-size:12.5px; }
  .msg.error { color:#FFB4A8; font-size:13px; }

  .caret::after {
    content:""; display:inline-block; width:7px; height:14px; margin-left:2px;
    background:var(--signal); vertical-align:-2px; animation:blink 1s steps(2) infinite;
  }
  @keyframes blink { 50% { opacity:0 } }

  .chips { display:flex; flex-wrap:wrap; gap:7px; padding-top:2px; }
  .chip {
    border:1px solid var(--line); background:transparent; color:var(--muted);
    border-radius:999px; padding:6px 12px; font:inherit; font-size:12.5px;
    cursor:pointer; text-align:left;
  }
  .chip:hover { border-color:var(--signal); color:var(--text); background:var(--signal-soft); }
  .chip:focus-visible { outline:2px solid var(--signal); outline-offset:2px; }

  /* ---- input ---- */
  .foot { flex:none; border-top:1px solid var(--line); padding:12px 14px 10px; background:var(--panel); }
  .field { display:flex; align-items:flex-end; gap:8px; }
  textarea {
    flex:1; resize:none; max-height:110px; min-height:38px;
    background:var(--surface); color:var(--text); font:inherit; font-size:14px;
    border:1px solid transparent; border-radius:10px; padding:9px 11px;
  }
  textarea::placeholder { color:var(--muted); }
  textarea:focus { outline:none; border-color:rgba(47,214,192,.5); }
  .send {
    flex:none; width:38px; height:38px; display:grid; place-items:center;
    border:none; border-radius:10px; background:var(--signal); color:var(--ink);
    cursor:pointer; transition:opacity .15s;
  }
  .send:disabled { opacity:.35; cursor:default; }
  .send:focus-visible { outline:2px solid var(--signal); outline-offset:2px; }
  .note { margin:8px 2px 0; font-size:10.5px; color:var(--muted); line-height:1.45; }

  @media (max-width:520px) {
    .root { right:12px; bottom:12px; left:12px; }
    .panel { width:auto; height:min(560px, calc(100vh - 24px)); }
    .launcher { margin-left:auto; }
  }
  @media (prefers-reduced-motion:reduce) {
    .root.open .panel, .root.busy .fiber::after, .caret::after { animation:none; }
    .launcher { transition:none; }
    .root.busy .fiber::after { opacity:.6; left:0; width:100%; }
  }`;

  var NODE_ICON =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">' +
    '<circle cx="3.5" cy="10" r="2.2" fill="#2FD6C0"/>' +
    '<circle cx="16.5" cy="4.5" r="2" stroke="#2FD6C0" stroke-width="1.4"/>' +
    '<circle cx="16.5" cy="15.5" r="2" stroke="#2FD6C0" stroke-width="1.4"/>' +
    '<path d="M5.6 9.1 14.6 5.2M5.6 10.9l9 3.9" stroke="#2FD6C0" stroke-width="1.3" opacity=".65"/></svg>';

  var SEND_ICON =
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="M2 8h11M8.5 3.5 13 8l-4.5 4.5" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var X_ICON =
    '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
    '<path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  /* ---------------- util ---------------- */

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Markdown minimal. Sengaja tidak memakai library: yang dibutuhkan
  // hanya tebal, kode inline, dan daftar.
  function render(text) {
    var html = escapeHtml(text);
    html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");

    var out = "";
    var listType = null;
    html.split("\n").forEach(function (line) {
      var bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      var num = line.match(/^\s*\d+[.)]\s+(.*)$/);
      var tag = bullet ? "ul" : num ? "ol" : null;
      if (tag) {
        if (listType !== tag) {
          if (listType) out += "</" + listType + ">";
          out += "<" + tag + ">";
          listType = tag;
        }
        out += "<li>" + (bullet ? bullet[1] : num[1]) + "</li>";
      } else {
        if (listType) {
          out += "</" + listType + ">";
          listType = null;
        }
        if (line.trim()) out += "<p>" + line + "</p>";
      }
    });
    if (listType) out += "</" + listType + ">";
    return out || "<p></p>";
  }

  function load() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function save(history) {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-20)));
    } catch (e) {
      /* mode privat atau kuota penuh — riwayat cukup di memori */
    }
  }

  /* ---------------- bangun UI ---------------- */

  var host = document.createElement("div");
  host.setAttribute("data-lti-chat", "");
  var shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML =
    "<style>" +
    CSS +
    "</style>" +
    '<div class="root" part="root">' +
    '<button class="launcher" type="button" aria-label="Buka asisten PRT">' +
    NODE_ICON +
    "<span>Tanya jaringan PRT</span></button>" +
    '<section class="panel" role="dialog" aria-modal="false" aria-label="Asisten PRT">' +
    '<header class="head">' +
    '<div class="head-row"><div>' +
    '<p class="eyebrow">Palapa Ring Tengah</p>' +
    '<h2 class="title">Asisten Komersial</h2>' +
    '<p class="sub">3.100 km · 27 PoP · 600 Gbps</p>' +
    "</div>" +
    '<button class="close" type="button" aria-label="Tutup">' + X_ICON + "</button>" +
    '</div><div class="fiber"></div></header>' +
    '<div class="log" role="log" aria-live="polite"></div>' +
    '<footer class="foot"><div class="field">' +
    '<textarea rows="1" placeholder="Tulis pertanyaan Anda…" aria-label="Pertanyaan"></textarea>' +
    '<button class="send" type="button" aria-label="Kirim" disabled>' + SEND_ICON + "</button>" +
    "</div>" +
    '<p class="note">Jawaban dibuat otomatis dan bisa keliru. Harga, SLA, dan ketersediaan kapasitas dikonfirmasi tim komersial LTI.</p>' +
    "</footer></section></div>";

  document.body.appendChild(host);

  var $ = shadow.querySelector.bind(shadow);
  var root = $(".root"),
    panel = $(".panel"),
    log = $(".log"),
    input = $("textarea"),
    sendBtn = $(".send");

  var history = load();
  var busy = false;
  var controller = null;

  /* ---------------- render pesan ---------------- */

  function addMsg(role, text) {
    var el = document.createElement("div");
    el.className = "msg " + (role === "user" ? "user" : "bot");
    if (role === "user") {
      el.textContent = text;
    } else {
      el.innerHTML = '<span class="who">Asisten PRT</span><div class="body">' + render(text) + "</div>";
    }
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function addChips() {
    var wrap = document.createElement("div");
    wrap.className = "chips";
    CHIPS.forEach(function (q) {
      var b = document.createElement("button");
      b.className = "chip";
      b.type = "button";
      b.textContent = q;
      b.addEventListener("click", function () {
        wrap.remove();
        submit(q);
      });
      wrap.appendChild(b);
    });
    log.appendChild(wrap);
  }

  function paint() {
    log.innerHTML = "";
    addMsg("assistant", GREETING);
    history.forEach(function (m) {
      addMsg(m.role, m.content);
    });
    if (history.length === 0) addChips();
  }
  paint();

  /* ---------------- kirim & streaming ---------------- */

  function setBusy(state) {
    busy = state;
    root.classList.toggle("busy", state);
    sendBtn.disabled = state || input.value.trim() === "";
  }

  async function submit(text) {
    if (busy) return;
    text = String(text || "").trim();
    if (!text) return;

    var chips = log.querySelector(".chips");
    if (chips) chips.remove();

    addMsg("user", text);
    history.push({ role: "user", content: text });
    input.value = "";
    input.style.height = "auto";
    setBusy(true);

    var el = addMsg("assistant", "");
    var body = el.querySelector(".body");
    body.classList.add("caret");
    var acc = "";

    controller = new AbortController();

    try {
      var res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!res.ok) {
        var info = await res.json().catch(function () {
          return {};
        });
        throw new Error(info.error || "Layanan chat tidak merespons.");
      }

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = "";

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buf += decoder.decode(chunk.value, { stream: true });
        var lines = buf.split("\n");
        buf = lines.pop();

        lines.forEach(function (line) {
          if (line.indexOf("data:") !== 0) return;
          var payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") return;
          try {
            var evt = JSON.parse(payload);
            if (evt.type === "content_block_delta" && evt.delta && evt.delta.text) {
              acc += evt.delta.text;
              body.innerHTML = render(acc);
              log.scrollTop = log.scrollHeight;
            }
          } catch (e) {
            /* baris SSE parsial — abaikan */
          }
        });
      }

      body.classList.remove("caret");
      if (acc.trim()) {
        history.push({ role: "assistant", content: acc });
        save(history);
      } else {
        body.innerHTML = "<p>Tidak ada jawaban yang diterima. Coba kirim ulang.</p>";
        el.classList.add("error");
      }
    } catch (err) {
      body.classList.remove("caret");
      if (err.name === "AbortError") {
        el.remove();
      } else {
        el.classList.add("error");
        body.innerHTML =
          "<p>" +
          escapeHtml(err.message) +
          " Silakan coba lagi, atau hubungi tim komersial LTI langsung.</p>";
      }
      history = history.filter(function (m, i) {
        return !(i === history.length - 1 && m.role === "user" && err.name === "AbortError");
      });
    } finally {
      controller = null;
      setBusy(false);
      input.focus();
    }
  }

  /* ---------------- event ---------------- */

  $(".launcher").addEventListener("click", function () {
    root.classList.add("open");
    setTimeout(function () {
      input.focus();
    }, 60);
  });

  $(".close").addEventListener("click", closePanel);

  function closePanel() {
    if (controller) controller.abort();
    root.classList.remove("open");
    $(".launcher").focus();
  }

  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 110) + "px";
    sendBtn.disabled = busy || input.value.trim() === "";
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input.value);
    }
  });

  sendBtn.addEventListener("click", function () {
    submit(input.value);
  });

  shadow.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && root.classList.contains("open")) closePanel();
  });

  // API kecil untuk membuka widget dari tombol lain di website, mis.
  // <button onclick="LTIChat.open()">Tanya asisten</button>
  window.LTIChat = {
    open: function () {
      $(".launcher").click();
    },
    close: closePanel,
    ask: function (q) {
      $(".launcher").click();
      submit(q);
    },
    reset: function () {
      history = [];
      save(history);
      paint();
    },
  };
})();
