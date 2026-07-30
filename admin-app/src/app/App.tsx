import { BrowserRouter, Route, Routes } from "react-router";
import { AdminShell } from "@/layout/AdminShell";
import { LandingPlaceholder } from "@/features/landing/LandingPlaceholder";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AdminShell />}>
          <Route path="/" element={<LandingPlaceholder />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
