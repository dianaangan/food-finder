"use client";
import type { Language, Subscription } from "../lib/types";
import { dictionaries } from "../lib/i18n";
export function SubscriptionPanel({
  language,
  subscription,
  busy,
  checking,
  onSubscribe,
  onRefresh,
  resetBusy,
  onReset,
}: {
  language: Language;
  subscription: Subscription | null;
  busy: boolean;
  checking: boolean;
  onSubscribe: () => void;
  onRefresh: () => void;
  resetBusy: boolean;
  onReset: () => void;
}) {
  const t = dictionaries[language];
  const issue =
    subscription &&
    !["none", "canceled", "incomplete_expired", "active"].includes(
      subscription.status,
    );
  return (
    <section className="subscription-panel" aria-label={t.demo}>
      <div className="flex min-w-0 items-start gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-stone-500">{t.demo}</p>
            <span className="test-badge">{t.testMode}</span>
          </div>
          <h2 className="mt-1 flex items-center gap-2 text-sm font-medium text-stone-800">
            <span
              className={
                subscription?.active ? "status-dot active" : "status-dot"
              }
              aria-hidden="true"
            />
            {!subscription
              ? t.checking
              : subscription.active
                ? t.active
                : t.free}
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-500">
            {issue
              ? t.subscriptionIssue
              : subscription?.active
                ? t.activeDetail
                : t.lockedDetail}
          </p>
          {subscription && !subscription.billingAvailable && (
            <p className="mt-2 text-xs text-amber-800">{t.billingOff}</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
        {!subscription?.active && (
          <button
            className="button-light"
            disabled={busy || !subscription?.billingAvailable || Boolean(issue)}
            onClick={onSubscribe}
          >
            {busy ? t.opening : t.subscribe}
            <span aria-hidden="true">→</span>
          </button>
        )}
        {subscription?.active && (
          <button
            className="button-light"
            disabled={resetBusy || !subscription.billingAvailable}
            onClick={onReset}
          >
            {resetBusy ? t.canceling : t.resetTest}
          </button>
        )}
        <button
          className="button-ghost"
          onClick={onRefresh}
          disabled={checking}
        >
          {checking ? t.checking : t.refresh}
        </button>
      </div>
    </section>
  );
}
