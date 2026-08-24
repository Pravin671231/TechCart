import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { TextField } from "@/components/form/FormField";
import { useSignInPasswordMutation } from "./api";
import { describeAuthError } from "./describeAuthError";

export interface PasswordSignInProps {
  onOtpRequired: (email: string) => void;
}

export const PasswordSignIn = ({ onOtpRequired }: PasswordSignInProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [signInPassword, { isLoading }] = useSignInPasswordMutation();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const { otpRequired } = await signInPassword({ email, password }).unwrap();
      if (otpRequired) {
        onOtpRequired(email);
      } else {
        // Every admin account has twoFactorEnabled:true (backend Issue
        // #140/M3.2) — this branch shouldn't be reachable, but fail loud
        // rather than silently stranding the admin on this form.
        setError("Sign-in did not require a verification code as expected. Please try again.");
      }
    } catch (err) {
      setError(describeAuthError(err, "Unable to sign in. Please try again."));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <TextField
        id="email"
        label="Email"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <TextField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error && <InlineAlert>{error}</InlineAlert>}
      <Button type="submit" loading={isLoading} loadingLabel="Signing in…" className="w-full">
        Sign in
      </Button>
    </form>
  );
};
