"use client";

import clsx from "clsx";
import {
  Baby,
  Briefcase,
  FileText,
  GraduationCap,
  Home,
  LineChart,
  Plus,
  School as SchoolIcon,
  Settings,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useHydrated } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { supabaseEnabled } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth";
import { fetchCloudSchoolDb, pullFromCloud } from "@/lib/supabase/sync";
import { AccountBadge } from "./Account";

const PRIMARY = [
  { href: "/", label: "Home", icon: Home },
  { href: "/children/", label: "Children", icon: Baby },
  { href: "/schools/", label: "Schools", icon: SchoolIcon },
  { href: "/planning/", label: "Planning", icon: LineChart },
  { href: "/portfolio/", label: "Portfolio", icon: Wallet },
];

const SECONDARY = [
  { href: "/report/", label: "Report", icon: FileText },
  { href: "/admin/", label: "Admin data", icon: ShieldCheck },
  { href: "/settings/", label: "Asumsi & Settings", icon: Settings },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/" || path === "";
  return path.startsWith(href.replace(/\/$/, ""));
}

export const DISCLAIMER_EN =
  "This application provides financial planning estimates and educational cost analysis. It is not a substitute for personalized financial, tax, legal, or investment advice. Investment returns are assumptions, not guarantees. School fees may change and actual costs may differ from projections.";

export const DISCLAIMER_ID =
  "Aplikasi ini memberikan estimasi perencanaan keuangan dan analisis biaya pendidikan, bukan pengganti nasihat keuangan, pajak, hukum, atau investasi yang dipersonalisasi. Return investasi adalah asumsi, bukan jaminan. Biaya sekolah dapat berubah dan biaya aktual dapat berbeda dari proyeksi. EduFin Planner tidak disertifikasi atau disahkan oleh CFA Institute maupun lembaga sertifikasi perencana keuangan mana pun.";

/** Signed-in: load reference data from the cloud; restore the family plan on a fresh device. */
function CloudBootstrap() {
  const auth = useAuth();
  const done = useRef(false);
  useEffect(() => {
    if (!auth.session || done.current) return;
    done.current = true;
    (async () => {
      try {
        useStore.getState().setCloudDb(await fetchCloudSchoolDb());
        const h = useStore.getState().household;
        if (h.children.length === 0 && h.primary.monthlyIncome === 0) await pullFromCloud();
      } catch (e) {
        console.warn("Cloud bootstrap failed", e);
      }
    })();
  }, [auth.session]);
  return null;
}

function ThemeSync() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    const el = document.documentElement;
    if (theme === "system") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", theme);
  }, [theme]);
  return null;
}

function QuickAdd() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const actions = [
    { label: "Add Child", href: "/children/?new=1", icon: Baby },
    { label: "Add School", href: "/schools/?new=1", icon: GraduationCap },
    { label: "Add Expense", href: "/portfolio/?tab=cashflow&new=expense", icon: Briefcase },
    { label: "Add Asset", href: "/portfolio/?tab=balance&new=asset", icon: Wallet },
  ];
  return (
    <div className="no-print fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-end gap-2 lg:bottom-6 lg:right-6">
      {open ? (
        <div className="card mb-1 flex flex-col overflow-hidden p-1" role="menu">
          {actions.map((a) => (
            <button
              key={a.label}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(a.href);
              }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[0.85rem] font-medium text-ink hover:bg-card-2"
            >
              <a.icon className="h-4 w-4 text-accent" aria-hidden />
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        aria-label={open ? "Tutup menu tambah" : "Tambah data"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg hover:brightness-110"
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const hydrated = useHydrated();
  const family = useStore((s) => s.household.familyName);
  const bare = path.startsWith("/report/print");

  if (bare) return <>{children}</>;

  return (
    <div className="min-h-dvh">
      <ThemeSync />
      {supabaseEnabled && hydrated ? <CloudBootstrap /> : null}
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-card px-3 py-5 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-page">
            <GraduationCap className="h-4.5 w-4.5" aria-hidden />
          </span>
          <span className="text-[0.95rem] font-semibold tracking-tight text-ink">EduFin Planner</span>
        </Link>
        <nav className="flex flex-col gap-0.5" aria-label="Navigasi utama">
          {PRIMARY.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.875rem] font-medium",
                isActive(path, n.href) ? "bg-card-2 text-ink" : "text-ink-2 hover:bg-card-2 hover:text-ink",
              )}
            >
              <n.icon className="h-4 w-4" aria-hidden />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="my-4 border-t border-line" />
        <nav className="flex flex-col gap-0.5" aria-label="Navigasi lainnya">
          {SECONDARY.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.85rem]",
                isActive(path, n.href) ? "bg-card-2 font-medium text-ink" : "text-ink-2 hover:bg-card-2 hover:text-ink",
              )}
            >
              <n.icon className="h-4 w-4" aria-hidden />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-1">
          <AccountBadge />
        </div>
      </aside>

      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="no-print sticky top-0 z-20 border-b border-line bg-[color-mix(in_srgb,var(--page)_88%,transparent)] backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-page">
                <GraduationCap className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-[0.9rem] font-semibold tracking-tight">EduFin Planner</span>
            </Link>
            <p className="hidden truncate text-[0.85rem] text-ink-2 lg:block">
              {hydrated && family ? `Rencana ${family}` : "Perencanaan biaya pendidikan keluarga"}
            </p>
            <div className="flex items-center gap-1">
              <Link href="/report/" className="rounded-lg p-2 text-ink-2 hover:bg-card-2 lg:hidden" aria-label="Report">
                <FileText className="h-4.5 w-4.5" />
              </Link>
              <Link href="/settings/" className="rounded-lg p-2 text-ink-2 hover:bg-card-2 lg:hidden" aria-label="Settings">
                <Settings className="h-4.5 w-4.5" />
              </Link>
              <div className="hidden lg:block">
                <AccountBadge compact />
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 lg:pb-12">
          {hydrated ? children : <div className="h-[60vh] animate-pulse rounded-2xl bg-card-2/60" aria-busy="true" />}
        </main>

        <footer className="no-print mx-auto max-w-6xl px-4 pb-28 sm:px-6 lg:pb-8">
          <div className="border-t border-line pt-4 text-[0.72rem] leading-relaxed text-muted">
            <p>{DISCLAIMER_EN}</p>
            <p className="mt-1.5">{DISCLAIMER_ID}</p>
          </div>
        </footer>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navigasi bawah"
      >
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {PRIMARY.map((n) => {
            const active = isActive(path, n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx("flex h-full flex-col items-center justify-center gap-0.5 text-[0.68rem] font-medium", active ? "text-ink" : "text-muted")}
                >
                  <n.icon className={clsx("h-5 w-5", active && "text-accent")} aria-hidden />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {hydrated ? <QuickAdd /> : null}
    </div>
  );
}
