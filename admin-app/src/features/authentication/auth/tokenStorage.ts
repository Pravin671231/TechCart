// Mirrors buyer-app's src/features/authentication/auth/tokenStorage.ts — same bearer-token
// mechanism (Issue #139's set-auth-token response header), separate storage
// key since these are two different apps/origins with no shared storage
// anyway, just for clarity if ever inspected side by side.
const TOKEN_KEY = "techcart_admin_auth_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
