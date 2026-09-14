import Link from "next/link";

export interface AccountCtaBannerProps {
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
}

// feature/buyer-app-account-sidebar-shell — buyer-app's own version of
// admin-app's DashboardBanner, built off the existing .bg-gradient-accent
// class (Issue #343) rather than new gradient CSS.
export function AccountCtaBanner({ title, subtitle, ctaLabel, href }: AccountCtaBannerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-gradient-accent px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-white/80">{subtitle}</p>
      </div>
      <Link
        href={href}
        className="inline-flex w-fit items-center rounded-md bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
