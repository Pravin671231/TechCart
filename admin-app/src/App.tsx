import { BrowserRouter } from "react-router";
import { Provider } from "react-redux";
import { Toaster } from "sonner";
import { store } from "@/app/store/store";
import { MainRoutes } from "@/routes/mainRoutes";

const App = () => {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <MainRoutes />
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </Provider>
  );
};

export default App;
