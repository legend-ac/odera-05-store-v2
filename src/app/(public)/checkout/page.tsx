"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useCart } from "@/components/cart/CartProvider";
import { apiPost, makeIdempotencyKey } from "@/lib/apiClient";
import type { CreateOrderResponse } from "@/schemas/createOrder";
import { db } from "@/lib/firebase/client";
import { formatPEN } from "@/lib/money";
import { notify } from "@/lib/toast";
import { safeHostname } from "@/lib/safeUrl";

type ShippingMethod = "LIMA_DELIVERY" | "AGENCIA_PROVINCIA";
type PayMethod = "YAPE" | "PLIN";

type ItemPreview = {
  productId: string;
  variantId: string;
  qty: number;
  name: string;
  unitPrice: number;
  lineTotal: number;
};

type StorePaymentInstructions = {
  yapeName?: string;
  yapeNumber?: string;
  plinName?: string;
  plinNumber?: string;
};

type StorePromo = {
  enabled: boolean;
  couponCode: string;
  discountPercent: number;
  freeShippingFrom: number;
};

async function uploadReceiptToCloudinary(file: File): Promise<string> {
  const cloudName = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "").trim();
  const uploadPreset = (process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "").trim();
  if (!cloudName || !uploadPreset) throw new Error("CLOUDINARY_NOT_CONFIGURED");

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", uploadPreset);
  form.append("folder", "receipts");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(`RECEIPT_UPLOAD_FAILED:${json?.error?.message ?? res.status}`);
  if (!json?.secure_url) throw new Error("RECEIPT_UPLOAD_NO_URL");
  return String(json.secure_url);
}

