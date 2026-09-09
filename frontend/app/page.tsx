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
    resultsSection.current?.scrollIntoView?.({ behavior: "auto" });
  }
  return (
    <>
      <header className="site-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <a href="/" className="brand" aria-label="Food Finder home">
            <span>foodfinder</span>
          </a>
          <label className="language-picker">
            <span className="sr-only sm:not-sr-only sm:text-sm sm:text-slate-600">
              {t.language}
            </span>
            <select
              className="language-select"
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
      <main className="mx-auto max-w-6xl space-y-8 px-5 pb-8 sm:px-8">
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
            <h1 className="text-3xl font-medium tracking-[-0.045em] text-slate-950 sm:text-4xl">
              {t.title}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
              {t.intro}
            </p>
          </div>
          <form
            onSubmit={submit}
            className="mt-7 flex flex-col gap-3 sm:flex-row"
          >
            <div className="search-field">
              <span className="search-icon" aria-hidden="true">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m16 16 4 4" />
                </svg>
              </span>
              <label htmlFor="food-search" className="sr-only">
                {t.searchLabel}
              </label>
              <input
                id="food-search"
                className="search-input"
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
            </div>
            <button
              className="button-primary min-w-44"
              disabled={sameRequest}
              type="submit"
            >
              {sameRequest && <span className="spinner" aria-hidden="true" />}
              {sameRequest ? t.searching : t.search}
            </button>
          </form>
          <div
            className="mt-5 flex flex-wrap items-center gap-2"
            aria-label={t.recent}
          >
            <h2 className="mr-1 text-xs text-slate-500">{t.recent}</h2>
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
                  {item.term}
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
              <h2 className="text-lg font-medium tracking-tight text-slate-950 break-words">
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
            <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                  className="h-80 animate-pulse rounded-lg bg-stone-100 motion-reduce:animate-none"
                >
                  <div className="m-5 h-40 rounded-xl bg-slate-100" />
                  <div className="mx-5 h-4 w-2/3 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-stone-50 px-6 py-14 text-center">
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
