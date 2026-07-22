import { BrowserRouter, Route, Routes } from "react-router";
import { LandingPlaceholder } from "@/features/landing/LandingPlaceholder";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPlaceholder />} />
      </Routes>
    </BrowserRouter>
  );
}
