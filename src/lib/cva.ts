type VariantRecord = Record<string, Record<string, string>>;

type CvaConfig<TVariants extends VariantRecord> = {
  variants: TVariants;
  defaultVariants?: Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>;
};

type CvaSelection<TVariants extends VariantRecord> = Partial<{ [K in keyof TVariants]: keyof TVariants[K] }>;

export function cva<TVariants extends VariantRecord>(base: string, config: CvaConfig<TVariants>) {
  return (selection: CvaSelection<TVariants> = {}) => {
    const merged = { ...(config.defaultVariants ?? {}), ...(selection ?? {}) } as Record<string, string>;
    const classes = [base];

    for (const variantName of Object.keys(config.variants)) {
      const variantValue = merged[variantName];
      if (!variantValue) continue;
      const token = config.variants[variantName]?.[variantValue];
      if (token) classes.push(token);
    }

    return classes.join(" ");
  };
}

