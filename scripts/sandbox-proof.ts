/**
 * Milestone 0: prove the sandbox credentials work before building on them.
 *
 *   npm run sandbox:proof                       token, $1 order, invoice
 *   npm run sandbox:proof -- capture <orderId>  capture after approving as the sandbox buyer
 *   npm run sandbox:proof -- you@example.com    send the test invoice to this address
 */
import { captureOrder, createAndSendInvoice, createOrder, getAccessToken, paypalFetch } from "../src/lib/paypal";

async function main() {
  const [arg1, arg2] = process.argv.slice(2);

  await getAccessToken();
  console.log("1. Token: OK (sandbox credentials accepted)");

  if (arg1 === "capture" && arg2) {
    const cap = await captureOrder(arg2, `proof-${arg2}`);
    const capture = cap.data.purchase_units?.[0]?.payments?.captures?.[0];
    console.log(`2. Capture: ${cap.data.status}, capture id ${capture?.id}, ${capture?.amount.value} ${capture?.amount.currency_code}`);
    console.log(`   PayPal debug id: ${cap.debugId}`);
    return;
  }

  const saleId = `proof_${Date.now()}`;
  const order = await createOrder({
    saleId,
    stallName: "Trustall sandbox proof",
    currency: "USD",
    lines: [{ name: "Test egg", quantity: 1, unitPriceCents: 100 }],
    tipCents: 0,
    totalCents: 100,
  });
  const approve = (order.data as unknown as { links?: { rel: string; href: string }[] }).links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href;
  console.log(`2. Order: ${order.data.id} created for $1.00 (${order.data.status})`);
  console.log(`   Approve it as your sandbox PERSONAL account: ${approve}`);
  console.log(`   Then run: npm run sandbox:proof -- capture ${order.data.id}`);

  const email = arg1 && arg1.includes("@") ? arg1 : "sandbox-buyer@example.com";
  const invoice = await createAndSendInvoice({
    reference: saleId,
    stallName: "Trustall sandbox proof",
    currency: "USD",
    recipientEmail: email,
    lines: [{ name: "Test egg", quantity: 1, unitPriceCents: 100 }],
  });
  const check = await paypalFetch<{ status: string }>(`/v2/invoicing/invoices/${invoice.invoiceId}`);
  console.log(`3. Invoice: ${invoice.invoiceId} sent to ${email} (status ${check.data.status})`);
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  if (err.debugId) console.error(`PayPal debug id: ${err.debugId}`);
  if (err.body) console.error(JSON.stringify(err.body, null, 2));
  process.exit(1);
});
