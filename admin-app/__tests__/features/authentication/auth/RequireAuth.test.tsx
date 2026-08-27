import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";
import { createStore } from "@/app/store/store";
import { RequireAuth } from "@/features/authentication/auth/RequireAuth";

const SESSION_URL = "http://localhost:4000/api/auth/get-session";

function renderProtected() {
  const testStore = createStore();
  return render(
    <Provider store={testStore}>
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/sign-in" element={<div>Sign-in content</div>} />
          <Route element={<RequireAuth />}>
            <Route path="/protected" element={<div>Protected content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe("RequireAuth", () => {
  it("redirects to sign-in when there is no session (401 case)", async () => {
    server.use(http.get(SESSION_URL, () => HttpResponse.json({ success: true, data: null })));

    renderProtected();

    expect(await screen.findByText("Sign-in content")).toBeInTheDocument();
  });

  it("renders a no-access state when the session's role isn't an admin role (403 case)", async () => {
    server.use(
      http.get(SESSION_URL, () =>
        HttpResponse.json({
          success: true,
          data: { user: { id: "u1", name: "Buyer", email: "buyer@example.com", role: "buyer" } },
        }),
      ),
    );

    renderProtected();

    expect(await screen.findByRole("heading", { name: "No access" })).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders the protected content when the session has an admin role", async () => {
    server.use(
      http.get(SESSION_URL, () =>
        HttpResponse.json({
          success: true,
          data: { user: { id: "u1", name: "Admin", email: "admin@example.com", role: "catalog-manager" } },
        }),
      ),
    );

    renderProtected();

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
  });
});
