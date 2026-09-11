import { Link } from "react-router";

export interface DashboardBannerProps {
  title: string;
  subtitle: string;
  ctaLabel: string;
  to: string;
}

export const DashboardBanner = ({ title, subtitle, ctaLabel, to }: DashboardBannerProps) => {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-800 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-white/80">{subtitle}</p>
      </div>
      <Link
        to={to}
        className="inline-flex w-fit items-center rounded-md bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25"
      >
        {ctaLabel}
      </Link>
    </div>
  );
};
