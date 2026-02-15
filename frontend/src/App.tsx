import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactKeycloakProvider } from "@react-keycloak/web";
import keycloak from "./lib/keycloak";
import Navbar from "./components/layout/Navbar";
import AdminLayout from "./components/layout/AdminLayout";
import HomePage from "./pages/Home/HomePage";
import Dashboard from "./pages/Admin/Dashboard";
import UserManagement from "./pages/Admin/UserManagement";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
const PublicLayout = () => {
  return (
    <>
      <Navbar />
      <div className="min-h-screen">
        <Outlet />
      </div>
    </>
  );
};

function App() {
  return (
    <ReactKeycloakProvider
      authClient={keycloak}
      initOptions={{
        onLoad: "check-sso",
        silentCheckSsoRedirectUri:
          window.location.origin + "/silent-check-sso.html",
        checkLoginIframe: false,
        pkceMethod: "S256",
      }}
      onEvent={(event, error) => {
        if (event === "onAuthError")
          console.error("Keycloak Auth Error:", error);
      }}
    >
      <QueryClientProvider client={queryClient}>
        <Router
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
            </Route>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route
                path="organizers"
                element={
                  <div className="p-8 text-xl font-bold">
                    Giao diện Duyệt Ban Tổ chức
                  </div>
                }
              />
              <Route
                path="events"
                element={
                  <div className="p-8 text-xl font-bold">
                    Giao diện Quản lý Sự kiện
                  </div>
                }
              />
              <Route
                path="orders"
                element={
                  <div className="p-8 text-xl font-bold">
                    Giao diện Quản lý Đơn hàng (Đang xây dựng)
                  </div>
                }
              />
            </Route>
          </Routes>
        </Router>
      </QueryClientProvider>
    </ReactKeycloakProvider>
  );
}

export default App;
