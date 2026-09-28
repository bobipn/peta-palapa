import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold">Halaman tidak ditemukan</h1>
      <Link href="/" className="text-accent-ink hover:underline">
        Kembali ke dashboard
      </Link>
    </div>
  );
}
