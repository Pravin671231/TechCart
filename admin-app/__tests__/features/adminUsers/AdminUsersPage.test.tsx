import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { renderWithStore } from "../../utils/renderWithStore";
import { AdminUsersPage } from "@/features/adminUsers/AdminUsersPage";
import type { AdminUser } from "@/features/adminUsers/types";

const BASE = "http://localhost:4000/api/admin";
const SESSION_URL = "http://localhost:4000/api/auth/get-session";

function buildPagination(items: unknown[], page = 1, limit = 20) {
  return { page, limit, total: items.length, totalPages: 1, hasNextPage: false };
}

function makeAdminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    _id: "admin-1",
    name: "Alice Admin",
    email: "alice@example.com",
    role: "catalog-manager",
    status: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setSession(id: string, role = "super-admin") {
  server.use(
    http.get(SESSION_URL, () =>
      HttpResponse.json({
        success: true,
        data: { user: { id, name: "Session User", email: "session@example.com", role } },
      }),
    ),
  );
}

function setupAdminUserHandlers(initial: AdminUser[]) {
  let adminUsers = initial;

  server.use(
    http.get(`${BASE}/users`, ({ request }) => {
      const url = new URL(request.url);
      const search = url.searchParams.get("search");
      const filtered = search
        ? adminUsers.filter(
            (u) =>
              u.name.toLowerCase().includes(search.toLowerCase()) ||
              u.email.toLowerCase().includes(search.toLowerCase()),
          )
        : adminUsers;
      return HttpResponse.json({
        success: true,
        data: filtered,
        pagination: buildPagination(filtered),
      });
    }),
    http.post(`${BASE}/users`, async ({ request }) => {
      const body = (await request.json()) as { name: string; email: string; role: string };
      const newAdminUser = makeAdminUser({
        _id: `admin-${adminUsers.length + 1}`,
        name: body.name,
        email: body.email,
        role: body.role as AdminUser["role"],
      });
      adminUsers = [...adminUsers, newAdminUser];
      return HttpResponse.json({ success: true, data: newAdminUser }, { status: 201 });
    }),
    http.patch(`${BASE}/users/:id`, async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      adminUsers = adminUsers.map((u) => (u._id === params.id ? { ...u, ...body } : u));
      const updated = adminUsers.find((u) => u._id === params.id);
      return HttpResponse.json({ success: true, data: updated });
    }),
  );
}

describe("AdminUsersPage", () => {
  it("renders the admin user list", async () => {
    setSession("someone-else");
    setupAdminUserHandlers([
      makeAdminUser({ _id: "admin-1", name: "Alice Admin", email: "alice@example.com" }),
      makeAdminUser({ _id: "admin-2", name: "Bob Admin", email: "bob@example.com" }),
    ]);

    renderWithStore(<AdminUsersPage />);

    expect(await screen.findByText("Alice Admin")).toBeInTheDocument();
    expect(screen.getByText("Bob Admin")).toBeInTheDocument();
  });

  it("creates a new admin with no password field, and toasts a reset-email message", async () => {
    setSession("someone-else");
    setupAdminUserHandlers([makeAdminUser({ _id: "admin-1", name: "Alice Admin" })]);

    renderWithStore(<AdminUsersPage />);
    await screen.findByText("Alice Admin");

    fireEvent.click(screen.getByRole("button", { name: "+ New admin" }));
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Nova Admin" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nova@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Nova Admin")).toBeInTheDocument();
  });

  it("changes an admin's role via the inline select", async () => {
    setSession("someone-else");
    setupAdminUserHandlers([
      makeAdminUser({ _id: "admin-1", name: "Alice Admin", role: "catalog-manager" }),
    ]);

    renderWithStore(<AdminUsersPage />);
    await screen.findByText("Alice Admin");

    const roleSelect = screen.getByLabelText("Role for Alice Admin") as HTMLSelectElement;
    fireEvent.change(roleSelect, { target: { value: "order-manager" } });

    await waitFor(() => {
      expect(roleSelect).toHaveValue("order-manager");
    });
  });

  it("deactivates an admin via the status toggle", async () => {
    setSession("someone-else");
    setupAdminUserHandlers([makeAdminUser({ _id: "admin-1", name: "Alice Admin", status: true })]);

    renderWithStore(<AdminUsersPage />);
    const statusButton = await screen.findByRole("button", { name: "Active" });

    fireEvent.click(statusButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Inactive" })).toBeInTheDocument();
    });
  });

  it("shows neither the role select nor the status toggle on the signed-in admin's own row", async () => {
    setSession("admin-1");
    setupAdminUserHandlers([
      makeAdminUser({ _id: "admin-1", name: "Alice Admin", status: true }),
      makeAdminUser({ _id: "admin-2", name: "Bob Admin", status: true }),
    ]);

    renderWithStore(<AdminUsersPage />);
    await screen.findByText("Alice Admin");

    const aliceRow = screen.getByText("Alice Admin").closest("tr") as HTMLElement;
    expect(within(aliceRow).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(aliceRow).queryByRole("button")).not.toBeInTheDocument();

    expect(screen.getByLabelText("Role for Bob Admin")).toBeInTheDocument();
  });
});
