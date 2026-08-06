import { Link } from "react-router";

export function LandingPlaceholder() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">TechCart Admin</h1>
      <p className="text-lg text-neutral-500">Admin console coming soon.</p>
      <div className="mt-4 flex flex-col gap-2">
        <Link to="/brands" className="text-primary-600 hover:underline">
          Manage brands
        </Link>
        <Link to="/categories" className="text-primary-600 hover:underline">
          Manage categories
        </Link>
        <Link to="/specifications" className="text-primary-600 hover:underline">
          Category specifications
        </Link>
      </div>
    </main>
  );
}
