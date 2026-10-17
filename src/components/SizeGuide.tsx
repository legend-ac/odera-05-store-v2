export default function SizeGuide() {
  return (
    <details className="group" style={{ borderTop: "1px solid var(--ash-2)", borderBottom: "1px solid var(--ash-2)" }}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vermeil)]" style={{ color: "var(--paper)" }}>
        <span className="flex items-center gap-2">
          <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} style={{ color: "var(--vermeil)" }}>
            <path d="m3 15 12-12 6 6L9 21l-6-6Z" />
            <path d="m12 6 3 3m-6 0 2 2m-5 1 3 3" />
          </svg>
          Cómo medir tu pie y elegir talla
        </span>
        <svg aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="pb-4 text-sm leading-relaxed" style={{ color: "var(--ash)" }}>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Coloca una hoja sobre el suelo, junto a una pared. Ponte los calcetines que usarás con las zapatillas y apoya el talón contra la pared.</li>
          <li>De pie, marca en la hoja la punta del dedo más largo. Mide en centímetros desde la pared hasta esa marca.</li>
          <li>Repite con el otro pie y usa la medida más larga. Compárala con la guía específica de la marca y el modelo.</li>
        </ol>
        <p className="mt-3">La conversión a EU o US y el ajuste cambian según la marca y el modelo. Si la ficha no indica la equivalencia en centímetros, consulta esa medida con la tienda antes de elegir.</p>
      </div>
    </details>
  );
}
