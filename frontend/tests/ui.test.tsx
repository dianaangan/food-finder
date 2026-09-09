import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProductCard } from "../components/ProductCard";
import { SubscriptionPanel } from "../components/SubscriptionPanel";
import Home from "../app/page";
import { dictionaries } from "../lib/i18n";
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("localized product cards", () => {
  it("shows a translated locked state without nutritional values", () => {
    render(
      <ProductCard
        product={{ id: "1", name: null, brand: null, image: null }}
        language="fr"
      />,
    );
    expect(screen.getByText("Nom indisponible")).toBeInTheDocument();
    expect(
      screen.getByText("Débloquez les valeurs nutritionnelles"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Énergie")).not.toBeInTheDocument();
  });
  it("distinguishes zero from missing values and formats numbers locally", () => {
    render(
      <ProductCard
        product={{
          id: "1",
          name: "Oats",
          brand: null,
          image: null,
          nutrition: {
            energy: 0,
            fat: 1.5,
            saturatedFat: null,
            carbohydrates: null,
            sugars: null,
            fiber: null,
            protein: null,
            salt: null,
          },
        }}
        language="de"
      />,
    );
    expect(screen.getByText("0 kcal")).toBeInTheDocument();
    expect(screen.getByText("1,5 g")).toBeInTheDocument();
  });
  it("has matching translation keys for every language", () => {
    for (const dictionary of Object.values(dictionaries))
      expect(Object.keys(dictionary).sort()).toEqual(
        Object.keys(dictionaries.en).sort(),
      );
  });
});
describe("subscription states", () => {
  const actions = {
    onRefresh: vi.fn(),
    onReset: vi.fn(),
    onSubscribe: vi.fn(),
  };
  it("keeps test reset specific to an active subscription", () => {
    const { rerender } = render(
      <SubscriptionPanel
        language="en"
        subscription={{ active: false, status: "none", billingAvailable: true }}
        busy={false}
        checking={false}
        resetBusy={false}
        {...actions}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Subscribe monthly" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Reset test subscription" }),
    ).not.toBeInTheDocument();
    rerender(
      <SubscriptionPanel
        language="en"
        subscription={{
          active: true,
          status: "active",
          billingAvailable: true,
        }}
        busy={false}
        checking={false}
        resetBusy={false}
        {...actions}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Subscribe monthly" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset test subscription" }),
    ).toBeEnabled();
    expect(
      screen.getByText(/unlocked across the catalog/i),
    ).toBeInTheDocument();
  });
});
it("submits a search through the backend and translates the interface", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) => {
      const url = String(input);
      const body =
        url.includes("/products") || url.includes("/featured")
          ? {
              products: [
                { id: "1", name: "Oats", brand: "Example", image: null },
              ],
              premium: false,
              warning: null,
            }
          : url.includes("/recent-searches")
            ? { searches: [] }
            : { active: false, status: "none", billingAvailable: true };
      return new Response(JSON.stringify(body), { status: 200 });
    });
  render(<Home />);
  await screen.findByText("Oats");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "oats" } });
  fireEvent.click(screen.getByRole("button", { name: /Search foods/ }));
  await screen.findByText("Oats");
  expect(fetcher).toHaveBeenCalledWith(
    "/api/products?q=oats&lang=en&page=1",
    expect.any(Object),
  );
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "nl" } });
  await waitFor(() =>
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Weet wat er in je eten zit.",
    ),
  );
  expect(document.documentElement.lang).toBe("nl");
});
it("shows a safe error when the backend is unavailable", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new TypeError("Network failure"),
  );
  render(<Home />);
  await waitFor(() =>
    expect(
      screen
        .getAllByRole("alert")
        .some((node) => node.textContent?.includes("Cannot reach the server")),
    ).toBe(true),
  );
});
