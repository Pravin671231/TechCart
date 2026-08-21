export function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-neutral-100 ${className}`} />;
}
