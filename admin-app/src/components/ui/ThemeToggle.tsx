import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle theme"
      onClick={toggleTheme}
      className="relative h-6 w-12 shrink-0 rounded-full border transition-colors bg-white border-neutral-200 dark:border-[#2D3032] dark:bg-[#2D3032] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
    >
      <span
        className="absolute top-0.5 left-0.5 flex h-5 w-5 translate-x-6 items-center justify-center rounded-full bg-black transition-transform duration-[250ms] ease-in-out dark:translate-x-0 dark:bg-white"
      >
        {isDark ? (
          <Sun className="h-3 w-3 text-[#111111]" aria-hidden="true" />
        ) : (
          <Moon className="h-3 w-3 text-white" aria-hidden="true" />
        )}
      </span>
    </button>
  );
};
