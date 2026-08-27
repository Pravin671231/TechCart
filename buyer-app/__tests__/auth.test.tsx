import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { server } from "./mocks/server";

const API_URL = "http://localhost:4000";

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/sign-in",
  useSearchParams: () => mockSearchParams,
}));

describe("Auth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    localStorage.clear();
    mockPush.mockClear();
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  describe("GoogleSignIn", () => {
    it("renders Google button container", async () => {
      const { makeStore } = await import("@/store/store");
      const { SignInContent } = await import("@/features/authentication/auth/SignInContent");
      const store = makeStore();

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
      const { makeStore } = await import("@/store/store");
      const { SignInContent } = await import("@/features/authentication/auth/SignInContent");
      const store = makeStore();

      render(
        <Provider store={store}>
          <SignInContent />
        </Provider>
      );

      const emailLabel = screen.getByLabelText(/email address/i);
      expect(emailLabel).toBeInTheDocument();
    });

    it("sends OTP and shows code entry step", async () => {
      const { makeStore } = await import("@/store/store");
      const { SignInContent } = await import("@/features/authentication/auth/SignInContent");
      const store = makeStore();

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
      const { makeStore } = await import("@/store/store");
      const { SignInContent } = await import("@/features/authentication/auth/SignInContent");
      const store = makeStore();

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
      const { makeStore } = await import("@/store/store");
      const { SignInContent } = await import("@/features/authentication/auth/SignInContent");
      const store = makeStore();

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

    it("redirects to a safe ?redirect= target once a session exists", async () => {
      mockSearchParams = new URLSearchParams("redirect=/cart");
      const { makeStore } = await import("@/store/store");
      const { SignInContent } = await import("@/features/authentication/auth/SignInContent");

      server.use(
        http.get("*/api/auth/get-session", () =>
          HttpResponse.json({
            success: true,
            data: { user: { id: "user1", name: "T", email: "t@example.com", role: "buyer" } },
          }),
        ),
      );

      render(
        <Provider store={makeStore()}>
          <SignInContent />
        </Provider>,
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/cart");
      });
    });

    it("falls back to home for an unsafe (protocol-relative) ?redirect= value", async () => {
      mockSearchParams = new URLSearchParams("redirect=//evil.example.com");
      const { makeStore } = await import("@/store/store");
      const { SignInContent } = await import("@/features/authentication/auth/SignInContent");

      server.use(
        http.get("*/api/auth/get-session", () =>
          HttpResponse.json({
            success: true,
            data: { user: { id: "user1", name: "T", email: "t@example.com", role: "buyer" } },
          }),
        ),
      );

      render(
        <Provider store={makeStore()}>
          <SignInContent />
        </Provider>,
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/");
      });
    });

    it("shows GOOGLE_ACCOUNT_IS_ADMIN error message", async () => {
      const { makeStore } = await import("@/store/store");
      const { SignInContent } = await import("@/features/authentication/auth/SignInContent");
      const store = makeStore();

      server.use(
        http.get("*/api/auth/get-session", () => {
          return HttpResponse.json({
            success: true,
            data: null,
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
            { status: 403 }
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

    it("shows INVALID_OTP error message", async () => {
      const { makeStore } = await import("@/store/store");
      const { SignInContent } = await import("@/features/authentication/auth/SignInContent");
      const store = makeStore();

      server.use(
        http.get("*/api/auth/get-session", () => {
          return HttpResponse.json({
            success: true,
            data: null,
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
              code: "INVALID_OTP",
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

    it("shows a resend failure message distinct from the generic fallback", async () => {
      const { makeStore } = await import("@/store/store");
      const { SignInContent } = await import("@/features/authentication/auth/SignInContent");
      const store = makeStore();

      vi.useFakeTimers({ shouldAdvanceTime: true });

      let sendCount = 0;
      server.use(
        http.get("*/api/auth/get-session", () => {
          return HttpResponse.json({ success: true, data: null });
        }),
        http.post("*/api/auth/email-otp/send-verification-otp", () => {
          sendCount += 1;
          if (sendCount === 1) {
            return HttpResponse.json({ success: true, data: null });
          }
          return HttpResponse.json(
            { success: false, code: "RATE_LIMITED", message: "Too many attempts, try later" },
            { status: 429 }
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
        expect(screen.getByRole("button", { name: /resend in \d+s/i })).toBeInTheDocument();
      });

      await vi.advanceTimersByTimeAsync(30_000);

      const resendButton = await screen.findByRole("button", { name: /^resend otp$/i });
      fireEvent.click(resendButton);

      await waitFor(() => {
        expect(screen.getByText(/too many attempts, try later/i)).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it("shows OTP_EXPIRED error message", async () => {
      const { makeStore } = await import("@/store/store");
      const { SignInContent } = await import("@/features/authentication/auth/SignInContent");
      const store = makeStore();

      server.use(
        http.get("*/api/auth/get-session", () => {
          return HttpResponse.json({
            success: true,
            data: null,
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
      const { makeStore } = await import("@/store/store");
      const { AuthStatus } = await import("@/components/layout/AuthStatus");
      const store = makeStore();

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
      const { makeStore } = await import("@/store/store");
      const { AuthStatus } = await import("@/components/layout/AuthStatus");
      const store = makeStore();

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
      const { makeStore } = await import("@/store/store");
      const { AuthStatus } = await import("@/components/layout/AuthStatus");
      const store = makeStore();

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
