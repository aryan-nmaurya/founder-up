/** Plan §12 (Milestone 12) - every route has a loading state. */
export default function Loading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 animate-pulse rounded bg-surface" />
      <div className="h-4 w-64 animate-pulse rounded bg-surface" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-14 animate-pulse rounded bg-surface" />
        ))}
      </div>
    </div>
  );
}
