import type { ReactNode } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/app/store/store";
import { AdminKeyPrompt } from "./AdminKeyPrompt";

export function AdminKeyGate({ children }: { children: ReactNode }) {
  const adminKey = useSelector((state: RootState) => state.auth.adminKey);

  if (!adminKey) {
    return <AdminKeyPrompt />;
  }

  return <>{children}</>;
}
