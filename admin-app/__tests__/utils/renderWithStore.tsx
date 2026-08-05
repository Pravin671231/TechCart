import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "@/store/store";
import type { AuthState } from "@/store/authSlice";

export function renderWithStore(ui: ReactElement, { adminKey = null }: { adminKey?: string | null } = {}) {
  const testStore = createStore({ auth: { adminKey } as AuthState });
  return { store: testStore, ...render(<Provider store={testStore}>{ui}</Provider>) };
}
