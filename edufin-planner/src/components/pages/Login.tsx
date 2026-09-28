"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseEnabled, getSupabase } from "@/lib/supabase/client";
import { sendMagicLink, signInWithEmail, signInWithGoogle, signUpWithEmail, useAuth } from "@/lib/supabase/auth";
import { Button, Card, CardBody, CardHeader, Field, Segmented, StatusPill, TextInput } from "../ui";

export function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "magic">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "critical" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (auth.session) router.replace("/settings/#data");
  }, [auth.session, router]);

  if (!supabaseEnabled) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader as="h1" title="Akun cloud belum diaktifkan" />
        <CardBody className="text-[0.85rem] text-ink-2">
          Aplikasi berjalan dalam mode lokal. Untuk login Email + Google dan sinkronisasi, isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> lalu build ulang (lihat README).{" "}
          <Link href="/" className="text-accent-ink hover:underline">
            Kembali
          </Link>
        </CardBody>
      </Card>
    );
  }

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "good", text: ok });
    } catch (e) {
      setMsg({ tone: "critical", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader as="h1" title="Masuk ke EduFin Planner" subtitle="Sinkronkan rencana keluarga antar perangkat. Data keluarga hanya dapat diakses pemilik akun (Row Level Security)." />
      <CardBody className="flex flex-col gap-4">
        <Button variant="secondary" disabled={busy} onClick={() => run(signInWithGoogle, "Mengalihkan ke Google…")}>
          Lanjutkan dengan Google
        </Button>
        <div className="flex items-center gap-2 text-[0.75rem] text-muted">
          <span className="h-px flex-1 bg-[var(--line)]" /> atau email <span className="h-px flex-1 bg-[var(--line)]" />
        </div>
        <Segmented
          ariaLabel="Metode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "signin", label: "Masuk" },
            { value: "signup", label: "Daftar" },
            { value: "magic", label: "Magic link" },
          ]}
        />
        <Field label="Email">
          <TextInput type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {mode !== "magic" ? (
          <Field label="Password" hint={mode === "signup" ? "Minimal 8 karakter" : undefined}>
            <TextInput type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        ) : null}
        <Button
          variant="primary"
          disabled={busy || !email || (mode !== "magic" && password.length < (mode === "signup" ? 8 : 1))}
          onClick={() =>
            mode === "signin"
              ? run(() => signInWithEmail(email, password), "Berhasil masuk.")
              : mode === "signup"
                ? run(() => signUpWithEmail(email, password), "Cek email untuk konfirmasi akun.")
                : run(() => sendMagicLink(email), "Tautan masuk dikirim ke email Anda.")
          }
        >
          {mode === "signin" ? "Masuk" : mode === "signup" ? "Buat akun" : "Kirim magic link"}
        </Button>
        {msg ? <StatusPill tone={msg.tone}>{msg.text}</StatusPill> : null}
      </CardBody>
    </Card>
  );
}

/**
 * OAuth / magic-link landing page. supabase-js (PKCE + detectSessionInUrl) exchanges the code
 * itself; this page waits for the session and forwards the user.
 */
function urlAuthError(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search + window.location.hash.replace(/^#/, "&"));
  return params.get("error_description") || params.get("error");
}

export function AuthCallbackPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(urlAuthError);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || urlAuthError()) return;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      router.replace("/settings/#data");
    };
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) go();
    });
    sb.auth.getSession().then(({ data }) => data.session && go());
    const t = setTimeout(() => !done && setErr("Sesi tidak ditemukan — coba masuk lagi."), 10000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [router]);
  return <p className="text-[0.9rem] text-ink-2">{err ? `Gagal masuk: ${err}` : "Menyelesaikan proses masuk…"}</p>;
}
