import type { ReactNode } from "react";

export function PageContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <main className={`mx-auto w-full max-w-7xl flex-1 px-4 py-6 ${className}`}>{children}</main>;
}
