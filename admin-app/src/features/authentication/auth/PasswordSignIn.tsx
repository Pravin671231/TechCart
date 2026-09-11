import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { useSignInPasswordMutation } from "./api";
import { describeAuthError } from "./describeAuthError";

export interface PasswordSignInProps {
  onOtpRequired: (email: string) => void;
}

export const PasswordSignIn = ({ onOtpRequired }: PasswordSignInProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="field-input mt-1 w-full px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Password
        </label>
        <div className="relative mt-1">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field-input w-full px-3 py-2 pr-10 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {error && <InlineAlert>{error}</InlineAlert>}
      <Button type="submit" loading={isLoading} loadingLabel="Signing in…" className="w-full">
        Sign in
      </Button>
    </form>
  );
};
