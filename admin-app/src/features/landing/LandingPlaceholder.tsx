import { Link } from "react-router";

export function LandingPlaceholder() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">TechCart Admin</h1>
      <p className="text-lg text-neutral-500">Admin console coming soon.</p>
      <Link to="/brands" className="mt-4 text-primary-600 hover:underline">
        Manage brands
      </Link>
    </main>
  );
}