export default function CheckoutPage() {
  const { items, clear } = useCart();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("LIMA_DELIVERY");
  const [receiverName, setReceiverName] = useState("");
  const [receiverDni, setReceiverDni] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressReference, setAddressReference] = useState("");

  const [department, setDepartment] = useState("");
  const [province, setProvince] = useState("");
  const [agencyName, setAgencyName] = useState("Shalom");
  const [agencyAddress, setAgencyAddress] = useState("");
  const [agencyReference, setAgencyReference] = useState("");

  const [payMethod, setPayMethod] = useState<PayMethod>("YAPE");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptBusy, setReceiptBusy] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemsPreview, setItemsPreview] = useState<ItemPreview[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState<StorePaymentInstructions>({});
  const [promo, setPromo] = useState<StorePromo>({
    enabled: true,
    couponCode: "ODERA10",
    discountPercent: 10,
    freeShippingFrom: 200,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingTotals(true);
        let nextSubtotal = 0;
        const preview: ItemPreview[] = [];

        for (const it of items) {
          const snap = await getDoc(doc(db, "products", it.productId));
          if (!snap.exists()) continue;
          const data = snap.data() as any;
          const unit = data.onSale && typeof data.salePrice === "number" ? Number(data.salePrice) : Number(data.price ?? 0);
          const line = unit * it.qty;
          nextSubtotal += line;
          preview.push({
            productId: it.productId,
            variantId: it.variantId,
            qty: it.qty,
            name: String(data.name ?? it.productId),
            unitPrice: unit,
            lineTotal: line,
          });
        }

        if (mounted) {
          setSubtotal(nextSubtotal);
          setItemsPreview(preview);
        }
      } finally {
        if (mounted) setLoadingTotals(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [items]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "store"));
        if (!mounted || !snap.exists()) return;
        const data = snap.data() as any;
        setPaymentInstructions({
          yapeName: String(data?.paymentInstructions?.yapeName ?? ""),
          yapeNumber: String(data?.paymentInstructions?.yapeNumber ?? ""),
          plinName: String(data?.paymentInstructions?.plinName ?? ""),
          plinNumber: String(data?.paymentInstructions?.plinNumber ?? ""),
        });
        setPromo({
          enabled: Boolean(data?.homePromoEnabled ?? true),
          couponCode: String(data?.homePromo?.couponCode ?? "ODERA10").trim().toUpperCase(),
          discountPercent: Number(data?.homePromo?.discountPercent ?? 10),
          freeShippingFrom: Number(data?.homePromo?.freeShippingFrom ?? 200),
        });
      } catch {
        // Public checkout can continue even if settings are missing.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const normalizedCoupon = useMemo(() => couponCode.trim().toUpperCase(), [couponCode]);
  const couponVisible = promo.enabled && promo.discountPercent > 0 && promo.couponCode.length >= 4;
  const couponValid = couponVisible && normalizedCoupon === promo.couponCode;
  const discountAmount = useMemo(() => {
    if (!couponValid) return 0;
    const pct = Math.max(0, Math.min(100, promo.discountPercent));
    return Math.round(subtotal * (pct / 100) * 100) / 100;
  }, [couponValid, promo.discountPercent, subtotal]);
  const shippingThreshold = Number.isFinite(promo.freeShippingFrom) ? Math.max(0, promo.freeShippingFrom) : 200;
  const shippingCost = useMemo(() => (subtotal >= shippingThreshold ? 0 : 10), [subtotal, shippingThreshold]);
  const totalToPay = useMemo(() => Math.max(0, subtotal - discountAmount) + shippingCost, [subtotal, discountAmount, shippingCost]);

  const isCustomerValid = useMemo(() => name.trim().length >= 2 && email.includes("@") && phone.trim().length >= 6, [name, email, phone]);

  const isShippingValid = useMemo(() => {
    const receiverOk = receiverName.trim().length >= 2 && receiverDni.trim().length >= 8 && receiverPhone.trim().length >= 6;
    if (!receiverOk) return false;
    if (shippingMethod === "LIMA_DELIVERY") return district.trim().length >= 2 && addressLine1.trim().length >= 5;
    return department.trim().length >= 2 && province.trim().length >= 2 && agencyName.trim().length >= 2 && agencyAddress.trim().length >= 5;
  }, [shippingMethod, receiverName, receiverDni, receiverPhone, district, addressLine1, department, province, agencyName, agencyAddress]);

  const disabled = useMemo(() => {
    return busy || receiptBusy || !items.length || !isCustomerValid || !isShippingValid || !receiptUrl;
  }, [busy, receiptBusy, items.length, isCustomerValid, isShippingValid, receiptUrl]);

  async function onPickReceipt(file: File) {
    setError(null);
    setReceiptBusy(true);
    try {
      const url = await uploadReceiptToCloudinary(file);
      setReceiptUrl(url);
      notify.success("Comprobante subido");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("CLOUDINARY_NOT_CONFIGURED")) {
        setError("El sistema de comprobantes está en mantenimiento temporal.");
      } else {
        setError("No se pudo subir el comprobante. Intenta con otra imagen o reintenta en unos segundos.");
      }
      setReceiptUrl("");
    } finally {
      setReceiptBusy(false);
    }
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const key = makeIdempotencyKey();

      const shipping =
        shippingMethod === "LIMA_DELIVERY"
          ? {
              method: "LIMA_DELIVERY" as const,
              receiverName: receiverName.trim(),
              receiverDni: receiverDni.trim(),
              receiverPhone: receiverPhone.trim(),
              district: district.trim(),
              addressLine1: addressLine1.trim(),
              reference: addressReference.trim() || undefined,
            }
          : {
              method: "AGENCIA_PROVINCIA" as const,
              receiverName: receiverName.trim(),
              receiverDni: receiverDni.trim(),
              receiverPhone: receiverPhone.trim(),
              department: department.trim(),
              province: province.trim(),
              agencyName: agencyName.trim(),
              agencyAddress: agencyAddress.trim(),
              reference: agencyReference.trim() || undefined,
            };

      const res = await apiPost<CreateOrderResponse>(
        "/api/create-order",
        {
          items,
          customer: { name: name.trim(), email: email.trim(), phone: phone.trim() },
          payment: { method: payMethod, receiptImageUrl: receiptUrl },
          shipping,
          couponCode: couponVisible ? normalizedCoupon || undefined : undefined,
        },
        { idempotencyKey: key }
      );

      clear();
      router.push(`/confirm?publicCode=${encodeURIComponent(res.publicCode)}&trackingToken=${encodeURIComponent(res.trackingToken)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo crear el pedido.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">Finalizar compra</h1>
        <p className="text-sm text-slate-600 mt-1">Completa tus datos para confirmar tu compra de forma segura.</p>
      </div>

      {!items.length ? <div className="text-sm text-neutral-600">Tu carrito está vacío.</div> : null}

      <div className="panel p-4 grid gap-3 rounded-2xl border-slate-200">
        <div className="font-medium text-slate-900">1) Datos personales</div>
        <label className="text-sm font-medium">Nombre completo</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
        <label className="text-sm font-medium">Correo</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
        <label className="text-sm font-medium">Telefono</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
      </div>

      <div className="panel p-4 flex flex-col gap-3 rounded-2xl border-slate-200">
        <div className="font-medium text-slate-900">2) Tipo de envío y dirección</div>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={shippingMethod === "LIMA_DELIVERY"} onChange={() => setShippingMethod("LIMA_DELIVERY")} />
            Lima Metropolitana - Delivery
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={shippingMethod === "AGENCIA_PROVINCIA"} onChange={() => setShippingMethod("AGENCIA_PROVINCIA")} />
            Provincia - Envío por agencia
          </label>
        </div>

        <label className="text-sm font-medium">Nombre de quien recibe o recoge</label>
        <input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />

        <div className="grid md:grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">DNI</label>
            <input value={receiverDni} onChange={(e) => setReceiverDni(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Telefono</label>
            <input value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
          </div>
        </div>

        {shippingMethod === "LIMA_DELIVERY" ? (
          <>
            <label className="text-sm font-medium">Distrito</label>
            <input value={district} onChange={(e) => setDistrict(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
            <label className="text-sm font-medium">Dirección</label>
            <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
            <label className="text-sm font-medium">Referencia (opcional)</label>
            <input value={addressReference} onChange={(e) => setAddressReference(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
          </>
        ) : (
          <>
            <label className="text-sm font-medium">Departamento</label>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
            <label className="text-sm font-medium">Provincia</label>
            <input value={province} onChange={(e) => setProvince(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
            <label className="text-sm font-medium">Agencia (ej. Shalom)</label>
            <input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
            <label className="text-sm font-medium">Dirección de agencia</label>
            <input value={agencyAddress} onChange={(e) => setAgencyAddress(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
            <label className="text-sm font-medium">Referencia (opcional)</label>
            <input value={agencyReference} onChange={(e) => setAgencyReference(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
          </>
        )}
      </div>

      <div className="panel p-4 grid gap-3 rounded-2xl border-slate-200">
        <div className="font-medium text-slate-900">3) Pago y comprobante</div>
        <div className="grid md:grid-cols-2 gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={payMethod === "YAPE"} onChange={() => setPayMethod("YAPE")} />
            Yape
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={payMethod === "PLIN"} onChange={() => setPayMethod("PLIN")} />
            Plin
          </label>
        </div>
        <div className="text-sm text-slate-700 rounded-xl bg-slate-50 border border-slate-200 p-3">
          {payMethod === "YAPE" ? (
            <>
              <div className="font-medium">Datos para pagar por Yape</div>
              <div>Nombre: {paymentInstructions.yapeName?.trim() || "Disponible al momento de confirmar"}</div>
              <div>Número: {paymentInstructions.yapeNumber?.trim() || "Disponible al momento de confirmar"}</div>
            </>
          ) : (
            <>
              <div className="font-medium">Datos para pagar por Plin</div>
              <div>Nombre: {paymentInstructions.plinName?.trim() || "Disponible al momento de confirmar"}</div>
              <div>Número: {paymentInstructions.plinNumber?.trim() || "Disponible al momento de confirmar"}</div>
            </>
          )}
        </div>

        <label className="text-sm font-medium">Subir comprobante de pago</label>
        <label className="w-fit text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer">
          {receiptBusy ? "Subiendo comprobante..." : "Seleccionar imagen"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickReceipt(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
        {receiptUrl ? (
          <div className="mt-3 rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Comprobante cargado</div>
                <div className="text-xs text-slate-500">{safeHostname(receiptUrl)}</div>
              </div>

              <div className="flex gap-2">
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  Ver comprobante
                </a>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(receiptUrl);
                      notify.success("Link copiado");
                    } catch {
                      notify.error("No se pudo copiar el link");
                    }
                  }}
                  className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                >
                  Copiar
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receiptUrl} alt="Comprobante" className="max-h-72 w-full object-contain" />
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500">Debes subir el comprobante para confirmar el pedido.</div>
        )}
      </div>

      <div className="panel p-4 text-sm grid gap-2 rounded-2xl border-slate-200">
        <div className="font-medium mb-1 text-slate-900">4) Resumen del pedido</div>
        {itemsPreview.map((it) => (
          <div key={`${it.productId}:${it.variantId}`} className="flex items-center justify-between">
            <span>
              {it.name} x {it.qty}
            </span>
            <span>{formatPEN(it.lineTotal)}</span>
          </div>
        ))}
        {couponVisible ? (
          <div className="grid gap-1 pt-2">
            <label className="text-sm font-medium">Cupon (opcional)</label>
            <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder={promo.couponCode || "CUPON"} className="border border-slate-300 rounded-xl px-3 py-2 text-sm" />
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <span>Subtotal</span>
          <span>{loadingTotals ? "Calculando..." : formatPEN(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Descuento</span>
          <span>{loadingTotals ? "Calculando..." : discountAmount > 0 ? `-${formatPEN(discountAmount)}` : formatPEN(0)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Envio</span>
          <span>{loadingTotals ? "Calculando..." : shippingCost === 0 ? "Gratis" : formatPEN(shippingCost)}</span>
        </div>
        <div className="flex items-center justify-between font-semibold">
          <span>Total</span>
          <span>{loadingTotals ? "Calculando..." : formatPEN(totalToPay)}</span>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">No pudimos procesar tu solicitud. Verifica los datos e inténtalo nuevamente.</div> : null}

      <button type="button" disabled={disabled} onClick={submit} className="btn-brand disabled:opacity-50">
        {busy ? "Confirmando pedido..." : "Confirmar pedido"}
      </button>
    </div>
  );
}
