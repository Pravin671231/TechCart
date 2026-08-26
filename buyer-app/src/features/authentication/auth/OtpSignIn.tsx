"use client";

import { useState, useEffect } from "react";
import { useSendOtpMutation, useVerifyOtpMutation } from "./api";
import type { NormalizedApiError } from "@/store/api";

type OtpStep = "email" | "code";

export function OtpSignIn() {
  const [step, setStep] = useState<OtpStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [sendOtp, { isLoading: isSendingOtp }] = useSendOtpMutation();
  const [verifyOtp, { isLoading: isVerifyingOtp }] = useVerifyOtpMutation();

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    try {
      await sendOtp({ email }).unwrap();
      setStep("code");
      setResendCountdown(30);
    } catch (err) {
      const error = err as NormalizedApiError;
      setEmailError(error?.message || "Failed to send OTP. Please try again.");
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);

    try {
      await verifyOtp({ email, otp }).unwrap();
    } catch (err) {
      const error = err as NormalizedApiError;
      const code = error?.code;

      if (code === "GOOGLE_ACCOUNT_IS_ADMIN") {
        setCodeError("This email is registered as an admin account. Please sign in as a buyer instead.");
      } else if (code === "INVALID_OTP") {
        // Better Auth's emailOTP plugin actually returns "INVALID_OTP", not "OTP_INVALID".
        setCodeError("The OTP you entered is invalid. Please try again.");
      } else if (code === "OTP_EXPIRED") {
        setCodeError("The OTP has expired. Please request a new one.");
      } else {
        setCodeError(error?.message || "Failed to verify OTP. Please try again.");
      }
    }
  };

  const handleResendOtp = async () => {
    setCodeError(null);
    try {
      await sendOtp({ email }).unwrap();
      setResendCountdown(30);
    } catch (err) {
      const error = err as NormalizedApiError;
      setCodeError(error?.message || "Failed to resend OTP. Please try again.");
    }
  };

  return (
    <div className="w-full max-w-sm">
      {step === "email" ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="you@example.com"
            />
          </div>
          {emailError && <p className="text-sm text-red-600">{emailError}</p>}
          <button
            type="submit"
            disabled={isSendingOtp}
            className="w-full bg-primary text-white py-2 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {isSendingOtp ? "Sending..." : "Send OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter the 6-digit code sent to <strong>{email}</strong>
          </p>
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
              Verification Code
            </label>
            <input
              id="otp"
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              maxLength={6}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-center text-2xl tracking-widest"
              placeholder="000000"
            />
          </div>
          {codeError && <p className="text-sm text-red-600">{codeError}</p>}
          <button
            type="submit"
            disabled={isVerifyingOtp || otp.length !== 6}
            className="w-full bg-primary text-white py-2 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {isVerifyingOtp ? "Verifying..." : "Verify & Sign In"}
          </button>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendCountdown > 0 || isSendingOtp}
            className="w-full py-2 text-sm text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend OTP"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setOtp("");
              setCodeError(null);
            }}
            className="w-full py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Use different email
          </button>
        </form>
      )}
    </div>
  );
}
