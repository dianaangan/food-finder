export function ProductSkeleton() {
  return (
    <div className="product-skeleton" aria-hidden="true">
      <div className="skeleton-photo" />
      <div className="skeleton-line short" />
      <div className="skeleton-line" />
      <div className="skeleton-line medium" />
    </div>
  );
}
