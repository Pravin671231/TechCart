import { useState, type FormEvent } from "react";
import { getApiErrorEnvelope } from "@/app/api/apiError";
import { Button } from "@/components/ui/Button";
import { Card, CardHeading } from "@/components/ui/Card";
import { TextField, SelectField } from "@/components/form/FormField";
import { ADMIN_ROLES, type AdminRole } from "@/features/authentication/auth/adminRoles";
import { useCreateAdminUserMutation } from "./adminUsersApi";

export interface AdminUserFormProps {
  onSaved: () => void;
  onCancel: () => void;
}

export const AdminUserForm = ({ onSaved, onCancel }: AdminUserFormProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>(ADMIN_ROLES[0]);

  const [createAdminUser, { isLoading, error }] = useCreateAdminUserMutation();
  const saveError = getApiErrorEnvelope(error);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) return;

    try {
      await createAdminUser({ name: trimmedName, email: trimmedEmail, role }).unwrap();
      onSaved();
    } catch {
      // surfaced via saveError below
    }
  }

  return (
    <Card className="w-full shrink-0 xl:w-96">
      <CardHeading>New admin</CardHeading>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          id="admin-user-name"
          label="Name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

        <TextField
          id="admin-user-email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <SelectField
          id="admin-user-role"
          label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value as AdminRole)}
        >
          {ADMIN_ROLES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>

        {saveError && (
          <p role="alert" className="text-[11px] text-red-600">
            {saveError.message ?? "Unable to create admin."}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" loading={isLoading} loadingLabel="Creating…">
            Create
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
};
