"use client";

export function Pagination({
  disabled,
  hasNext,
  labels,
  onChange,
  page,
}: {
  disabled: boolean;
  hasNext: boolean;
  labels: { aria: string; next: string; page: string; previous: string };
  onChange: (page: number) => void;
  page: number;
}) {
  if (page === 1 && !hasNext) return null;

  return (
    <nav aria-label={labels.aria} className="pagination">
      <button
        className="pagination-button"
        disabled={disabled || page === 1}
        onClick={() => onChange(page - 1)}
      >
        <span aria-hidden="true">←</span> {labels.previous}
      </button>
      <span className="pagination-page" aria-live="polite">
        {labels.page} <strong>{page}</strong>
      </span>
      <button
        className="pagination-button"
        disabled={disabled || !hasNext}
        onClick={() => onChange(page + 1)}
      >
        {labels.next} <span aria-hidden="true">→</span>
      </button>
    </nav>
  );
}
