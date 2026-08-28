import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";
import { createStore } from "@/app/store/store";
import { RequireRole } from "@/features/authentication/auth/RequireRole";

const SESSION_URL = "http://localhost:4000/api/auth/get-session";

function renderSuperAdminOnly() {
  const testStore = createStore();
  return render(
    <Provider store={testStore}>
      <MemoryRouter initialEntries={["/admin-users"]}>
        <Routes>
          <Route path="/sign-in" element={<div>Sign-in content</div>} />
          <Route element={<RequireRole role="super-admin" />}>
            <Route path="/admin-users" element={<div>Admin users content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

// Issue #163/M5.10 — role widened to AdminRole | AdminRole[] for order
// management's order-manager-or-super-admin allow-list.
function renderOrderManagerOrSuperAdminOnly() {
  const testStore = createStore();
  return render(
    <Provider store={testStore}>
      <MemoryRouter initialEntries={["/orders"]}>
        <Routes>
          <Route path="/sign-in" element={<div>Sign-in content</div>} />
          <Route element={<RequireRole role={["order-manager", "super-admin"]} />}>
            <Route path="/orders" element={<div>Orders content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe("RequireRole", () => {
  it("redirects to sign-in when there is no session", async () => {
    server.use(http.get(SESSION_URL, () => HttpResponse.json({ success: true, data: null })));

    renderSuperAdminOnly();

    expect(await screen.findByText("Sign-in content")).toBeInTheDocument();
  });

  it("renders a no-access state when the session's role doesn't match", async () => {
    server.use(
      http.get(SESSION_URL, () =>
        HttpResponse.json({
          success: true,
          data: {
            user: {
              id: "u1",
              name: "Catalog Manager",
              email: "cm@example.com",
              role: "catalog-manager",
            },
          },
        }),
      ),
    );

    renderSuperAdminOnly();

    expect(await screen.findByRole("heading", { name: "No access" })).toBeInTheDocument();
    expect(screen.queryByText("Admin users content")).not.toBeInTheDocument();
  });

  it("renders the protected content when the session's role matches", async () => {
    server.use(
      http.get(SESSION_URL, () =>
        HttpResponse.json({
          success: true,
          data: {
            user: { id: "u1", name: "Super Admin", email: "sa@example.com", role: "super-admin" },
          },
        }),
      ),
    );

    renderSuperAdminOnly();

    expect(await screen.findByText("Admin users content")).toBeInTheDocument();
  });

  it("with an array role, rejects a session whose role isn't in the allow-list", async () => {
    server.use(
      http.get(SESSION_URL, () =>
        HttpResponse.json({
          success: true,
          data: {
            user: {
              id: "u1",
              name: "Catalog Manager",
              email: "cm@example.com",
              role: "catalog-manager",
            },
          },
        }),
      ),
    );

    renderOrderManagerOrSuperAdminOnly();

    expect(await screen.findByRole("heading", { name: "No access" })).toBeInTheDocument();
    expect(screen.queryByText("Orders content")).not.toBeInTheDocument();
  });

  it("with an array role, admits either role in the allow-list", async () => {
    server.use(
      http.get(SESSION_URL, () =>
        HttpResponse.json({
          success: true,
          data: {
            user: {
              id: "u1",
              name: "Order Manager",
              email: "om@example.com",
              role: "order-manager",
            },
          },
        }),
      ),
    );

    renderOrderManagerOrSuperAdminOnly();

    expect(await screen.findByText("Orders content")).toBeInTheDocument();
  });
});
