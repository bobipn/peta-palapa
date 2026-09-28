"use client";

import { Cloud, HardDrive } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/supabase/auth";

export function AccountBadge({ compact }: { compact?: boolean }) {
  const auth = useAuth();
  if (!auth.enabled) {
    return (
      <Link
        href="/settings/#data"
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[0.78rem] text-ink-2 hover:bg-card-2"
        title="Data tersimpan di browser ini (mode lokal)"
      >
        <HardDrive className="h-4 w-4" aria-hidden />
        {compact ? "Lokal" : "Mode lokal · data di browser ini"}
      </Link>
    );
  }
  if (auth.loading) return <span className="text-[0.78rem] text-muted">Memuat akun…</span>;
  if (!auth.session) {
    return (
      <Link href="/login/" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[0.8rem] font-medium text-accent-ink hover:bg-accent-soft">
        <Cloud className="h-4 w-4" aria-hidden />
        Masuk untuk sinkronisasi
      </Link>
    );
  }
  return (
    <Link href="/settings/#data" className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-[0.78rem] text-ink-2 hover:bg-card-2">
      <Cloud className="h-4 w-4 shrink-0 text-accent" aria-hidden />
      <span className="truncate">
        {auth.email}
        {auth.role === "admin" ? " · admin" : ""}
      </span>
    </Link>
  );
}
