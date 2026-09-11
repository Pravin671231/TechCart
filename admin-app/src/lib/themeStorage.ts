const THEME_KEY = "techcart_admin_theme";

export function getStoredTheme(): "light" | "dark" | null {
  const value = localStorage.getItem(THEME_KEY);
  return value === "light" || value === "dark" ? value : null;
}

export function setStoredTheme(theme: "light" | "dark"): void {
  localStorage.setItem(THEME_KEY, theme);
}
