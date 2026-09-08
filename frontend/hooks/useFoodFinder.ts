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
  const [result, setResult] = useState<SearchResult | null>(null);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [error, setError] = useState("");
  const [billingError, setBillingError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef(0);
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
    async (term: string, lang: Language) => {
      controller.current?.abort();
      const id = ++requestId.current;
      if (!term.trim() || term.trim().length > 120) {
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
      try {
        const data = await api<SearchResult>(
          `/products?${new URLSearchParams({ q: term.trim(), lang })}`,
          {
            signal: AbortSignal.any([
              abort.signal,
              AbortSignal.timeout(25_000),
            ]),
          },
        );
        if (id !== requestId.current) return;
        setResult(data);
        void loadRecent();
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
    try {
      const saved = localStorage.getItem("food-language");
      if (saved && saved in languageNames) {
        setLanguage(saved as Language);
        document.documentElement.lang = saved;
      }
    } catch {
      /* Preference storage is optional in private browsing. */
    }
    void loadRecent();
    const checkout = new URLSearchParams(window.location.search).get(
      "checkout",
    );
    setCheckoutNotice(checkout ?? "");
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll(attempt: number) {
      const data = await refreshSubscription(checkout === "success");
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
  }, [loadRecent, refreshSubscription]);
  function changeLanguage(lang: Language) {
    setLanguage(lang);
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("food-language", lang);
    } catch {
      /* The selector still works without browser storage. */
    }
    if (submitted) void runSearch(submitted, lang);
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
  return {
    language,
    query,
    setQuery,
    submitted,
    result,
    recent,
    subscription,
    loading,
    checking,
    checkoutBusy,
    error,
    billingError,
    historyError,
    checkoutNotice,
    runSearch,
    refreshSubscription,
    changeLanguage,
    subscribe,
  };
}
