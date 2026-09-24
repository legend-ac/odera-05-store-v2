"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "@/components/ui/layout";

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/dashboard")) {
    return null;
  }

  return (
    <footer
      className="mt-16 relative"
      style={{
        background: "var(--ink-2)",
        borderTop: "1px solid var(--ash-2)",
      }}
    >
      {/* Vermeil accent line */}
      <div
        className="absolute top-0 inset-x-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, transparent 0%, var(--vermeil) 30%, var(--gold) 60%, transparent 100%)",
        }}
      />

      <Container className="py-12 grid md:grid-cols-4 gap-8 text-sm">
        {/* Brand column */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center text-white text-[11px] font-black"
              style={{
                width: 36,
                height: 36,
                background: "var(--vermeil)",
                clipPath: "polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px))",
                letterSpacing: "0.06em",
              }}
            >
              O5
            </span>
            <div>
              <p
                className="font-black tracking-tight"
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "15px",
                  letterSpacing: "0.12em",
                  color: "var(--paper)",
                }}
              >
                ODERA 05 STORE
              </p>
              <p
                className="font-medium"
                style={{
                  fontSize: "9px",
                  letterSpacing: "0.22em",
                  color: "var(--ash)",
                  textTransform: "uppercase",
                }}
              >
                オデラ · Perú
              </p>
            </div>
          </div>
          <p style={{ color: "var(--ash)", fontSize: "11px", lineHeight: "1.7" }}>
            Tienda peruana de zapatillas y ropa con atención por canales oficiales.
          </p>
          <div
            className="inline-flex items-center gap-2 w-fit"
            style={{
              background: "var(--ink-3)",
              border: "1px solid var(--ash-2)",
              borderRadius: "2px",
              padding: "6px 12px",
              fontSize: "11px",
              color: "var(--ash)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: "#3CB878",
                boxShadow: "0 0 6px rgba(60,184,120,0.8)",
              }}
            />
            Compra protegida · Seguimiento claro
          </div>
        </div>

        {/* Navegación */}
        <div className="flex flex-col gap-3">
          <p
            className="font-black mb-1"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "13px",
              letterSpacing: "0.2em",
              color: "var(--paper)",
            }}
          >
            NAVEGACIÓN
          </p>
          {[
            { href: "/catalog", label: "Catálogo" },
            { href: "/track", label: "Seguimiento" },
            { href: "/cart", label: "Carrito" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="transition-colors duration-150 hover:text-[var(--vermeil)]"
              style={{ color: "var(--ash)", fontSize: "13px" }}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Compra Segura */}
        <div className="flex flex-col gap-3">
          <p
            className="font-black mb-1"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "13px",
              letterSpacing: "0.2em",
              color: "var(--paper)",
            }}
          >
            COMPRA SEGURA
          </p>
          {[
            "Validación de pagos con confirmación manual.",
            "Stock y estado de pedido en tiempo real.",
            "Despachos a Lima y provincias.",
          ].map((text) => (
            <p key={text} style={{ color: "var(--ash)", fontSize: "12px", lineHeight: "1.6" }}>
              {text}
            </p>
          ))}
        </div>

        {/* Soporte */}
        <div className="flex flex-col gap-3">
          <p
            className="font-black mb-1"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "13px",
              letterSpacing: "0.2em",
              color: "var(--paper)",
            }}
          >
            SOPORTE
          </p>
          {[
            "Respuesta rápida por WhatsApp y redes oficiales.",
            "Seguimiento simple con número de pedido.",
          ].map((text) => (
            <p key={text} style={{ color: "var(--ash)", fontSize: "12px", lineHeight: "1.6" }}>
              {text}
            </p>
          ))}
        </div>
      </Container>

      {/* Bottom bar */}
      <div style={{ borderTop: "1px solid var(--ash-2)" }}>
        <Container
          className="py-5 text-xs flex flex-col md:flex-row md:items-center md:justify-between gap-2"
          style={{ color: "var(--ash-2)" }}
        >
          <p>© {new Date().getFullYear()} ODERA 05 STORE. Todos los derechos reservados.</p>
          <p style={{ color: "var(--ash)" }}>Marca peruana · ペルーブランド</p>
        </Container>
      </div>
    </footer>
  );
}
