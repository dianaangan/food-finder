import type { Language, Product, RecentSearch, SearchResult } from "./types";

interface Catalog {
  capturedAt: string;
  source: string;
  products: Record<Language, Product[]>;
}
let catalogRequest: Promise<Catalog> | undefined;
let recent: RecentSearch[] = [];
function readRecent() {
  try {
    const saved: unknown = JSON.parse(
      sessionStorage.getItem("food-finder-demo-recent") || "[]",
    );
    if (Array.isArray(saved))
      recent = saved
        .filter(
          (item): item is RecentSearch =>
            typeof item?.term === "string" &&
            item.term.length <= 120 &&
            ["en", "nl", "de", "fr"].includes(item.language),
        )
        .slice(0, 5);
  } catch {
    /* Search remains usable when browser storage is unavailable. */
  }
  return recent;
}
const fold = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

export function searchDemoCatalog(
  products: Product[],
  term: string,
  page: number,
): SearchResult {
  const words = fold(term).trim().split(/\s+/).filter(Boolean);
  const matches = products.filter((product) => {
    const text = fold(
      `${product.name ?? ""} ${product.brand ?? ""} ${product.id}`,
    );
    return words.every((word) => text.includes(word));
  });
  return {
    total: matches.length,
    products: matches.slice((page - 1) * 20, page * 20),
    page,
    hasNext: page * 20 < matches.length,
    premium: true,
    warning: null,
  };
}

// This adapter is only used by the explicitly labeled static preview build.
export async function demoApi<T>(path: string): Promise<T> {
  const url = new URL(path, "https://demo.invalid");
  if (url.pathname === "/subscription")
    return { active: false, status: "none", billingAvailable: false } as T;
  if (url.pathname === "/recent-searches")
    return { searches: readRecent() } as T;
  if (!["/products", "/featured"].includes(url.pathname))
    throw new Error("Checkout is not part of the static preview.");

  if (!catalogRequest) {
    catalogRequest = import("../data/demo-products.json")
      .then((module) => module.default as Catalog)
      .catch((error: unknown) => {
        catalogRequest = undefined;
        throw error;
      });
  }
  const catalog = await catalogRequest;
  const language = (url.searchParams.get("lang") || "en") as Language;
  const term = url.searchParams.get("q") || "";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  if (term && page === 1) {
    recent = [
      { term, language },
      ...readRecent().filter((item) => fold(item.term) !== fold(term)),
    ].slice(0, 5);
    try {
      sessionStorage.setItem("food-finder-demo-recent", JSON.stringify(recent));
    } catch {
      /* Memory-only history is sufficient for the preview. */
    }
  }
  return searchDemoCatalog(
    catalog.products[language] ?? catalog.products.en,
    term,
    page,
  ) as T;
}
