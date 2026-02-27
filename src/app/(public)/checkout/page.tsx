"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/fields";
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

type FieldErrors = Record<string, string>;

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

function ErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive mt-1">
      {message}
    </p>
  );
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

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
        // Checkout stays available without settings.
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

  function setFieldErrorAware<K extends keyof FieldErrors>(key: K, value: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (error) setError(null);
  }

  function validateFields(): FieldErrors {
    const next: FieldErrors = {};

    if (name.trim().length < 2) next.name = "Ingresa tu nombre completo.";
    if (!email.includes("@")) next.email = "Ingresa un correo valido.";
    if (phone.trim().length < 6) next.phone = "Ingresa un telefono valido.";

    if (receiverName.trim().length < 2) next.receiverName = "Ingresa quien recibe el pedido.";
    if (receiverDni.trim().length < 8) next.receiverDni = "Ingresa un DNI valido.";
    if (receiverPhone.trim().length < 6) next.receiverPhone = "Ingresa un telefono valido.";

    if (shippingMethod === "LIMA_DELIVERY") {
      if (district.trim().length < 2) next.district = "Ingresa distrito.";
      if (addressLine1.trim().length < 5) next.addressLine1 = "Ingresa direccion completa.";
    } else {
      if (department.trim().length < 2) next.department = "Ingresa departamento.";
      if (province.trim().length < 2) next.province = "Ingresa provincia.";
      if (agencyName.trim().length < 2) next.agencyName = "Ingresa agencia.";
      if (agencyAddress.trim().length < 5) next.agencyAddress = "Ingresa direccion de agencia.";
    }

    if (!receiptUrl) next.receiptUrl = "Debes subir un comprobante para confirmar.";
    if (!items.length) next.items = "Tu carrito esta vacio.";

    return next;
  }

  function focusFirstError(next: FieldErrors) {
    const order = [
      "name",
      "email",
      "phone",
      "receiverName",
      "receiverDni",
      "receiverPhone",
      "district",
      "addressLine1",
      "department",
      "province",
      "agencyName",
      "agencyAddress",
      "receiptUrl",
    ];
    const first = order.find((key) => next[key]);
    if (!first) return;
    const el = document.getElementById(`checkout-${first}`);
    if (el && "focus" in el) {
      (el as HTMLElement).focus();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function onPickReceipt(file: File) {
    setError(null);
    setReceiptBusy(true);
    try {
      const url = await uploadReceiptToCloudinary(file);
      setReceiptUrl(url);
      setFieldErrorAware("receiptUrl", url);
      notify.success("Comprobante subido");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("CLOUDINARY_NOT_CONFIGURED")) setError("El sistema de comprobantes esta en mantenimiento temporal.");
      else setError("No se pudo subir el comprobante. Intenta nuevamente.");
      setReceiptUrl("");
    } finally {
      setReceiptBusy(false);
    }
  }

  async function submit() {
    setError(null);
    const nextErrors = validateFields();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      return;
    }

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
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Finalizar compra</h1>
        <p className="text-sm text-muted mt-1">Completa tus datos para confirmar tu compra de forma segura.</p>
      </div>

      {!items.length ? (
        <div className="panel p-3 text-sm text-destructive" role="alert">
          Tu carrito esta vacio.
        </div>
      ) : null}

      <section className="panel p-4 grid gap-3 rounded-2xl border-border" aria-labelledby="checkout-customer-title">
        <h2 id="checkout-customer-title" className="font-medium text-foreground">1) Datos personales</h2>

        <div className="grid gap-1">
          <label htmlFor="checkout-name" className="text-sm font-medium">Nombre completo</label>
          <Input id="checkout-name" value={name} invalid={Boolean(fieldErrors.name)} onChange={(e) => { setName(e.target.value); setFieldErrorAware("name", e.target.value); }} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "checkout-name-error" : undefined} />
          <ErrorText id="checkout-name-error" message={fieldErrors.name} />
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label htmlFor="checkout-email" className="text-sm font-medium">Correo</label>
            <Input id="checkout-email" type="email" value={email} invalid={Boolean(fieldErrors.email)} onChange={(e) => { setEmail(e.target.value); setFieldErrorAware("email", e.target.value); }} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "checkout-email-error" : undefined} />
            <ErrorText id="checkout-email-error" message={fieldErrors.email} />
          </div>
          <div className="grid gap-1">
            <label htmlFor="checkout-phone" className="text-sm font-medium">Telefono</label>
            <Input id="checkout-phone" value={phone} invalid={Boolean(fieldErrors.phone)} onChange={(e) => { setPhone(e.target.value); setFieldErrorAware("phone", e.target.value); }} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "checkout-phone-error" : undefined} />
            <ErrorText id="checkout-phone-error" message={fieldErrors.phone} />
          </div>
        </div>
      </section>

      <section className="panel p-4 grid gap-3 rounded-2xl border-border" aria-labelledby="checkout-shipping-title">
        <h2 id="checkout-shipping-title" className="font-medium text-foreground">2) Tipo de envio y direccion</h2>

        <fieldset className="grid gap-2 text-sm">
          <legend className="text-sm font-medium text-foreground">Metodo de envio</legend>
          <label className="flex items-center gap-2">
            <input id="checkout-shipping-lima" type="radio" checked={shippingMethod === "LIMA_DELIVERY"} onChange={() => setShippingMethod("LIMA_DELIVERY")} />
            Lima Metropolitana - Delivery
          </label>
          <label className="flex items-center gap-2">
            <input id="checkout-shipping-agency" type="radio" checked={shippingMethod === "AGENCIA_PROVINCIA"} onChange={() => setShippingMethod("AGENCIA_PROVINCIA")} />
            Provincia - Envio por agencia
          </label>
        </fieldset>

        <div className="grid gap-1">
          <label htmlFor="checkout-receiverName" className="text-sm font-medium">Nombre de quien recibe o recoge</label>
          <Input id="checkout-receiverName" value={receiverName} invalid={Boolean(fieldErrors.receiverName)} onChange={(e) => { setReceiverName(e.target.value); setFieldErrorAware("receiverName", e.target.value); }} aria-invalid={Boolean(fieldErrors.receiverName)} aria-describedby={fieldErrors.receiverName ? "checkout-receiverName-error" : undefined} />
          <ErrorText id="checkout-receiverName-error" message={fieldErrors.receiverName} />
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label htmlFor="checkout-receiverDni" className="text-sm font-medium">DNI</label>
            <Input id="checkout-receiverDni" value={receiverDni} invalid={Boolean(fieldErrors.receiverDni)} onChange={(e) => { setReceiverDni(e.target.value); setFieldErrorAware("receiverDni", e.target.value); }} aria-invalid={Boolean(fieldErrors.receiverDni)} aria-describedby={fieldErrors.receiverDni ? "checkout-receiverDni-error" : undefined} />
            <ErrorText id="checkout-receiverDni-error" message={fieldErrors.receiverDni} />
          </div>
          <div className="grid gap-1">
            <label htmlFor="checkout-receiverPhone" className="text-sm font-medium">Telefono</label>
            <Input id="checkout-receiverPhone" value={receiverPhone} invalid={Boolean(fieldErrors.receiverPhone)} onChange={(e) => { setReceiverPhone(e.target.value); setFieldErrorAware("receiverPhone", e.target.value); }} aria-invalid={Boolean(fieldErrors.receiverPhone)} aria-describedby={fieldErrors.receiverPhone ? "checkout-receiverPhone-error" : undefined} />
            <ErrorText id="checkout-receiverPhone-error" message={fieldErrors.receiverPhone} />
          </div>
        </div>

        {shippingMethod === "LIMA_DELIVERY" ? (
          <>
            <div className="grid gap-1">
              <label htmlFor="checkout-district" className="text-sm font-medium">Distrito</label>
              <Input id="checkout-district" value={district} invalid={Boolean(fieldErrors.district)} onChange={(e) => { setDistrict(e.target.value); setFieldErrorAware("district", e.target.value); }} aria-invalid={Boolean(fieldErrors.district)} aria-describedby={fieldErrors.district ? "checkout-district-error" : undefined} />
              <ErrorText id="checkout-district-error" message={fieldErrors.district} />
            </div>
            <div className="grid gap-1">
              <label htmlFor="checkout-addressLine1" className="text-sm font-medium">Direccion</label>
              <Input id="checkout-addressLine1" value={addressLine1} invalid={Boolean(fieldErrors.addressLine1)} onChange={(e) => { setAddressLine1(e.target.value); setFieldErrorAware("addressLine1", e.target.value); }} aria-invalid={Boolean(fieldErrors.addressLine1)} aria-describedby={fieldErrors.addressLine1 ? "checkout-addressLine1-error" : undefined} />
              <ErrorText id="checkout-addressLine1-error" message={fieldErrors.addressLine1} />
            </div>
            <div className="grid gap-1">
              <label htmlFor="checkout-addressReference" className="text-sm font-medium">Referencia (opcional)</label>
              <Input id="checkout-addressReference" value={addressReference} onChange={(e) => setAddressReference(e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <label htmlFor="checkout-department" className="text-sm font-medium">Departamento</label>
                <Input id="checkout-department" value={department} invalid={Boolean(fieldErrors.department)} onChange={(e) => { setDepartment(e.target.value); setFieldErrorAware("department", e.target.value); }} aria-invalid={Boolean(fieldErrors.department)} aria-describedby={fieldErrors.department ? "checkout-department-error" : undefined} />
                <ErrorText id="checkout-department-error" message={fieldErrors.department} />
              </div>
              <div className="grid gap-1">
                <label htmlFor="checkout-province" className="text-sm font-medium">Provincia</label>
                <Input id="checkout-province" value={province} invalid={Boolean(fieldErrors.province)} onChange={(e) => { setProvince(e.target.value); setFieldErrorAware("province", e.target.value); }} aria-invalid={Boolean(fieldErrors.province)} aria-describedby={fieldErrors.province ? "checkout-province-error" : undefined} />
                <ErrorText id="checkout-province-error" message={fieldErrors.province} />
              </div>
            </div>
            <div className="grid gap-1">
              <label htmlFor="checkout-agencyName" className="text-sm font-medium">Agencia (ej. Shalom)</label>
              <Input id="checkout-agencyName" value={agencyName} invalid={Boolean(fieldErrors.agencyName)} onChange={(e) => { setAgencyName(e.target.value); setFieldErrorAware("agencyName", e.target.value); }} aria-invalid={Boolean(fieldErrors.agencyName)} aria-describedby={fieldErrors.agencyName ? "checkout-agencyName-error" : undefined} />
              <ErrorText id="checkout-agencyName-error" message={fieldErrors.agencyName} />
            </div>
            <div className="grid gap-1">
              <label htmlFor="checkout-agencyAddress" className="text-sm font-medium">Direccion de agencia</label>
              <Input id="checkout-agencyAddress" value={agencyAddress} invalid={Boolean(fieldErrors.agencyAddress)} onChange={(e) => { setAgencyAddress(e.target.value); setFieldErrorAware("agencyAddress", e.target.value); }} aria-invalid={Boolean(fieldErrors.agencyAddress)} aria-describedby={fieldErrors.agencyAddress ? "checkout-agencyAddress-error" : undefined} />
              <ErrorText id="checkout-agencyAddress-error" message={fieldErrors.agencyAddress} />
            </div>
            <div className="grid gap-1">
              <label htmlFor="checkout-agencyReference" className="text-sm font-medium">Referencia (opcional)</label>
              <Input id="checkout-agencyReference" value={agencyReference} onChange={(e) => setAgencyReference(e.target.value)} />
            </div>
          </>
        )}
      </section>

      <section className="panel p-4 grid gap-3 rounded-2xl border-border" aria-labelledby="checkout-payment-title">
        <h2 id="checkout-payment-title" className="font-medium text-foreground">3) Pago y comprobante</h2>

        <fieldset className="grid md:grid-cols-2 gap-2 text-sm">
          <legend className="sr-only">Metodo de pago</legend>
          <label className="flex items-center gap-2">
            <input id="checkout-pay-yape" type="radio" checked={payMethod === "YAPE"} onChange={() => setPayMethod("YAPE")} />
            Yape
          </label>
          <label className="flex items-center gap-2">
            <input id="checkout-pay-plin" type="radio" checked={payMethod === "PLIN"} onChange={() => setPayMethod("PLIN")} />
            Plin
          </label>
        </fieldset>

        <div className="text-sm text-foreground rounded-xl bg-background border border-border p-3">
          {payMethod === "YAPE" ? (
            <>
              <div className="font-medium">Datos para pagar por Yape</div>
              <div>Nombre: {paymentInstructions.yapeName?.trim() || "Disponible al momento de confirmar"}</div>
              <div>Numero: {paymentInstructions.yapeNumber?.trim() || "Disponible al momento de confirmar"}</div>
            </>
          ) : (
            <>
              <div className="font-medium">Datos para pagar por Plin</div>
              <div>Nombre: {paymentInstructions.plinName?.trim() || "Disponible al momento de confirmar"}</div>
              <div>Numero: {paymentInstructions.plinNumber?.trim() || "Disponible al momento de confirmar"}</div>
            </>
          )}
        </div>

        <div className="grid gap-1">
          <label htmlFor="checkout-receiptUrl" className="text-sm font-medium">Subir comprobante de pago</label>
          <label className="w-fit text-sm px-3 py-2 rounded-xl border border-border bg-card hover:bg-background cursor-pointer">
            {receiptBusy ? "Subiendo comprobante..." : "Seleccionar imagen"}
            <input
              id="checkout-receiptUrl"
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
          <ErrorText id="checkout-receiptUrl-error" message={fieldErrors.receiptUrl} />
        </div>

        {receiptUrl ? (
          <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Comprobante cargado</div>
                <div className="text-xs text-muted">{safeHostname(receiptUrl)}</div>
              </div>

              <div className="flex gap-2">
                <a href={receiptUrl} target="_blank" rel="noreferrer" className="inline-flex">
                  <Button type="button" size="sm">Ver comprobante</Button>
                </a>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(receiptUrl);
                      notify.success("Link copiado");
                    } catch {
                      notify.error("No se pudo copiar el link");
                    }
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receiptUrl} alt="Comprobante" className="max-h-72 w-full object-contain" />
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted">Debes subir el comprobante para confirmar el pedido.</div>
        )}
      </section>

      <section className="panel p-4 text-sm grid gap-2 rounded-2xl border-border" aria-labelledby="checkout-summary-title">
        <h2 id="checkout-summary-title" className="font-medium mb-1 text-foreground">4) Resumen del pedido</h2>
        {itemsPreview.map((it) => (
          <div key={`${it.productId}:${it.variantId}`} className="flex items-center justify-between">
            <span>{it.name} x {it.qty}</span>
            <span>{formatPEN(it.lineTotal)}</span>
          </div>
        ))}
        {couponVisible ? (
          <div className="grid gap-1 pt-2">
            <label htmlFor="checkout-coupon" className="text-sm font-medium">Cupon (opcional)</label>
            <Input id="checkout-coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder={promo.couponCode || "CUPON"} />
          </div>
        ) : null}
        <div className="flex items-center justify-between"><span>Subtotal</span><span>{loadingTotals ? "Calculando..." : formatPEN(subtotal)}</span></div>
        <div className="flex items-center justify-between"><span>Descuento</span><span>{loadingTotals ? "Calculando..." : discountAmount > 0 ? `-${formatPEN(discountAmount)}` : formatPEN(0)}</span></div>
        <div className="flex items-center justify-between"><span>Envio</span><span>{loadingTotals ? "Calculando..." : shippingCost === 0 ? "Gratis" : formatPEN(shippingCost)}</span></div>
        <div className="flex items-center justify-between font-semibold"><span>Total</span><span>{loadingTotals ? "Calculando..." : formatPEN(totalToPay)}</span></div>
      </section>

      {error ? (
        <div className="text-sm text-destructive" role="alert">
          No pudimos procesar tu solicitud. Verifica los datos e intentalo nuevamente.
        </div>
      ) : null}

      <Button type="button" onClick={submit} disabled={busy || receiptBusy || !items.length} size="lg">
        {busy ? "Confirmando pedido..." : "Confirmar pedido"}
      </Button>
    </div>
  );
}
