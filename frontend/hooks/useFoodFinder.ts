"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { languageNames } from "../lib/i18n";
import type {
  Language,
  RecentSearch,
  SearchResult,
  Subscription,
} from "../lib/types";
export function useFoodFinder() {
  const [language, setLanguage] = useState<Language>("en");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState("");
  const [billingError, setBillingError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  // Only the newest provider response may update the product grid.
  const requestId = useRef(0);
  // Subscription refreshes reload the exact page the visitor is viewing.
  const selection = useRef({ term: "", language: "en" as Language, page: 1 });
  const failure = (e: unknown) =>
    e instanceof ApiError ? e.code : "INTERNAL_ERROR";
  const loadRecent = useCallback(async () => {
    try {
      const data = await api<{ searches: RecentSearch[] }>("/recent-searches");
      setRecent(data.searches);
      setHistoryError("");
    } catch {
      setHistoryError("HISTORY_LOAD_FAILED");
    }
  }, []);
  const runSearch = useCallback(
    async (term: string, lang: Language, page = 1) => {
      controller.current?.abort();
      const id = ++requestId.current;
      if (term.trim().length > 120 || /[\p{Cc}\p{Cf}]/u.test(term)) {
        setLoading(false);
        setError("INVALID_SEARCH");
        return;
      }
      const abort = new AbortController();
      controller.current = abort;
      setLoading(true);
      setError("");
      setResult(null);
      setSubmitted(term.trim());
      setPage(page);
      selection.current = { term: term.trim(), language: lang, page };
      try {
        const data = await api<SearchResult>(
          term.trim()
            ? `/products?${new URLSearchParams({ q: term.trim(), lang, page: String(page) })}`
            : `/featured?${new URLSearchParams({ lang, page: String(page) })}`,
          {
            signal: AbortSignal.any([
              abort.signal,
              AbortSignal.timeout(25_000),
            ]),
          },
        );
        if (id !== requestId.current) return;
        setResult(data);
        if (term.trim() && page === 1) void loadRecent();
      } catch (e) {
        if (id === requestId.current && !abort.signal.aborted)
          setError(failure(e));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [loadRecent],
  );
  const refreshSubscription = useCallback(async (refresh = false) => {
    setChecking(true);
    setBillingError("");
    try {
      const data = await api<Subscription>(
        `/subscription${refresh ? "?refresh=1" : ""}`,
      );
      setSubscription(data);
      return data;
    } catch (e) {
      setBillingError(failure(e));
      return null;
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    let initialLanguage: Language = "en";
    try {
      const saved = localStorage.getItem("food-language");
      if (saved && Object.hasOwn(languageNames, saved)) {
        initialLanguage = saved as Language;
        setLanguage(saved as Language);
        document.documentElement.lang = saved;
      }
    } catch {
      /* Preference storage is optional in private browsing. */
    }
    void loadRecent();
    void runSearch("", initialLanguage);
    const checkout = new URLSearchParams(window.location.search).get(
      "checkout",
    );
    setCheckoutNotice(checkout ?? "");
    if (checkout) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("checkout");
      window.history.replaceState(null, "", cleanUrl);
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll(attempt: number) {
      // Webhook delivery can trail the Checkout redirect, so retry briefly.
      const data = await refreshSubscription(checkout === "success");
      if (!stopped && checkout === "success" && data?.active) {
        void runSearch(
          selection.current.term,
          selection.current.language,
          selection.current.page,
        );
      }
      if (!stopped && checkout === "success" && !data?.active && attempt < 5) {
        timer = setTimeout(() => void poll(attempt + 1), 4000);
      }
    }
    void poll(0);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      controller.current?.abort();
    };
  }, [loadRecent, refreshSubscription, runSearch]);
  function changeLanguage(lang: Language) {
    setLanguage(lang);
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("food-language", lang);
    } catch {
      /* The selector still works without browser storage. */
    }
    void runSearch(submitted, lang);
  }
  async function subscribe() {
    setCheckoutBusy(true);
    setBillingError("");
    try {
      const data = await api<{ url: string }>("/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
        throw new ApiError("BILLING_UNAVAILABLE");
      window.location.assign(url.href);
    } catch (e) {
      setBillingError(failure(e));
      setCheckoutBusy(false);
    }
  }
  async function resetSubscription() {
    setResetBusy(true);
    try {
      await api("/subscription/reset-test", { method: "POST" });
      setResult(null);
      await refreshSubscription(true);
      await runSearch(submitted, language, page);
      setBillingError("");
      setCheckoutNotice("reset");
    } catch {
      setBillingError("CANCEL_ERROR");
    } finally {
      setResetBusy(false);
    }
  }
  return {
    language,
    query,
    setQuery,
    submitted,
    page,
    result,
    recent,
    subscription,
    loading,
    checking,
    checkoutBusy,
    resetBusy,
    resetSubscription,
    error,
    billingError,
    historyError,
    checkoutNotice,
    dismissNotice: () => {
      setError("");
      setBillingError("");
      setHistoryError("");
      setCheckoutNotice("");
      setResult((current) =>
        current ? { ...current, warning: null } : current,
      );
    },
    runSearch,
    refreshSubscription,
    changeLanguage,
    subscribe,
  };
}
