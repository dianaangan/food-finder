import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import Home from "../app/page";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it("paginates the catalog and search, resetting new searches to page one", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) => {
      const url = new URL(String(input), "http://localhost");
      const page = Number(url.searchParams.get("page") || 1);
      const term = url.searchParams.get("q") || "Catalog";
      const body = /\/(featured|products)$/.test(url.pathname)
        ? {
            products: [
              {
                id: `${term}-${page}`,
                name: `${term} item ${page}`,
                brand: null,
                image: null,
              },
            ],
            page,
            hasNext: page < 2,
            premium: false,
            warning: null,
          }
        : url.pathname.includes("recent-searches")
          ? { searches: [] }
          : { active: false, status: "none", billingAvailable: true };
      return new Response(JSON.stringify(body));
    });
  render(<Home />);
  await screen.findByText("Catalog item 1");
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Catalog item 2");
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "peanut" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Search foods/ }));
  await screen.findByText("peanut item 1");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("peanut item 2");
  expect(fetcher).toHaveBeenCalledWith(
    "/api/products?q=peanut&lang=en&page=2",
    expect.any(Object),
  );
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  await screen.findByText("peanut item 1");
  expect(
    screen.queryByRole("button", { name: "Browse products" }),
  ).not.toBeInTheDocument();
});

it("does not let a slow catalog overwrite a newer search", async () => {
  let resolveCatalog!: (response: Response) => void;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/featured"))
      return new Promise<Response>((resolve) => {
        resolveCatalog = resolve;
      });
    const body = url.includes("/products")
      ? {
          products: [
            { id: "2", name: "Searched oats", brand: null, image: null },
          ],
          premium: false,
          warning: null,
        }
      : url.includes("/recent-searches")
        ? { searches: [] }
        : { active: false, status: "none", billingAvailable: true };
    return new Response(JSON.stringify(body));
  });
  render(<Home />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "oats" } });
  fireEvent.click(screen.getByRole("button", { name: /Search foods/ }));
  await screen.findByText("Searched oats");
  await act(async () =>
    resolveCatalog(
      new Response(
        JSON.stringify({
          products: [
            { id: "1", name: "Old catalog", brand: null, image: null },
          ],
          premium: false,
          warning: null,
        }),
      ),
    ),
  );
  expect(screen.getByText("Searched oats")).toBeInTheDocument();
  expect(screen.queryByText("Old catalog")).not.toBeInTheDocument();
});

it("shows products on arrival, searches, and returns to the catalog", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) => {
      const url = String(input);
      const body =
        url.includes("/featured") || url.includes("/products")
          ? {
              products: [
                {
                  id: "1",
                  name: url.includes("/featured")
                    ? "Catalog milk"
                    : "Searched oats",
                  brand: null,
                  image: null,
                },
              ],
              premium: false,
              warning: null,
            }
          : url.includes("/recent-searches")
            ? { searches: [] }
            : { active: false, status: "none", billingAvailable: true };
      return new Response(JSON.stringify(body));
    });
  render(<Home />);
  await screen.findByText("Catalog milk");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "oats" } });
  fireEvent.click(screen.getByRole("button", { name: /Search foods/ }));
  await screen.findByText("Searched oats");
  expect(screen.queryByText("Catalog milk")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Browse products" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  await screen.findByText("Catalog milk");
  expect(screen.getByRole("textbox")).toHaveValue("");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "fr" } });
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      "/api/featured?lang=fr&page=1",
      expect.any(Object),
    ),
  );
});

it("dismisses a popup and retries a failed initial catalog", async () => {
  let failed = true;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input).includes("/featured")) {
      if (failed)
        return new Response(
          JSON.stringify({ error: { code: "PRODUCTS_UNAVAILABLE" } }),
          { status: 502 },
        );
      return new Response(
        JSON.stringify({
          products: [{ id: "1", name: "Milk", brand: null, image: null }],
          premium: false,
          warning: null,
        }),
      );
    }
    return new Response(
      JSON.stringify(
        String(input).includes("/recent-searches")
          ? { searches: [] }
          : { active: false, status: "none", billingAvailable: false },
      ),
    );
  });
  render(<Home />);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  failed = false;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("Milk");
});
