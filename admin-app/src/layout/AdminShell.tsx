import { useState } from "react";
import { Header } from "@/layout/Header";
import { MainSection } from "@/layout/MainSection";
import { Sidebar } from "@/layout/Sidebar";

export function AdminShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen gap-2 bg-neutral-100 p-2">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Header onToggleSidebar={() => setIsSidebarOpen((open) => !open)} />
        <MainSection />
      </div>
    </div>
  );
}
