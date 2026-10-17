"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useCart } from "@/components/cart/CartProvider";
import { Input } from "@/components/ui/fields";
import { apiPost, makeIdempotencyKey } from "@/lib/apiClient";
import type { CreateOrderResponse } from "@/schemas/createOrder";
import { db } from "@/lib/firebase/client";
import { formatPEN } from "@/lib/money";
import { checkoutErrorMessage } from "@/lib/checkoutErrors";
import { shippingCostFor, shippingThreshold } from "@/lib/shipping";

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

type StorePromo = {
  enabled: boolean;
  couponCode: string;
  discountPercent: number;
  freeShippingFrom: number;
};

type FieldErrors = Record<string, string>;

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
  const pendingRequest = useRef<{payload: string; key: string; createdAt: number} | null>(null);

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [itemsPreview, setItemsPreview] = useState<ItemPreview[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [couponCode, setCouponCode] = useState("");
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

        if (!items.length) { setSubtotal(0); setItemsPreview([]); return; }
        const response = await fetch(`/api/products/cart?ids=${encodeURIComponent(Array.from(new Set(items.map(it => it.productId))).join(","))}`, { cache: "no-store" });
        if (!response.ok) throw new Error("CART_PRODUCTS_UNAVAILABLE");
        const { products } = await response.json();
        for (const it of items) {
          const data = products.find((product: { id: string }) => product.id === it.productId);
          if (!data) throw new Error("PRODUCT_NOT_FOUND");
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
      } catch {
        if (mounted) setError("No pudimos actualizar el resumen. Revisa el carrito antes de reservar.");
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

  const freeShippingFrom = shippingThreshold(promo.freeShippingFrom);
  const shippingCost = useMemo(() => shippingCostFor(subtotal, freeShippingFrom), [subtotal, freeShippingFrom]);
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
      const shipping = shippingMethod === "LIMA_DELIVERY"
        ? { method: "LIMA_DELIVERY" as const, receiverName: receiverName.trim(), receiverDni: receiverDni.trim(), receiverPhone: receiverPhone.trim(), district: district.trim(), addressLine1: addressLine1.trim(), reference: addressReference.trim() || undefined }
        : { method: "AGENCIA_PROVINCIA" as const, receiverName: receiverName.trim(), receiverDni: receiverDni.trim(), receiverPhone: receiverPhone.trim(), department: department.trim(), province: province.trim(), agencyName: agencyName.trim(), agencyAddress: agencyAddress.trim(), reference: agencyReference.trim() || undefined };

      const payload = { items, customer: { name: name.trim(), email: email.trim(), phone: phone.trim() }, payment: { method: payMethod }, shipping, couponCode: couponVisible ? normalizedCoupon || undefined : undefined };
      const serialized = JSON.stringify(payload);
      const createdAt = Date.now();
      const previousRequest = pendingRequest.current;
      let key = previousRequest?.payload === serialized && createdAt - previousRequest.createdAt < 20 * 60 * 1000 ? previousRequest.key : makeIdempotencyKey();
      try {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
        const signature = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
        const previous = JSON.parse(sessionStorage.getItem("odera_checkout_request") ?? "null");
        if (previous?.signature === signature && typeof previous.key === "string" && Number.isFinite(previous.createdAt) && createdAt - previous.createdAt < 20 * 60 * 1000) key = previous.key;
        sessionStorage.setItem("odera_checkout_request", JSON.stringify({signature, key, createdAt}));
      } catch { /* A blocked browser storage must not prevent checkout. */ }
      pendingRequest.current = {payload: serialized, key, createdAt};
      const res = await apiPost<CreateOrderResponse>(
        "/api/create-order",
        payload,
        { idempotencyKey: key }
      );
      if (res.reservedUntilMs <= Date.now()) throw new Error("ORDER_EXPIRED");
      pendingRequest.current = null;
      try { sessionStorage.removeItem("odera_checkout_request"); } catch { /* optional storage */ }
      clear();
      router.push(`/checkout/pago?publicCode=${encodeURIComponent(res.publicCode)}&trackingToken=${encodeURIComponent(res.trackingToken)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo crear el pedido.";
      if (msg === "ORDER_EXPIRED" || msg === "ORDER_CANCELLED") {
        pendingRequest.current = null;
        try { sessionStorage.removeItem("odera_checkout_request"); } catch { /* optional storage */ }
      }
      setError(checkoutErrorMessage(msg));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shopping-flow checkout-page mx-auto max-w-5xl px-4 py-8 flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Link href="/" className="hover:text-slate-900 transition-colors">Inicio</Link>
        <span className="text-slate-300">/</span>
        <Link href="/cart" className="hover:text-slate-900 transition-colors">Carrito</Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900">Checkout</span>
      </nav>

      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">Finalizar compra</h1>
        <p className="text-sm text-slate-500 mt-1">Primero confirmaremos stock y total. Después podrás pagar tu reserva.</p>
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
        <h2 id="checkout-payment-title" className="flex items-center gap-2.5 font-semibold text-slate-900"><span className="grid place-items-center h-7 w-7 rounded-lg bg-slate-100 text-xs font-bold text-slate-600">3</span>Medio de pago</h2>
        <fieldset className="grid sm:grid-cols-2 gap-2">
          <legend className="sr-only">Método de pago</legend>
          <label className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all duration-150 ${payMethod === "YAPE" ? "border-[#6C2D82] bg-purple-50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}><input id="checkout-pay-yape" type="radio" checked={payMethod === "YAPE"} onChange={() => setPayMethod("YAPE")} className="accent-[#6C2D82]" /><p className="text-sm font-semibold text-slate-900">💜 Yape</p></label>
          <label className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all duration-150 ${payMethod === "PLIN" ? "border-emerald-600 bg-emerald-50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}><input id="checkout-pay-plin" type="radio" checked={payMethod === "PLIN"} onChange={() => setPayMethod("PLIN")} className="accent-emerald-600" /><p className="text-sm font-semibold text-slate-900">💚 Plin</p></label>
        </fieldset>
        <p className="text-sm text-slate-500">Verás el número y el titular para pagar después de confirmar la disponibilidad. La reserva dura 20 minutos.</p>
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
          <div className="flex items-center justify-between font-bold text-slate-900 text-base pt-1"><span>Total estimado</span><span className="tabular-nums">{loadingTotals ? "Calculando..." : formatPEN(totalToPay)}</span></div>
        </div>
        <p className="text-xs text-slate-500">Envío S/10 o gratis desde {formatPEN(freeShippingFrom)} de productos antes del descuento. Confirmaremos el importe exacto al reservar.</p>
      </section>

      {error ? <div className="text-sm text-destructive bg-rose-50 border border-rose-200 rounded-xl px-4 py-3" role="alert">{error} <a href="/cart" className="font-bold underline">Revisar carrito</a></div> : null}

      <button type="button" onClick={submit} disabled={busy || loadingTotals || !items.length} className="btn-brand w-full justify-center h-14 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed">
        {busy ? "Confirmando disponibilidad..." : "Reservar y continuar al pago"}
      </button>
    </div>
  );
}
