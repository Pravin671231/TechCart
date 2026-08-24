import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { createStore } from "@/app/store/store";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableLayout } from "@/components/layout/TableLayout";

const SESSION_URL = "http://localhost:4000/api/auth/get-session";

function renderShell(initialPath = "/") {
  const testStore = createStore();
  return {
    store: testStore,
    ...render(
      <Provider store={testStore}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<div>Home content</div>} />
              <Route path="/products" element={<div>Products content</div>} />
            </Route>
            <Route path="/sign-in" element={<div>Sign-in content</div>} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    ),
  };
}

describe("AppShell / Sidebar", () => {
  it("renders nav items with correct hrefs and marks the active item", () => {
    renderShell("/");

    const dashboardLinks = screen.getAllByRole("link", { name: "Dashboard" });
    expect(dashboardLinks[0]).toHaveAttribute("href", "/");
    expect(dashboardLinks[0]).toHaveClass("bg-primary-50");

    const productsLinks = screen.getAllByRole("link", { name: "Products" });
    expect(productsLinks[0]).toHaveAttribute("href", "/products");
    expect(productsLinks[0]).not.toHaveClass("bg-primary-50");
  });

  it("opens and closes the mobile drawer", async () => {
    const user = userEvent.setup();
    renderShell("/");

    expect(screen.queryByLabelText("Navigation")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Open navigation menu"));
    expect(screen.getByLabelText("Navigation")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Close navigation menu"));
    expect(screen.queryByLabelText("Navigation")).not.toBeInTheDocument();
  });

  it("logs out and navigates to sign-in", async () => {
    const user = userEvent.setup();
    renderShell("/");

    const logoutButtons = screen.getAllByRole("button", { name: "Logout" });
    await user.click(logoutButtons[0]);

    expect(await screen.findByText("Sign-in content")).toBeInTheDocument();
  });

  it("shows a tooltip naming the item on hover and hides it on unhover", async () => {
    const user = userEvent.setup();
    renderShell("/");

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    const productsLinks = screen.getAllByRole("link", { name: "Products" });
    await user.hover(productsLinks[0]);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Products");

    await user.unhover(productsLinks[0]);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the tooltip on keyboard focus and hides it on blur", () => {
    renderShell("/");

    const productsLinks = screen.getAllByRole("link", { name: "Products" });
    fireEvent.focus(productsLinks[0]);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Products");

    fireEvent.blur(productsLinks[0]);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides the role-gated 'Admin Users' nav item for a non-super-admin session (Issue #149/M3.11)", async () => {
    renderShell("/");

    await screen.findByRole("link", { name: "Dashboard" });
    expect(screen.queryByRole("link", { name: "Admin Users" })).not.toBeInTheDocument();
  });

  it("shows the 'Admin Users' nav item once the session's role is super-admin", async () => {
    server.use(
      http.get(SESSION_URL, () =>
        HttpResponse.json({
          success: true,
          data: { user: { id: "u1", name: "Super Admin", email: "sa@example.com", role: "super-admin" } },
        }),
      ),
    );

    renderShell("/");

    const adminUsersLinks = await screen.findAllByRole("link", { name: "Admin Users" });
    expect(adminUsersLinks[0]).toHaveAttribute("href", "/admin-users");
  });
});

describe("PageHeader breadcrumbs", () => {
  it("renders no breadcrumb nav when omitted", () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
  });

  it("renders earlier crumbs as links and bolds the current crumb", () => {
    render(
      <MemoryRouter>
        <PageHeader
          title="Electronics"
          breadcrumbs={[{ label: "Products", to: "/products" }, { label: "Details" }]}
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Products" });
    expect(link).toHaveAttribute("href", "/products");

    const current = screen.getByText("Details");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveClass("font-semibold");
  });
});

describe("TableLayout", () => {
  it("renders title, search, filters, children, and pagination", () => {
    render(
      <MemoryRouter>
        <TableLayout
          title="Brands"
          primaryAction={<button type="button">+ New brand</button>}
          search={{ value: "", onChange: () => {}, label: "Search brands" }}
          filters={<span>Status: Active</span>}
          pagination={<div>Page 1 of 3</div>}
        >
          <table>
            <tbody>
              <tr>
                <td>Brand A</td>
              </tr>
            </tbody>
          </table>
        </TableLayout>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Brands" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ New brand" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search brands")).toBeInTheDocument();
    expect(screen.getByText("Status: Active")).toBeInTheDocument();
    expect(screen.getByText("Brand A")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });
});
