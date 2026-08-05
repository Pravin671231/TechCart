const DEFAULT_API_URL = "http://localhost:4000";

export const API_URL: string = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL;

export const ADMIN_API_BASE_URL = `${API_URL}/api/admin`;
