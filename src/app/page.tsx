import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold tracking-tight">SwimIO</h1>
      <p className="text-lg text-neutral-400">Freestyle racing. No water required.</p>
      <Link
        href="/play"
        className="rounded-xl bg-blue-600 px-8 py-3 text-lg font-semibold hover:bg-blue-500 transition-colors"
      >
        Start
      </Link>
    </main>
  );
}
