import { BrowserRouter } from "react-router";
import { Provider } from "react-redux";
import { store } from "@/app/store/store";
import { AdminKeyGate } from "@/features/adminKey/AdminKeyGate";
import { MainRoutes } from "@/routes/mainRoutes";

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AdminKeyGate>
          <MainRoutes />
        </AdminKeyGate>
      </BrowserRouter>
    </Provider>
  );
}
