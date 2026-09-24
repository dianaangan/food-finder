import { describe, expect, it, vi } from "vitest";
import { demoApi, searchDemoCatalog } from "../lib/demo";
import type { Product, SearchResult } from "../lib/types";

const products: Product[] = Array.from({ length: 25 }, (_, index) => ({
  id: String(index),
  name: `Chocolat au lait ${index}`,
  brand: "Équitable",
  image: null,
}));
describe("static preview search", () => {
  it("browses and searches the saved catalog without a live API or billing", async () => {
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("offline"));
    try {
      const catalog = await demoApi<SearchResult>("/featured?lang=en&page=1");
      expect(catalog.products).toHaveLength(20);
      expect(catalog.hasNext).toBe(true);
      const matches = await demoApi<SearchResult>(
        "/products?q=Lindt&lang=fr&page=1",
      );
      expect(matches.products.length).toBeGreaterThan(0);
      expect(
        matches.products.every((product) =>
          `${product.name} ${product.brand}`.toLowerCase().includes("lindt"),
        ),
      ).toBe(true);
      await expect(demoApi("/checkout")).rejects.toThrow("static preview");
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
    }
  });
  it("searches real names and brands without accents or case sensitivity", () => {
    expect(
      searchDemoCatalog(products, "CHOCOLAT equitable", 1).products,
    ).toHaveLength(20);
    expect(searchDemoCatalog(products, "peanut", 1).products).toEqual([]);
  });
  it("paginates matching results and stops on the final page", () => {
    expect(searchDemoCatalog(products, "lait", 1).hasNext).toBe(true);
    const second = searchDemoCatalog(products, "lait", 2);
    expect(second.products).toHaveLength(5);
    expect(second.products[0].id).toBe("20");
    expect(second.hasNext).toBe(false);
  });
});
