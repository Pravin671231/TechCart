import { useNavigate } from "react-router";
import { Button } from "@/components/ui/Button";
import { useSignOutMutation } from "./api";

export const NoAccess = () => {
  const navigate = useNavigate();
  const [signOut, { isLoading }] = useSignOutMutation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/sign-in", { replace: true });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">No access</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        You don&apos;t have access to the admin console. Contact a super admin if you believe this
        is a mistake.
      </p>
      <Button variant="outline" onClick={handleSignOut} loading={isLoading} loadingLabel="Signing out…">
        Sign out
      </Button>
    </main>
  );
};
