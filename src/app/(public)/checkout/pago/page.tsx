import type { Metadata } from "next";
import PaymentClient from "./payment-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pagar mi reserva", robots: { index: false, follow: false } };

export default async function PaymentPage({ searchParams }: { searchParams: Promise<{ publicCode?: string; trackingToken?: string }> }) {
  const query = await searchParams;
  return <PaymentClient publicCode={query.publicCode ?? ""} trackingToken={query.trackingToken ?? ""} />;
}
