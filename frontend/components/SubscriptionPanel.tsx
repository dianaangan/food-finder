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
      <div>
        <p className="mb-2 text-sm text-slate-500">{t.demo}</p>
        <h2 className="text-lg font-semibold">
          {subscription?.active ? t.active : t.free}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          {issue ? t.subscriptionIssue : t.lockedDetail}
        </p>
        {subscription && !subscription.billingAvailable && (
          <p className="mt-2 text-sm text-slate-600">{t.billingOff}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        {!subscription?.active && (
          <button
            className="button-primary"
            disabled={busy || !subscription?.billingAvailable || Boolean(issue)}
            onClick={onSubscribe}
          >
            {busy ? t.opening : t.subscribe}
            <span aria-hidden="true"> ↗</span>
          </button>
        )}
        <button
          className="text-xs text-slate-500 underline underline-offset-4"
          disabled={resetBusy}
          onClick={onReset}
        >
          {resetBusy ? t.canceling : t.resetTest}
        </button>
        <button
          className="text-sm font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-4 disabled:opacity-50"
          onClick={onRefresh}
          disabled={checking}
        >
          {checking ? t.checking : t.refresh}
        </button>
        <span className="text-sm text-slate-500">{t.testMode}</span>
      </div>
    </section>
  );
}
