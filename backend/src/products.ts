import { setTimeout as delay } from "node:timers/promises";
import { AppError } from "./errors.js";
export const languages = ["en", "nl", "de", "fr"] as const;
export type Language = (typeof languages)[number];
export interface ProductPage {
  products: unknown[];
  hasNext: boolean;
  warning?: "PRODUCTS_STALE";
}
export function parsePage(value: unknown): number {
  if (value === undefined) return 1;
  // Bound the page before multiplying it by the provider page size.
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > Math.floor(Number.MAX_SAFE_INTEGER / 20)
  )
    throw new AppError(400, "INVALID_PAGE");
  return Number(value);
}
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
  const cache = new Map<string, { data: ProductPage; savedAt: number }>();
  const pending = new Map<string, Promise<ProductPage>>();
  let windowStart = Date.now();
  let searchRequests = 0;
  // Cache raw catalog data only; subscription access is checked for every response.
  const fetchProducts = async (
    term: string,
    language: Language,
    page: number,
    attempt = 0,
  ): Promise<ProductPage> => {
    // Retries also count against the provider's search allowance.
    if (term) {
      if (Date.now() - windowStart >= 60_000) {
        windowStart = Date.now();
        searchRequests = 0;
      }
      if (++searchRequests > 10) throw new AppError(429, "TOO_MANY_SEARCHES");
    }
    const url = new URL(
      term
        ? "https://world.openfoodfacts.org/cgi/search.pl"
        : "https://world.openfoodfacts.org/api/v2/search",
    );
    url.search = new URLSearchParams({
      search_terms: term,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: "20",
      page: String(page),
      lc: language,
      fields:
        "code,product_name,product_name_en,product_name_nl,product_name_de,product_name_fr,brands,image_front_url,selected_images,nutriments",
    }).toString();
    if (!term) {
      for (const key of [
        "search_terms",
        "search_simple",
        "action",
        "json",
        "lc",
      ])
        url.searchParams.delete(key);
      url.searchParams.set("sort_by", "unique_scans_n");
    }
    let retryable = true;
    try {
      const response = await fetcher(url, {
        headers: { "User-Agent": userAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        // Do not retry rate limits or rejected requests and worsen provider load.
        retryable = response.status >= 500;
        throw new AppError(
          response.status === 429 ? 503 : 502,
          "PRODUCTS_UNAVAILABLE",
        );
      }
      const body = record(await response.json());
      if (!Array.isArray(body.products))
        throw new AppError(502, "PRODUCTS_UNAVAILABLE");
      const products = body.products
        .slice(0, 20)
        .filter(
          (p) => p !== null && typeof p === "object" && !Array.isArray(p),
        );
      const count = Number(body.count);
      return {
        products,
        hasNext:
          body.count != null && Number.isFinite(count) && count >= 0
            ? page * 20 < count
            : body.products.length >= 20,
      };
    } catch (error) {
      if (retryable && attempt === 0) {
        await delay(300);
        return fetchProducts(term, language, page, 1);
      }
      if (error instanceof AppError) throw error;
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      )
        throw new AppError(504, "PRODUCTS_TIMEOUT");
      throw new AppError(502, "PRODUCTS_UNAVAILABLE");
    }
  };
  return async (
    term: string,
    language: Language,
    page = 1,
  ): Promise<ProductPage> => {
    const key = JSON.stringify([
      term.toLowerCase(),
      term ? language : "",
      page,
    ]);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.savedAt < 300_000) return cached.data;
    const existing = pending.get(key);
    if (existing) return existing;
    const request = fetchProducts(term, language, page)
      .then((data) => {
        // Keep memory bounded as visitors browse deeper into the catalog.
        cache.delete(key);
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(key, { data, savedAt: Date.now() });
        return data;
      })
      .catch((error: unknown) => {
        // Only reuse the same query/page, and tell the visitor it is a saved result.
        if (cached && Date.now() - cached.savedAt < 3_600_000)
          return { ...cached.data, warning: "PRODUCTS_STALE" as const };
        throw error;
      })
      .finally(() => {
        pending.delete(key);
      });
    pending.set(key, request);
    return request;
  };
}
