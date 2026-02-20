"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useCart } from "@/components/cart/CartProvider";
import { apiPost, makeIdempotencyKey } from "@/lib/apiClient";
import type { CreateOrderResponse } from "@/schemas/createOrder";
import { db } from "@/lib/firebase/client";
import { formatPEN } from "@/lib/money";

type ShippingMethod = "LIMA_DELIVERY" | "AGENCIA_PROVINCIA";

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

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subtotal, setSubtotal] = useState(0);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [couponCode, setCouponCode] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingTotals(true);
        let nextSubtotal = 0;

        for (const it of items) {
          const snap = await getDoc(doc(db, "products", it.productId));
          if (!snap.exists()) continue;
          const data = snap.data() as any;
          const unit = data.onSale && typeof data.salePrice === "number" ? Number(data.salePrice) : Number(data.price ?? 0);
          nextSubtotal += unit * it.qty;
        }

        if (mounted) setSubtotal(nextSubtotal);
      } finally {
        if (mounted) setLoadingTotals(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [items]);

  const normalizedCoupon = useMemo(() => couponCode.trim().toUpperCase(), [couponCode]);
  const couponValid = normalizedCoupon === "ODERA10";
  const discountAmount = useMemo(() => (couponValid ? Math.round(subtotal * 0.1 * 100) / 100 : 0), [couponValid, subtotal]);
  const shippingCost = useMemo(() => (subtotal >= 200 ? 0 : 10), [subtotal]);
  const totalToPay = useMemo(() => Math.max(0, subtotal - discountAmount) + shippingCost, [subtotal, discountAmount, shippingCost]);

  const isCustomerValid = useMemo(() => name.trim().length >= 2 && email.includes("@") && phone.trim().length >= 6, [name, email, phone]);

  const isShippingValid = useMemo(() => {
    const receiverOk = receiverName.trim().length >= 2 && receiverDni.trim().length >= 8 && receiverPhone.trim().length >= 6;
    if (!receiverOk) return false;
    if (shippingMethod === "LIMA_DELIVERY") {
      return district.trim().length >= 2 && addressLine1.trim().length >= 5;
    }
    return (
      department.trim().length >= 2 &&
      province.trim().length >= 2 &&
      agencyName.trim().length >= 2 &&
      agencyAddress.trim().length >= 5
    );
  }, [shippingMethod, receiverName, receiverDni, receiverPhone, district, addressLine1, department, province, agencyName, agencyAddress]);

  const disabled = useMemo(() => busy || !items.length || !isCustomerValid || !isShippingValid, [busy, items.length, isCustomerValid, isShippingValid]);

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
          shipping,
          couponCode: normalizedCoupon || undefined,
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
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Finalizar compra</h1>

      {!items.length ? <div className="text-sm text-neutral-600">Tu carrito esta vacio.</div> : null}

      <div className="grid gap-3">
        <label className="text-sm font-medium">Nombre completo</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />

        <label className="text-sm font-medium">Correo</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />

        <label className="text-sm font-medium">Telefono</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
      </div>

      <div className="border border-neutral-200 rounded-xl p-4 flex flex-col gap-3">
        <div className="font-medium">Tipo de envio</div>

        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={shippingMethod === "LIMA_DELIVERY"}
              onChange={() => setShippingMethod("LIMA_DELIVERY")}
            />
            Lima Metropolitana - Delivery
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={shippingMethod === "AGENCIA_PROVINCIA"}
              onChange={() => setShippingMethod("AGENCIA_PROVINCIA")}
            />
            Provincia - Envio por agencia
          </label>
        </div>

        {shippingMethod === "LIMA_DELIVERY" ? (
          <div className="grid gap-3">
            <label className="text-sm font-medium">Nombre de quien recibe</label>
            <input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />

            <div className="grid md:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <label className="text-sm font-medium">DNI de quien recibe</label>
                <input value={receiverDni} onChange={(e) => setReceiverDni(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Celular de quien recibe</label>
                <input value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
              </div>
            </div>

            <label className="text-sm font-medium">Distrito</label>
            <input value={district} onChange={(e) => setDistrict(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />

            <label className="text-sm font-medium">Direccion</label>
            <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />

            <label className="text-sm font-medium">Referencia (opcional)</label>
            <input value={addressReference} onChange={(e) => setAddressReference(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
          </div>
        ) : (
          <div className="grid gap-3">
            <label className="text-sm font-medium">Nombre de quien recoge</label>
            <input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />

            <div className="grid md:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <label className="text-sm font-medium">DNI de quien recoge</label>
                <input value={receiverDni} onChange={(e) => setReceiverDni(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Celular de quien recoge</label>
                <input value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
              </div>
            </div>

            <label className="text-sm font-medium">Departamento</label>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />

            <label className="text-sm font-medium">Provincia</label>
            <input value={province} onChange={(e) => setProvince(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />

            <label className="text-sm font-medium">Agencia de envio (ejemplo: Shalom)</label>
            <input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />

            <label className="text-sm font-medium">Direccion de agencia</label>
            <input value={agencyAddress} onChange={(e) => setAgencyAddress(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />

            <label className="text-sm font-medium">Referencia (opcional)</label>
            <input value={agencyReference} onChange={(e) => setAgencyReference(e.target.value)} className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
          </div>
        )}
      </div>

      <div className="border border-neutral-200 rounded-xl p-4 text-sm grid gap-1">
        <div className="grid gap-1 pb-2">
          <label className="text-sm font-medium">Cupon de descuento (opcional)</label>
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Ejemplo: ODERA10"
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
          <div className="text-xs text-neutral-500">
            Cupon activo: <b>ODERA10</b> (10% de descuento en productos).
          </div>
        </div>
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
        <div className="text-xs text-neutral-500 pt-1">
          Envio gratis desde S/ 200 en productos. Si tu compra es menor, el envio cuesta S/ 10.
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <button
        type="button"
        disabled={disabled}
        onClick={submit}
        className="px-4 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
      >
        {busy ? "Registrando pedido..." : "Confirmar pedido"}
      </button>

      <div className="text-xs text-neutral-500">
        Verificamos stock y precio antes de confirmar tu compra.
      </div>
    </div>
  );
}
