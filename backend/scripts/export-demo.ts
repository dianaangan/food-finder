import { mkdir, writeFile } from "node:fs/promises";
import {
  createProductSearch,
  languages,
  normalizeProduct,
} from "../src/products.js";

const search = createProductSearch(
  "FoodFinderDemo/1.0 (https://github.com/dianaangan/food-finder)",
);
const records = new Map<string, unknown>();
for (const [term, page] of [
  ["", 1],
  ["peanut", 1],
  ["oats", 1],
  ["chocolate", 1],
  ["", 2],
  ["", 3],
] as const) {
  try {
    const result = await search(term, "en", page);
    result.products.forEach((raw, index) => {
      const product = normalizeProduct(raw, "en", true, index);
      if (product.name && !product.id.startsWith("result-"))
        records.set(product.id, raw);
    });
    console.log(
      `Saved ${term || "catalog"} page ${page}; ${records.size} unique products`,
    );
  } catch {
    console.warn(`Skipped unavailable ${term || "catalog"} page ${page}.`);
  }
}
if (records.size < 40)
  throw new Error("Not enough real products to publish the preview.");
const catalog = {
  capturedAt: new Date().toISOString(),
  source: "https://world.openfoodfacts.org",
  license: "https://opendatacommons.org/licenses/odbl/1-0/",
  products: Object.fromEntries(
    languages.map((language) => [
      language,
      [...records.values()].map((raw, index) =>
        normalizeProduct(raw, language, true, index),
      ),
    ]),
  ),
};
const directory = new URL("../../frontend/data/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("demo-products.json", directory),
  JSON.stringify(catalog),
);
console.log(
  `Exported ${records.size} products in ${languages.length} languages.`,
);
