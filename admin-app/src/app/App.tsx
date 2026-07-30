import { BrowserRouter } from "react-router";
import { AppRoutes } from "@/router/AppRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
