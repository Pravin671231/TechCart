import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export const ADMIN_KEY_STORAGE_KEY = "techcart_admin_key";

export interface AuthState {
  adminKey: string | null;
}

function readStoredAdminKey(): string | null {
  return window.sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY);
}

const initialState: AuthState = {
  adminKey: readStoredAdminKey(),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAdminKey: (state, action: PayloadAction<string>) => {
      state.adminKey = action.payload;
      window.sessionStorage.setItem(ADMIN_KEY_STORAGE_KEY, action.payload);
    },
    clearAdminKey: (state) => {
      state.adminKey = null;
      window.sessionStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
    },
  },
});

export const { setAdminKey, clearAdminKey } = authSlice.actions;
export default authSlice.reducer;
