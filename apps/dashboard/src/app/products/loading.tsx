// Streamed skeleton shown while the dynamic /products page fetches.
// Wraps page.tsx in a Suspense boundary automatically (Next.js convention).
export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-32 rounded bg-neutral-200" />
        <div className="mt-2 h-4 w-48 rounded bg-neutral-200" />
      </div>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="h-10 border-b border-neutral-200 bg-neutral-100" />
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3 last:border-b-0"
          >
            <div className="h-4 w-20 rounded bg-neutral-200" />
            <div className="h-4 flex-1 rounded bg-neutral-200" />
            <div className="h-4 w-12 rounded bg-neutral-200" />
            <div className="h-4 w-20 rounded bg-neutral-200" />
            <div className="h-4 w-20 rounded bg-neutral-200" />
            <div className="h-4 w-16 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
