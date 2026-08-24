import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { renderWithStore } from "../../utils/renderWithStore";
import { AccountPage } from "@/features/account/AccountPage";

const CHANGE_PASSWORD_URL = "http://localhost:4000/api/account/change-password";

function fillAndSubmit(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));
}

describe("AccountPage", () => {
  it("changes the password on the happy path and clears the form", async () => {
    server.use(
      http.post(CHANGE_PASSWORD_URL, () =>
        HttpResponse.json({ success: true, data: { changed: true } }),
      ),
    );

    renderWithStore(<AccountPage />);
    fillAndSubmit("OldPassw0rd!", "NewPassw0rd!", "NewPassw0rd!");

    expect(await screen.findByText("Password changed successfully.")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
  });

  it("shows a distinct message for an incorrect current password", async () => {
    server.use(
      http.post(CHANGE_PASSWORD_URL, () =>
        HttpResponse.json(
          { success: false, code: "INVALID_CURRENT_PASSWORD", message: "Current password is incorrect." },
          { status: 401 },
        ),
      ),
    );

    renderWithStore(<AccountPage />);
    fillAndSubmit("WrongPassword!", "NewPassw0rd!", "NewPassw0rd!");

    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
  });

  it("rejects a mismatched confirmation without calling the API", async () => {
    let calls = 0;
    server.use(
      http.post(CHANGE_PASSWORD_URL, () => {
        calls += 1;
        return HttpResponse.json({ success: true, data: { changed: true } });
      }),
    );

    renderWithStore(<AccountPage />);
    fillAndSubmit("OldPassw0rd!", "NewPassw0rd!", "Mismatch!");

    expect(await screen.findByText("New password and confirmation don't match.")).toBeInTheDocument();
    expect(calls).toBe(0);
  });
});
