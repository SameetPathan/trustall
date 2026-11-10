import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import PrintButton from "@/components/PrintButton";
import { getOwnerStall } from "@/lib/auth";
import { appUrl } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your QR sign: Trustall" };

export default async function SignPage() {
  const stall = await getOwnerStall();
  if (!stall) redirect("/owner/login");
  const url = `${appUrl()}/s/${stall.slug}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#14231a", light: "#ffffff" } });
  const download = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return (
    <main className="mx-auto max-w-xl px-5 pb-16 pt-8">
      <div className="no-print">
        <h1 className="text-4xl">Your sign</h1>
        <p className="mt-3">Print it on A5, or save it as a PDF from the print window, and put it where customers pick things up.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <PrintButton />
          <a className="btn-plain" href={download} download={`${stall.slug}-qr.svg`}>
            Download the QR code only
          </a>
          <Link className="btn-plain" href="/owner">
            Open my ledger
          </Link>
        </div>
      </div>

      <section className="card qr-poster mt-8 p-5 sm:p-8 text-center print:mt-0 print:shadow-none">
        <p className="font-bold text-moss">Pay here with PayPal</p>
        <p className="display mt-2 text-4xl">{stall.name}</p>
        <div className="mx-auto mt-6 w-64 max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="display mt-6 text-4xl sm:text-5xl">Scan. Snap. Pay.</p>
        <ol className="mx-auto mt-5 max-w-xs list-decimal space-y-1 pl-5 text-left text-lg">
          <li>Scan the code with your phone camera.</li>
          <li>Take a photo of what you are taking.</li>
          <li>Check the total and pay.</li>
        </ol>
        <p className="mt-5 break-all text-sm text-moss">{url}</p>
      </section>
    </main>
  );
}
