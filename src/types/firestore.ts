export type ProductStatus = "active" | "archived";

export type ProductImage = {
  url: string;
  alt?: string;
  isMain: boolean;
  order: number;
};

export type ProductVariant = {
  id: string;
  size?: string;
  color?: string;
  sku?: string;
  stock: number;
};

export type ProductDoc = {
  status: ProductStatus;
  slug: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  price: number;
  salePrice?: number;
  onSale: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
  searchTokens: string[];
  createdAt: unknown;
  updatedAt: unknown;
};

export type OrderStatus =
  | "SCHEDULED"
  | "PAYMENT_SENT"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "CANCELLED_EXPIRED";

export type OrderItemSnapshot = {
  productId: string;
  nameSnapshot: string;
  imageSnapshot: string;
  variantSnapshot: { id: string; size?: string; color?: string };
  unitPriceSnapshot: number;
  qty: number;
};

export type OrderDoc = {
  publicCode: string;
  trackingToken: string;
  status: OrderStatus;
  reservedUntil: unknown;
  customer: { name: string; email: string; phone: string };
  shipping:
    | {
        method: "LIMA_DELIVERY";
        receiverName: string;
        receiverDni: string;
        receiverPhone: string;
        district: string;
        addressLine1: string;
        reference?: string;
      }
    | {
        method: "AGENCIA_PROVINCIA";
        receiverName: string;
        receiverDni: string;
        receiverPhone: string;
        department: string;
        province: string;
        agencyName: string;
        agencyAddress: string;
        reference?: string;
      };
  itemsSnapshots: OrderItemSnapshot[];
  totals: { subtotal: number; discountAmount?: number; shippingCost?: number; totalToPay: number };
  couponCode?: string;
  payment: { operationCode?: string; method?: "YAPE" | "PLIN" | "OTHER"; paymentSentAt?: unknown };
  createdAt: unknown;
  updatedAt: unknown;
};

export type StoreSettingsDoc = {
  storeName: string;
  publicContactEmail: string;
  publicWhatsapp: string;
  socialLinks?: { instagram?: string; tiktok?: string; facebook?: string; whatsapp?: string };
  paymentInstructions: { yapeName?: string; yapeNumber?: string; plinName?: string; plinNumber?: string };
  updatedAt: unknown;
};
