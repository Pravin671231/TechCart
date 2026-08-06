export interface LoadingStateProps {
  fullPage?: boolean;
  label?: string;
  spaced?: boolean;
}

export function LoadingState({
  fullPage = false,
  label = "Loading…",
  spaced = true,
}: LoadingStateProps) {
  if (fullPage) {
    return <main className="p-6 text-sm text-neutral-500">{label}</main>;
  }
  return <p className={`${spaced ? "mt-4 " : ""}text-sm text-neutral-500`}>{label}</p>;
}

export interface ErrorStateProps {
  fullPage?: boolean;
  message?: string;
  spaced?: boolean;
}

export function ErrorState({
  fullPage = false,
  message = "Something went wrong.",
  spaced = true,
}: ErrorStateProps) {
  if (fullPage) {
    return <main className="p-6 text-sm text-red-600">{message}</main>;
  }
  return <p className={`${spaced ? "mt-4 " : ""}text-sm text-red-600`}>{message}</p>;
}
