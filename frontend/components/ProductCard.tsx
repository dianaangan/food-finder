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
    <article className="product-card group">
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
      <div className="flex flex-1 flex-col p-5">
        <p className="mb-1 truncate text-xs font-bold uppercase tracking-wider text-emerald-700">
          {product.brand ?? t.unknownBrand}
        </p>
        <h3 className="mb-5 line-clamp-2 min-h-12 text-base font-bold leading-6 text-slate-900">
          {name}
        </h3>
        {!values ? (
          <div className="locked-box mt-auto">
            <span className="lock-icon" aria-hidden="true">
              ◇
            </span>
            <p className="text-sm font-semibold">{t.locked}</p>
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
