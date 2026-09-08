"use client";
import type { FormEvent } from "react";
import { ProductCard } from "../components/ProductCard";
import { SubscriptionPanel } from "../components/SubscriptionPanel";
import { dictionaries, errorText, languageNames } from "../lib/i18n";
import type { Language } from "../lib/types";
import { useFoodFinder } from "../hooks/useFoodFinder";
export default function Home() {
  const {
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
  } = useFoodFinder();
  const t = dictionaries[language];
  function submit(event: FormEvent) {
    event.preventDefault();
    void runSearch(query, language);
  }
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <a href="/" className="text-xl font-bold tracking-tight">
            food<span className="text-emerald-700">finder</span>
            <span className="ml-1 text-emerald-700" aria-hidden="true">
              .
            </span>
          </a>
          <label className="flex items-center gap-3 text-sm">
            <span>{t.language}</span>
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              value={language}
              onChange={(e) => changeLanguage(e.target.value as Language)}
            >
              {Object.entries(languageNames).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-7 px-5 py-8 sm:px-8 sm:py-10">
        <section>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t.title}
          </h1>
          <p className="mt-3 text-slate-600">{t.intro}</p>
          <form
            onSubmit={submit}
            className="mt-6 flex flex-col gap-3 sm:flex-row"
          >
            <label className="flex-1">
              <span className="sr-only">{t.searchLabel}</span>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-5 py-4"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.placeholder}
                maxLength={120}
              />
            </label>
            <button className="button-primary" disabled={loading} type="submit">
              {loading ? t.searching : t.search}
              <span aria-hidden="true"> →</span>
            </button>
          </form>
        </section>
        <section
          aria-label={t.recent}
          className="flex flex-wrap items-center gap-2"
        >
          <h2 className="mr-2 text-sm font-semibold text-slate-600">
            {t.recent}
          </h2>
          {recent.map((item) => (
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm hover:border-emerald-600"
              key={`${item.term}-${item.language}`}
              onClick={() => {
                setQuery(item.term);
                void runSearch(item.term, language);
              }}
            >
              {item.term}
            </button>
          ))}
          {!recent.length && (
            <p className="text-sm text-slate-500">{t.noRecent}</p>
          )}
        </section>
        {historyError && (
          <p role="status" className="notice">
            {errorText(historyError, language)}
          </p>
        )}
        <SubscriptionPanel
          language={language}
          subscription={subscription}
          busy={checkoutBusy}
          checking={checking}
          onSubscribe={() => void subscribe()}
          onRefresh={() =>
            void refreshSubscription(true).then(() => {
              if (submitted) void runSearch(submitted, language);
            })
          }
        />
        {billingError && (
          <p role="alert" className="notice">
            {errorText(billingError, language)}
          </p>
        )}
        {checkoutNotice && !subscription?.active && (
          <p role="status" className="notice">
            {checkoutNotice === "success" ? t.pending : t.canceled}
          </p>
        )}
        {error && (
          <p role="alert" className="notice">
            {errorText(error, language)}
          </p>
        )}
        {result?.warning && (
          <p role="status" className="notice">
            {errorText(result.warning, language)}
          </p>
        )}
        <section aria-label={t.results} aria-busy={loading}>
          <div
            aria-live="polite"
            className="mb-4 flex items-center justify-between"
          >
            <h2 className="text-lg font-semibold">
              {t.results}
              {result ? ` (${result.products.length})` : ""}
            </h2>
            {loading && (
              <span className="text-sm text-slate-500">{t.searching}</span>
            )}
          </div>
          {result?.products.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {result.products.map((product, index) => (
                <ProductCard
                  key={`${product.id}-${index}`}
                  product={product}
                  language={language}
                />
              ))}
            </div>
          ) : !loading && !error ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <span
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700"
                aria-hidden="true"
              >
                ⌕
              </span>
              <h3 className="text-lg font-semibold">
                {result ? t.noResults : t.first}
              </h3>
              <p className="mt-2 text-slate-500">
                {result ? t.noResultsDetail : t.firstDetail}
              </p>
            </div>
          ) : null}
        </section>
        <footer className="space-y-2 border-t border-slate-200 pt-6 text-sm text-slate-500">
          <p>{t.limit}</p>
          <a
            className="underline underline-offset-4"
            href="https://world.openfoodfacts.org"
            target="_blank"
            rel="noreferrer"
          >
            {t.source}
          </a>
        </footer>
      </main>
    </>
  );
}
