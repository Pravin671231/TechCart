import { useState, type FormEvent } from "react";
import { getApiErrorEnvelope } from "@/app/api/apiError";
import { Button } from "@/components/ui/Button";
import { Card, CardHeading } from "@/components/ui/Card";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/layout/PageHeader";
import { TextField } from "@/components/form/FormField";
import { useChangePasswordMutation } from "./accountApi";

function describeChangePasswordError(error: unknown): string {
  const envelope = getApiErrorEnvelope(error);
  if (envelope?.code === "INVALID_CURRENT_PASSWORD") {
    return "Current password is incorrect.";
  }
  return envelope?.message ?? "Unable to change password. Please try again.";
}

export const AccountPage = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [changePassword, { isLoading }] = useChangePasswordMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(describeChangePasswordError(err));
    }
  }

  return (
    <main className="p-6">
      <PageHeader title="My Account" />

      <Card className="max-w-md">
        <CardHeading>Change password</CardHeading>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            id="current-password"
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <TextField
            id="new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <TextField
            id="confirm-password"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />

          {error && <InlineAlert>{error}</InlineAlert>}
          {success && (
            <p role="status" className="text-sm text-green-700">
              Password changed successfully.
            </p>
          )}

          <Button type="submit" loading={isLoading} loadingLabel="Changing…">
            Change password
          </Button>
        </form>
      </Card>
    </main>
  );
};
