"use client";

type NoticeKind = "error" | "info" | "success" | "warning";

const styles: Record<NoticeKind, string> = {
  error: "border-rose-200 bg-rose-50 text-rose-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
};

const icons: Record<NoticeKind, string> = {
  error: "!",
  info: "i",
  success: "✓",
  warning: "!",
};

export function NotificationToast({
  dismissLabel,
  kind,
  message,
  onDismiss,
}: {
  dismissLabel: string;
  kind: NoticeKind;
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`notification-toast ${styles[kind]}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <span className="notification-icon" aria-hidden="true">
        {icons[kind]}
      </span>
      <p className="min-w-0 flex-1 text-sm font-medium leading-6">{message}</p>
      <button
        className="notification-close"
        aria-label={dismissLabel}
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
