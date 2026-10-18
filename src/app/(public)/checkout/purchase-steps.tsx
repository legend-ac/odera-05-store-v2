import styles from "./purchase-flow.module.css";

export default function PurchaseSteps({ current }: { current: "cart" | "details" | "payment" }) {
  return (
    <ol className={styles.steps} aria-label="Pasos de compra">
      <li aria-current={current === "cart" ? "step" : undefined}><span>01</span>Carrito</li>
      <li aria-current={current === "details" ? "step" : undefined}><span>02</span>Datos y envío</li>
      <li aria-current={current === "payment" ? "step" : undefined}><span>03</span>Pago</li>
    </ol>
  );
}
