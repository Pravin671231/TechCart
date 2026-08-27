import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { TextField } from "@/components/form/FormField";
import { useSendOtpMutation, useVerifyOtpMutation } from "./api";
import { describeAuthError } from "./describeAuthError";

const RESEND_COOLDOWN_SECONDS = 30;

export interface OtpVerifyProps {
  email: string;
  onVerified: () => void;
  onStartOver: () => void;
}

export const OtpVerify = ({ email, onVerified, onStartOver }: OtpVerifyProps) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(RESEND_COOLDOWN_SECONDS);

  const [sendOtp, { isLoading: isResending }] = useSendOtpMutation();
  const [verifyOtp, { isLoading: isVerifying }] = useVerifyOtpMutation();

  // The password step (POST /sign-in/email) establishes the pending 2FA
  // challenge cookie but does not mint an OTP — the backend's
  // /two-factor/send-otp step does (auth.controller.ts). Fire it once when
  // this step opens; the ref guard keeps StrictMode's double-mount from
  // sending twice. "Resend code" reuses the same mutation afterwards.
  const initialSendFired = useRef(false);
  useEffect(() => {
    if (initialSendFired.current) return;
    initialSendFired.current = true;
    sendOtp()
      .unwrap()
      .catch((err) => {
        setError(describeAuthError(err, "Unable to send a verification code. Please try again."));
        setResendCountdown(0);
      });
  }, [sendOtp]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => setResendCountdown((count) => count - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await verifyOtp({ code }).unwrap();
      onVerified();
    } catch (err) {
      setError(describeAuthError(err, "Unable to verify the code. Please try again."));
    }
  };

  const handleResend = async () => {
    setError(null);
    try {
      await sendOtp().unwrap();
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(describeAuthError(err, "Unable to resend the code. Please try again."));
    }
  };

  return (
    <form onSubmit={handleVerify} className="w-full max-w-sm space-y-4">
      <p className="text-sm text-neutral-600">
        Enter the 6-digit code sent to <strong>{email}</strong>
      </p>
      <TextField
        id="otp-code"
        label="Verification code"
        type="text"
        inputMode="numeric"
        maxLength={6}
        required
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        className="text-center text-2xl tracking-widest"
      />
      {error && <InlineAlert>{error}</InlineAlert>}
      <Button
        type="submit"
        loading={isVerifying}
        loadingLabel="Verifying…"
        disabled={code.length !== 6}
        className="w-full"
      >
        Verify &amp; sign in
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={handleResend}
        disabled={resendCountdown > 0 || isResending}
        className="w-full"
      >
        {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : "Resend code"}
      </Button>
      <Button type="button" variant="secondary" onClick={onStartOver} className="w-full">
        Use a different account
      </Button>
    </form>
  );
};
