import { describe, expect, it, vi } from "vitest";
import {
  createProductSearch,
  normalizeProduct,
  parseSearch,
} from "../src/products.js";
describe("product normalization", () => {
  it("uses selected language, default, then English", () => {
    expect(
      normalizeProduct(
        { product_name_fr: "Avoine", product_name: "Oats" },
        "fr",
        false,
        0,
      ).name,
    ).toBe("Avoine");
    expect(
      normalizeProduct({ product_name: "Oats" }, "nl", false, 0).name,
    ).toBe("Oats");
    expect(
      normalizeProduct({ product_name_en: "Oats" }, "de", false, 0).name,
    ).toBe("Oats");
  });
  it("never includes nutrition in basic responses", () => {
    const p = normalizeProduct(
      {
        nutriments: { fat_100g: 42 },
        nutrition: "secret",
        nutrition_grades: "a",
      },
      "en",
      false,
      0,
    );
    expect(p).not.toHaveProperty("nutrition");
    expect(JSON.stringify(p)).not.toContain("42");
    expect(Object.keys(p)).toEqual(["id", "name", "brand", "image"]);
  });
  it("handles malformed fields and preserves actual zero values", () => {
    const p = normalizeProduct(
      {
        product_name: {},
        brands: [],
        image_front_url: "javascript:alert(1)",
        nutriments: {
          fat_100g: 0,
          salt_100g: -1,
          sugars_100g: "12",
          proteins_100g: Infinity,
        },
      },
      "en",
      true,
      0,
    );
    expect(p.name).toBeNull();
    expect(p.brand).toBeNull();
    expect(p.image).toBeNull();
    expect(p.nutrition).toMatchObject({
      fat: 0,
      salt: null,
      sugars: null,
      protein: null,
    });
    expect(normalizeProduct(null, "en", true, 0).nutrition?.energy).toBeNull();
  });
  it("selects localized front images and rejects other hosts", () => {
    expect(
      normalizeProduct(
        {
          selected_images: {
            front: {
              display: { fr: "https://images.openfoodfacts.org/fr.jpg" },
            },
          },
        },
        "fr",
        false,
        0,
      ).image,
    ).toContain("/fr.jpg");
    expect(
      normalizeProduct(
        { image_front_url: "https://evil.example/img" },
        "en",
        false,
        0,
      ).image,
    ).toBeNull();
  });
});
describe("search input", () => {
  it.each(["", "   ", "a".repeat(121), "a\u0000b"])(
    "rejects invalid term %j",
    (q) =>
      expect(() => parseSearch({ q, lang: "en" })).toThrow("INVALID_SEARCH"),
  );
  it("normalizes spaces and rejects arrays or unsupported languages", () => {
    expect(parseSearch({ q: "  oat   milk ", lang: "nl" })).toEqual({
      term: "oat milk",
      language: "nl",
    });
    expect(() => parseSearch({ q: ["oats"], lang: "en" })).toThrow();
    expect(() => parseSearch({ q: "oats", lang: "es" })).toThrow(
      "INVALID_LANGUAGE",
    );
  });
});
describe("provider integration", () => {
  it("caches catalog pages separately and stops at the provider's final page", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const page = new URL(String(input)).searchParams.get("page");
      return new Response(
        JSON.stringify({ count: 21, products: [{ code: page }] }),
      );
    });
    const search = createProductSearch("test", fetcher);
    expect(await search("", "en", 1)).toEqual({
      products: [{ code: "1" }],
      hasNext: true,
    });
    expect(await search("", "en", 2)).toEqual({
      products: [{ code: "2" }],
      hasNext: false,
    });
    await search("", "fr", 1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await search("peanut", "fr", 2);
    const url = new URL(String(fetcher.mock.calls[2][0]));
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("search_terms")).toBe("peanut");
  });
  it("shares and caches a general catalog request across languages", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ products: [{ code: "1" }] })),
      );
    const search = createProductSearch("test", fetcher);
    const [en, fr] = await Promise.all([search("", "en"), search("", "fr")]);
    expect(en).toEqual(fr);
    expect(await search("", "nl")).toEqual(en);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/v2/search");
    expect(url.searchParams.has("search_terms")).toBe(false);
  });
  it("allows retry after a failed catalog request", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ products: [{ code: "1" }] })),
      );
    const search = createProductSearch("test", fetcher);
    await expect(search("", "en")).rejects.toThrow();
    expect(await search("", "en")).toEqual({
      products: [{ code: "1" }],
      hasNext: false,
    });
  });
  it("encodes text search and supplies a user agent", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ products: [{ code: "1" }, null, "bad"] }),
        ),
      );
    expect(
      await createProductSearch("FoodFinder/test (test@example.com)", fetcher)(
        "oats & milk",
        "fr",
      ),
    ).toEqual({ products: [{ code: "1" }], hasNext: false });
    const [url, options] = fetcher.mock.calls[0];
    expect(new URL(String(url)).searchParams.get("search_terms")).toBe(
      "oats & milk",
    );
    expect(options?.headers).toMatchObject({
      "User-Agent": "FoodFinder/test (test@example.com)",
    });
  });
  it.each([
    new Response("unavailable", { status: 503 }),
    new Response("{broken"),
    new Response("{}"),
  ])("handles upstream failure or malformed JSON", async (response) => {
    await expect(
      createProductSearch(
        "test",
        vi.fn<typeof fetch>().mockResolvedValue(response),
      )("oats", "en"),
    ).rejects.toMatchObject({ status: 502 });
  });
  it("maps timeouts safely", async () => {
    await expect(
      createProductSearch(
        "test",
        vi
          .fn<typeof fetch>()
          .mockRejectedValue(new DOMException("timeout", "TimeoutError")),
      )("oats", "en"),
    ).rejects.toMatchObject({ status: 504 });
  });
});
