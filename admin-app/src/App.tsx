import { BrowserRouter } from "react-router";
import { Provider } from "react-redux";
import { Toaster } from "sonner";
import { store } from "@/app/store/store";
import { MainRoutes } from "@/routes/mainRoutes";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useTheme } from "@/hooks/useTheme";

const AppContent = () => {
  const { theme } = useTheme();

  return (
    <Provider store={store}>
      <BrowserRouter>
        <MainRoutes />
      </BrowserRouter>
      <Toaster theme={theme} richColors position="top-right" />
    </Provider>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
