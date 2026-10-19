import Image from "next/image";
import Link from "next/link";
import styles from "./CategoryGrid.module.css";

type Category = {
  key: string;
  label: string;
  subtitle: string;
  cta: string;
  imageUrl?: string;
};

function categoryImage(category: Category, index: number): string {
  if (category.imageUrl) return category.imageUrl;
  if (category.key.includes("zapat")) return "/brand/category-zapatillas.jpg";
  if (category.key.includes("ropa")) return "/brand/category-ropa.jpg";
  if (category.key.includes("acces")) return "/brand/category-accesorios.jpg";
  return ["/brand/category-zapatillas.jpg", "/brand/category-ropa.jpg", "/brand/category-accesorios.jpg"][index % 3]!;
}

export default function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <div className={styles.grid}>
      {categories.map((category, index) => (
        <Link
          key={category.key}
          href={`/catalog?type=${encodeURIComponent(category.key)}`}
          className={styles.card}
          aria-label={`${category.cta}: ${category.label}`}
        >
          <div className={styles.media}>
            <Image
              src={categoryImage(category, index)}
              alt=""
              fill
              sizes="(max-width: 639px) 112px, (max-width: 1023px) 32vw, 380px"
              className={styles.image}
            />
          </div>
          <div className={styles.content}>
            <div className={styles.copy}>
              <h3 className={styles.title}>{category.label}</h3>
              <p className={styles.subtitle}>{category.subtitle}</p>
            </div>
            <svg className={styles.arrow} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12h15m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" />
            </svg>
          </div>
        </Link>
      ))}
    </div>
  );
}
