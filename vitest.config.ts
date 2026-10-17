import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["e2e/**", "node_modules/**", "dist/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // This is the maintained unit-test boundary: pricing, stock, order
      // rules and the public purchase APIs. Browser flows are covered by
      // Playwright instead of being counted as unit-test statements.
      include: [
        "src/lib/idempotency.ts",
        "src/lib/orderExport.ts",
        "src/lib/orderStatus.ts",
        "src/lib/paymentRules.ts",
        "src/lib/productStock.ts",
        "src/lib/searchTokens.ts",
        "src/lib/trackingUrl.ts",
        "src/lib/shipping.ts",
        "src/lib/checkoutErrors.ts",
        "src/lib/productMetadata.ts",
        "src/lib/storeInformation.ts",
        "src/lib/server/emailDelivery.ts",
        "src/lib/server/random.ts",
        "src/schemas/consumerClaim.ts",
        "src/schemas/createOrder.ts",
        "src/schemas/submitPayment.ts",
        "src/schemas/settings.ts",
        "src/app/api/create-order/route.ts",
        "src/app/api/submit-payment/route.ts",
        "src/app/api/products/cart/route.ts",
        "src/app/api/consumer-claims/route.ts",
      ],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 80,
        lines: 50,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
