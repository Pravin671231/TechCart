import { BrowserRouter } from "react-router";
import { Provider } from "react-redux";
import { Toaster } from "sonner";
import { store } from "@/app/store/store";
import { AdminKeyGate } from "@/features/adminKey/AdminKeyGate";
import { MainRoutes } from "@/routes/mainRoutes";

const App = () => {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AdminKeyGate>
          <MainRoutes />
        </AdminKeyGate>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </Provider>
  );
};

export default App;
