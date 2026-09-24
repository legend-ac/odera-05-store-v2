"use client";

import { FormEvent, useState } from "react";

type FormState = {
  kind: "RECLAMO" | "QUEJA";
  fullName: string;
  documentNumber: string;
  email: string;
  phone: string;
  orderCode: string;
  detail: string;
};

const initialState: FormState = { kind: "RECLAMO", fullName: "", documentNumber: "", email: "", phone: "", orderCode: "", detail: "" };

const labelStyle = { color: "var(--paper)", fontSize: "12px", fontWeight: 700 } as const;
const inputStyle = { background: "var(--ink-2)", border: "1px solid var(--ash-2)", borderRadius: 0, color: "var(--paper)", fontSize: "14px" } as const;

export default function ConsumerClaimForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");

  const update = (key: keyof FormState, value: string) => setForm((previous) => ({ ...previous, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/consumer-claims", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json() as { code?: string; error?: string };
      if (!response.ok || !body.code) throw new Error(body.error ?? "No se pudo registrar el caso.");
      setCode(body.code);
      setForm(initialState);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el caso.");
    } finally {
      setSubmitting(false);
    }
  }

  if (code) {
    return <div className="mt-10 p-6" role="status" style={{ background: "rgba(60,184,120,.09)", border: "1px solid rgba(60,184,120,.45)" }}><p className="font-bold" style={{ color: "#86deb2" }}>Solicitud registrada</p><p className="mt-2" style={{ color: "var(--paper)", fontSize: "15px" }}>Tu código de seguimiento es <strong>{code}</strong>.</p><p className="mt-2" style={{ color: "var(--ash)", fontSize: "13px" }}>Guárdalo para cualquier consulta posterior.</p></div>;
  }

  return (
    <form onSubmit={submit} className="mt-10 grid gap-5" noValidate>
      <fieldset className="grid gap-3"><legend style={labelStyle}>Tipo de solicitud</legend><div className="flex flex-wrap gap-3"><label className="flex cursor-pointer items-center gap-2 px-4 py-3" style={{ ...inputStyle, borderColor: form.kind === "RECLAMO" ? "var(--vermeil)" : "var(--ash-2)" }}><input type="radio" name="kind" value="RECLAMO" checked={form.kind === "RECLAMO"} onChange={() => update("kind", "RECLAMO")} /> Reclamo</label><label className="flex cursor-pointer items-center gap-2 px-4 py-3" style={{ ...inputStyle, borderColor: form.kind === "QUEJA" ? "var(--vermeil)" : "var(--ash-2)" }}><input type="radio" name="kind" value="QUEJA" checked={form.kind === "QUEJA"} onChange={() => update("kind", "QUEJA")} /> Queja</label></div></fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2" style={labelStyle}>Nombre completo<input required value={form.fullName} onChange={(e) => update("fullName", e.target.value)} style={inputStyle} className="h-11 px-3" /></label>
        <label className="grid gap-2" style={labelStyle}>Documento de identidad<input required value={form.documentNumber} onChange={(e) => update("documentNumber", e.target.value)} style={inputStyle} className="h-11 px-3" /></label>
        <label className="grid gap-2" style={labelStyle}>Correo electrónico<input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} style={inputStyle} className="h-11 px-3" /></label>
        <label className="grid gap-2" style={labelStyle}>Teléfono<input required value={form.phone} onChange={(e) => update("phone", e.target.value)} style={inputStyle} className="h-11 px-3" /></label>
      </div>
      <label className="grid gap-2" style={labelStyle}>Código de pedido <span style={{ color: "var(--ash)", fontWeight: 400 }}>(opcional)</span><input value={form.orderCode} onChange={(e) => update("orderCode", e.target.value)} style={inputStyle} className="h-11 px-3" /></label>
      <label className="grid gap-2" style={labelStyle}>Detalle de la solicitud<textarea required minLength={20} rows={6} value={form.detail} onChange={(e) => update("detail", e.target.value)} style={inputStyle} className="resize-y p-3" placeholder="Describe lo ocurrido y lo que solicitas." /></label>
      {error && <p role="alert" style={{ color: "#ff876e", fontSize: "13px" }}>{error}</p>}
      <button type="submit" disabled={submitting} className="btn-brand w-fit disabled:opacity-60" style={{ fontSize: "12px", padding: "12px 20px" }}>{submitting ? "Registrando…" : "Registrar solicitud"}</button>
    </form>
  );
}
