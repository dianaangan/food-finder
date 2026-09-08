import { AppError } from "./errors.js";
export const languages = ["en", "nl", "de", "fr"] as const;
export type Language = (typeof languages)[number];
export function parseSearch(query: Record<string, unknown>): {
  term: string;
  language: Language;
} {
  const term =
    typeof query.q === "string"
      ? query.q.normalize("NFKC").trim().replace(/\s+/g, " ")
      : "";
  if (!term || term.length > 120 || /[\p{Cc}\p{Cf}]/u.test(term))
    throw new AppError(400, "INVALID_SEARCH");
  if (
    typeof query.lang !== "string" ||
    !languages.includes(query.lang as Language)
  )
    throw new AppError(400, "INVALID_LANGUAGE");
  return { term, language: query.lang as Language };
}
export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
const nutrients = {
  energy: "energy-kcal",
  fat: "fat",
  saturatedFat: "saturated-fat",
  carbohydrates: "carbohydrates",
  sugars: "sugars",
  fiber: "fiber",
  protein: "proteins",
  salt: "salt",
} as const;
export type Nutrition = Record<keyof typeof nutrients, number | null>;
export interface Product {
  id: string;
  name: string | null;
  brand: string | null;
  image: string | null;
  nutrition?: Nutrition;
}
function safeImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "images.openfoodfacts.org"
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function normalizeProduct(
  value: unknown,
  language: Language,
  premium: boolean,
  index: number,
): Product {
  const p = record(value);
  const images = record(record(record(p.selected_images).front).display);
  const product: Product = {
    id: text(p.code) ?? `result-${index}`,
    name:
      text(p[`product_name_${language}`]) ??
      text(p.product_name) ??
      text(p.product_name_en),
    brand: text(p.brands),
    image: safeImage(images[language]) ?? safeImage(p.image_front_url),
  };
  if (premium) {
    const raw = record(p.nutriments);
    product.nutrition = Object.fromEntries(
      Object.entries(nutrients).map(([name, field]) => {
        const v = raw[`${field}_100g`];
        return [
          name,
          typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null,
        ];
      }),
    ) as Nutrition;
  }
  return product;
}
export function createProductSearch(
  userAgent: string,
  fetcher: typeof fetch = fetch,
) {
  // Full-text search uses the documented legacy CGI endpoint; v2 tag search is not equivalent.
  return async (term: string, language: Language): Promise<unknown[]> => {
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.search = new URLSearchParams({
      search_terms: term,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: "20",
      lc: language,
      fields:
        "code,product_name,product_name_en,product_name_nl,product_name_de,product_name_fr,brands,image_front_url,selected_images,nutriments",
    }).toString();
    try {
      const response = await fetcher(url, {
        headers: { "User-Agent": userAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok)
        throw new AppError(
          response.status === 429 ? 503 : 502,
          "PRODUCTS_UNAVAILABLE",
        );
      const body = record(await response.json());
      if (!Array.isArray(body.products))
        throw new AppError(502, "PRODUCTS_UNAVAILABLE");
      return body.products
        .slice(0, 20)
        .filter(
          (p) => p !== null && typeof p === "object" && !Array.isArray(p),
        );
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      )
        throw new AppError(504, "PRODUCTS_TIMEOUT");
      throw new AppError(502, "PRODUCTS_UNAVAILABLE");
    }
  };
}
