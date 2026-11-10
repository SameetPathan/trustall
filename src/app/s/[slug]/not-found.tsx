import Link from "next/link";

export default function StallNotFound() {
  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <p className="eyebrow mb-3 text-moss">Stall finder</p>
      <h1 className="text-4xl">No stall at this address</h1>
      <p className="mt-3 text-moss">The QR sign may be out of date. Ask the owner for a new one, or try the demo stall.</p>
      <Link href="/s/meadow-lane" className="btn-sign mt-6">
        Open the demo stall
      </Link>
    </main>
  );
}
