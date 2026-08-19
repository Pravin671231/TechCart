// Placeholder brand spinner — swap for a real branded loading GIF once designed.
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white">
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600"
        role="status"
        aria-label="Loading"
      />
      <p className="font-display text-lg font-semibold text-primary-700">TechCart</p>
    </div>
  );
}
