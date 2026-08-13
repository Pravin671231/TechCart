import type { ReactNode } from "react";
import { useAppSelector } from "@/app/store/hooks";
import { AdminKeyPrompt } from "./AdminKeyPrompt";

export const AdminKeyGate = ({ children }: { children: ReactNode }) => {
  const adminKey = useAppSelector((state) => state.auth.adminKey);

  if (!adminKey) {
    return <AdminKeyPrompt />;
  }

  return <>{children}</>;
};
