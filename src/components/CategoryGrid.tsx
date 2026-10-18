import Image from "next/image";
import Link from "next/link";
import styles from "./HomeStorefront.module.css";

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
    <div className={styles.categories}>
      {categories.map((category, index) => (
        <Link
          key={category.key}
          href={`/catalog?type=${encodeURIComponent(category.key)}`}
          className={styles.category}
          aria-label={`${category.cta}: ${category.label}`}
        >
          <div className={styles.categoryMedia}>
            <Image
              src={categoryImage(category, index)}
              alt=""
              fill
              sizes="(max-width: 639px) 116px, (max-width: 1023px) 33vw, 390px"
              className={styles.categoryImage}
            />
          </div>
          <div className={styles.categoryCopy}>
            <div>
              <h3>{category.label}</h3>
              <p>{category.subtitle}</p>
            </div>
            <span className={styles.categoryArrow} aria-hidden="true">↗</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
