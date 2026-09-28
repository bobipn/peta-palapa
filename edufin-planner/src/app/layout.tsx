import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduFin Planner",
  description:
    "Perencanaan biaya pendidikan keluarga berbasis data: biaya sekolah, inflasi pendidikan, funding gap, investasi bulanan, dan trade-off dengan dana pensiun.",
  applicationName: "EduFin Planner",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

// Apply the saved theme before first paint (no flash). Storage may be unavailable: ignore errors.
const themeScript = `try{var s=JSON.parse(localStorage.getItem('edufin-planner')||'{}');var t=s&&s.state&&s.state.theme;if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
