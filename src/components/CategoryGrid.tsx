import Image from "next/image";
import Link from "next/link";

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
    <div className="category-grid">
      {categories.map((category, index) => (
        <Link
          key={category.key}
          href={`/catalog?type=${encodeURIComponent(category.key)}`}
          className="category-card group"
          aria-label={`${category.cta}: ${category.label}`}
        >
          <div className="category-card__media">
            <Image
              src={categoryImage(category, index)}
              alt=""
              fill
              sizes="(max-width: 639px) 36vw, (max-width: 1023px) 33vw, 30vw"
              className="category-card__image"
            />
          </div>
          <div className="category-card__shade" />
          <span className="category-card__number">{String(index + 1).padStart(2, "0")}</span>
          <div className="category-card__content">
            <div>
              <span className="category-card__eyebrow">EXPLORAR COLECCIÓN</span>
              <h3 className="category-card__title">{category.label}</h3>
              <p className="category-card__subtitle">{category.subtitle}</p>
            </div>
            <span className="category-card__arrow" aria-hidden="true">↗</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
