"use client";
import { useRef, type FormEvent } from "react";
import { NotificationToast } from "../components/NotificationToast";
import { Pagination } from "../components/Pagination";
import { ProductCard } from "../components/ProductCard";
import { SubscriptionPanel } from "../components/SubscriptionPanel";
import { dictionaries, errorText, languageNames } from "../lib/i18n";
import type { Language } from "../lib/types";
import { useFoodFinder } from "../hooks/useFoodFinder";
export default function Home() {
  const resultsSection = useRef<HTMLElement>(null);
  const {
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
    dismissNotice,
    runSearch,
    refreshSubscription,
    changeLanguage,
    subscribe,
  } = useFoodFinder();
  const t = dictionaries[language];
  const notice = error || billingError || historyError || result?.warning;
  const message = notice
    ? errorText(notice, language)
    : checkoutNotice === "reset"
      ? t.resetDone
      : checkoutNotice === "success"
        ? subscription?.active
          ? t.subscriptionReady
          : t.pending
        : checkoutNotice === "cancel"
          ? t.canceled
          : "";
  const noticeKind = notice
    ? notice === "HISTORY_NOT_SAVED" || notice === "HISTORY_LOAD_FAILED"
      ? "warning"
      : "error"
    : checkoutNotice === "reset" ||
        (checkoutNotice === "success" && subscription?.active)
      ? "success"
      : "info";
  const sameRequest = loading && query.trim() === submitted;
  function submit(event: FormEvent) {
    event.preventDefault();
    void runSearch(query, language);
  }
  function changePage(nextPage: number) {
    void runSearch(submitted, language, nextPage);
    resultsSection.current?.scrollIntoView?.({ behavior: "smooth" });
  }
  return (
    <>
      <header className="site-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href="/" className="brand" aria-label="Food Finder home">
            <span className="brand-mark" aria-hidden="true">
              f
            </span>
            <span>foodfinder</span>
          </a>
          <label className="language-picker">
            <span className="hidden text-sm font-medium text-slate-600 sm:inline">
              {t.language}
            </span>
            <select
              className="rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm font-medium shadow-sm"
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
      <main className="mx-auto max-w-7xl space-y-8 px-5 py-7 sm:px-8 sm:py-10">
        <SubscriptionPanel
          language={language}
          subscription={subscription}
          busy={checkoutBusy}
          checking={checking}
          onSubscribe={() => void subscribe()}
          resetBusy={resetBusy}
          onReset={() => void resetSubscription()}
          onRefresh={async () => {
            if (await refreshSubscription(true))
              await runSearch(submitted, language, page);
          }}
        />
        <section className="search-panel">
          <div className="max-w-3xl">
            <p className="eyebrow">{t.explore}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-5xl">
              {t.title}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              {t.intro}
            </p>
          </div>
          <form
            onSubmit={submit}
            className="mt-7 flex flex-col gap-3 sm:flex-row"
          >
            <label className="search-field">
              <span className="search-icon" aria-hidden="true">
                ⌕
              </span>
              <span className="sr-only">{t.searchLabel}</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-12 text-slate-950 shadow-sm transition focus:border-emerald-600"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.placeholder}
                maxLength={120}
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  className="search-clear"
                  aria-label={t.clearSearch}
                  onClick={() => {
                    setQuery("");
                    void runSearch("", language);
                  }}
                >
                  ×
                </button>
              )}
            </label>
            <button
              className="button-primary min-w-44"
              disabled={sameRequest}
              type="submit"
            >
              {sameRequest && <span className="spinner" aria-hidden="true" />}
              {sameRequest ? t.searching : t.search}
              <span aria-hidden="true"> →</span>
            </button>
          </form>
          <div
            className="mt-5 flex flex-wrap items-center gap-2"
            aria-label={t.recent}
          >
            <h2 className="mr-1 text-xs font-bold uppercase tracking-wider text-slate-500">
              {t.recent}
            </h2>
            {recent
              .filter(
                (item, index, items) =>
                  items.findIndex(
                    (other) =>
                      other.term.toLowerCase() === item.term.toLowerCase(),
                  ) === index,
              )
              .map((item) => (
                <button
                  className="recent-chip"
                  key={`${item.term}-${item.language}`}
                  onClick={() => {
                    setQuery(item.term);
                    void runSearch(item.term, language);
                  }}
                >
                  <span aria-hidden="true">↗</span> {item.term}
                </button>
              ))}
            {!recent.length && (
              <p className="text-sm text-slate-500">{t.noRecent}</p>
            )}
          </div>
        </section>
        <section
          ref={resultsSection}
          className="scroll-mt-24"
          aria-label={t.results}
          aria-busy={loading}
        >
          <div
            aria-live="polite"
            className="mb-5 flex min-h-10 flex-wrap items-end justify-between gap-3"
          >
            <div>
              <p className="eyebrow">
                {submitted ? t.searchResults : t.popular}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                {submitted ? `${t.resultsFor} “${submitted}”` : t.results}
              </h2>
            </div>
            {loading && (
              <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
                <span className="spinner spinner-dark" aria-hidden="true" />
                {t.searching}
              </span>
            )}
          </div>
          {result?.products.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {result.products.map((product, index) => (
                <ProductCard
                  key={`${product.id}-${index}`}
                  product={product}
                  language={language}
                />
              ))}
            </div>
          ) : loading ? (
            <div
              className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              aria-hidden="true"
            >
              {Array.from({ length: 8 }, (_, index) => (
                <div
                  key={index}
                  className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white motion-reduce:animate-none"
                >
                  <div className="m-5 h-40 rounded-xl bg-slate-100" />
                  <div className="mx-5 h-4 w-2/3 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <span
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700"
                aria-hidden="true"
              >
                ⌕
              </span>
              <h3 className="text-lg font-semibold">
                {result ? t.noResults : t.catalogUnavailable}
              </h3>
              <p className="mt-2 text-slate-500">
                {result ? t.noResultsDetail : t.provider}
              </p>
              {!result && (
                <button
                  className="button-primary mt-5"
                  onClick={() => void runSearch(submitted, language, page)}
                >
                  {t.retry}
                </button>
              )}
            </div>
          )}
          <Pagination
            disabled={loading}
            hasNext={Boolean(result?.hasNext)}
            labels={{
              aria: t.pagination,
              next: t.next,
              page: t.page,
              previous: t.previous,
            }}
            onChange={changePage}
            page={page}
          />
        </section>
        <footer className="flex flex-col justify-between gap-3 border-t border-slate-200 py-6 text-sm text-slate-500 sm:flex-row">
          <p>
            © {new Date().getFullYear()} Food Finder · {t.limit}
          </p>
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
      {message && (
        <NotificationToast
          dismissLabel={t.dismiss}
          kind={noticeKind}
          message={message}
          onDismiss={dismissNotice}
        />
      )}
    </>
  );
}
