import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";
import { createStore } from "@/app/store/store";
import { SignInContent } from "@/features/authentication/auth/SignInContent";
import { clearToken, getToken } from "@/features/authentication/auth/tokenStorage";

const BASE = "http://localhost:4000/api/auth";

function renderSignIn() {
  const testStore = createStore();
  return render(
    <Provider store={testStore}>
      <MemoryRouter initialEntries={["/sign-in"]}>
        <Routes>
          <Route path="/sign-in" element={<SignInContent />} />
          <Route path="/" element={<div>Home content</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

function setUnauthenticatedSession() {
  server.use(
    http.get(`${BASE}/get-session`, () => {
      return HttpResponse.json({ success: true, data: { user: null } });
    }),
  );
}

async function submitPassword(email = "admin@example.com", password = "correct-password") {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("SignInContent", () => {
  afterEach(() => {
    clearToken();
  });

  it("completes the password -> OTP happy path and redirects home", async () => {
    setUnauthenticatedSession();
    let verified = false;

    server.use(
      http.get(`${BASE}/get-session`, () => {
        return HttpResponse.json({
          success: true,
          data: verified ? { user: { id: "u1", name: "Admin", email: "admin@example.com", role: "catalog-manager" } } : { user: null },
        });
      }),
      http.post(`${BASE}/sign-in/email`, () => {
        return HttpResponse.json({ success: true, data: { code: "OTP_REQUIRED" } });
      }),
      http.post(`${BASE}/two-factor/verify-otp`, () => {
        verified = true;
        return HttpResponse.json(
          { success: true, data: { user: { id: "u1", name: "Admin", email: "admin@example.com", role: "catalog-manager" } } },
          { headers: { "set-auth-token": "real-token" } },
        );
      }),
    );

    renderSignIn();
    await submitPassword();

    fireEvent.change(await screen.findByLabelText("Verification code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify & sign in" }));

    expect(await screen.findByText("Home content")).toBeInTheDocument();
    expect(getToken()).toBe("real-token");
  });

  it("shows a distinct message for an incorrect password", async () => {
    setUnauthenticatedSession();
    server.use(
      http.post(`${BASE}/sign-in/email`, () => {
        return HttpResponse.json(
          { success: false, code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password." },
          { status: 401 },
        );
      }),
    );

    renderSignIn();
    await submitPassword();

    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
  });

  it("shows a distinct message for a deactivated account", async () => {
    setUnauthenticatedSession();
    server.use(
      http.post(`${BASE}/sign-in/email`, () => {
        return HttpResponse.json(
          { success: false, code: "ACCOUNT_DEACTIVATED", message: "This account has been deactivated." },
          { status: 403 },
        );
      }),
    );

    renderSignIn();
    await submitPassword();

    expect(
      await screen.findByText("This account has been deactivated. Contact a super admin."),
    ).toBeInTheDocument();
  });

  it("shows a distinct message when rate limited", async () => {
    setUnauthenticatedSession();
    server.use(
      http.post(`${BASE}/sign-in/email`, () => {
        return HttpResponse.json(
          { success: false, code: "RATE_LIMITED", message: "Too many attempts." },
          { status: 429 },
        );
      }),
    );

    renderSignIn();
    await submitPassword();

    expect(
      await screen.findByText("Too many attempts. Please wait a while before trying again."),
    ).toBeInTheDocument();
  });

  it("shows a distinct message for an invalid OTP code", async () => {
    setUnauthenticatedSession();
    server.use(
      http.post(`${BASE}/sign-in/email`, () => {
        return HttpResponse.json({ success: true, data: { code: "OTP_REQUIRED" } });
      }),
      http.post(`${BASE}/two-factor/verify-otp`, () => {
        return HttpResponse.json(
          { success: false, code: "INVALID_CODE", message: "Invalid code." },
          { status: 401 },
        );
      }),
    );

    renderSignIn();
    await submitPassword();
    fireEvent.change(await screen.findByLabelText("Verification code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify & sign in" }));

    expect(
      await screen.findByText("The code you entered is incorrect. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows a distinct message for an expired OTP code", async () => {
    setUnauthenticatedSession();
    server.use(
      http.post(`${BASE}/sign-in/email`, () => {
        return HttpResponse.json({ success: true, data: { code: "OTP_REQUIRED" } });
      }),
      http.post(`${BASE}/two-factor/verify-otp`, () => {
        return HttpResponse.json(
          { success: false, code: "OTP_HAS_EXPIRED", message: "Code expired." },
          { status: 401 },
        );
      }),
    );

    renderSignIn();
    await submitPassword();
    fireEvent.change(await screen.findByLabelText("Verification code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify & sign in" }));

    expect(await screen.findByText("This code has expired. Request a new one.")).toBeInTheDocument();
  });

  it("disables Resend during the cooldown and re-enables once it elapses", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setUnauthenticatedSession();
    server.use(
      http.post(`${BASE}/sign-in/email`, () => {
        return HttpResponse.json({ success: true, data: { code: "OTP_REQUIRED" } });
      }),
      http.post(`${BASE}/two-factor/send-otp`, () => {
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    renderSignIn();
    await submitPassword();
    await screen.findByLabelText("Verification code");

    expect(screen.getByRole("button", { name: /Resend code in \d+s/ })).toBeDisabled();

    await vi.advanceTimersByTimeAsync(30_000);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resend code" })).not.toBeDisabled();
    });

    vi.useRealTimers();
  });
});
