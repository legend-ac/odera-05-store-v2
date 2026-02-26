import { z } from "zod";

export const productImageSchema = z.object({
  url: z.string().min(1).max(500),
  alt: z.string().max(200).optional(),
  isMain: z.boolean(),
  order: z.number().int().min(0).max(999),
});

export const productVariantSchema = z.object({
  id: z.string().min(1).max(80),
  size: z.string().max(40).optional(),
  color: z.string().max(40).optional(),
  sku: z.string().max(80).optional(),
  stock: z.number().int().min(0).max(100000),
});

export const productUpsertSchema = z.object({
  productType: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "productType must be kebab-case"),
  audience: z.enum(["hombre", "mujer", "ninos", "todos"]),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
  status: z.enum(["active", "archived"]),
  name: z.string().min(2).max(150),
  description: z.string().min(0).max(4000),
  brand: z.string().min(0).max(80),
  category: z.string().min(0).max(80),
  price: z.number().min(0).max(1000000),
  salePrice: z.number().min(0).max(1000000).optional(),
  onSale: z.boolean(),
  images: z.array(productImageSchema).max(10),
  variants: z.array(productVariantSchema).min(1).max(50),
}).superRefine((data, ctx) => {
  const pt = data.productType.toLowerCase();
  const requiresAudience = pt.includes("zapat") || pt.includes("ropa");
  if (!requiresAudience) return;
  if (!data.audience) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["audience"],
      message: "audience is required for ropa/zapatillas",
    });
  }
});

export type ProductUpsertInput = z.infer<typeof productUpsertSchema>;
