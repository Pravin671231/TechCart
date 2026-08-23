import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { makeStore } from "@/store/store";
import { server } from "./mocks/server";
import { SignInContent } from "@/features/auth/SignInContent";
import { AuthStatus } from "@/components/layout/AuthStatus";

const API_URL = "http://localhost:4000";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("Auth", () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    store = makeStore();
    localStorage.clear();
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  describe("GoogleSignIn", () => {
    it("renders Google button container", async () => {
      render(
        <Provider store={store}>
          <SignInContent />
        </Provider>
      );

      const buttonContainer = screen.getByRole("heading", { name: /sign in with google/i });
      expect(buttonContainer).toBeInTheDocument();
    });
  });

  describe("OtpSignIn", () => {
    it("renders email input initially", async () => {
      render(
        <Provider store={store}>
          <SignInContent />
        </Provider>
      );

      const emailLabel = screen.getByLabelText(/email address/i);
      expect(emailLabel).toBeInTheDocument();
    });

    it("sends OTP and shows code entry step", async () => {
      server.use(
        http.post("*/api/auth/email-otp/send-verification-otp", () => {
          return HttpResponse.json({
            success: true,
            data: null,
          });
        })
      );

      render(
        <Provider store={store}>
          <SignInContent />
        </Provider>
      );

      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      const sendButton = screen.getByRole("button", { name: /send otp/i });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });
    });

    it("shows resend countdown after OTP send", async () => {
      server.use(
        http.post("*/api/auth/email-otp/send-verification-otp", () => {
          return HttpResponse.json({
            success: true,
            data: null,
          });
        })
      );

      render(
        <Provider store={store}>
          <SignInContent />
        </Provider>
      );

      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      const sendButton = screen.getByRole("button", { name: /send otp/i });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        const resendButton = screen.getByRole("button", { name: /resend in \d+s/i });
        expect(resendButton).toBeDisabled();
      });
    });

    it("verifies OTP and persists token, then redirects home", async () => {
      server.use(
        http.post("*/api/auth/email-otp/send-verification-otp", () => {
          return HttpResponse.json({
            success: true,
            data: null,
          });
        }),
        http.post("*/api/auth/sign-in/email-otp", () => {
          return HttpResponse.json(
            {
              success: true,
              data: { id: "user1", name: "Test User", email: "test@example.com", role: "buyer" },
            },
            {
              headers: {
                "set-auth-token": "test_token_123",
              },
            }
          );
        }),
        http.get("*/api/auth/get-session", () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: {
                id: "user1",
                name: "Test User",
                email: "test@example.com",
                role: "buyer",
              },
            },
          });
        })
      );

      render(
        <Provider store={store}>
          <SignInContent />
        </Provider>
      );

      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(screen.getByRole("button", { name: /send otp/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });

      const codeInput = screen.getByPlaceholderText(/000000/i);
      fireEvent.change(codeInput, { target: { value: "123456" } });
      fireEvent.click(screen.getByRole("button", { name: /verify & sign in/i }));

      await waitFor(() => {
        const token = localStorage.getItem("auth_token");
        expect(token).toBe("test_token_123");
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/");
      });
    });

    it("shows GOOGLE_ACCOUNT_IS_ADMIN error message", async () => {
      server.use(
        http.get("*/api/auth/get-session", () => {
          return HttpResponse.json({
            success: true,
            data: { user: null },
          });
        }),
        http.post("*/api/auth/email-otp/send-verification-otp", () => {
          return HttpResponse.json({
            success: true,
            data: null,
          });
        }),
        http.post("*/api/auth/sign-in/email-otp", () => {
          return HttpResponse.json(
            {
              success: false,
              code: "GOOGLE_ACCOUNT_IS_ADMIN",
              message: "This account is an admin account",
            },
            { status: 400 }
          );
        })
      );

      render(
        <Provider store={store}>
          <SignInContent />
        </Provider>
      );

      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      fireEvent.change(emailInput, { target: { value: "admin@example.com" } });
      fireEvent.click(screen.getByRole("button", { name: /send otp/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });

      const codeInput = screen.getByPlaceholderText(/000000/i);
      fireEvent.change(codeInput, { target: { value: "123456" } });
      fireEvent.click(screen.getByRole("button", { name: /verify & sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/registered as an admin account/i)).toBeInTheDocument();
      });
    });

    it("shows OTP_INVALID error message", async () => {
      server.use(
        http.get("*/api/auth/get-session", () => {
          return HttpResponse.json({
            success: true,
            data: { user: null },
          });
        }),
        http.post("*/api/auth/email-otp/send-verification-otp", () => {
          return HttpResponse.json({
            success: true,
            data: null,
          });
        }),
        http.post("*/api/auth/sign-in/email-otp", () => {
          return HttpResponse.json(
            {
              success: false,
              code: "OTP_INVALID",
              message: "Invalid OTP",
            },
            { status: 400 }
          );
        })
      );

      render(
        <Provider store={store}>
          <SignInContent />
        </Provider>
      );

      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(screen.getByRole("button", { name: /send otp/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });

      const codeInput = screen.getByPlaceholderText(/000000/i);
      fireEvent.change(codeInput, { target: { value: "000000" } });
      fireEvent.click(screen.getByRole("button", { name: /verify & sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/OTP you entered is invalid/i)).toBeInTheDocument();
      });
    });

    it("shows OTP_EXPIRED error message", async () => {
      server.use(
        http.get("*/api/auth/get-session", () => {
          return HttpResponse.json({
            success: true,
            data: { user: null },
          });
        }),
        http.post("*/api/auth/email-otp/send-verification-otp", () => {
          return HttpResponse.json({
            success: true,
            data: null,
          });
        }),
        http.post("*/api/auth/sign-in/email-otp", () => {
          return HttpResponse.json(
            {
              success: false,
              code: "OTP_EXPIRED",
              message: "OTP expired",
            },
            { status: 400 }
          );
        })
      );

      render(
        <Provider store={store}>
          <SignInContent />
        </Provider>
      );

      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(screen.getByRole("button", { name: /send otp/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });

      const codeInput = screen.getByPlaceholderText(/000000/i);
      fireEvent.change(codeInput, { target: { value: "000000" } });
      fireEvent.click(screen.getByRole("button", { name: /verify & sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/OTP has expired/i)).toBeInTheDocument();
      });
    });
  });

  describe("AuthStatus", () => {
    it("renders sign-in link when not authenticated", async () => {
      server.use(
        http.get("*/api/auth/get-session", () => {
          return HttpResponse.json({
            success: true,
            data: { user: null },
          });
        })
      );

      render(
        <Provider store={store}>
          <AuthStatus />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
      });
    });

    it("renders user name and sign-out button when authenticated", async () => {
      server.use(
        http.get("*/api/auth/get-session", () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: {
                id: "user1",
                name: "John Doe",
                email: "john@example.com",
                role: "buyer",
              },
            },
          });
        })
      );

      render(
        <Provider store={store}>
          <AuthStatus />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
      });
    });

    it("sign out clears token and navigates home", async () => {
      localStorage.setItem("auth_token", "test_token");
      mockPush.mockClear();

      server.use(
        http.get("*/api/auth/get-session", () => {
          return HttpResponse.json({
            success: true,
            data: {
              user: {
                id: "user1",
                name: "John Doe",
                email: "john@example.com",
                role: "buyer",
              },
            },
          });
        }),
        http.post("*/api/auth/sign-out", () => {
          return HttpResponse.json({
            success: true,
            data: null,
          });
        })
      );

      render(
        <Provider store={store}>
          <AuthStatus />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
      });

      const signOutButton = screen.getByRole("button", { name: /sign out/i });
      fireEvent.click(signOutButton);

      await waitFor(() => {
        expect(localStorage.getItem("auth_token")).toBeNull();
        expect(mockPush).toHaveBeenCalledWith("/");
      });
    });
  });
});
