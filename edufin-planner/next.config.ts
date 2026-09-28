import type { NextConfig } from "next";

// Static export so the app can be hosted on any static host (cPanel, Netlify,
// Cloudflare Pages, Vercel). All data access happens client-side: localStorage
// in local mode, Supabase (Postgres + Auth + RLS) when env vars are provided.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  reactStrictMode: true,
};

export default nextConfig;
