"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/fields";
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
    if (!email.includes("@")) next.email = "Ingresa un correo válido.";
    if (phone.trim().length < 6) next.phone = "Ingresa un teléfono válido.";
    if (receiverName.trim().length < 2) next.receiverName = "Ingresa quien recibe el pedido.";
    if (receiverDni.trim().length < 8) next.receiverDni = "Ingresa un DNI válido.";
    if (receiverPhone.trim().length < 6) next.receiverPhone = "Ingresa un teléfono válido.";
    if (shippingMethod === "LIMA_DELIVERY") {
      if (district.trim().length < 2) next.district = "Ingresa distrito.";
      if (addressLine1.trim().length < 5) next.addressLine1 = "Ingresa dirección completa.";
    } else {
      if (department.trim().length < 2) next.department = "Ingresa departamento.";
      if (province.trim().length < 2) next.province = "Ingresa provincia.";
      if (agencyName.trim().length < 2) next.agencyName = "Ingresa agencia.";
      if (agencyAddress.trim().length < 5) next.agencyAddress = "Ingresa dirección de agencia.";
    }
    if (!receiptUrl) next.receiptUrl = "Debes subir un comprobante para confirmar.";
    if (!items.length) next.items = "Tu carrito está vacío.";
    return next;
  }

  function focusFirstError(next: FieldErrors) {
    const order = ["name", "email", "phone", "receiverName", "receiverDni", "receiverPhone", "district", "addressLine1", "department", "province", "agencyName", "agencyAddress", "receiptUrl"];
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
      if (msg.includes("CLOUDINARY_NOT_CONFIGURED")) setError("El sistema de comprobantes está en mantenimiento temporal.");
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
      const shipping = shippingMethod === "LIMA_DELIVERY"
        ? { method: "LIMA_DELIVERY" as const, receiverName: receiverName.trim(), receiverDni: receiverDni.trim(), receiverPhone: receiverPhone.trim(), district: district.trim(), addressLine1: addressLine1.trim(), reference: addressReference.trim() || undefined }
        : { method: "AGENCIA_PROVINCIA" as const, receiverName: receiverName.trim(), receiverDni: receiverDni.trim(), receiverPhone: receiverPhone.trim(), department: department.trim(), province: province.trim(), agencyName: agencyName.trim(), agencyAddress: agencyAddress.trim(), reference: agencyReference.trim() || undefined };

      const res = await apiPost<CreateOrderResponse>(
        "/api/create-order",
        { items, customer: { name: name.trim(), email: email.trim(), phone: phone.trim() }, payment: { method: payMethod, receiptImageUrl: receiptUrl }, shipping, couponCode: couponVisible ? normalizedCoupon || undefined : undefined },
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
      <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <a href="/" className="hover:text-slate-900 transition-colors">Inicio</a>
        <span className="text-slate-300">/</span>
        <a href="/cart" className="hover:text-slate-900 transition-colors">Carrito</a>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900">Checkout</span>
      </nav>

      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">Finalizar compra</h1>
        <p className="text-sm text-slate-500 mt-1">Completa tus datos para confirmar tu compra de forma segura.</p>
      </div>

      {!items.length ? (<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-destructive" role="alert">Tu carrito está vacío.</div>) : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] p-5 grid gap-4" aria-labelledby="checkout-customer-title">
        <h2 id="checkout-customer-title" className="flex items-center gap-2.5 font-semibold text-slate-900"><span className="grid place-items-center h-7 w-7 rounded-lg bg-slate-100 text-xs font-bold text-slate-600">1</span>Datos personales</h2>
        <div className="grid gap-1"><label htmlFor="checkout-name" className="text-sm font-medium text-slate-700">Nombre completo</label><Input id="checkout-name" value={name} invalid={Boolean(fieldErrors.name)} onChange={(e) => { setName(e.target.value); setFieldErrorAware("name", e.target.value); }} /><ErrorText id="checkout-name-error" message={fieldErrors.name} /></div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="grid gap-1"><label htmlFor="checkout-email" className="text-sm font-medium text-slate-700">Correo</label><Input id="checkout-email" type="email" value={email} invalid={Boolean(fieldErrors.email)} onChange={(e) => { setEmail(e.target.value); setFieldErrorAware("email", e.target.value); }} /><ErrorText id="checkout-email-error" message={fieldErrors.email} /></div>
          <div className="grid gap-1"><label htmlFor="checkout-phone" className="text-sm font-medium text-slate-700">Teléfono</label><Input id="checkout-phone" value={phone} invalid={Boolean(fieldErrors.phone)} onChange={(e) => { setPhone(e.target.value); setFieldErrorAware("phone", e.target.value); }} /><ErrorText id="checkout-phone-error" message={fieldErrors.phone} /></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] p-5 grid gap-4" aria-labelledby="checkout-shipping-title">
        <h2 id="checkout-shipping-title" className="flex items-center gap-2.5 font-semibold text-slate-900"><span className="grid place-items-center h-7 w-7 rounded-lg bg-slate-100 text-xs font-bold text-slate-600">2</span>Tipo de envío y dirección</h2>
        <fieldset className="grid sm:grid-cols-2 gap-2">
          <legend className="sr-only">Método de envío</legend>
          <label className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all duration-150 ${shippingMethod === "LIMA_DELIVERY" ? "border-slate-900 bg-slate-50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}><input id="checkout-shipping-lima" type="radio" checked={shippingMethod === "LIMA_DELIVERY"} onChange={() => setShippingMethod("LIMA_DELIVERY")} className="accent-slate-900" /><div><p className="text-sm font-semibold text-slate-900">Lima Metropolitana</p><p className="text-xs text-slate-500">Delivery a domicilio</p></div></label>
          <label className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all duration-150 ${shippingMethod === "AGENCIA_PROVINCIA" ? "border-slate-900 bg-slate-50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}><input id="checkout-shipping-agency" type="radio" checked={shippingMethod === "AGENCIA_PROVINCIA"} onChange={() => setShippingMethod("AGENCIA_PROVINCIA")} className="accent-slate-900" /><div><p className="text-sm font-semibold text-slate-900">Provincia</p><p className="text-xs text-slate-500">Envío por agencia</p></div></label>
        </fieldset>
        <div className="grid gap-1"><label htmlFor="checkout-receiverName" className="text-sm font-medium text-slate-700">Nombre de quien recibe o recoge</label><Input id="checkout-receiverName" value={receiverName} invalid={Boolean(fieldErrors.receiverName)} onChange={(e) => { setReceiverName(e.target.value); setFieldErrorAware("receiverName", e.target.value); }} /><ErrorText id="checkout-receiverName-error" message={fieldErrors.receiverName} /></div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="grid gap-1"><label htmlFor="checkout-receiverDni" className="text-sm font-medium text-slate-700">DNI</label><Input id="checkout-receiverDni" value={receiverDni} invalid={Boolean(fieldErrors.receiverDni)} onChange={(e) => { setReceiverDni(e.target.value); setFieldErrorAware("receiverDni", e.target.value); }} /><ErrorText id="checkout-receiverDni-error" message={fieldErrors.receiverDni} /></div>
          <div className="grid gap-1"><label htmlFor="checkout-receiverPhone" className="text-sm font-medium text-slate-700">Teléfono</label><Input id="checkout-receiverPhone" value={receiverPhone} invalid={Boolean(fieldErrors.receiverPhone)} onChange={(e) => { setReceiverPhone(e.target.value); setFieldErrorAware("receiverPhone", e.target.value); }} /><ErrorText id="checkout-receiverPhone-error" message={fieldErrors.receiverPhone} /></div>
        </div>
        {shippingMethod === "LIMA_DELIVERY" ? (<>
          <div className="grid gap-1"><label htmlFor="checkout-district" className="text-sm font-medium text-slate-700">Distrito</label><Input id="checkout-district" value={district} invalid={Boolean(fieldErrors.district)} onChange={(e) => { setDistrict(e.target.value); setFieldErrorAware("district", e.target.value); }} /><ErrorText id="checkout-district-error" message={fieldErrors.district} /></div>
          <div className="grid gap-1"><label htmlFor="checkout-addressLine1" className="text-sm font-medium text-slate-700">Dirección</label><Input id="checkout-addressLine1" value={addressLine1} invalid={Boolean(fieldErrors.addressLine1)} onChange={(e) => { setAddressLine1(e.target.value); setFieldErrorAware("addressLine1", e.target.value); }} /><ErrorText id="checkout-addressLine1-error" message={fieldErrors.addressLine1} /></div>
          <div className="grid gap-1"><label htmlFor="checkout-addressReference" className="text-sm font-medium text-slate-700">Referencia (opcional)</label><Input id="checkout-addressReference" value={addressReference} onChange={(e) => setAddressReference(e.target.value)} /></div>
        </>) : (<>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1"><label htmlFor="checkout-department" className="text-sm font-medium text-slate-700">Departamento</label><Input id="checkout-department" value={department} invalid={Boolean(fieldErrors.department)} onChange={(e) => { setDepartment(e.target.value); setFieldErrorAware("department", e.target.value); }} /><ErrorText id="checkout-department-error" message={fieldErrors.department} /></div>
            <div className="grid gap-1"><label htmlFor="checkout-province" className="text-sm font-medium text-slate-700">Provincia</label><Input id="checkout-province" value={province} invalid={Boolean(fieldErrors.province)} onChange={(e) => { setProvince(e.target.value); setFieldErrorAware("province", e.target.value); }} /><ErrorText id="checkout-province-error" message={fieldErrors.province} /></div>
          </div>
          <div className="grid gap-1"><label htmlFor="checkout-agencyName" className="text-sm font-medium text-slate-700">Agencia (ej. Shalom)</label><Input id="checkout-agencyName" value={agencyName} invalid={Boolean(fieldErrors.agencyName)} onChange={(e) => { setAgencyName(e.target.value); setFieldErrorAware("agencyName", e.target.value); }} /><ErrorText id="checkout-agencyName-error" message={fieldErrors.agencyName} /></div>
          <div className="grid gap-1"><label htmlFor="checkout-agencyAddress" className="text-sm font-medium text-slate-700">Dirección de agencia</label><Input id="checkout-agencyAddress" value={agencyAddress} invalid={Boolean(fieldErrors.agencyAddress)} onChange={(e) => { setAgencyAddress(e.target.value); setFieldErrorAware("agencyAddress", e.target.value); }} /><ErrorText id="checkout-agencyAddress-error" message={fieldErrors.agencyAddress} /></div>
          <div className="grid gap-1"><label htmlFor="checkout-agencyReference" className="text-sm font-medium text-slate-700">Referencia (opcional)</label><Input id="checkout-agencyReference" value={agencyReference} onChange={(e) => setAgencyReference(e.target.value)} /></div>
        </>)}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] p-5 grid gap-4" aria-labelledby="checkout-payment-title">
        <h2 id="checkout-payment-title" className="flex items-center gap-2.5 font-semibold text-slate-900"><span className="grid place-items-center h-7 w-7 rounded-lg bg-slate-100 text-xs font-bold text-slate-600">3</span>Pago y comprobante</h2>
        <fieldset className="grid sm:grid-cols-2 gap-2">
          <legend className="sr-only">Método de pago</legend>
          <label className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all duration-150 ${payMethod === "YAPE" ? "border-[#6C2D82] bg-purple-50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}><input id="checkout-pay-yape" type="radio" checked={payMethod === "YAPE"} onChange={() => setPayMethod("YAPE")} className="accent-[#6C2D82]" /><p className="text-sm font-semibold text-slate-900">💜 Yape</p></label>
          <label className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all duration-150 ${payMethod === "PLIN" ? "border-emerald-600 bg-emerald-50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}><input id="checkout-pay-plin" type="radio" checked={payMethod === "PLIN"} onChange={() => setPayMethod("PLIN")} className="accent-emerald-600" /><p className="text-sm font-semibold text-slate-900">💚 Plin</p></label>
        </fieldset>
        <div className="text-sm rounded-xl bg-[var(--surface-muted)] border border-slate-200 p-4">
          {payMethod === "YAPE" ? (<><p className="font-semibold text-slate-900 mb-1">Datos para pagar por Yape</p><p className="text-slate-600">Nombre: {paymentInstructions.yapeName?.trim() || "Disponible al momento de confirmar"}</p><p className="text-slate-600">Número: {paymentInstructions.yapeNumber?.trim() || "Disponible al momento de confirmar"}</p></>) : (<><p className="font-semibold text-slate-900 mb-1">Datos para pagar por Plin</p><p className="text-slate-600">Nombre: {paymentInstructions.plinName?.trim() || "Disponible al momento de confirmar"}</p><p className="text-slate-600">Número: {paymentInstructions.plinNumber?.trim() || "Disponible al momento de confirmar"}</p></>)}
        </div>
        <div className="grid gap-1">
          <label htmlFor="checkout-receiptUrl" className="text-sm font-medium text-slate-700">Subir comprobante de pago</label>
          <label className="w-fit inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-[var(--surface-hover)] hover:border-slate-300 cursor-pointer transition-all duration-150 font-medium text-slate-700 shadow-sm">
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            {receiptBusy ? "Subiendo comprobante..." : "Seleccionar imagen"}
            <input id="checkout-receiptUrl" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickReceipt(f); e.currentTarget.value = ""; }} />
          </label>
          <ErrorText id="checkout-receiptUrl-error" message={fieldErrors.receiptUrl} />
        </div>
        {receiptUrl ? (
          <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-semibold text-slate-900">Comprobante cargado</p><p className="text-xs text-slate-500">{safeHostname(receiptUrl)}</p></div>
              <div className="flex gap-2">
                <a href={receiptUrl} target="_blank" rel="noreferrer" className="inline-flex"><Button type="button" size="sm">Ver</Button></a>
                <Button type="button" variant="secondary" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(receiptUrl); notify.success("Link copiado"); } catch { notify.error("No se pudo copiar"); } }}>Copiar</Button>
              </div>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-[var(--surface-muted)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receiptUrl} alt="Comprobante" className="max-h-72 w-full object-contain" />
            </div>
          </div>
        ) : (<p className="text-xs text-slate-500">Debes subir el comprobante para confirmar el pedido.</p>)}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] p-5 grid gap-3" aria-labelledby="checkout-summary-title">
        <h2 id="checkout-summary-title" className="flex items-center gap-2.5 font-semibold text-slate-900"><span className="grid place-items-center h-7 w-7 rounded-lg bg-slate-100 text-xs font-bold text-slate-600">4</span>Resumen del pedido</h2>
        <div className="flex flex-col gap-1.5 text-sm">
          {itemsPreview.map((it) => (<div key={`${it.productId}:${it.variantId}`} className="flex items-center justify-between"><span className="text-slate-700">{it.name} x {it.qty}</span><span className="font-medium text-slate-900 tabular-nums">{formatPEN(it.lineTotal)}</span></div>))}
        </div>
        {couponVisible ? (<div className="grid gap-1 pt-2 border-t border-slate-100"><label htmlFor="checkout-coupon" className="text-sm font-medium text-slate-700">Cupón (opcional)</label><Input id="checkout-coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder={promo.couponCode || "CUPON"} uiSize="sm" /></div>) : null}
        <div className="border-t border-slate-100 pt-3 flex flex-col gap-1 text-sm">
          <div className="flex items-center justify-between"><span className="text-slate-500">Subtotal</span><span className="tabular-nums">{loadingTotals ? "Calculando..." : formatPEN(subtotal)}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-500">Descuento</span><span className="tabular-nums">{loadingTotals ? "Calculando..." : discountAmount > 0 ? `-${formatPEN(discountAmount)}` : formatPEN(0)}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-500">Envío</span><span className="tabular-nums">{loadingTotals ? "Calculando..." : shippingCost === 0 ? "Gratis" : formatPEN(shippingCost)}</span></div>
          <div className="flex items-center justify-between font-bold text-slate-900 text-base pt-1"><span>Total</span><span className="tabular-nums">{loadingTotals ? "Calculando..." : formatPEN(totalToPay)}</span></div>
        </div>
      </section>

      {error ? (<div className="flex items-center gap-2 text-sm text-destructive bg-rose-50 border border-rose-200 rounded-xl px-4 py-3" role="alert"><svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>No pudimos procesar tu solicitud. Verifica los datos e inténtalo nuevamente.</div>) : null}

      <button type="button" onClick={submit} disabled={busy || receiptBusy || !items.length} className="btn-brand w-full justify-center h-14 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed">
        {busy ? "Confirmando pedido..." : "Confirmar pedido"}
      </button>
    </div>
  );
}
