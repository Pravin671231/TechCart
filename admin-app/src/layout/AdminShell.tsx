import { Header } from "@/layout/Header";
import { MainSection } from "@/layout/MainSection";
import { Sidebar } from "@/layout/Sidebar";

export function AdminShell() {
  return (
    <div className="flex h-screen">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Header />
        <MainSection />
      </div>
    </div>
  );
}
