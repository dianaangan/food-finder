"use client";
import { useState } from "react";
import { dictionaries } from "../lib/i18n";
import type { Language, Nutrient, Product } from "../lib/types";
export function ProductCard({
  product,
  language,
}: {
  product: Product;
  language: Language;
}) {
  const t = dictionaries[language];
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const name = product.name ?? t.unknownName;
  const values = product.nutrition;
  return (
    <article className="product-card">
      <div className="product-photo">
        {product.image && failedImage !== product.image ? (
          <img
            src={product.image}
            alt={name}
            loading="lazy"
            width={220}
            height={180}
            onError={() => setFailedImage(product.image)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <span className="text-3xl" aria-hidden="true">
              ◇
            </span>
            <span className="text-xs font-medium">{t.noImage}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col pt-4">
        <p className="mb-1 text-xs text-stone-500 break-words">
          {product.brand ?? t.unknownBrand}
        </p>
        <h3 className="mb-4 text-sm font-medium leading-6 text-stone-900 break-words">
          {name}
        </h3>
        {!values ? (
          <div className="locked-box mt-auto">
            <span className="lock-icon" aria-hidden="true">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="5" y="10" width="14" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            <p className="text-xs">{t.locked}</p>
          </div>
        ) : (
          <div>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-semibold">{t.nutrition}</h4>
              <span className="text-sm text-slate-500">{t.per100g}</span>
            </div>
            {Object.values(values).every((v) => v === null) ? (
              <p className="text-sm text-slate-500">{t.noNutrition}</p>
            ) : (
              <dl>
                {(Object.keys(values) as Nutrient[]).map((key) => (
                  <div
                    className="flex justify-between gap-3 border-t border-slate-100 py-2 text-sm"
                    key={key}
                  >
                    <dt>{t[key]}</dt>
                    <dd className="font-medium tabular-nums">
                      {values[key] === null
                        ? "—"
                        : `${new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(values[key])} ${key === "energy" ? "kcal" : "g"}`}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
