import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "@/app/store/store";
import { ThemeProvider } from "@/theme/ThemeProvider";

// Issue #148/M3.10 — no `auth` slice exists anymore (session state lives
// purely in RTK Query's own cache, see api/baseApi.ts); a pre-authenticated
// render is achieved via the shared default `get-session` MSW handler
// (__tests__/mocks/handlers.ts), not preloaded Redux state.
export function renderWithStore(ui: ReactElement) {
  const testStore = createStore();
  return {
    store: testStore,
    ...render(
      <ThemeProvider>
        <Provider store={testStore}>{ui}</Provider>
      </ThemeProvider>,
    ),
  };
}
